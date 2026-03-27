/**
 * Template & Gallery System for Pixel Art Creator
 *
 * Provides built-in pixel-art templates and a localStorage-backed gallery
 * for saving / browsing user creations.
 *
 * Plain script scope (no modules). Exposes the global `TemplateGallery` object.
 */

const TemplateGallery = (function () {
    'use strict';

    // ------------------------------------------------------------------
    //  Constants
    // ------------------------------------------------------------------

    const STORAGE_KEY = 'pixelArtGallery';
    const THUMB_SIZE = 64;

    // ------------------------------------------------------------------
    //  Helper – build a 256-element array from a visual map
    // ------------------------------------------------------------------

    /**
     * Accepts a 16-row array of 16-char strings plus a palette object that
     * maps single characters to hex colours (or null for transparent).
     * Returns a flat 256-element array suitable for template data.
     */
    function _fromMap(rows, palette) {
        const data = [];
        for (let r = 0; r < 16; r++) {
            const row = rows[r];
            for (let c = 0; c < 16; c++) {
                const ch = row[c];
                data.push(palette[ch] !== undefined ? palette[ch] : null);
            }
        }
        return data;
    }

    // ------------------------------------------------------------------
    //  Built-in templates
    // ------------------------------------------------------------------

    function _buildTemplates() {
        const templates = [];

        // 1. 빈 캔버스 (blank 16x16)
        templates.push({
            name: '빈 캔버스',
            gridSize: 16,
            data: new Array(256).fill(null),
        });

        // 2. 하트 (heart – red on transparent)
        templates.push({
            name: '하트',
            gridSize: 16,
            data: _fromMap([
                '................',
                '................',
                '..rrrr..rrrr....',
                '.rRRRRrrRRRRr...',
                '.rRRRRRRRRRRr...',
                '.rRRRRRRRRRRr...',
                '.rRRRRRRRRRRr...',
                '..rRRRRRRRRr....',
                '...rRRRRRRr.....',
                '....rRRRRr......',
                '.....rRRr.......',
                '......rr........',
                '................',
                '................',
                '................',
                '................',
            ], {
                '.': null,
                'r': '#aa0000',
                'R': '#ff2244',
            }),
        });

        // 3. 스마일 (smiley face – yellow circle, black eyes & mouth)
        templates.push({
            name: '스마일',
            gridSize: 16,
            data: _fromMap([
                '................',
                '.....YYYY.......',
                '...YYYYYYYY.....',
                '..YYYYYYYYYY....',
                '..YYYYYYYYYY....',
                '.YYYbYYYYbYYY...',
                '.YYYbYYYYbYYY...',
                '.YYYYYYYYYYYY...',
                '.YYYYYYYYYYYY...',
                '.YYbYYYYYYbYY...',
                '.YYYbbbbbYYYY...',
                '..YYYYYYYYYY....',
                '..YYYYYYYYYY....',
                '...YYYYYYYY.....',
                '.....YYYY.......',
                '................',
            ], {
                '.': null,
                'Y': '#ffdd00',
                'b': '#222222',
            }),
        });

        // 4. 별 (star – gold on transparent)
        templates.push({
            name: '별',
            gridSize: 16,
            data: _fromMap([
                '................',
                '.......GG.......',
                '.......GG.......',
                '......GGGG......',
                '......GGGG......',
                '..GGGGGGGGGGGG..',
                '...GGGGGGGGGG...',
                '....GGGGGGGG....',
                '....GGGGGGGG....',
                '...GGGGGGGGGG...',
                '...GGG....GGG...',
                '..GGG......GGG..',
                '..GG........GG..',
                '................',
                '................',
                '................',
            ], {
                '.': null,
                'G': '#ffcc00',
            }),
        });

        // 5. 나무 (tree – green crown, brown trunk, on transparent)
        templates.push({
            name: '나무',
            gridSize: 16,
            data: _fromMap([
                '................',
                '.......gg.......',
                '......gGGg......',
                '.....gGGGGg.....',
                '....gGGGGGGg....',
                '...gGGGGGGGGg...',
                '..gGGGGGGGGGGg..',
                '..gGGGGGGGGGGg..',
                '...gGGGGGGGGg...',
                '....gGGGGGGg....',
                '.......BB.......',
                '.......BB.......',
                '.......BB.......',
                '.......BB.......',
                '......bBBb......',
                '................',
            ], {
                '.': null,
                'g': '#228833',
                'G': '#33bb44',
                'B': '#885522',
                'b': '#664411',
            }),
        });

        // 6. 로켓 (rocket – grey body, red fins, orange flame)
        templates.push({
            name: '로켓',
            gridSize: 16,
            data: _fromMap([
                '.......WW.......',
                '......WSsw......',
                '......WssW......',
                '.....WssssW.....',
                '.....WssssW.....',
                '.....WssssW.....',
                '.....WsBBsW.....',
                '.....WsBBsW.....',
                '....RWssssWR....',
                '....RWssssWR....',
                '...RRWssssWRR...',
                '...RR.WssW.RR...',
                '........WW......',
                '.......oFFo.....',
                '......oFFFFo....',
                '.......ooo......',
            ], {
                '.': null,
                'W': '#cccccc',
                's': '#aaaaaa',
                'B': '#3399ff',
                'R': '#dd2222',
                'F': '#ff6600',
                'o': '#ffaa00',
            }),
        });

        return templates;
    }

    const _templates = _buildTemplates();

    // ------------------------------------------------------------------
    //  Template access methods
    // ------------------------------------------------------------------

    /**
     * Return a shallow copy of all built-in templates.
     */
    function getTemplates() {
        return _templates.map(function (t) {
            return { name: t.name, gridSize: t.gridSize, data: t.data.slice() };
        });
    }

    /**
     * Look up a template by name.
     * Returns the template object or undefined.
     */
    function getTemplate(name) {
        var found = _templates.find(function (t) { return t.name === name; });
        if (!found) return undefined;
        return { name: found.name, gridSize: found.gridSize, data: found.data.slice() };
    }

    /**
     * Apply a built-in template.
     * Returns { gridSize, layerData } where layerData is an array suitable
     * for loading into the first layer of a LayerManager.
     */
    function applyTemplate(name) {
        var tpl = getTemplate(name);
        if (!tpl) {
            throw new Error('Template not found: ' + name);
        }
        return {
            gridSize: tpl.gridSize,
            layerData: tpl.data,
        };
    }

    // ------------------------------------------------------------------
    //  Local gallery (localStorage-backed)
    // ------------------------------------------------------------------

    /**
     * Internal: read the gallery array from localStorage.
     */
    function _readStorage() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            return JSON.parse(raw);
        } catch (_e) {
            return [];
        }
    }

    /**
     * Internal: write the gallery array to localStorage.
     */
    function _writeStorage(items) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }

    /**
     * Save the current work to the gallery.
     *
     * @param {string}  name              Display name for this piece.
     * @param {number}  gridSize          The grid dimension (e.g. 16).
     * @param {string}  layerManagerJSON  Serialised layer-manager state
     *                                    (the caller is responsible for
     *                                    serialising however they see fit).
     */
    function saveToGallery(name, gridSize, layerManagerJSON, thumbnail) {
        if (!name || typeof name !== 'string') {
            throw new Error('A name is required when saving to the gallery.');
        }

        var items = _readStorage();

        // If an item with the same name exists, overwrite it.
        var idx = items.findIndex(function (i) { return i.name === name; });

        var entry = {
            name: name,
            gridSize: gridSize,
            thumbnail: thumbnail || null,
            data: layerManagerJSON,
            timestamp: Date.now(),
        };

        if (idx !== -1) {
            items[idx] = entry;
        } else {
            items.push(entry);
        }

        _writeStorage(items);
    }

    /**
     * Return every saved gallery item.
     * Each item has: { name, gridSize, thumbnail, data, timestamp }
     */
    function getGalleryItems() {
        return _readStorage();
    }

    /**
     * Delete a single gallery item by name.
     */
    function deleteFromGallery(name) {
        var items = _readStorage().filter(function (i) { return i.name !== name; });
        _writeStorage(items);
    }

    /**
     * Remove all gallery items.
     */
    function clearGallery() {
        localStorage.removeItem(STORAGE_KEY);
    }

    // ------------------------------------------------------------------
    //  Thumbnail generation
    // ------------------------------------------------------------------

    /**
     * Generate a 64x64 PNG thumbnail (base64 data-URL) from a flat
     * composite pixel array.
     *
     * @param {Array<string|null>} compositeImage  Flat array of hex colours
     *                                             (or null for transparent).
     * @param {number}             gridSize        The grid dimension.
     * @returns {string} A base64-encoded data URL of a 64x64 PNG.
     */
    function generateThumbnail(compositeImage, gridSize) {
        var canvas = document.createElement('canvas');
        canvas.width = THUMB_SIZE;
        canvas.height = THUMB_SIZE;
        var ctx = canvas.getContext('2d');

        // Clear to transparent.
        ctx.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);

        var cellSize = THUMB_SIZE / gridSize;

        for (var i = 0; i < compositeImage.length; i++) {
            if (compositeImage[i] === null) continue;

            var x = (i % gridSize) * cellSize;
            var y = Math.floor(i / gridSize) * cellSize;

            ctx.fillStyle = compositeImage[i];
            ctx.fillRect(
                Math.floor(x),
                Math.floor(y),
                Math.ceil(cellSize),
                Math.ceil(cellSize)
            );
        }

        return canvas.toDataURL('image/png');
    }

    // ------------------------------------------------------------------
    //  Public API
    // ------------------------------------------------------------------

    return {
        // Template access
        getTemplates: getTemplates,
        getTemplate: getTemplate,
        applyTemplate: applyTemplate,

        // Gallery CRUD
        saveToGallery: saveToGallery,
        getGalleryItems: getGalleryItems,
        deleteFromGallery: deleteFromGallery,
        clearGallery: clearGallery,

        // Thumbnail
        generateThumbnail: generateThumbnail,
    };
})();
