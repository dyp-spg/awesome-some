# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser-based pixel art editor (Pixel Art Creator). Vanilla HTML/CSS/JavaScript, **no build step, no package manager, no dependencies, no test framework**. Korean is used in much of the UI copy and code comments — preserve existing language when editing strings.

## Running

Just open `index.html` in a browser. For PWA / Service Worker behavior, serve over HTTP:

```bash
python3 -m http.server 8080
```

There is no lint, build, or test command. "Testing" means manually exercising the feature in a browser.

## Architecture

### Script loading model

All `.js` files are loaded as **plain `<script>` tags** in `index.html` (no ES modules, no `type="module"`). Every class/manager attaches to the global scope and depends on previous scripts having loaded. The required load order is encoded in `index.html` (~line 205) and must be kept in sync:

```
ui.js → layers.js → history.js → tools.js → colortools.js →
selection.js → symmetry.js → animation.js → filemanager.js →
gallery.js → renderer.js → app.js
```

`app.js` is the entry point. It defines a single global `state` object (`app.js:8`) holding all managers and current tool/color/grid settings, plus all DOM event wiring.

### Central data flow

The pixel data lives in `LayerManager` (`layers.js`). Every other system serializes through it:

- **Layer storage**: each layer = flat array of hex strings or `null` (transparent), length = `gridSize * gridSize`. Composite is computed top-down with alpha blending in `LayerManager.getCompositePixel(i)`.
- **Undo/redo** (`history.js`): `HistoryManager` stores **deep-copied `LayerManager.toJSON()` snapshots** (max 50). Restore via `LayerManager.fromJSON(snapshot)`.
- **Animation** (`animation.js`): each frame is itself a `LayerManager.toJSON()` snapshot. Switching frames swaps `state.layerManager` with a fresh `LayerManager.fromJSON(...)`.
- **File save** (`.pxl`): JSON containing layer + frame state, handled in `filemanager.js`.

This means **any new edit operation must call `saveHistory()` after mutating the layer** for undo to work. The pattern across `app.js` is: mutate → `saveHistory()` → `renderCanvas()`.

### Rendering — dual backend

There are two rendering paths, switched by `state.useCanvasRenderer`:

1. **DOM grid (default)**: `state.pixels[]` holds one `<div>` per cell, rendered by setting `backgroundColor`. Initialized in `createCanvas()`.
2. **Canvas API** (`renderer.js`, `PixelRenderer`): single `<canvas>` with dirty-pixel tracking and `requestAnimationFrame` loop, used for higher zoom/larger grids.

`renderCanvas()` and `renderPixel(idx)` in `app.js` branch on `useCanvasRenderer`. When the canvas backend is active, mouse handlers build a `pixelProxy` to keep the rest of the code grid-agnostic (search `makePixelProxy` in `app.js`). Any new tool/edit code should go through `renderPixel(idx)` / `renderCanvas()` rather than touching `state.pixels[i].style` directly, so it works under both backends.

### Module roles (where things live)

| Concern | Module | Notes |
|---|---|---|
| Global state, event wiring, tool dispatch | `app.js` | The only place that knows about both DOM and managers |
| Multi-layer pixel storage, alpha compositing, JSON round-trip | `layers.js` | `LayerManager` — central data model |
| Undo/redo snapshots | `history.js` | Stores `LayerManager.toJSON()` |
| Frame timeline, playback, onion skin | `animation.js` | Each frame = a serialized `LayerManager` |
| Line/rect/circle/eyedropper algorithms | `tools.js` | `DrawingTools` — pure functions returning coord arrays |
| HSL conversion, harmony, gradient, recent-color list | `colortools.js` | `ColorTools` IIFE + `ColorHistory` class |
| Rect select, clipboard, move, flip | `selection.js` | `SelectionManager`, recreated when grid size changes |
| Mirror / radial / pattern symmetry | `symmetry.js` | `SymmetryTool` IIFE; produces extra paint coords |
| `.pxl` save/load, PNG export, animated GIF | `filemanager.js` | Includes self-contained `SimpleGIFEncoder` (LZW, no libs) |
| Built-in templates + localStorage gallery | `gallery.js` | `TemplateGallery` |
| Theme (CSS vars), zoom, keyboard shortcuts | `ui.js` | Three IIFEs: `ThemeManager`, `ZoomManager`, `KeyboardShortcutManager` |
| Canvas-backend renderer with dirty tracking | `renderer.js` | `PixelRenderer`, optional |
| Cache-first offline | `sw.js` | Static asset list + `CACHE_NAME` |

### Module style mix

Some modules are ES6 `class`es (`LayerManager`, `HistoryManager`, `AnimationManager`, `SelectionManager`, `PixelRenderer`, `SimpleGIFEncoder`); others are revealing-pattern IIFEs (`ThemeManager`, `ZoomManager`, `KeyboardShortcutManager`, `ColorTools`, `SymmetryTool`). Match the existing style of the file you're editing rather than refactoring.

## When adding a new JS file

Three things must be updated together or the file will silently not load (or load stale via Service Worker cache):

1. Add a `<script src="...">` tag to `index.html` in the correct dependency position.
2. Add the path to `ASSETS_TO_CACHE` in `sw.js`.
3. Bump `CACHE_NAME` in `sw.js` (e.g. `pixel-art-v2` → `pixel-art-v3`) so existing PWA installs invalidate the old cache.

## Conventions

- Pixel colors are always **hex strings `#rrggbb`** (lowercase) or `null` for transparent. Use `LayerManager.parseHex` / `LayerManager.toHex` rather than reimplementing.
- Pixel coordinates use a flat index `i = y * gridSize + x`. `DrawingTools.coordToIndex(x, y, size)` is the canonical converter.
- Canvas grid sizes are constrained to 8/16/32/48 (see `index.html` `#grid-size`); resizing goes through `LayerManager.resize` which preserves layer structure.
- Korean labels in the UI (`배경`, `브러시`, etc.) are intentional — keep bilingual strings consistent with surrounding code.
- No comments unless the *why* isn't obvious; the existing code is heavily JSDoc'd, follow that level when adding to a documented module.
