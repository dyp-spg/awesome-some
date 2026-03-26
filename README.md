# Pixel Art Creator

**Browser-based pixel art drawing tool / 브라우저 기반 픽셀 아트 그리기 도구**

Create pixel art, animations, and sprite sheets directly in your browser with no dependencies or installation required.
설치 없이 브라우저에서 바로 픽셀 아트, 애니메이션, 스프라이트 시트를 만들 수 있습니다.

---

## Features / 기능

### Drawing Tools / 그리기 도구
- **Brush** (브러시) -- freehand pixel drawing
- **Eraser** (지우개) -- remove pixels from the active layer
- **Fill** (채우기) -- flood-fill a contiguous region
- **Line** (직선) -- Bresenham's line algorithm for pixel-perfect lines
- **Rectangle** (사각형) -- outline or filled rectangles
- **Circle** (원) -- midpoint circle algorithm, outline or filled
- **Eyedropper** (스포이드) -- sample the composite color from any pixel
- **Shape fill toggle** -- switch between outline and filled shapes

### Layer System / 레이어
- Multi-layer support with add, delete, duplicate
- Per-layer visibility toggle, opacity control (0--1), and lock
- Reorder layers (move up/down)
- Merge down and flatten all
- Layer rename

### Animation / 애니메이션
- Frame-based timeline with add, duplicate, delete frames
- Playback with play/stop controls
- Onion skin overlay (previous frame in red, next frame in blue)
- Adjustable FPS (1--60)
- Frame navigation (previous/next)

### Color Tools / 색상 도구
- HSL color space conversion
- Color harmony generators: complementary, triadic, analogous, split-complementary
- Gradient generator (HSL interpolation with shortest hue path)
- Lighten, darken, saturate, desaturate manipulation
- Color history (up to 24 recent colors)
- 16-color default palette + custom color picker

### Selection / 선택
- Rectangular selection tool
- Copy, cut, paste with offset support
- Move selected pixels
- Flip horizontal / flip vertical within selection bounds
- Select all, deselect, invert selection

### Symmetry / 대칭
- Horizontal mirror (좌우)
- Vertical mirror (상하)
- Both axes / 4-way (4방향)
- Radial 4 / 6 / 8 (회전 대칭)
- Diagonal mirror
- Pattern tile preview

### File Management / 파일 관리
- **Save/Load project** -- `.pxl` JSON format preserving all layers, frames, and settings
- **PNG export** -- single frame at native resolution
- **GIF export** -- animated GIF with built-in LZW encoder (no external libraries)
- **Sprite sheet export** -- all frames arranged in a grid as PNG

### Templates & Gallery / 템플릿 & 갤러리
- Built-in templates: blank canvas, heart, smiley, star, tree, rocket
- localStorage-backed gallery to save and browse your creations
- Thumbnail generation for gallery items

### UI & Display / UI
- **4 themes**: Dark (다크), Light (라이트), Midnight (미드나잇), Forest (포레스트)
- Zoom in/out (0.5x -- 4.0x) with pan support
- Grid line toggle
- Canvas sizes: 8x8, 16x16, 32x32, 48x48
- Undo/Redo (up to 50 states)
- Touch device support

### PWA Support
- Service Worker with cache-first strategy for full offline use
- Web App Manifest for home screen installation
- Works without an internet connection after first load

---

## Keyboard Shortcuts / 키보드 단축키

| Key / 키 | Action / 동작 |
|-----------|---------------|
| `B` | Brush / 브러시 |
| `E` | Eraser / 지우개 |
| `G` | Fill / 채우기 |
| `L` | Line / 직선 |
| `R` | Rectangle / 사각형 |
| `C` | Circle / 원 |
| `I` | Eyedropper / 스포이드 |
| `S` | Select / 선택 |
| `+` / `=` | Zoom in / 확대 |
| `-` | Zoom out / 축소 |
| `0` | Reset zoom / 줌 초기화 |
| `[` | Previous frame / 이전 프레임 |
| `]` | Next frame / 다음 프레임 |
| `Ctrl+Z` | Undo / 실행 취소 |
| `Ctrl+Y` | Redo / 다시 실행 |

---

## Getting Started / 시작하기

Just open `index.html` in any modern browser. No build step, no server required.

브라우저에서 `index.html`을 열면 바로 사용할 수 있습니다.

```bash
# Optionally serve with a local server for PWA support
# PWA 기능을 위해 로컬 서버로 실행할 수도 있습니다
python3 -m http.server 8080
```

---

## Tech Stack / 기술 스택

- **Vanilla HTML / CSS / JavaScript** -- no frameworks, no dependencies
- HTML5 Canvas API for high-performance rendering
- Self-contained GIF encoder (LZW compression)
- Service Worker + Web App Manifest for PWA
- localStorage for gallery persistence and theme preference

---

## File Structure / 파일 구조

| File | Description |
|------|-------------|
| `index.html` | Main HTML structure and UI layout |
| `style.css` | All styles, CSS variables for theming |
| `app.js` | Application entry point, state management, event wiring |
| `ui.js` | ThemeManager, ZoomManager, KeyboardShortcutManager |
| `renderer.js` | Canvas-based pixel renderer with dirty-tracking and rAF loop |
| `layers.js` | LayerManager -- multi-layer system with compositing and alpha blending |
| `history.js` | HistoryManager -- undo/redo with snapshot-based state tracking |
| `tools.js` | DrawingTools -- line, rectangle, circle algorithms and eyedropper |
| `colortools.js` | ColorTools -- HSL conversion, harmony, gradient, color history |
| `selection.js` | SelectionManager -- rect select, clipboard, move, flip transforms |
| `symmetry.js` | SymmetryTool -- mirror modes, radial symmetry, tile preview, rotation |
| `animation.js` | AnimationManager -- frame timeline, playback, onion skin |
| `filemanager.js` | FileManager + SimpleGIFEncoder -- save/load, PNG/GIF/sprite export |
| `gallery.js` | TemplateGallery -- built-in templates and localStorage gallery |
| `sw.js` | Service Worker -- cache-first offline support |
| `manifest.json` | PWA Web App Manifest |
| `icon.svg` | Application icon |

---

## License

MIT
