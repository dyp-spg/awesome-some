/**
 * Symmetry and Pattern Tools for Pixel Art Creator
 *
 * Provides mirror modes, radial symmetry, pattern tiling, and
 * transform utilities.  All data arrays follow the layer.data format:
 * flat arrays of length gridSize*gridSize where index = y * gridSize + x,
 * each element being a hex color string or null.
 */

var SymmetryTool = (function () {

    // ------------------------------------------------------------------
    //  Helpers
    // ------------------------------------------------------------------

    /**
     * Clamp a value to integer grid coordinates [0, gridSize).
     */
    function _clamp(v, gridSize) {
        return Math.max(0, Math.min(gridSize - 1, Math.round(v)));
    }

    /**
     * De-duplicate an array of {x, y} points so each grid cell appears
     * at most once.
     */
    function _unique(points, gridSize) {
        var seen = {};
        var out = [];
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            if (p.x < 0 || p.x >= gridSize || p.y < 0 || p.y >= gridSize) {
                continue;
            }
            var key = p.y * gridSize + p.x;
            if (!seen[key]) {
                seen[key] = true;
                out.push(p);
            }
        }
        return out;
    }

    // ------------------------------------------------------------------
    //  Mirror modes
    // ------------------------------------------------------------------

    /**
     * Mirror across the vertical center line (left <-> right).
     * Returns the original point plus its horizontal mirror.
     */
    function mirrorHorizontal(x, y, gridSize) {
        var mx = gridSize - 1 - x;
        return _unique([
            { x: x, y: y },
            { x: mx, y: y }
        ], gridSize);
    }

    /**
     * Mirror across the horizontal center line (top <-> bottom).
     * Returns the original point plus its vertical mirror.
     */
    function mirrorVertical(x, y, gridSize) {
        var my = gridSize - 1 - y;
        return _unique([
            { x: x, y: y },
            { x: x, y: my }
        ], gridSize);
    }

    /**
     * Mirror across both axes.  Produces up to 4 points.
     */
    function mirrorBoth(x, y, gridSize) {
        var mx = gridSize - 1 - x;
        var my = gridSize - 1 - y;
        return _unique([
            { x: x,  y: y },
            { x: mx, y: y },
            { x: x,  y: my },
            { x: mx, y: my }
        ], gridSize);
    }

    /**
     * Mirror across the main diagonal (y = x).
     * Returns the original point plus its diagonal mirror.
     */
    function mirrorDiagonal(x, y, gridSize) {
        return _unique([
            { x: x, y: y },
            { x: y, y: x }
        ], gridSize);
    }

    // ------------------------------------------------------------------
    //  Radial symmetry
    // ------------------------------------------------------------------

    /**
     * N-fold rotational symmetry around the center of the grid.
     *
     * @param {number} x        - source pixel x
     * @param {number} y        - source pixel y
     * @param {number} gridSize - width/height of the grid
     * @param {number} segments - number of rotational copies (e.g. 2, 3, 4, 6, 8)
     * @returns {Array<{x: number, y: number}>} array of grid-clamped points
     */
    function radial(x, y, gridSize, segments) {
        if (segments < 1) { segments = 1; }

        var cx = gridSize / 2;
        var cy = gridSize / 2;

        // Translate so the center of the grid is the origin.
        var dx = x - cx + 0.5;
        var dy = y - cy + 0.5;

        var angleStep = (2 * Math.PI) / segments;
        var points = [];

        for (var i = 0; i < segments; i++) {
            var angle = angleStep * i;
            var cos = Math.cos(angle);
            var sin = Math.sin(angle);
            var rx = cos * dx - sin * dy;
            var ry = sin * dx + cos * dy;
            points.push({
                x: _clamp(Math.floor(rx + cx - 0.5 + 0.5), gridSize),
                y: _clamp(Math.floor(ry + cy - 0.5 + 0.5), gridSize)
            });
        }

        return _unique(points, gridSize);
    }

    // ------------------------------------------------------------------
    //  Pattern tiling preview
    // ------------------------------------------------------------------

    /**
     * Creates a canvas element that shows the layer data tiled in a grid
     * of tilesX x tilesY.
     *
     * @param {Array}  layerData - flat array of hex strings / null
     * @param {number} gridSize  - pixel art width & height
     * @param {number} tilesX    - how many tiles horizontally
     * @param {number} tilesY    - how many tiles vertically
     * @returns {HTMLCanvasElement}
     */
    function tilePreview(layerData, gridSize, tilesX, tilesY) {
        var pixelSize = 4;   // each pixel-art pixel rendered as 4x4 screen pixels
        var tileW = gridSize * pixelSize;
        var tileH = gridSize * pixelSize;

        var canvas = document.createElement('canvas');
        canvas.width  = tileW * tilesX;
        canvas.height = tileH * tilesY;

        var ctx = canvas.getContext('2d');

        // Draw one tile onto an off-screen canvas first.
        var tileCanvas = document.createElement('canvas');
        tileCanvas.width  = tileW;
        tileCanvas.height = tileH;
        var tileCtx = tileCanvas.getContext('2d');

        for (var py = 0; py < gridSize; py++) {
            for (var px = 0; px < gridSize; px++) {
                var color = layerData[py * gridSize + px];
                if (color) {
                    tileCtx.fillStyle = color;
                    tileCtx.fillRect(px * pixelSize, py * pixelSize, pixelSize, pixelSize);
                }
            }
        }

        // Stamp the tile across the output canvas.
        for (var ty = 0; ty < tilesY; ty++) {
            for (var tx = 0; tx < tilesX; tx++) {
                ctx.drawImage(tileCanvas, tx * tileW, ty * tileH);
            }
        }

        return canvas;
    }

    // ------------------------------------------------------------------
    //  Transform utilities
    // ------------------------------------------------------------------

    /**
     * Rotate the data array 90 degrees clockwise.
     *
     * Mapping: dst(gridSize - 1 - y, x) = src(x, y)
     */
    function rotate90CW(data, gridSize) {
        var out = new Array(gridSize * gridSize).fill(null);
        for (var y = 0; y < gridSize; y++) {
            for (var x = 0; x < gridSize; x++) {
                var srcIdx = y * gridSize + x;
                var dstX = gridSize - 1 - y;
                var dstY = x;
                out[dstY * gridSize + dstX] = data[srcIdx];
            }
        }
        return out;
    }

    /**
     * Rotate the data array 90 degrees counter-clockwise.
     *
     * Mapping: dst(y, gridSize - 1 - x) = src(x, y)
     */
    function rotate90CCW(data, gridSize) {
        var out = new Array(gridSize * gridSize).fill(null);
        for (var y = 0; y < gridSize; y++) {
            for (var x = 0; x < gridSize; x++) {
                var srcIdx = y * gridSize + x;
                var dstX = y;
                var dstY = gridSize - 1 - x;
                out[dstY * gridSize + dstX] = data[srcIdx];
            }
        }
        return out;
    }

    /**
     * Rotate the data array 180 degrees.
     *
     * Mapping: dst(gridSize - 1 - x, gridSize - 1 - y) = src(x, y)
     */
    function rotate180(data, gridSize) {
        var out = new Array(gridSize * gridSize).fill(null);
        for (var y = 0; y < gridSize; y++) {
            for (var x = 0; x < gridSize; x++) {
                var srcIdx = y * gridSize + x;
                var dstX = gridSize - 1 - x;
                var dstY = gridSize - 1 - y;
                out[dstY * gridSize + dstX] = data[srcIdx];
            }
        }
        return out;
    }

    /**
     * Flip the data array horizontally (left <-> right).
     */
    function flipH(data, gridSize) {
        var out = new Array(gridSize * gridSize).fill(null);
        for (var y = 0; y < gridSize; y++) {
            for (var x = 0; x < gridSize; x++) {
                out[y * gridSize + (gridSize - 1 - x)] = data[y * gridSize + x];
            }
        }
        return out;
    }

    /**
     * Flip the data array vertically (top <-> bottom).
     */
    function flipV(data, gridSize) {
        var out = new Array(gridSize * gridSize).fill(null);
        for (var y = 0; y < gridSize; y++) {
            for (var x = 0; x < gridSize; x++) {
                out[(gridSize - 1 - y) * gridSize + x] = data[y * gridSize + x];
            }
        }
        return out;
    }

    // ------------------------------------------------------------------
    //  Public API
    // ------------------------------------------------------------------

    return {
        // Mirror modes
        mirrorHorizontal: mirrorHorizontal,
        mirrorVertical:   mirrorVertical,
        mirrorBoth:       mirrorBoth,
        mirrorDiagonal:   mirrorDiagonal,

        // Radial symmetry
        radial: radial,

        // Pattern tiling
        tilePreview: tilePreview,

        // Transform utilities
        rotate90CW:  rotate90CW,
        rotate90CCW: rotate90CCW,
        rotate180:   rotate180,
        flipH:       flipH,
        flipV:       flipV
    };

})();
