/**
 * File Management System for Pixel Art Creator
 *
 * Handles project save/load (.pxl JSON), PNG export (single frame & sprite sheet),
 * and animated GIF export with a self-contained LZW-based GIF encoder.
 *
 * Depends on: layers.js (LayerManager) being loaded first.
 * Plain script scope — no modules.
 */

// ===================================================================
//  SimpleGIFEncoder — self-contained animated GIF encoder
// ===================================================================

class SimpleGIFEncoder {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.colorTable = [];   // Array of {r, g, b}
        this.colorMap = {};     // "r,g,b" -> index
        this.frames = [];       // {pixelIndices: Uint8Array, delay: number}
        this.finished = false;
    }

    // ---------------------------------------------------------------
    //  Public API
    // ---------------------------------------------------------------

    /**
     * Initialise the encoder with canvas dimensions.
     */
    init(width, height) {
        this.width = width;
        this.height = height;
        this.colorTable = [];
        this.colorMap = {};
        this.frames = [];
        this.finished = false;
    }

    /**
     * Add a frame to the animation.
     *
     * @param {string[]} pixelData - flat array of hex color strings (#rrggbb),
     *                               length must equal width * height.
     * @param {number}   delay     - frame delay in milliseconds.
     */
    addFrame(pixelData, delay) {
        // Register colours and build index array.
        const pixelIndices = new Uint8Array(pixelData.length);
        for (let i = 0; i < pixelData.length; i++) {
            const hex = pixelData[i] || '#ffffff';
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const key = r + ',' + g + ',' + b;

            if (this.colorMap[key] === undefined) {
                if (this.colorTable.length < 256) {
                    this.colorMap[key] = this.colorTable.length;
                    this.colorTable.push({ r, g, b });
                } else {
                    // Palette full — find nearest colour.
                    this.colorMap[key] = this._findNearest(r, g, b);
                }
            }
            pixelIndices[i] = this.colorMap[key];
        }

        // Delay is in centiseconds in the GIF spec.
        this.frames.push({ pixelIndices, delay: Math.round(delay / 10) });
    }

    /**
     * Finalise and return the complete GIF file as a Uint8Array.
     */
    finish() {
        this.finished = true;

        // Pad the colour table to the next power of two (minimum 2 entries).
        const tableSize = this._paddedTableSize();
        const tableSizeBits = Math.log2(tableSize);  // 1..8

        const out = [];

        // -- Header --
        this._writeString(out, 'GIF89a');

        // -- Logical Screen Descriptor --
        this._writeU16(out, this.width);
        this._writeU16(out, this.height);
        // Packed: GCT flag=1, colour resolution = tableSizeBits-1, sort=0, GCT size = tableSizeBits-1
        out.push(0x80 | ((tableSizeBits - 1) << 4) | (tableSizeBits - 1));
        out.push(0);  // Background colour index
        out.push(0);  // Pixel aspect ratio

        // -- Global Colour Table --
        for (let i = 0; i < tableSize; i++) {
            if (i < this.colorTable.length) {
                out.push(this.colorTable[i].r);
                out.push(this.colorTable[i].g);
                out.push(this.colorTable[i].b);
            } else {
                out.push(0); out.push(0); out.push(0);
            }
        }

        // -- NETSCAPE 2.0 Application Extension (infinite loop) --
        out.push(0x21); // Extension introducer
        out.push(0xFF); // Application extension label
        out.push(11);   // Block size
        this._writeString(out, 'NETSCAPE2.0');
        out.push(3);    // Sub-block size
        out.push(1);    // Sub-block ID
        this._writeU16(out, 0); // Loop count (0 = infinite)
        out.push(0);    // Block terminator

        // -- Frames --
        for (const frame of this.frames) {
            // Graphic Control Extension
            out.push(0x21); // Extension introducer
            out.push(0xF9); // Graphic control label
            out.push(4);    // Block size
            out.push(0x00); // Packed: disposal=0, no user input, no transparent
            this._writeU16(out, frame.delay);
            out.push(0);    // Transparent colour index (unused)
            out.push(0);    // Block terminator

            // Image Descriptor
            out.push(0x2C); // Image separator
            this._writeU16(out, 0); // Left
            this._writeU16(out, 0); // Top
            this._writeU16(out, this.width);
            this._writeU16(out, this.height);
            out.push(0);    // Packed: no local colour table, not interlaced

            // Image Data (LZW compressed)
            const minCodeSize = Math.max(2, tableSizeBits);
            out.push(minCodeSize);
            const compressed = this._lzwCompress(frame.pixelIndices, minCodeSize);
            this._writeSubBlocks(out, compressed);
        }

        // -- Trailer --
        out.push(0x3B);

        return new Uint8Array(out);
    }

    // ---------------------------------------------------------------
    //  Internal helpers
    // ---------------------------------------------------------------

    /**
     * Find the nearest colour in the existing palette (simple Euclidean distance).
     */
    _findNearest(r, g, b) {
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < this.colorTable.length; i++) {
            const c = this.colorTable[i];
            const dr = c.r - r;
            const dg = c.g - g;
            const db = c.b - b;
            const d = dr * dr + dg * dg + db * db;
            if (d < bestDist) {
                bestDist = d;
                best = i;
            }
        }
        return best;
    }

    /**
     * Calculate the padded colour table size (must be a power of 2, min 4).
     */
    _paddedTableSize() {
        let size = 4; // Minimum for GIF (2 bits -> 4 entries)
        while (size < this.colorTable.length) {
            size *= 2;
        }
        if (size > 256) size = 256;
        return size;
    }

    /**
     * LZW compression for GIF image data.
     *
     * Implements variable-width codes from (minCodeSize+1) bits up to 12 bits,
     * with clear and EOI codes, and table resets when the table fills up.
     */
    _lzwCompress(pixels, minCodeSize) {
        const clearCode = 1 << minCodeSize;
        const eoiCode = clearCode + 1;

        let codeSize = minCodeSize + 1;
        let nextCode = eoiCode + 1;
        const maxCodeLimit = 4096; // 12-bit maximum

        // Dictionary: maps string keys to codes.
        let dict = {};
        const resetDict = () => {
            dict = {};
            for (let i = 0; i < clearCode; i++) {
                dict[String(i)] = i;
            }
            codeSize = minCodeSize + 1;
            nextCode = eoiCode + 1;
        };

        // Bit packer: accumulates bits and flushes full bytes.
        let bitBuffer = 0;
        let bitCount = 0;
        const output = [];

        const writeBits = (code, size) => {
            bitBuffer |= (code << bitCount);
            bitCount += size;
            while (bitCount >= 8) {
                output.push(bitBuffer & 0xFF);
                bitBuffer >>= 8;
                bitCount -= 8;
            }
        };

        // Begin with a clear code.
        resetDict();
        writeBits(clearCode, codeSize);

        if (pixels.length === 0) {
            writeBits(eoiCode, codeSize);
            if (bitCount > 0) {
                output.push(bitBuffer & 0xFF);
            }
            return output;
        }

        let current = String(pixels[0]);

        for (let i = 1; i < pixels.length; i++) {
            const next = String(pixels[i]);
            const combined = current + ',' + next;

            if (dict[combined] !== undefined) {
                current = combined;
            } else {
                // Output the code for current.
                writeBits(dict[current], codeSize);

                // Add the new sequence to the dictionary.
                if (nextCode < maxCodeLimit) {
                    dict[combined] = nextCode;
                    nextCode++;

                    // Increase code size if needed.
                    if (nextCode > (1 << codeSize) && codeSize < 12) {
                        codeSize++;
                    }
                } else {
                    // Table full — emit clear code and reset.
                    writeBits(clearCode, codeSize);
                    resetDict();
                }

                current = next;
            }
        }

        // Output the remaining code.
        writeBits(dict[current], codeSize);

        // End of information.
        writeBits(eoiCode, codeSize);

        // Flush remaining bits.
        if (bitCount > 0) {
            output.push(bitBuffer & 0xFF);
        }

        return output;
    }

    /**
     * Write compressed image data as GIF sub-blocks (max 255 bytes each).
     */
    _writeSubBlocks(out, data) {
        let offset = 0;
        while (offset < data.length) {
            const chunkSize = Math.min(255, data.length - offset);
            out.push(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                out.push(data[offset + i]);
            }
            offset += chunkSize;
        }
        out.push(0); // Block terminator
    }

    /**
     * Write a UTF-8 string as individual byte values.
     */
    _writeString(out, str) {
        for (let i = 0; i < str.length; i++) {
            out.push(str.charCodeAt(i));
        }
    }

    /**
     * Write an unsigned 16-bit integer in little-endian order.
     */
    _writeU16(out, value) {
        out.push(value & 0xFF);
        out.push((value >> 8) & 0xFF);
    }
}

// ===================================================================
//  FileManager — project save/load, PNG export, GIF export
// ===================================================================

const FileManager = {

    // ---------------------------------------------------------------
    //  Project save / load (.pxl)
    // ---------------------------------------------------------------

    /**
     * Save a project to a downloadable .pxl file.
     *
     * @param {object} projectData - { gridSize, layers: <LayerManager.toJSON()>,
     *                                  animation: <animation JSON> }
     */
    saveProject(projectData) {
        const json = JSON.stringify(projectData);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'project.pxl';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Open a file picker to load a .pxl project file.
     *
     * @param {function} callback - called with the parsed project data object,
     *                              or null if loading failed / was cancelled.
     */
    loadProject(callback) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pxl';

        input.addEventListener('change', function () {
            const file = input.files && input.files[0];
            if (!file) {
                callback(null);
                return;
            }

            const reader = new FileReader();
            reader.onload = function () {
                try {
                    const data = JSON.parse(reader.result);
                    callback(data);
                } catch (e) {
                    console.error('FileManager: failed to parse project file.', e);
                    callback(null);
                }
            };
            reader.onerror = function () {
                console.error('FileManager: failed to read project file.');
                callback(null);
            };
            reader.readAsText(file);
        });

        input.click();
    },

    // ---------------------------------------------------------------
    //  PNG export
    // ---------------------------------------------------------------

    /**
     * Export a single composite frame as a PNG.
     *
     * @param {string[]} compositeImage - flat array of hex colour strings,
     *                                    length = gridSize * gridSize.
     * @param {number}   gridSize       - width (and height) in pixels.
     */
    exportPNG(compositeImage, gridSize) {
        const canvas = document.createElement('canvas');
        canvas.width = gridSize;
        canvas.height = gridSize;
        const ctx = canvas.getContext('2d');

        for (let i = 0; i < compositeImage.length; i++) {
            const x = i % gridSize;
            const y = Math.floor(i / gridSize);
            ctx.fillStyle = compositeImage[i] || '#ffffff';
            ctx.fillRect(x, y, 1, 1);
        }

        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pixel-art.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    /**
     * Export all animation frames as a sprite sheet PNG.
     *
     * Frames are laid out left-to-right, wrapping after `columns` frames.
     *
     * @param {string[][]} frames   - array of composite images (each is a hex array).
     * @param {number}     gridSize - width/height of each frame in pixels.
     * @param {number}     columns  - number of frames per row (defaults to frame count).
     */
    exportSpriteSheet(frames, gridSize, columns) {
        if (!frames || frames.length === 0) {
            console.warn('FileManager: no frames to export.');
            return;
        }

        columns = columns || frames.length;
        const rows = Math.ceil(frames.length / columns);

        const canvas = document.createElement('canvas');
        canvas.width = gridSize * columns;
        canvas.height = gridSize * rows;
        const ctx = canvas.getContext('2d');

        // Fill background white.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let f = 0; f < frames.length; f++) {
            const col = f % columns;
            const row = Math.floor(f / columns);
            const offsetX = col * gridSize;
            const offsetY = row * gridSize;
            const pixels = frames[f];

            for (let i = 0; i < pixels.length; i++) {
                const x = i % gridSize;
                const y = Math.floor(i / gridSize);
                ctx.fillStyle = pixels[i] || '#ffffff';
                ctx.fillRect(offsetX + x, offsetY + y, 1, 1);
            }
        }

        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sprite-sheet.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    // ---------------------------------------------------------------
    //  GIF export
    // ---------------------------------------------------------------

    /**
     * Export animation frames as an animated GIF.
     *
     * @param {string[][]} frames   - array of composite images (each is a hex string array).
     * @param {number}     gridSize - width/height of each frame in pixels.
     * @param {number}     fps      - frames per second.
     */
    exportGIF(frames, gridSize, fps) {
        if (!frames || frames.length === 0) {
            console.warn('FileManager: no frames to export as GIF.');
            return;
        }

        const delay = Math.round(1000 / (fps || 10)); // ms per frame

        const encoder = new SimpleGIFEncoder();
        encoder.init(gridSize, gridSize);

        for (let i = 0; i < frames.length; i++) {
            encoder.addFrame(frames[i], delay);
        }

        const gifData = encoder.finish();
        const blob = new Blob([gifData], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'animation.gif';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
