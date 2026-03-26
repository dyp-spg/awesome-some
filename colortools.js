/**
 * ColorTools - Advanced color tools for the Pixel Art Creator.
 * Plain script scope, no modules.
 */
var ColorTools = (function () {

    // ---------------------------------------------------------------
    //  Core conversion helpers
    // ---------------------------------------------------------------

    /**
     * Parse a hex color string into 0-255 RGB components.
     * Accepts "#RGB", "#RRGGBB", "RGB", "RRGGBB".
     */
    function _parseHex(hex) {
        var h = hex.replace(/^#/, '');
        if (h.length === 3) {
            h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }
        var num = parseInt(h, 16);
        return {
            r: (num >> 16) & 0xff,
            g: (num >> 8) & 0xff,
            b: num & 0xff
        };
    }

    /**
     * Clamp a number between min and max (inclusive).
     */
    function _clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    /**
     * Normalise a hex string to uppercase "#RRGGBB" form.
     */
    function _normalizeHex(hex) {
        var rgb = _parseHex(hex);
        return rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    // ---------------------------------------------------------------
    //  Public conversion functions
    // ---------------------------------------------------------------

    /**
     * hexToRGB(hex) -> {r, g, b}  (each 0-255)
     */
    function hexToRGB(hex) {
        return _parseHex(hex);
    }

    /**
     * rgbToHex(r, g, b) -> "#RRGGBB"
     */
    function rgbToHex(r, g, b) {
        r = _clamp(Math.round(r), 0, 255);
        g = _clamp(Math.round(g), 0, 255);
        b = _clamp(Math.round(b), 0, 255);
        return '#' + (
            (1 << 24) + (r << 16) + (g << 8) + b
        ).toString(16).slice(1).toUpperCase();
    }

    /**
     * hexToHSL(hex) -> {h: 0-360, s: 0-100, l: 0-100}
     */
    function hexToHSL(hex) {
        var rgb = _parseHex(hex);
        var r = rgb.r / 255;
        var g = rgb.g / 255;
        var b = rgb.b / 255;

        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var delta = max - min;

        var h = 0;
        var s = 0;
        var l = (max + min) / 2;

        if (delta !== 0) {
            s = l > 0.5
                ? delta / (2 - max - min)
                : delta / (max + min);

            if (max === r) {
                h = ((g - b) / delta) + (g < b ? 6 : 0);
            } else if (max === g) {
                h = ((b - r) / delta) + 2;
            } else {
                h = ((r - g) / delta) + 4;
            }
            h *= 60;
        }

        return {
            h: Math.round(h * 10) / 10,
            s: Math.round(s * 1000) / 10,
            l: Math.round(l * 1000) / 10
        };
    }

    /**
     * hslToHex(h, s, l) -> "#RRGGBB"
     *   h: 0-360, s: 0-100, l: 0-100
     */
    function hslToHex(h, s, l) {
        h = ((h % 360) + 360) % 360;   // normalise to [0,360)
        s = _clamp(s, 0, 100) / 100;
        l = _clamp(l, 0, 100) / 100;

        var c = (1 - Math.abs(2 * l - 1)) * s;
        var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        var m = l - c / 2;

        var r, g, b;
        if (h < 60)       { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else               { r = c; g = 0; b = x; }

        return rgbToHex(
            (r + m) * 255,
            (g + m) * 255,
            (b + m) * 255
        );
    }

    // ---------------------------------------------------------------
    //  Color harmony generators
    // ---------------------------------------------------------------

    function _shiftHue(hex, degrees) {
        var hsl = hexToHSL(hex);
        return hslToHex(hsl.h + degrees, hsl.s, hsl.l);
    }

    /**
     * complementary(hex) -> [hex, complement]
     */
    function complementary(hex) {
        var base = _normalizeHex(hex);
        return [base, _shiftHue(hex, 180)];
    }

    /**
     * triadic(hex) -> [hex, +120, +240]
     */
    function triadic(hex) {
        var base = _normalizeHex(hex);
        return [base, _shiftHue(hex, 120), _shiftHue(hex, 240)];
    }

    /**
     * analogous(hex) -> [hex, +30, -30]
     */
    function analogous(hex) {
        var base = _normalizeHex(hex);
        return [base, _shiftHue(hex, 30), _shiftHue(hex, -30)];
    }

    /**
     * splitComplementary(hex) -> [hex, +150, +210]
     */
    function splitComplementary(hex) {
        var base = _normalizeHex(hex);
        return [base, _shiftHue(hex, 150), _shiftHue(hex, 210)];
    }

    // ---------------------------------------------------------------
    //  Color manipulation
    // ---------------------------------------------------------------

    /**
     * lighten(hex, amount) -> hex   (amount 0-1)
     */
    function lighten(hex, amount) {
        var hsl = hexToHSL(hex);
        var newL = hsl.l + (100 - hsl.l) * _clamp(amount, 0, 1);
        return hslToHex(hsl.h, hsl.s, newL);
    }

    /**
     * darken(hex, amount) -> hex   (amount 0-1)
     */
    function darken(hex, amount) {
        var hsl = hexToHSL(hex);
        var newL = hsl.l * (1 - _clamp(amount, 0, 1));
        return hslToHex(hsl.h, hsl.s, newL);
    }

    /**
     * saturate(hex, amount) -> hex  (amount 0-1)
     */
    function saturate(hex, amount) {
        var hsl = hexToHSL(hex);
        var newS = hsl.s + (100 - hsl.s) * _clamp(amount, 0, 1);
        return hslToHex(hsl.h, newS, hsl.l);
    }

    /**
     * desaturate(hex, amount) -> hex  (amount 0-1)
     */
    function desaturate(hex, amount) {
        var hsl = hexToHSL(hex);
        var newS = hsl.s * (1 - _clamp(amount, 0, 1));
        return hslToHex(hsl.h, newS, hsl.l);
    }

    // ---------------------------------------------------------------
    //  Gradient generator
    // ---------------------------------------------------------------

    /**
     * gradient(color1, color2, steps) -> array of hex colors
     * Interpolated in HSL space. steps includes the two endpoints.
     */
    function gradient(color1, color2, steps) {
        if (steps < 2) {
            return [_normalizeHex(color1)];
        }

        var hsl1 = hexToHSL(color1);
        var hsl2 = hexToHSL(color2);

        // Choose the shortest path around the hue circle
        var dh = hsl2.h - hsl1.h;
        if (dh > 180) { dh -= 360; }
        if (dh < -180) { dh += 360; }

        var result = [];
        for (var i = 0; i < steps; i++) {
            var t = i / (steps - 1);
            var h = hsl1.h + dh * t;
            var s = hsl1.s + (hsl2.s - hsl1.s) * t;
            var l = hsl1.l + (hsl2.l - hsl1.l) * t;
            result.push(hslToHex(h, s, l));
        }
        return result;
    }

    // ---------------------------------------------------------------
    //  ColorHistory
    // ---------------------------------------------------------------

    /**
     * ColorHistory class - tracks recently used colors.
     *   max 24 entries, deduplicated, most recent first.
     */
    function ColorHistory() {
        this._colors = [];
    }

    ColorHistory.prototype.add = function (hex) {
        var normalized = _normalizeHex(hex);
        // Remove duplicate if present
        var idx = this._colors.indexOf(normalized);
        if (idx !== -1) {
            this._colors.splice(idx, 1);
        }
        // Insert at front
        this._colors.unshift(normalized);
        // Enforce max size
        if (this._colors.length > 24) {
            this._colors.length = 24;
        }
    };

    ColorHistory.prototype.getAll = function () {
        return this._colors.slice();
    };

    ColorHistory.prototype.clear = function () {
        this._colors = [];
    };

    // ---------------------------------------------------------------
    //  Public API
    // ---------------------------------------------------------------

    return {
        // Conversions
        hexToHSL: hexToHSL,
        hslToHex: hslToHex,
        hexToRGB: hexToRGB,
        rgbToHex: rgbToHex,

        // Harmony generators
        complementary: complementary,
        triadic: triadic,
        analogous: analogous,
        splitComplementary: splitComplementary,

        // Manipulation
        lighten: lighten,
        darken: darken,
        saturate: saturate,
        desaturate: desaturate,

        // Gradient
        gradient: gradient,

        // History
        ColorHistory: ColorHistory
    };

})();
