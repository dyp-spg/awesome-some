/**
 * Undo/Redo History Manager for Pixel Art Creator
 *
 * Stores snapshots of the entire layer state so that any action
 * can be fully reversed or replayed.
 */

class HistoryManager {
    /**
     * @param {number} [maxSize=50] - Maximum number of states to retain.
     */
    constructor(maxSize) {
        this._maxSize = (maxSize != null && maxSize > 0) ? maxSize : 50;
        this._states = [];   // Array of JSON-serializable snapshots
        this._index = -1;    // Points to the current state in _states
    }

    // ---------------------------------------------------------------
    //  Public API
    // ---------------------------------------------------------------

    /**
     * Save the current layer state as a new snapshot.
     *
     * If we are in the middle of the history (after one or more undos),
     * all "future" states beyond the current index are discarded before
     * the new state is appended.
     *
     * @param {LayerManager} layerManager
     */
    pushState(layerManager) {
        // Deep-copy the state via JSON round-trip to prevent mutation.
        const snapshot = JSON.parse(JSON.stringify(layerManager.toJSON()));

        // Discard any redo states beyond the current position.
        if (this._index < this._states.length - 1) {
            this._states.length = this._index + 1;
        }

        this._states.push(snapshot);

        // Enforce the maximum history size by trimming the oldest entries.
        if (this._states.length > this._maxSize) {
            const overflow = this._states.length - this._maxSize;
            this._states.splice(0, overflow);
        }

        this._index = this._states.length - 1;
    }

    /**
     * Move one step back in history.
     *
     * @returns {Object|null} The previous state snapshot, or null if
     *     already at the beginning of history.
     */
    undo() {
        if (!this.canUndo()) {
            return null;
        }

        this._index--;
        return JSON.parse(JSON.stringify(this._states[this._index]));
    }

    /**
     * Move one step forward in history.
     *
     * @returns {Object|null} The next state snapshot, or null if
     *     already at the most recent state.
     */
    redo() {
        if (!this.canRedo()) {
            return null;
        }

        this._index++;
        return JSON.parse(JSON.stringify(this._states[this._index]));
    }

    /**
     * @returns {boolean} True if there is at least one earlier state to
     *     return to.
     */
    canUndo() {
        return this._index > 0;
    }

    /**
     * @returns {boolean} True if there is at least one later state to
     *     advance to.
     */
    canRedo() {
        return this._index < this._states.length - 1;
    }

    /**
     * Reset all history, removing every stored snapshot.
     */
    clear() {
        this._states = [];
        this._index = -1;
    }
}
