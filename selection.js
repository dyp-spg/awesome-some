/**
 * Selection Tool System for Pixel Art Creator
 *
 * Provides rectangular and full-canvas selection, clipboard operations
 * (copy / cut / paste), and transform operations (move, flip) that
 * work with the active layer of a LayerManager instance.
 */

class SelectionManager {
    constructor(gridSize) {
        this.gridSize = gridSize;
        this.selected = new Set();
        this.clipboard = null;
    }

    // ---------------------------------------------------------------
    //  Internal helpers
    // ---------------------------------------------------------------

    /**
     * Convert (x, y) grid coordinates to a flat pixel index.
     * Returns -1 if the coordinates are out of bounds.
     */
    _toIndex(x, y) {
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) {
            return -1;
        }
        return y * this.gridSize + x;
    }

    /**
     * Convert a flat pixel index to { x, y } grid coordinates.
     */
    _toCoords(index) {
        return {
            x: index % this.gridSize,
            y: Math.floor(index / this.gridSize),
        };
    }

    /**
     * Clamp a value to the valid grid coordinate range [0, gridSize - 1].
     */
    _clamp(value) {
        return Math.max(0, Math.min(this.gridSize - 1, value));
    }

    // ---------------------------------------------------------------
    //  Selection methods
    // ---------------------------------------------------------------

    /**
     * Select all pixels inside the rectangle defined by two corners.
     * Coordinates are clamped to the grid and the rectangle is normalised
     * so that argument order does not matter.
     */
    selectRect(x0, y0, x1, y1) {
        this.selected.clear();

        const minX = this._clamp(Math.min(x0, x1));
        const maxX = this._clamp(Math.max(x0, x1));
        const minY = this._clamp(Math.min(y0, y1));
        const maxY = this._clamp(Math.max(y0, y1));

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                this.selected.add(this._toIndex(x, y));
            }
        }
    }

    /**
     * Select every pixel on the grid.
     */
    selectAll() {
        this.selected.clear();
        const total = this.gridSize * this.gridSize;
        for (let i = 0; i < total; i++) {
            this.selected.add(i);
        }
    }

    /**
     * Clear the current selection.
     */
    deselect() {
        this.selected.clear();
    }

    /**
     * Invert the selection — previously unselected pixels become selected
     * and vice-versa.
     */
    invertSelection() {
        const total = this.gridSize * this.gridSize;
        const inverted = new Set();
        for (let i = 0; i < total; i++) {
            if (!this.selected.has(i)) {
                inverted.add(i);
            }
        }
        this.selected = inverted;
    }

    /**
     * Check whether a pixel index is currently selected.
     */
    isSelected(index) {
        return this.selected.has(index);
    }

    /**
     * Return the selected indices as a plain array.
     */
    getSelectedIndices() {
        return Array.from(this.selected);
    }

    // ---------------------------------------------------------------
    //  Selection bounds
    // ---------------------------------------------------------------

    /**
     * Compute the axis-aligned bounding box of the current selection.
     * Returns { minX, minY, maxX, maxY } or null if nothing is selected.
     */
    getBounds() {
        if (this.selected.size === 0) {
            return null;
        }

        let minX = this.gridSize;
        let minY = this.gridSize;
        let maxX = -1;
        let maxY = -1;

        for (const index of this.selected) {
            const { x, y } = this._toCoords(index);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        return { minX, minY, maxX, maxY };
    }

    // ---------------------------------------------------------------
    //  Clipboard operations
    // ---------------------------------------------------------------

    /**
     * Copy the selected pixels on the active layer to the internal clipboard.
     * Each entry stores { index, color }.  Transparent (null) pixels are
     * included so that paste faithfully reproduces the source region.
     */
    copy(layerManager) {
        if (this.selected.size === 0) {
            return;
        }

        const layer = layerManager.getActiveLayer();
        if (!layer) {
            return;
        }

        this.clipboard = [];
        for (const index of this.selected) {
            this.clipboard.push({ index, color: layer.data[index] });
        }
    }

    /**
     * Copy the selected pixels to the clipboard, then clear them on the
     * active layer (set to null).
     */
    cut(layerManager) {
        if (this.selected.size === 0) {
            return;
        }

        this.copy(layerManager);

        const layer = layerManager.getActiveLayer();
        if (!layer || layer.locked) {
            return;
        }

        for (const index of this.selected) {
            layer.data[index] = null;
        }
    }

    /**
     * Paste the clipboard onto the active layer with an optional pixel offset.
     * Out-of-bounds pixels are silently skipped.
     */
    paste(layerManager, offsetX, offsetY) {
        if (!this.clipboard || this.clipboard.length === 0) {
            return;
        }

        const layer = layerManager.getActiveLayer();
        if (!layer || layer.locked) {
            return;
        }

        offsetX = offsetX || 0;
        offsetY = offsetY || 0;

        for (const entry of this.clipboard) {
            const { x, y } = this._toCoords(entry.index);
            const nx = x + offsetX;
            const ny = y + offsetY;
            const ni = this._toIndex(nx, ny);

            if (ni !== -1 && entry.color !== null) {
                layer.data[ni] = entry.color;
            }
        }
    }

    // ---------------------------------------------------------------
    //  Transform operations
    // ---------------------------------------------------------------

    /**
     * Move every selected pixel by (dx, dy) on the active layer.
     *
     * Procedure:
     *   1. Collect the colors of all selected pixels.
     *   2. Clear the original positions.
     *   3. Write the colors at the new (offset) positions.
     *   4. Update the selection set to reflect the new positions.
     *
     * Pixels that would land outside the grid are discarded.
     */
    move(layerManager, dx, dy) {
        if (this.selected.size === 0) {
            return;
        }

        const layer = layerManager.getActiveLayer();
        if (!layer || layer.locked) {
            return;
        }

        // 1. Save colors.
        const entries = [];
        for (const index of this.selected) {
            entries.push({ index, color: layer.data[index] });
        }

        // 2. Clear originals.
        for (const { index } of entries) {
            layer.data[index] = null;
        }

        // 3. Write at new positions & rebuild selection.
        const newSelected = new Set();

        for (const { index, color } of entries) {
            const { x, y } = this._toCoords(index);
            const nx = x + dx;
            const ny = y + dy;
            const ni = this._toIndex(nx, ny);

            if (ni !== -1) {
                if (color !== null) {
                    layer.data[ni] = color;
                }
                newSelected.add(ni);
            }
        }

        this.selected = newSelected;
    }

    /**
     * Flip the selected pixels horizontally (mirror left-right) on the
     * active layer.  The flip axis is the horizontal centre of the
     * selection's bounding box.
     */
    flipHorizontal(layerManager) {
        if (this.selected.size === 0) {
            return;
        }

        const bounds = this.getBounds();
        if (!bounds) {
            return;
        }

        const layer = layerManager.getActiveLayer();
        if (!layer || layer.locked) {
            return;
        }

        // Collect current colors.
        const entries = [];
        for (const index of this.selected) {
            entries.push({ index, color: layer.data[index] });
        }

        // Clear originals.
        for (const { index } of entries) {
            layer.data[index] = null;
        }

        // Write flipped & rebuild selection.
        const newSelected = new Set();

        for (const { index, color } of entries) {
            const { x, y } = this._toCoords(index);
            const nx = bounds.minX + (bounds.maxX - x);
            const ni = this._toIndex(nx, y);

            if (ni !== -1) {
                if (color !== null) {
                    layer.data[ni] = color;
                }
                newSelected.add(ni);
            }
        }

        this.selected = newSelected;
    }

    /**
     * Flip the selected pixels vertically (mirror top-bottom) on the
     * active layer.  The flip axis is the vertical centre of the
     * selection's bounding box.
     */
    flipVertical(layerManager) {
        if (this.selected.size === 0) {
            return;
        }

        const bounds = this.getBounds();
        if (!bounds) {
            return;
        }

        const layer = layerManager.getActiveLayer();
        if (!layer || layer.locked) {
            return;
        }

        // Collect current colors.
        const entries = [];
        for (const index of this.selected) {
            entries.push({ index, color: layer.data[index] });
        }

        // Clear originals.
        for (const { index } of entries) {
            layer.data[index] = null;
        }

        // Write flipped & rebuild selection.
        const newSelected = new Set();

        for (const { index, color } of entries) {
            const { x, y } = this._toCoords(index);
            const ny = bounds.minY + (bounds.maxY - y);
            const ni = this._toIndex(x, ny);

            if (ni !== -1) {
                if (color !== null) {
                    layer.data[ni] = color;
                }
                newSelected.add(ni);
            }
        }

        this.selected = newSelected;
    }
}
