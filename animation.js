/**
 * Frame-Based Animation System for Pixel Art Creator
 *
 * Each frame stores a full LayerManager state snapshot (via toJSON/fromJSON).
 * Depends on LayerManager from layers.js being available in scope.
 */

class AnimationManager {
    constructor(gridSize) {
        this.gridSize = gridSize;
        this.frames = [];
        this.currentFrameIndex = 0;
        this.fps = 8;
        this.playing = false;
        this.onionSkinEnabled = false;
        this.onionSkinOpacity = 0.3;
        this._playbackTimer = null;

        // Start with one blank frame.
        const lm = new LayerManager(gridSize * gridSize);
        this.frames.push(lm.toJSON());
    }

    // ---------------------------------------------------------------
    //  Frame management
    // ---------------------------------------------------------------

    /**
     * Add a new blank frame after the current frame.
     * Returns the index of the newly created frame.
     */
    addFrame() {
        const lm = new LayerManager(this.gridSize * this.gridSize);
        const insertIndex = this.currentFrameIndex + 1;
        this.frames.splice(insertIndex, 0, lm.toJSON());
        this.currentFrameIndex = insertIndex;
        return insertIndex;
    }

    /**
     * Duplicate the current frame and insert the copy after it.
     * Returns the index of the duplicate.
     */
    duplicateFrame() {
        const copy = JSON.parse(JSON.stringify(this.frames[this.currentFrameIndex]));
        const insertIndex = this.currentFrameIndex + 1;
        this.frames.splice(insertIndex, 0, copy);
        this.currentFrameIndex = insertIndex;
        return insertIndex;
    }

    /**
     * Delete a frame by index.
     * At least one frame must remain; returns false if deletion is refused.
     */
    deleteFrame(index) {
        if (this.frames.length <= 1) {
            return false;
        }
        if (index < 0 || index >= this.frames.length) {
            return false;
        }

        this.frames.splice(index, 1);

        // Adjust currentFrameIndex so it stays valid.
        if (this.currentFrameIndex >= this.frames.length) {
            this.currentFrameIndex = this.frames.length - 1;
        } else if (this.currentFrameIndex > index) {
            this.currentFrameIndex--;
        }

        return true;
    }

    /**
     * Switch to the specified frame index.
     * Returns the LayerManager JSON for that frame, or null if out of range.
     */
    goToFrame(index) {
        if (index < 0 || index >= this.frames.length) {
            return null;
        }
        this.currentFrameIndex = index;
        return this.frames[index];
    }

    /**
     * Return the current frame data (LayerManager JSON).
     */
    getCurrentFrame() {
        return this.frames[this.currentFrameIndex];
    }

    /**
     * Save the given LayerManager JSON to the current frame slot.
     */
    setCurrentFrame(layerManagerJSON) {
        this.frames[this.currentFrameIndex] = layerManagerJSON;
    }

    /**
     * Return the total number of frames.
     */
    getFrameCount() {
        return this.frames.length;
    }

    /**
     * Move a frame from one index to another, shifting other frames accordingly.
     * Returns true on success.
     */
    moveFrame(fromIndex, toIndex) {
        if (
            fromIndex < 0 || fromIndex >= this.frames.length ||
            toIndex < 0 || toIndex >= this.frames.length ||
            fromIndex === toIndex
        ) {
            return false;
        }

        const frame = this.frames.splice(fromIndex, 1)[0];
        this.frames.splice(toIndex, 0, frame);

        // Keep currentFrameIndex tracking the same frame the user was on.
        if (this.currentFrameIndex === fromIndex) {
            this.currentFrameIndex = toIndex;
        } else if (fromIndex < this.currentFrameIndex && toIndex >= this.currentFrameIndex) {
            this.currentFrameIndex--;
        } else if (fromIndex > this.currentFrameIndex && toIndex <= this.currentFrameIndex) {
            this.currentFrameIndex++;
        }

        return true;
    }

    // ---------------------------------------------------------------
    //  Playback
    // ---------------------------------------------------------------

    /**
     * Start playback. The callback is invoked on each tick with the current
     * frame's LayerManager JSON and its index: callback(frameData, frameIndex).
     */
    play(callback) {
        if (this.playing) {
            return;
        }
        this.playing = true;

        const tick = () => {
            if (!this.playing) {
                return;
            }
            this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;
            if (callback) {
                callback(this.frames[this.currentFrameIndex], this.currentFrameIndex);
            }
            this._playbackTimer = setTimeout(tick, 1000 / this.fps);
        };

        // Fire the first tick after one frame interval.
        this._playbackTimer = setTimeout(tick, 1000 / this.fps);
    }

    /**
     * Stop playback.
     */
    stop() {
        this.playing = false;
        if (this._playbackTimer !== null) {
            clearTimeout(this._playbackTimer);
            this._playbackTimer = null;
        }
    }

    /**
     * Set the playback frame rate, clamped to 1-60.
     */
    setFps(value) {
        this.fps = Math.max(1, Math.min(60, value));
    }

    // ---------------------------------------------------------------
    //  Onion skin
    // ---------------------------------------------------------------

    /**
     * Return the adjacent frame data for onion-skin rendering.
     * Returns { prev: frameData|null, next: frameData|null }.
     */
    getOnionSkinFrames() {
        const prev = this.currentFrameIndex > 0
            ? this.frames[this.currentFrameIndex - 1]
            : null;
        const next = this.currentFrameIndex < this.frames.length - 1
            ? this.frames[this.currentFrameIndex + 1]
            : null;
        return { prev, next };
    }

    // ---------------------------------------------------------------
    //  Export / serialization
    // ---------------------------------------------------------------

    /**
     * Return a copy of all frame data (array of LayerManager JSON objects).
     */
    getAllFrames() {
        return this.frames.map(f => JSON.parse(JSON.stringify(f)));
    }

    /**
     * Export the full animation state as a JSON-serializable object.
     */
    toJSON() {
        return {
            gridSize: this.gridSize,
            currentFrameIndex: this.currentFrameIndex,
            fps: this.fps,
            onionSkinEnabled: this.onionSkinEnabled,
            onionSkinOpacity: this.onionSkinOpacity,
            frames: this.frames.map(f => JSON.parse(JSON.stringify(f))),
        };
    }

    /**
     * Restore an AnimationManager from a previously exported JSON object.
     */
    static fromJSON(json) {
        const manager = Object.create(AnimationManager.prototype);
        manager.gridSize = json.gridSize;
        manager.frames = json.frames.map(f => JSON.parse(JSON.stringify(f)));
        manager.currentFrameIndex = json.currentFrameIndex;
        manager.fps = json.fps;
        manager.playing = false;
        manager.onionSkinEnabled = json.onionSkinEnabled;
        manager.onionSkinOpacity = json.onionSkinOpacity;
        manager._playbackTimer = null;
        return manager;
    }
}
