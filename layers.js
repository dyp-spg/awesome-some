/**
 * Layer Management System for Pixel Art Creator
 *
 * Each layer stores an array of hex color strings (or null for transparent pixels).
 * Layers are composited from bottom (index 0) to top, respecting visibility and opacity.
 */

class LayerManager {
    constructor(pixelCount) {
        this.pixelCount = pixelCount;
        this.layers = [];
        this.activeLayerId = null;
        this._nextId = 1;

        // Initialize with a default background layer.
        this.addLayer('배경');
    }

    // ---------------------------------------------------------------
    //  Internal helpers
    // ---------------------------------------------------------------

    /**
     * Generate a unique layer id.
     */
    _generateId() {
        return this._nextId++;
    }

    /**
     * Create a blank data array (all transparent).
     */
    _createBlankData() {
        return new Array(this.pixelCount).fill(null);
    }

    /**
     * Find the index of a layer by its id.
     * Returns -1 if not found.
     */
    _indexOfLayer(id) {
        return this.layers.findIndex(layer => layer.id === id);
    }

    /**
     * Get a layer object by id, or null.
     */
    _getLayer(id) {
        return this.layers.find(layer => layer.id === id) || null;
    }

    /**
     * Parse a hex color string (#rrggbb) into { r, g, b } with values 0-255.
     */
    static parseHex(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    }

    /**
     * Convert r, g, b (0-255) back to a hex color string.
     */
    static toHex(r, g, b) {
        const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
        return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
    }

    /**
     * Alpha-blend a foreground color (hex) at a given opacity over a background
     * color (hex). Both are fully opaque in themselves; opacity controls how much
     * of the foreground shows through.
     *
     * Returns a hex string.
     */
    static alphaBlend(bgHex, fgHex, opacity) {
        const bg = LayerManager.parseHex(bgHex);
        const fg = LayerManager.parseHex(fgHex);
        const a = opacity;

        const r = fg.r * a + bg.r * (1 - a);
        const g = fg.g * a + bg.g * (1 - a);
        const b = fg.b * a + bg.b * (1 - a);

        return LayerManager.toHex(r, g, b);
    }

    // ---------------------------------------------------------------
    //  Public API — layer CRUD
    // ---------------------------------------------------------------

    /**
     * Add a new layer at the top of the stack.
     * Returns the newly created layer object.
     */
    addLayer(name) {
        const layer = {
            id: this._generateId(),
            name: name || `레이어 ${this.layers.length + 1}`,
            visible: true,
            opacity: 1,
            locked: false,
            data: this._createBlankData(),
        };

        this.layers.push(layer);
        this.activeLayerId = layer.id;
        return layer;
    }

    /**
     * Remove a layer by id.
     * Cannot remove the last remaining layer.
     * Returns true on success, false otherwise.
     */
    removeLayer(id) {
        if (this.layers.length <= 1) {
            return false;
        }

        const index = this._indexOfLayer(id);
        if (index === -1) {
            return false;
        }

        this.layers.splice(index, 1);

        // If the removed layer was active, activate the nearest layer.
        if (this.activeLayerId === id) {
            const newIndex = Math.min(index, this.layers.length - 1);
            this.activeLayerId = this.layers[newIndex].id;
        }

        return true;
    }

    /**
     * Duplicate a layer. The copy is inserted directly above the original.
     * Returns the new layer object, or null if the source was not found.
     */
    duplicateLayer(id) {
        const index = this._indexOfLayer(id);
        if (index === -1) {
            return null;
        }

        const source = this.layers[index];
        const copy = {
            id: this._generateId(),
            name: `${source.name} 사본`,
            visible: source.visible,
            opacity: source.opacity,
            locked: false,
            data: [...source.data],
        };

        this.layers.splice(index + 1, 0, copy);
        this.activeLayerId = copy.id;
        return copy;
    }

    /**
     * Move a layer one position up (towards the top of the stack / higher index).
     * Returns true on success.
     */
    moveLayerUp(id) {
        const index = this._indexOfLayer(id);
        if (index === -1 || index >= this.layers.length - 1) {
            return false;
        }

        [this.layers[index], this.layers[index + 1]] =
            [this.layers[index + 1], this.layers[index]];
        return true;
    }

    /**
     * Move a layer one position down (towards the bottom of the stack / lower index).
     * Returns true on success.
     */
    moveLayerDown(id) {
        const index = this._indexOfLayer(id);
        if (index <= 0) {
            return false;
        }

        [this.layers[index], this.layers[index - 1]] =
            [this.layers[index - 1], this.layers[index]];
        return true;
    }

    // ---------------------------------------------------------------
    //  Public API — layer state
    // ---------------------------------------------------------------

    /**
     * Set a layer as the active (selected) layer.
     * Returns true on success.
     */
    setActiveLayer(id) {
        if (!this._getLayer(id)) {
            return false;
        }
        this.activeLayerId = id;
        return true;
    }

    /**
     * Get the currently active layer object, or null.
     */
    getActiveLayer() {
        return this._getLayer(this.activeLayerId);
    }

    /**
     * Toggle the visibility of a layer.
     * Returns the new visibility state, or null if not found.
     */
    toggleVisibility(id) {
        const layer = this._getLayer(id);
        if (!layer) {
            return null;
        }
        layer.visible = !layer.visible;
        return layer.visible;
    }

    /**
     * Set the opacity of a layer (clamped to 0-1).
     * Returns true on success.
     */
    setOpacity(id, value) {
        const layer = this._getLayer(id);
        if (!layer) {
            return false;
        }
        layer.opacity = Math.max(0, Math.min(1, value));
        return true;
    }

    /**
     * Toggle the locked state of a layer.
     * Returns the new locked state, or null if not found.
     */
    toggleLock(id) {
        const layer = this._getLayer(id);
        if (!layer) {
            return null;
        }
        layer.locked = !layer.locked;
        return layer.locked;
    }

    /**
     * Rename a layer.
     * Returns true on success.
     */
    renameLayer(id, name) {
        const layer = this._getLayer(id);
        if (!layer) {
            return false;
        }
        layer.name = name;
        return true;
    }

    // ---------------------------------------------------------------
    //  Public API — pixel data
    // ---------------------------------------------------------------

    /**
     * Set a pixel on the active layer.
     * Respects the locked flag — locked layers cannot be edited.
     * Returns true if the pixel was set.
     */
    setPixel(index, color) {
        const layer = this.getActiveLayer();
        if (!layer || layer.locked) {
            return false;
        }
        if (index < 0 || index >= this.pixelCount) {
            return false;
        }
        layer.data[index] = color;
        return true;
    }

    /**
     * Get the raw pixel value on the active layer.
     */
    getPixel(index) {
        const layer = this.getActiveLayer();
        if (!layer || index < 0 || index >= this.pixelCount) {
            return null;
        }
        return layer.data[index];
    }

    // ---------------------------------------------------------------
    //  Public API — compositing
    // ---------------------------------------------------------------

    /**
     * Return the final composited color for a single pixel index.
     *
     * Composites all visible layers from bottom to top using alpha blending.
     * Starts with white (#ffffff) as the canvas base color.
     * A null pixel in a layer is treated as fully transparent (skipped).
     */
    getCompositePixel(index) {
        if (index < 0 || index >= this.pixelCount) {
            return '#ffffff';
        }

        let result = '#ffffff';

        for (const layer of this.layers) {
            if (!layer.visible || layer.opacity === 0) {
                continue;
            }

            const color = layer.data[index];
            if (color === null) {
                continue;
            }

            if (layer.opacity === 1) {
                // Full opacity — the foreground completely replaces the result.
                result = color;
            } else {
                result = LayerManager.alphaBlend(result, color, layer.opacity);
            }
        }

        return result;
    }

    /**
     * Return a full composite image as an array of hex color strings.
     */
    getCompositeImage() {
        const image = new Array(this.pixelCount);
        for (let i = 0; i < this.pixelCount; i++) {
            image[i] = this.getCompositePixel(i);
        }
        return image;
    }

    // ---------------------------------------------------------------
    //  Public API — merging
    // ---------------------------------------------------------------

    /**
     * Merge a layer down into the layer directly below it.
     *
     * The upper layer's visible pixels (respecting its opacity) are blended
     * onto the lower layer. The upper layer is then removed.
     *
     * Returns true on success, false if the layer cannot be merged down
     * (e.g., it is already the bottom layer, or it does not exist).
     */
    mergeDown(id) {
        const upperIndex = this._indexOfLayer(id);
        if (upperIndex <= 0) {
            return false;
        }

        const upper = this.layers[upperIndex];
        const lower = this.layers[upperIndex - 1];

        for (let i = 0; i < this.pixelCount; i++) {
            const fgColor = upper.data[i];
            if (fgColor === null) {
                continue;
            }

            const bgColor = lower.data[i] || '#ffffff';

            if (upper.opacity === 1) {
                lower.data[i] = fgColor;
            } else if (upper.opacity > 0) {
                lower.data[i] = LayerManager.alphaBlend(bgColor, fgColor, upper.opacity);
            }
            // opacity === 0: upper pixel has no effect.
        }

        // Remove the upper layer.
        this.layers.splice(upperIndex, 1);

        // Keep active layer valid.
        if (this.activeLayerId === id) {
            this.activeLayerId = lower.id;
        }

        return true;
    }

    /**
     * Flatten all visible layers into a single layer.
     *
     * The resulting layer inherits the name of the bottom-most visible layer
     * (or "배경" if none). All other layers are removed.
     *
     * Returns the flattened layer object.
     */
    flattenAll() {
        const flatData = this.getCompositeImage();

        // Determine the name for the flattened layer.
        const bottomVisible = this.layers.find(l => l.visible);
        const name = bottomVisible ? bottomVisible.name : '배경';

        // Replace the layer stack with a single layer.
        const layer = {
            id: this._generateId(),
            name,
            visible: true,
            opacity: 1,
            locked: false,
            data: flatData,
        };

        this.layers = [layer];
        this.activeLayerId = layer.id;
        return layer;
    }

    // ---------------------------------------------------------------
    //  Public API — serialization helpers
    // ---------------------------------------------------------------

    /**
     * Resize all layer data arrays when the grid size changes.
     * Existing pixel data is discarded.
     */
    resize(newPixelCount) {
        this.pixelCount = newPixelCount;
        for (const layer of this.layers) {
            layer.data = new Array(newPixelCount).fill(null);
        }
    }

    /**
     * Export the layer stack as a plain JSON-serializable object.
     */
    toJSON() {
        return {
            pixelCount: this.pixelCount,
            activeLayerId: this.activeLayerId,
            layers: this.layers.map(layer => ({
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                locked: layer.locked,
                data: [...layer.data],
            })),
        };
    }

    /**
     * Restore layer state from a previously exported JSON object.
     */
    static fromJSON(json) {
        const manager = Object.create(LayerManager.prototype);
        manager.pixelCount = json.pixelCount;
        manager.activeLayerId = json.activeLayerId;
        manager._nextId = 1;

        manager.layers = json.layers.map(l => {
            const layer = {
                id: l.id,
                name: l.name,
                visible: l.visible,
                opacity: l.opacity,
                locked: l.locked,
                data: [...l.data],
            };
            if (layer.id >= manager._nextId) {
                manager._nextId = layer.id + 1;
            }
            return layer;
        });

        return manager;
    }
}
