/**
 * Advanced Drawing Tools for Pixel Art Creator
 *
 * Provides geometric shape algorithms (line, rectangle, circle) that operate
 * on the pixel grid. All coordinate-based functions return arrays of {x, y}
 * objects representing the pixels that make up the shape.
 *
 * No modules — plain script scope, intended to be loaded via <script> tag.
 */

const DrawingTools = {

    // -------------------------------------------------------------------
    //  Coordinate helpers
    // -------------------------------------------------------------------

    /**
     * Convert (x, y) grid coordinates to a flat pixel index.
     * Returns -1 if the coordinates are out of bounds.
     */
    coordToIndex(x, y, gridSize) {
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) {
            return -1;
        }
        return y * gridSize + x;
    },

    /**
     * Convert a flat pixel index back to {x, y} grid coordinates.
     * Returns null if the index is out of bounds.
     */
    indexToCoord(index, gridSize) {
        if (index < 0 || index >= gridSize * gridSize) {
            return null;
        }
        return {
            x: index % gridSize,
            y: Math.floor(index / gridSize),
        };
    },

    // -------------------------------------------------------------------
    //  Line — Bresenham's line algorithm
    // -------------------------------------------------------------------

    /**
     * Compute all pixel coordinates along a line from (x0, y0) to (x1, y1).
     *
     * Uses Bresenham's line algorithm for pixel-perfect, non-antialiased output.
     *
     * @param {number} x0 - Start column.
     * @param {number} y0 - Start row.
     * @param {number} x1 - End column.
     * @param {number} y1 - End row.
     * @returns {Array<{x: number, y: number}>} Pixel coordinates along the line.
     */
    line(x0, y0, x1, y1) {
        const pixels = [];

        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        let cx = x0;
        let cy = y0;

        while (true) {
            pixels.push({ x: cx, y: cy });

            if (cx === x1 && cy === y1) {
                break;
            }

            const e2 = 2 * err;

            if (e2 > -dy) {
                err -= dy;
                cx += sx;
            }

            if (e2 < dx) {
                err += dx;
                cy += sy;
            }
        }

        return pixels;
    },

    // -------------------------------------------------------------------
    //  Rectangle
    // -------------------------------------------------------------------

    /**
     * Compute all pixel coordinates for an axis-aligned rectangle.
     *
     * The two corner points (x0, y0) and (x1, y1) can be given in any order;
     * the function normalises them internally.
     *
     * @param {number} x0 - First corner column.
     * @param {number} y0 - First corner row.
     * @param {number} x1 - Opposite corner column.
     * @param {number} y1 - Opposite corner row.
     * @param {boolean} filled - If true, return every pixel inside the
     *     rectangle; otherwise return only the outline.
     * @returns {Array<{x: number, y: number}>}
     */
    rectangle(x0, y0, x1, y1, filled) {
        const pixels = [];

        const minX = Math.min(x0, x1);
        const maxX = Math.max(x0, x1);
        const minY = Math.min(y0, y1);
        const maxY = Math.max(y0, y1);

        if (filled) {
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    pixels.push({ x, y });
                }
            }
        } else {
            // Top and bottom edges
            for (let x = minX; x <= maxX; x++) {
                pixels.push({ x, y: minY });
                if (minY !== maxY) {
                    pixels.push({ x, y: maxY });
                }
            }
            // Left and right edges (excluding corners already added)
            for (let y = minY + 1; y < maxY; y++) {
                pixels.push({ x: minX, y });
                if (minX !== maxX) {
                    pixels.push({ x: maxX, y });
                }
            }
        }

        return pixels;
    },

    // -------------------------------------------------------------------
    //  Circle — Bresenham's (midpoint) circle algorithm
    // -------------------------------------------------------------------

    /**
     * Compute all pixel coordinates for a circle centred at (cx, cy).
     *
     * Uses the midpoint circle algorithm for pixel-perfect output.
     *
     * @param {number} cx     - Centre column.
     * @param {number} cy     - Centre row.
     * @param {number} radius - Radius in pixels (>= 0).
     * @param {boolean} filled - If true, return every pixel inside the circle;
     *     otherwise return only the outline.
     * @returns {Array<{x: number, y: number}>}
     */
    circle(cx, cy, radius, filled) {
        if (radius < 0) {
            return [];
        }

        // Degenerate case: a single pixel.
        if (radius === 0) {
            return [{ x: cx, y: cy }];
        }

        if (filled) {
            return DrawingTools._filledCircle(cx, cy, radius);
        }

        return DrawingTools._outlineCircle(cx, cy, radius);
    },

    /**
     * Internal: outline circle via midpoint algorithm.
     * Plots the eight symmetric octant points for each step.
     */
    _outlineCircle(cx, cy, radius) {
        const set = new Set();
        const pixels = [];

        function plot(px, py) {
            const key = px + ',' + py;
            if (!set.has(key)) {
                set.add(key);
                pixels.push({ x: px, y: py });
            }
        }

        let x = radius;
        let y = 0;
        let d = 1 - radius;

        while (x >= y) {
            plot(cx + x, cy + y);
            plot(cx - x, cy + y);
            plot(cx + x, cy - y);
            plot(cx - x, cy - y);
            plot(cx + y, cy + x);
            plot(cx - y, cy + x);
            plot(cx + y, cy - x);
            plot(cx - y, cy - x);

            y++;

            if (d <= 0) {
                d += 2 * y + 1;
            } else {
                x--;
                d += 2 * (y - x) + 1;
            }
        }

        return pixels;
    },

    /**
     * Internal: filled circle.
     * Draws horizontal spans between symmetric outline points so every
     * interior pixel is included exactly once.
     */
    _filledCircle(cx, cy, radius) {
        const set = new Set();
        const pixels = [];

        function hline(x0, x1, py) {
            const lo = Math.min(x0, x1);
            const hi = Math.max(x0, x1);
            for (let px = lo; px <= hi; px++) {
                const key = px + ',' + py;
                if (!set.has(key)) {
                    set.add(key);
                    pixels.push({ x: px, y: py });
                }
            }
        }

        let x = radius;
        let y = 0;
        let d = 1 - radius;

        while (x >= y) {
            // Fill horizontal spans for all four quadrant pairs.
            hline(cx - x, cx + x, cy + y);
            hline(cx - x, cx + x, cy - y);
            hline(cx - y, cx + y, cy + x);
            hline(cx - y, cx + y, cy - x);

            y++;

            if (d <= 0) {
                d += 2 * y + 1;
            } else {
                x--;
                d += 2 * (y - x) + 1;
            }
        }

        return pixels;
    },

    // -------------------------------------------------------------------
    //  Eyedropper
    // -------------------------------------------------------------------

    /**
     * Sample the composite color at a given pixel index.
     *
     * Returns the fully composited hex color string (accounting for all
     * visible layers and their opacities), or null if the index is invalid.
     *
     * @param {number} index        - Flat pixel index.
     * @param {LayerManager} layerManager - The layer manager instance.
     * @returns {string|null} Hex color string, e.g. '#ff0000', or null.
     */
    eyedropper(index, layerManager) {
        if (!layerManager || index < 0 || index >= layerManager.pixelCount) {
            return null;
        }
        return layerManager.getCompositePixel(index);
    },

    // -------------------------------------------------------------------
    //  Dithering
    // -------------------------------------------------------------------

    /**
     * Check if the pixel at (x, y) should be colored according to
     * the given dithering pattern.
     *
     * @param {number} x        - Column.
     * @param {number} y        - Row.
     * @param {number} gridSize - Grid dimension (used for bounds check).
     * @param {string} pattern  - One of 'checkerboard', 'horizontal',
     *     'vertical', 'diagonal', '25percent', '75percent'.
     * @returns {Array<{x: number, y: number}>} Single-element array if
     *     the pixel should be colored, empty array otherwise.
     */
    dither(x, y, gridSize, pattern) {
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) {
            return [];
        }

        let fill = false;

        switch (pattern) {
            case 'checkerboard':
                fill = (x + y) % 2 === 0;
                break;
            case 'horizontal':
                fill = y % 2 === 0;
                break;
            case 'vertical':
                fill = x % 2 === 0;
                break;
            case 'diagonal':
                fill = (x - y) % 2 === 0;
                break;
            case '25percent':
                fill = x % 2 === 0 && y % 2 === 0;
                break;
            case '75percent':
                fill = !(x % 2 === 1 && y % 2 === 1);
                break;
            default:
                fill = (x + y) % 2 === 0;
                break;
        }

        return fill ? [{ x, y }] : [];
    },

    /**
     * Apply dithering over a brush area centred at (x, y).
     *
     * For each pixel within the brush radius, the dithering pattern is
     * evaluated and only matching pixels are returned.
     *
     * @param {number} x         - Centre column.
     * @param {number} y         - Centre row.
     * @param {number} gridSize  - Grid dimension (used for bounds check).
     * @param {string} pattern   - Dithering pattern name.
     * @param {number} brushSize - 1 = single pixel, 2 = 3x3, 3 = 5x5.
     * @returns {Array<{x: number, y: number}>} Pixels that should be colored.
     */
    ditherBrush(x, y, gridSize, pattern, brushSize) {
        const radius = brushSize - 1; // 1 → 0, 2 → 1, 3 → 2
        const pixels = [];

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const px = x + dx;
                const py = y + dy;
                const result = DrawingTools.dither(px, py, gridSize, pattern);
                if (result.length > 0) {
                    pixels.push(result[0]);
                }
            }
        }

        return pixels;
    },
};
