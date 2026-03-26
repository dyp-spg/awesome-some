/**
 * High-Performance Canvas API Renderer for Pixel Art Creator
 *
 * Replaces the DOM-based grid rendering with a single HTML5 Canvas element.
 * Works with LayerManager to composite and display pixel art efficiently.
 */

class PixelRenderer {
    /**
     * @param {HTMLElement} containerEl - The DOM element to host the canvas.
     * @param {number} gridSize - Number of cells per row/column (e.g. 16 for 16x16).
     */
    constructor(containerEl, gridSize) {
        this.container = containerEl;
        this.gridSize = gridSize;
        this.showGrid = true;
        this.zoom = 1.0;
        this.offset = { x: 0, y: 0 };

        // Maximum canvas dimension in CSS pixels (matches current 560px cap).
        this._maxCanvasWidth = Math.min(560, window.innerWidth - 40);

        // Cell size is computed to fill the container at zoom 1.
        this.cellSize = Math.floor(this._maxCanvasWidth / this.gridSize);

        // Create the canvas element.
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this._applyCanvasSize();
        this.container.appendChild(this.canvas);

        // Snapshot of per-pixel colors used for dirty tracking.
        this._pixelColors = new Array(this.gridSize * this.gridSize).fill('#ffffff');

        // Dirty tracking — indices that need re-painting.
        this._dirtyPixels = new Set();
        this._fullRenderNeeded = true;

        // requestAnimationFrame state.
        this._rafId = null;
        this._rafBound = this._rafLoop.bind(this);
    }

    // -------------------------------------------------------------------
    //  Canvas management
    // -------------------------------------------------------------------

    /**
     * Recalculate internal dimensions and resize the canvas element.
     * @param {number} gridSize - New grid dimension.
     */
    resize(gridSize) {
        this.gridSize = gridSize;
        this._maxCanvasWidth = Math.min(560, window.innerWidth - 40);
        this.cellSize = Math.floor(this._maxCanvasWidth / this.gridSize);
        this._applyCanvasSize();
        this._pixelColors = new Array(this.gridSize * this.gridSize).fill('#ffffff');
        this._fullRenderNeeded = true;
    }

    /**
     * Set the zoom level, clamped between 0.5 and 4.0.
     * @param {number} level
     */
    setZoom(level) {
        this.zoom = Math.max(0.5, Math.min(4.0, level));
        this._applyCanvasSize();
        this._fullRenderNeeded = true;
    }

    /**
     * Set the pan offset (in CSS pixels).
     * @param {number} x
     * @param {number} y
     */
    setOffset(x, y) {
        this.offset.x = x;
        this.offset.y = y;
        this._fullRenderNeeded = true;
    }

    /**
     * Return the pixel index at the given client coordinates, or -1 if outside
     * the grid.  This is a convenience wrapper around screenToPixel().
     * @param {number} clientX
     * @param {number} clientY
     * @returns {number} Pixel index (row * gridSize + col) or -1.
     */
    getPixelAtPoint(clientX, clientY) {
        const coord = this.screenToPixel(clientX, clientY);
        if (coord.x < 0 || coord.x >= this.gridSize || coord.y < 0 || coord.y >= this.gridSize) {
            return -1;
        }
        return coord.y * this.gridSize + coord.x;
    }

    // -------------------------------------------------------------------
    //  Mouse coordinate translation
    // -------------------------------------------------------------------

    /**
     * Translate browser client coordinates to grid coordinates, accounting
     * for zoom and pan offset.
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{ x: number, y: number }} Grid column (x) and row (y).
     */
    screenToPixel(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        // Position relative to the canvas element, in CSS pixels.
        const relX = clientX - rect.left;
        const relY = clientY - rect.top;

        // Convert CSS pixels to canvas logical pixels (undo zoom).
        const canvasX = relX / this.zoom - this.offset.x;
        const canvasY = relY / this.zoom - this.offset.y;

        const col = Math.floor(canvasX / this.cellSize);
        const row = Math.floor(canvasY / this.cellSize);

        return { x: col, y: row };
    }

    // -------------------------------------------------------------------
    //  Rendering methods
    // -------------------------------------------------------------------

    /**
     * Full re-render of all composite pixels from the LayerManager.
     * @param {LayerManager} layerManager
     */
    render(layerManager) {
        const total = this.gridSize * this.gridSize;
        const composite = layerManager.getCompositeImage();

        for (let i = 0; i < total; i++) {
            this._pixelColors[i] = composite[i];
        }

        this._fullRenderNeeded = true;
        this._scheduleFrame();
    }

    /**
     * Update a single pixel efficiently.  Marks it as dirty so only the
     * changed rectangle is repainted on the next frame.
     * @param {number} index - Pixel index (row * gridSize + col).
     * @param {string} color - Hex color string.
     */
    renderPixel(index, color) {
        if (index < 0 || index >= this.gridSize * this.gridSize) return;
        if (this._pixelColors[index] === color) return;

        this._pixelColors[index] = color;
        this._dirtyPixels.add(index);
        this._scheduleFrame();
    }

    /**
     * Draw grid lines as an overlay on top of the pixel canvas.
     */
    renderGrid() {
        if (!this.showGrid) return;

        const ctx = this.ctx;
        const size = this.gridSize;
        const cell = this.cellSize;
        const totalPx = size * cell;

        ctx.save();
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(this.offset.x, this.offset.y);

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();

        for (let i = 0; i <= size; i++) {
            const pos = i * cell;
            // Vertical line
            ctx.moveTo(pos, 0);
            ctx.lineTo(pos, totalPx);
            // Horizontal line
            ctx.moveTo(0, pos);
            ctx.lineTo(totalPx, pos);
        }

        ctx.stroke();
        ctx.restore();
    }

    /**
     * Fill the entire canvas with white.
     */
    clear() {
        const total = this.gridSize * this.gridSize;
        for (let i = 0; i < total; i++) {
            this._pixelColors[i] = '#ffffff';
        }
        this._fullRenderNeeded = true;
        this._scheduleFrame();
    }

    // -------------------------------------------------------------------
    //  Overlay rendering
    // -------------------------------------------------------------------

    /**
     * Draw dashed rectangles around selected pixels.
     * @param {number[]} selectedIndices - Array of pixel indices that are selected.
     */
    renderSelection(selectedIndices) {
        if (!selectedIndices || selectedIndices.length === 0) return;

        const ctx = this.ctx;
        const cell = this.cellSize;
        const size = this.gridSize;

        ctx.save();
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(this.offset.x, this.offset.y);

        ctx.strokeStyle = '#4a90d9';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);

        const selected = new Set(selectedIndices);

        for (const idx of selectedIndices) {
            const col = idx % size;
            const row = Math.floor(idx / size);
            const x = col * cell;
            const y = row * cell;

            // Draw a border segment only on edges that face a non-selected
            // pixel (or the grid boundary), so adjacent selections merge
            // visually into one outline.

            // Top
            if (row === 0 || !selected.has(idx - size)) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + cell, y);
                ctx.stroke();
            }
            // Bottom
            if (row === size - 1 || !selected.has(idx + size)) {
                ctx.beginPath();
                ctx.moveTo(x, y + cell);
                ctx.lineTo(x + cell, y + cell);
                ctx.stroke();
            }
            // Left
            if (col === 0 || !selected.has(idx - 1)) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + cell);
                ctx.stroke();
            }
            // Right
            if (col === size - 1 || !selected.has(idx + 1)) {
                ctx.beginPath();
                ctx.moveTo(x + cell, y);
                ctx.lineTo(x + cell, y + cell);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    /**
     * Render semi-transparent onion-skin overlays for previous/next frames.
     * @param {string[]|null} prevComposite - Composite image array for the previous frame.
     * @param {string[]|null} nextComposite - Composite image array for the next frame.
     * @param {number} opacity - Opacity for the onion-skin layers (0-1).
     */
    renderOnionSkin(prevComposite, nextComposite, opacity) {
        if (!prevComposite && !nextComposite) return;

        const ctx = this.ctx;
        const cell = this.cellSize;
        const size = this.gridSize;

        ctx.save();
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(this.offset.x, this.offset.y);

        if (prevComposite) {
            ctx.globalAlpha = opacity;
            for (let i = 0; i < prevComposite.length; i++) {
                if (prevComposite[i] === '#ffffff') continue;
                const col = i % size;
                const row = Math.floor(i / size);

                // Tint previous frame red.
                ctx.fillStyle = this._tintColor(prevComposite[i], '#ff0000', 0.35);
                ctx.fillRect(col * cell, row * cell, cell, cell);
            }
        }

        if (nextComposite) {
            ctx.globalAlpha = opacity;
            for (let i = 0; i < nextComposite.length; i++) {
                if (nextComposite[i] === '#ffffff') continue;
                const col = i % size;
                const row = Math.floor(i / size);

                // Tint next frame blue.
                ctx.fillStyle = this._tintColor(nextComposite[i], '#0000ff', 0.35);
                ctx.fillRect(col * cell, row * cell, cell, cell);
            }
        }

        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    // -------------------------------------------------------------------
    //  Internal helpers
    // -------------------------------------------------------------------

    /**
     * Apply current gridSize, cellSize and zoom to the canvas element.
     */
    _applyCanvasSize() {
        const logicalPx = this.gridSize * this.cellSize;
        const displayPx = Math.round(logicalPx * this.zoom);

        this.canvas.width = displayPx;
        this.canvas.height = displayPx;
        this.canvas.style.width = displayPx + 'px';
        this.canvas.style.height = displayPx + 'px';

        // Disable image smoothing so scaled pixels stay crisp.
        this.ctx.imageSmoothingEnabled = false;
    }

    /**
     * Schedule a paint on the next animation frame if one is not already
     * pending.
     */
    _scheduleFrame() {
        if (this._rafId !== null) return;
        this._rafId = requestAnimationFrame(this._rafBound);
    }

    /**
     * The rAF callback — performs the actual painting.
     */
    _rafLoop() {
        this._rafId = null;

        if (this._fullRenderNeeded) {
            this._paintAll();
            this._fullRenderNeeded = false;
            this._dirtyPixels.clear();
        } else if (this._dirtyPixels.size > 0) {
            this._paintDirty();
            this._dirtyPixels.clear();
        }
    }

    /**
     * Paint every pixel from the internal _pixelColors buffer and then
     * draw the grid overlay if enabled.
     */
    _paintAll() {
        const ctx = this.ctx;
        const size = this.gridSize;
        const cell = this.cellSize;

        // Clear canvas.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(this.offset.x, this.offset.y);

        // Batch pixels by color to minimize fillStyle changes.
        const colorBuckets = {};
        const total = size * size;

        for (let i = 0; i < total; i++) {
            const c = this._pixelColors[i];
            if (!colorBuckets[c]) {
                colorBuckets[c] = [];
            }
            colorBuckets[c].push(i);
        }

        for (const color in colorBuckets) {
            ctx.fillStyle = color;
            const indices = colorBuckets[color];
            for (let j = 0; j < indices.length; j++) {
                const idx = indices[j];
                const col = idx % size;
                const row = (idx - col) / size;
                ctx.fillRect(col * cell, row * cell, cell, cell);
            }
        }

        ctx.restore();

        // Grid overlay.
        this.renderGrid();
    }

    /**
     * Re-paint only the dirty pixels, then re-draw the grid on those areas.
     */
    _paintDirty() {
        const ctx = this.ctx;
        const size = this.gridSize;
        const cell = this.cellSize;

        ctx.save();
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(this.offset.x, this.offset.y);

        for (const idx of this._dirtyPixels) {
            const col = idx % size;
            const row = (idx - col) / size;
            const x = col * cell;
            const y = row * cell;

            ctx.fillStyle = this._pixelColors[idx];
            ctx.fillRect(x, y, cell, cell);

            // Re-draw local grid lines around this cell if grid is visible.
            if (this.showGrid) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, cell, cell);
            }
        }

        ctx.restore();
    }

    /**
     * Tint a source color towards a target tint color by the given amount.
     * @param {string} srcHex
     * @param {string} tintHex
     * @param {number} amount - 0 = no tint, 1 = full tint.
     * @returns {string} Hex color string.
     */
    _tintColor(srcHex, tintHex, amount) {
        const s = this._parseHex(srcHex);
        const t = this._parseHex(tintHex);
        const inv = 1 - amount;

        const r = Math.round(s.r * inv + t.r * amount);
        const g = Math.round(s.g * inv + t.g * amount);
        const b = Math.round(s.b * inv + t.b * amount);

        return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
    }

    /**
     * Parse a hex color string to { r, g, b }.
     * @param {string} hex - e.g. "#ff00aa"
     * @returns {{ r: number, g: number, b: number }}
     */
    _parseHex(hex) {
        return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16),
        };
    }
}
