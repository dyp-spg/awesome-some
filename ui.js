// ---------------------------------------------------------------
//  ThemeManager
// ---------------------------------------------------------------

var ThemeManager = (function () {
    var STORAGE_KEY = 'pixel-art-theme';

    var themes = {
        dark: {
            '--bg': '#1a1a2e',
            '--panel-bg': '#16213e',
            '--text': '#eeeeee',
            '--accent': '#e94560',
            '--border': '#333333',
            '--pixel-bg': '#ffffff'
        },
        light: {
            '--bg': '#f0f0f5',
            '--panel-bg': '#ffffff',
            '--text': '#1a1a2e',
            '--accent': '#e94560',
            '--border': '#cccccc',
            '--pixel-bg': '#ffffff'
        },
        midnight: {
            '--bg': '#0d0d1a',
            '--panel-bg': '#111126',
            '--text': '#c8c8e0',
            '--accent': '#7c5cbf',
            '--border': '#2a2a44',
            '--pixel-bg': '#f5f5ff'
        },
        forest: {
            '--bg': '#1a2e1a',
            '--panel-bg': '#1e3a1e',
            '--text': '#d4e8d4',
            '--accent': '#4caf50',
            '--border': '#2e5a2e',
            '--pixel-bg': '#f5fff5'
        }
    };

    var currentTheme = 'dark';

    function applyTheme(name) {
        if (!themes[name]) return;
        currentTheme = name;
        var vars = themes[name];
        var root = document.documentElement;
        for (var prop in vars) {
            if (vars.hasOwnProperty(prop)) {
                root.style.setProperty(prop, vars[prop]);
            }
        }
        try {
            localStorage.setItem(STORAGE_KEY, name);
        } catch (e) { /* storage unavailable */ }
    }

    function getCurrentTheme() {
        return currentTheme;
    }

    function getThemeNames() {
        return Object.keys(themes);
    }

    // Load saved theme on init
    function init() {
        var saved = null;
        try {
            saved = localStorage.getItem(STORAGE_KEY);
        } catch (e) { /* ignore */ }
        applyTheme(saved && themes[saved] ? saved : 'dark');
    }

    return {
        themes: themes,
        applyTheme: applyTheme,
        getCurrentTheme: getCurrentTheme,
        getThemeNames: getThemeNames,
        init: init
    };
})();

// ---------------------------------------------------------------
//  ZoomManager
// ---------------------------------------------------------------

var ZoomManager = (function () {
    var MIN_ZOOM = 0.5;
    var MAX_ZOOM = 4.0;
    var ZOOM_STEP = 0.25;

    var zoomLevel = 1.0;
    var offset = { x: 0, y: 0 };

    // Pan state (internal)
    var _panning = false;
    var _panStart = { x: 0, y: 0 };
    var _offsetStart = { x: 0, y: 0 };

    function clampZoom(val) {
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, val));
    }

    function applyZoom(canvasWrapper) {
        if (!canvasWrapper) return;
        var inner = canvasWrapper.querySelector('.canvas') || canvasWrapper.firstElementChild;
        if (!inner) return;
        inner.style.transform =
            'translate(' + offset.x + 'px, ' + offset.y + 'px) scale(' + zoomLevel + ')';
        inner.style.transformOrigin = 'center center';
    }

    function zoomIn() {
        zoomLevel = clampZoom(zoomLevel + ZOOM_STEP);
        return zoomLevel;
    }

    function zoomOut() {
        zoomLevel = clampZoom(zoomLevel - ZOOM_STEP);
        return zoomLevel;
    }

    function resetZoom() {
        zoomLevel = 1.0;
        offset.x = 0;
        offset.y = 0;
        return zoomLevel;
    }

    function getZoomLevel() {
        return zoomLevel;
    }

    function getOffset() {
        return { x: offset.x, y: offset.y };
    }

    // Pan support --------------------------------------------------

    function startPan(e) {
        _panning = true;
        var clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
        var clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
        _panStart.x = clientX;
        _panStart.y = clientY;
        _offsetStart.x = offset.x;
        _offsetStart.y = offset.y;
    }

    function movePan(e) {
        if (!_panning) return;
        var clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
        var clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
        offset.x = _offsetStart.x + (clientX - _panStart.x);
        offset.y = _offsetStart.y + (clientY - _panStart.y);
    }

    function endPan() {
        _panning = false;
    }

    function isPanning() {
        return _panning;
    }

    return {
        zoomIn: zoomIn,
        zoomOut: zoomOut,
        resetZoom: resetZoom,
        getZoomLevel: getZoomLevel,
        getOffset: getOffset,
        applyZoom: applyZoom,
        startPan: startPan,
        movePan: movePan,
        endPan: endPan,
        isPanning: isPanning
    };
})();

// ---------------------------------------------------------------
//  KeyboardShortcutManager
// ---------------------------------------------------------------

var KeyboardShortcutManager = (function () {
    var shortcuts = {};

    function registerShortcut(key, callback) {
        shortcuts[key.toLowerCase()] = callback;
    }

    function handleKeyDown(e) {
        // Skip when typing in inputs or selects
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' ||
            e.target.tagName === 'TEXTAREA') {
            return;
        }
        // Skip if modifier keys are held (let app.js handle Ctrl/Cmd combos)
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        var key = e.key.toLowerCase();
        if (shortcuts[key]) {
            e.preventDefault();
            shortcuts[key]();
        }
    }

    function init() {
        document.addEventListener('keydown', handleKeyDown);
    }

    function destroy() {
        document.removeEventListener('keydown', handleKeyDown);
    }

    return {
        registerShortcut: registerShortcut,
        init: init,
        destroy: destroy
    };
})();

// ---------------------------------------------------------------
//  Register default shortcuts
// ---------------------------------------------------------------

(function () {
    // Tool shortcuts
    var toolKeys = {
        b: 'brush',
        e: 'eraser',
        g: 'fill',
        l: 'line',
        r: 'rect',
        c: 'circle',
        i: 'eyedropper',
        s: 'select'
    };

    Object.keys(toolKeys).forEach(function (key) {
        var toolName = toolKeys[key];
        KeyboardShortcutManager.registerShortcut(key, function () {
            if (typeof setTool === 'function') {
                setTool(toolName);
            }
        });
    });

    // Zoom shortcuts
    var canvasWrapper = null;
    function getWrapper() {
        if (!canvasWrapper) {
            canvasWrapper = document.querySelector('.canvas-wrapper');
        }
        return canvasWrapper;
    }

    KeyboardShortcutManager.registerShortcut('=', function () {
        ZoomManager.zoomIn();
        ZoomManager.applyZoom(getWrapper());
    });
    KeyboardShortcutManager.registerShortcut('+', function () {
        ZoomManager.zoomIn();
        ZoomManager.applyZoom(getWrapper());
    });
    KeyboardShortcutManager.registerShortcut('-', function () {
        ZoomManager.zoomOut();
        ZoomManager.applyZoom(getWrapper());
    });
    KeyboardShortcutManager.registerShortcut('0', function () {
        ZoomManager.resetZoom();
        ZoomManager.applyZoom(getWrapper());
    });

    // Frame navigation shortcuts
    KeyboardShortcutManager.registerShortcut('[', function () {
        var btn = document.getElementById('prev-frame-btn');
        if (btn) btn.click();
    });
    KeyboardShortcutManager.registerShortcut(']', function () {
        var btn = document.getElementById('next-frame-btn');
        if (btn) btn.click();
    });
})();

// ---------------------------------------------------------------
//  Auto-init on DOM ready
// ---------------------------------------------------------------

(function () {
    function onReady() {
        ThemeManager.init();
        KeyboardShortcutManager.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})();
