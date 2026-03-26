const DEFAULT_COLORS = [
    '#000000', '#ffffff', '#e94560', '#f5a623',
    '#f8e71c', '#7ed321', '#4a90d9', '#9013fe',
    '#50e3c2', '#b8e986', '#ff6b6b', '#c0392b',
    '#8b572a', '#7f8c8d', '#2c3e50', '#e0e0e0',
];

const state = {
    color: '#000000',
    tool: 'brush',
    gridSize: 16,
    showGrid: true,
    painting: false,
    shapeFilled: false,
    symmetryMode: 'none',
    pixels: [],
    layerManager: null,
    historyManager: new HistoryManager(50),
    animationManager: null,
    selectionManager: null,
    colorHistory: new ColorHistory(),
    shapeStart: null,
    shapePreview: [],
    selectStart: null,
};

// ---------------------------------------------------------------
//  DOM references
// ---------------------------------------------------------------

const canvas = document.getElementById('canvas');
const colorPicker = document.getElementById('color-picker');
const palette = document.getElementById('palette');
const gridSizeSelect = document.getElementById('grid-size');
const toggleGridBtn = document.getElementById('toggle-grid');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const toolButtons = document.querySelectorAll('[data-tool]');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const shapeFillToggle = document.getElementById('shape-fill-toggle');

// Layer panel
const layerList = document.getElementById('layer-list');
const addLayerBtn = document.getElementById('add-layer-btn');
const mergeLayerBtn = document.getElementById('merge-layer-btn');
const flattenBtn = document.getElementById('flatten-btn');
const deleteLayerBtn = document.getElementById('delete-layer-btn');

// Timeline
const frameStrip = document.getElementById('frame-strip');
const frameCounter = document.getElementById('frame-counter');
const addFrameBtn = document.getElementById('add-frame-btn');
const dupFrameBtn = document.getElementById('dup-frame-btn');
const delFrameBtn = document.getElementById('del-frame-btn');
const prevFrameBtn = document.getElementById('prev-frame-btn');
const nextFrameBtn = document.getElementById('next-frame-btn');
const playBtn = document.getElementById('play-btn');
const fpsInput = document.getElementById('fps-input');
const onionSkinBtn = document.getElementById('onion-skin-btn');

// File management
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const exportGifBtn = document.getElementById('export-gif-btn');
const exportSheetBtn = document.getElementById('export-sheet-btn');

// Color tools
const colorHarmony = document.getElementById('color-harmony');
const colorGradient = document.getElementById('color-gradient');
const colorHistoryEl = document.getElementById('color-history');

// Selection
const selectionBar = document.getElementById('selection-bar');
const selCopy = document.getElementById('sel-copy');
const selCut = document.getElementById('sel-cut');
const selPaste = document.getElementById('sel-paste');
const selDeselect = document.getElementById('sel-deselect');
const selFlipH = document.getElementById('sel-flip-h');
const selFlipV = document.getElementById('sel-flip-v');

// Symmetry
const symmetryMode = document.getElementById('symmetry-mode');

// ---------------------------------------------------------------
//  History helpers
// ---------------------------------------------------------------

function saveHistory() {
    state.historyManager.pushState(state.layerManager);
    updateUndoRedoButtons();
}

function performUndo() {
    const snapshot = state.historyManager.undo();
    if (snapshot) {
        state.layerManager = LayerManager.fromJSON(snapshot);
        renderCanvas();
        renderLayerPanel();
        updateUndoRedoButtons();
    }
}

function performRedo() {
    const snapshot = state.historyManager.redo();
    if (snapshot) {
        state.layerManager = LayerManager.fromJSON(snapshot);
        renderCanvas();
        renderLayerPanel();
        updateUndoRedoButtons();
    }
}

function updateUndoRedoButtons() {
    undoBtn.style.opacity = state.historyManager.canUndo() ? '1' : '0.4';
    redoBtn.style.opacity = state.historyManager.canRedo() ? '1' : '0.4';
}

// ---------------------------------------------------------------
//  Palette
// ---------------------------------------------------------------

function initPalette() {
    palette.innerHTML = '';
    DEFAULT_COLORS.forEach(color => {
        const el = document.createElement('div');
        el.className = 'palette-color' + (color === state.color ? ' active' : '');
        el.style.background = color;
        el.addEventListener('click', () => {
            state.color = color;
            colorPicker.value = color;
            updatePaletteActive();
            updateColorTools();
            if (state.tool === 'eraser') setTool('brush');
        });
        palette.appendChild(el);
    });
}

function updatePaletteActive() {
    document.querySelectorAll('.palette-color').forEach((el, i) => {
        el.classList.toggle('active', DEFAULT_COLORS[i] === state.color);
    });
}

// ---------------------------------------------------------------
//  Canvas
// ---------------------------------------------------------------

function createCanvas() {
    const size = state.gridSize;
    const maxCanvasWidth = Math.min(560, window.innerWidth - 40);
    const cellSize = Math.floor(maxCanvasWidth / size);

    canvas.innerHTML = '';
    canvas.style.gridTemplateColumns = `repeat(${size}, ${cellSize}px)`;
    canvas.style.gridTemplateRows = `repeat(${size}, ${cellSize}px)`;
    canvas.classList.toggle('show-grid', state.showGrid);

    state.pixels = [];

    if (!state.layerManager) {
        state.layerManager = new LayerManager(size * size);
    } else {
        state.layerManager.resize(size * size);
    }

    for (let i = 0; i < size * size; i++) {
        const pixel = document.createElement('div');
        pixel.className = 'pixel';
        pixel.dataset.index = i;
        canvas.appendChild(pixel);
        state.pixels.push(pixel);
    }

    state.historyManager.clear();
    saveHistory();
    renderCanvas();
    renderLayerPanel();
}

function renderCanvas() {
    const lm = state.layerManager;
    if (!lm) return;
    for (let i = 0; i < state.pixels.length; i++) {
        state.pixels[i].style.backgroundColor = lm.getCompositePixel(i);
    }
}

function renderPixel(index) {
    state.pixels[index].style.backgroundColor = state.layerManager.getCompositePixel(index);
}

// ---------------------------------------------------------------
//  Shape tool helpers
// ---------------------------------------------------------------

function isShapeTool(tool) {
    return tool === 'line' || tool === 'rect' || tool === 'circle';
}

function getShapePixels(startCoord, endCoord) {
    const { x: x0, y: y0 } = startCoord;
    const { x: x1, y: y1 } = endCoord;
    const size = state.gridSize;

    if (state.tool === 'line') {
        return DrawingTools.line(x0, y0, x1, y1);
    } else if (state.tool === 'rect') {
        return DrawingTools.rectangle(x0, y0, x1, y1, state.shapeFilled);
    } else if (state.tool === 'circle') {
        const cx = Math.round((x0 + x1) / 2);
        const cy = Math.round((y0 + y1) / 2);
        const radius = Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2);
        return DrawingTools.circle(cx, cy, radius, state.shapeFilled);
    }
    return [];
}

function clearShapePreview() {
    state.shapePreview.forEach(idx => renderPixel(idx));
    state.shapePreview = [];
}

function showShapePreview(startCoord, endCoord) {
    clearShapePreview();
    const coords = getShapePixels(startCoord, endCoord);
    const size = state.gridSize;

    coords.forEach(({ x, y }) => {
        const idx = DrawingTools.coordToIndex(x, y, size);
        if (idx >= 0 && idx < state.pixels.length) {
            state.pixels[idx].style.backgroundColor = state.color;
            state.shapePreview.push(idx);
        }
    });
}

function commitShape(startCoord, endCoord) {
    clearShapePreview();
    const lm = state.layerManager;
    const activeLayer = lm.getActiveLayer();
    if (!activeLayer || activeLayer.locked) return;

    const coords = getShapePixels(startCoord, endCoord);
    const size = state.gridSize;

    coords.forEach(({ x, y }) => {
        const idx = DrawingTools.coordToIndex(x, y, size);
        if (idx >= 0) {
            lm.setPixel(idx, state.color);
        }
    });

    renderCanvas();
    saveHistory();
    renderLayerPanel();
}

// ---------------------------------------------------------------
//  Drawing
// ---------------------------------------------------------------

function getSymmetryPoints(idx) {
    const size = state.gridSize;
    const coord = DrawingTools.indexToCoord(idx, size);
    if (!coord) return [idx];

    let points;
    switch (state.symmetryMode) {
        case 'horizontal': points = SymmetryTool.mirrorHorizontal(coord.x, coord.y, size); break;
        case 'vertical': points = SymmetryTool.mirrorVertical(coord.x, coord.y, size); break;
        case 'both': points = SymmetryTool.mirrorBoth(coord.x, coord.y, size); break;
        case 'radial4': points = SymmetryTool.radial(coord.x, coord.y, size, 4); break;
        case 'radial6': points = SymmetryTool.radial(coord.x, coord.y, size, 6); break;
        case 'radial8': points = SymmetryTool.radial(coord.x, coord.y, size, 8); break;
        default: return [idx];
    }

    return points
        .map(p => DrawingTools.coordToIndex(p.x, p.y, size))
        .filter(i => i >= 0);
}

function paint(pixel) {
    const lm = state.layerManager;
    const idx = parseInt(pixel.dataset.index);

    if (state.tool === 'brush') {
        const indices = getSymmetryPoints(idx);
        indices.forEach(i => { lm.setPixel(i, state.color); renderPixel(i); });
    } else if (state.tool === 'eraser') {
        const indices = getSymmetryPoints(idx);
        indices.forEach(i => { lm.setPixel(i, null); renderPixel(i); });
    } else if (state.tool === 'fill') {
        floodFill(idx);
        saveHistory();
        renderLayerPanel();
    } else if (state.tool === 'eyedropper') {
        const sampledColor = DrawingTools.eyedropper(idx, lm);
        if (sampledColor) {
            state.color = sampledColor;
            colorPicker.value = sampledColor;
            updatePaletteActive();
            updateColorTools();
        }
    }
}

function floodFill(startIndex) {
    const lm = state.layerManager;
    const activeLayer = lm.getActiveLayer();
    if (!activeLayer || activeLayer.locked) return;

    const targetColor = activeLayer.data[startIndex];
    const fillColor = state.color;
    if (targetColor === fillColor) return;

    const size = state.gridSize;
    const total = size * size;
    const visited = new Set();
    const stack = [startIndex];

    while (stack.length > 0) {
        const idx = stack.pop();
        if (visited.has(idx)) continue;
        if (idx < 0 || idx >= total) continue;
        if (activeLayer.data[idx] !== targetColor) continue;

        visited.add(idx);
        activeLayer.data[idx] = fillColor;

        const row = Math.floor(idx / size);
        const col = idx % size;

        if (col > 0) stack.push(idx - 1);
        if (col < size - 1) stack.push(idx + 1);
        if (row > 0) stack.push(idx - size);
        if (row < size - 1) stack.push(idx + size);
    }

    renderCanvas();
}

function setTool(tool) {
    state.tool = tool;
    toolButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    // Reset shape state
    state.shapeStart = null;
    clearShapePreview();
}

// ---------------------------------------------------------------
//  Layer Panel UI
// ---------------------------------------------------------------

function renderLayerPanel() {
    const lm = state.layerManager;
    if (!lm) return;

    layerList.innerHTML = '';
    const layers = [...lm.layers].reverse();

    layers.forEach(layer => {
        const item = document.createElement('div');
        item.className = 'layer-item' + (layer.id === lm.activeLayerId ? ' active' : '');
        item.addEventListener('click', (e) => {
            if (e.target.closest('.layer-visibility') || e.target.closest('.layer-lock') ||
                e.target.closest('.layer-opacity') || e.target.closest('.layer-name')) return;
            lm.setActiveLayer(layer.id);
            renderLayerPanel();
        });

        const thumb = document.createElement('canvas');
        thumb.className = 'layer-thumbnail';
        thumb.width = 32;
        thumb.height = 32;
        renderLayerThumbnail(thumb, layer);

        const visBtn = document.createElement('button');
        visBtn.className = 'layer-visibility' + (layer.visible ? '' : ' hidden');
        visBtn.textContent = layer.visible ? '👁' : '—';
        visBtn.title = '가시성 토글';
        visBtn.addEventListener('click', () => {
            lm.toggleVisibility(layer.id);
            renderCanvas();
            renderLayerPanel();
        });

        const nameInput = document.createElement('input');
        nameInput.className = 'layer-name';
        nameInput.type = 'text';
        nameInput.value = layer.name;
        nameInput.addEventListener('change', () => {
            lm.renameLayer(layer.id, nameInput.value);
        });
        nameInput.addEventListener('click', () => {
            lm.setActiveLayer(layer.id);
            renderLayerPanel();
            const newInput = layerList.querySelector('.layer-item.active .layer-name');
            if (newInput) newInput.focus();
        });

        const opacitySlider = document.createElement('input');
        opacitySlider.className = 'layer-opacity';
        opacitySlider.type = 'range';
        opacitySlider.min = '0';
        opacitySlider.max = '100';
        opacitySlider.value = String(Math.round(layer.opacity * 100));
        opacitySlider.title = `불투명도: ${Math.round(layer.opacity * 100)}%`;
        opacitySlider.addEventListener('input', () => {
            lm.setOpacity(layer.id, parseInt(opacitySlider.value) / 100);
            opacitySlider.title = `불투명도: ${opacitySlider.value}%`;
            renderCanvas();
        });

        const lockBtn = document.createElement('button');
        lockBtn.className = 'layer-lock' + (layer.locked ? ' locked' : '');
        lockBtn.textContent = layer.locked ? '🔒' : '🔓';
        lockBtn.title = '잠금 토글';
        lockBtn.addEventListener('click', () => {
            lm.toggleLock(layer.id);
            renderLayerPanel();
        });

        item.appendChild(visBtn);
        item.appendChild(thumb);
        item.appendChild(nameInput);
        item.appendChild(opacitySlider);
        item.appendChild(lockBtn);
        layerList.appendChild(item);
    });
}

function renderLayerThumbnail(canvasEl, layer) {
    const ctx = canvasEl.getContext('2d');
    const size = state.gridSize;
    const scale = 32 / size;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 32, 32);

    for (let i = 0; i < layer.data.length; i++) {
        if (layer.data[i] === null) continue;
        const row = Math.floor(i / size);
        const col = i % size;
        ctx.fillStyle = layer.data[i];
        ctx.globalAlpha = layer.opacity;
        ctx.fillRect(col * scale, row * scale, Math.ceil(scale), Math.ceil(scale));
    }
    ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------
//  Export
// ---------------------------------------------------------------

function exportAsPNG() {
    const size = state.gridSize;
    const lm = state.layerManager;
    const scale = Math.max(1, Math.floor(512 / size));
    const c = document.createElement('canvas');
    c.width = size * scale;
    c.height = size * scale;
    const ctx = c.getContext('2d');

    for (let i = 0; i < size * size; i++) {
        const row = Math.floor(i / size);
        const col = i % size;
        ctx.fillStyle = lm.getCompositePixel(i);
        ctx.fillRect(col * scale, row * scale, scale, scale);
    }

    const link = document.createElement('a');
    link.download = `pixel-art-${size}x${size}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
}

// ---------------------------------------------------------------
//  Event Listeners — Canvas (mouse)
// ---------------------------------------------------------------

function getPixelIndex(target) {
    return target.classList.contains('pixel') ? parseInt(target.dataset.index) : -1;
}

canvas.addEventListener('mousedown', (e) => {
    const idx = getPixelIndex(e.target);
    if (idx < 0) return;

    if (state.tool === 'select') {
        state.selectStart = DrawingTools.indexToCoord(idx, state.gridSize);
        state.painting = true;
    } else if (isShapeTool(state.tool)) {
        state.shapeStart = DrawingTools.indexToCoord(idx, state.gridSize);
        state.painting = true;
    } else {
        state.painting = true;
        paint(e.target);
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!state.painting) return;
    const idx = getPixelIndex(e.target);
    if (idx < 0) return;

    if (state.tool === 'select' && state.selectStart) {
        // Preview selection rect
        const endCoord = DrawingTools.indexToCoord(idx, state.gridSize);
        state.selectionManager.selectRect(state.selectStart.x, state.selectStart.y, endCoord.x, endCoord.y);
        updateSelectionVisuals();
    } else if (isShapeTool(state.tool) && state.shapeStart) {
        const endCoord = DrawingTools.indexToCoord(idx, state.gridSize);
        showShapePreview(state.shapeStart, endCoord);
    } else if (state.tool !== 'fill' && state.tool !== 'eyedropper') {
        paint(e.target);
    }
});

document.addEventListener('mouseup', (e) => {
    if (!state.painting) return;

    if (state.tool === 'select' && state.selectStart) {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const idx = target ? getPixelIndex(target) : -1;
        if (idx >= 0) {
            const endCoord = DrawingTools.indexToCoord(idx, state.gridSize);
            state.selectionManager.selectRect(state.selectStart.x, state.selectStart.y, endCoord.x, endCoord.y);
            updateSelectionVisuals();
        }
        state.selectStart = null;
        state.painting = false;
        return;
    }

    if (isShapeTool(state.tool) && state.shapeStart) {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        let idx = target ? getPixelIndex(target) : -1;
        if (idx < 0) {
            // If released outside canvas, use last known position from preview
            clearShapePreview();
        } else {
            const endCoord = DrawingTools.indexToCoord(idx, state.gridSize);
            commitShape(state.shapeStart, endCoord);
        }
        state.shapeStart = null;
    } else if (state.tool === 'brush' || state.tool === 'eraser') {
        saveHistory();
        renderLayerPanel();
    }

    state.painting = false;
});

// ---------------------------------------------------------------
//  Event Listeners — Canvas (touch)
// ---------------------------------------------------------------

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target) return;
    const idx = getPixelIndex(target);
    if (idx < 0) return;

    if (isShapeTool(state.tool)) {
        state.shapeStart = DrawingTools.indexToCoord(idx, state.gridSize);
        state.painting = true;
    } else {
        state.painting = true;
        paint(target);
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!state.painting) return;
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target) return;
    const idx = getPixelIndex(target);
    if (idx < 0) return;

    if (isShapeTool(state.tool) && state.shapeStart) {
        const endCoord = DrawingTools.indexToCoord(idx, state.gridSize);
        showShapePreview(state.shapeStart, endCoord);
    } else if (state.tool !== 'fill' && state.tool !== 'eyedropper') {
        paint(target);
    }
});

canvas.addEventListener('touchend', (e) => {
    if (!state.painting) return;

    if (isShapeTool(state.tool) && state.shapeStart) {
        // Commit with last preview position
        if (state.shapePreview.length > 0) {
            // Re-derive end from last preview - just commit current preview pixels
            const lm = state.layerManager;
            const activeLayer = lm.getActiveLayer();
            if (activeLayer && !activeLayer.locked) {
                clearShapePreview();
                // We need to re-apply since clearShapePreview reverted
                // Use touch end position
                const touch = e.changedTouches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                if (target) {
                    const idx = getPixelIndex(target);
                    if (idx >= 0) {
                        const endCoord = DrawingTools.indexToCoord(idx, state.gridSize);
                        commitShape(state.shapeStart, endCoord);
                    }
                }
            }
        }
        state.shapeStart = null;
    } else if (state.tool === 'brush' || state.tool === 'eraser') {
        saveHistory();
        renderLayerPanel();
    }

    state.painting = false;
});

// ---------------------------------------------------------------
//  Event Listeners — Toolbar
// ---------------------------------------------------------------

colorPicker.addEventListener('input', (e) => {
    state.color = e.target.value;
    updatePaletteActive();
    updateColorTools();
    if (state.tool === 'eraser') setTool('brush');
});

toolButtons.forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
});

gridSizeSelect.addEventListener('change', (e) => {
    state.gridSize = parseInt(e.target.value);
    createCanvas();
});

toggleGridBtn.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    toggleGridBtn.classList.toggle('active', state.showGrid);
    canvas.classList.toggle('show-grid', state.showGrid);
});

clearBtn.addEventListener('click', () => {
    if (confirm('현재 레이어를 초기화하시겠습니까?')) {
        const layer = state.layerManager.getActiveLayer();
        if (layer && !layer.locked) {
            layer.data.fill(null);
            renderCanvas();
            saveHistory();
            renderLayerPanel();
        }
    }
});

exportBtn.addEventListener('click', exportAsPNG);

// Undo/Redo buttons
undoBtn.addEventListener('click', performUndo);
redoBtn.addEventListener('click', performRedo);

// Shape fill toggle
shapeFillToggle.addEventListener('click', () => {
    state.shapeFilled = !state.shapeFilled;
    shapeFillToggle.textContent = state.shapeFilled ? '■' : '☐';
    shapeFillToggle.classList.toggle('active', state.shapeFilled);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        performRedo();
    }
});

// ---------------------------------------------------------------
//  Event Listeners — Layer Panel
// ---------------------------------------------------------------

addLayerBtn.addEventListener('click', () => {
    state.layerManager.addLayer();
    saveHistory();
    renderCanvas();
    renderLayerPanel();
});

deleteLayerBtn.addEventListener('click', () => {
    const lm = state.layerManager;
    if (lm.layers.length <= 1) {
        alert('마지막 레이어는 삭제할 수 없습니다.');
        return;
    }
    if (confirm('현재 레이어를 삭제하시겠습니까?')) {
        lm.removeLayer(lm.activeLayerId);
        saveHistory();
        renderCanvas();
        renderLayerPanel();
    }
});

mergeLayerBtn.addEventListener('click', () => {
    const lm = state.layerManager;
    if (!lm.mergeDown(lm.activeLayerId)) {
        alert('아래 레이어와 병합할 수 없습니다.');
        return;
    }
    saveHistory();
    renderCanvas();
    renderLayerPanel();
});

flattenBtn.addEventListener('click', () => {
    if (confirm('모든 레이어를 하나로 병합하시겠습니까?')) {
        state.layerManager.flattenAll();
        saveHistory();
        renderCanvas();
        renderLayerPanel();
    }
});

// ---------------------------------------------------------------
//  Animation Timeline UI
// ---------------------------------------------------------------

function saveCurrentFrameToAnimation() {
    if (state.animationManager) {
        state.animationManager.setCurrentFrame(state.layerManager.toJSON());
    }
}

function switchToFrame(index) {
    saveCurrentFrameToAnimation();
    const frameData = state.animationManager.goToFrame(index);
    if (frameData) {
        state.layerManager = LayerManager.fromJSON(frameData);
        state.historyManager.clear();
        saveHistory();
        renderCanvas();
        renderLayerPanel();
        renderTimeline();
    }
}

function renderTimeline() {
    const am = state.animationManager;
    if (!am) return;

    frameCounter.textContent = `${am.currentFrameIndex + 1} / ${am.getFrameCount()}`;
    frameStrip.innerHTML = '';

    const allFrames = am.getAllFrames();
    allFrames.forEach((frameData, i) => {
        const thumb = document.createElement('canvas');
        thumb.className = 'frame-thumb' + (i === am.currentFrameIndex ? ' active' : '');
        thumb.width = 48;
        thumb.height = 48;

        // Render composite of this frame
        const tempLM = LayerManager.fromJSON(frameData);
        const ctx = thumb.getContext('2d');
        const size = state.gridSize;
        const scale = 48 / size;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 48, 48);

        for (let j = 0; j < size * size; j++) {
            const color = tempLM.getCompositePixel(j);
            if (color !== '#ffffff') {
                const row = Math.floor(j / size);
                const col = j % size;
                ctx.fillStyle = color;
                ctx.fillRect(col * scale, row * scale, Math.ceil(scale), Math.ceil(scale));
            }
        }

        thumb.addEventListener('click', () => switchToFrame(i));
        frameStrip.appendChild(thumb);
    });

    playBtn.textContent = am.playing ? '⏸' : '▶';
}

function getCompositeFrames() {
    const am = state.animationManager;
    saveCurrentFrameToAnimation();
    const allFrames = am.getAllFrames();
    return allFrames.map(frameData => {
        const tempLM = LayerManager.fromJSON(frameData);
        return tempLM.getCompositeImage();
    });
}

// Timeline events
addFrameBtn.addEventListener('click', () => {
    saveCurrentFrameToAnimation();
    state.animationManager.addFrame();
    const frameData = state.animationManager.getCurrentFrame();
    state.layerManager = new LayerManager(state.gridSize * state.gridSize);
    state.animationManager.setCurrentFrame(state.layerManager.toJSON());
    state.historyManager.clear();
    saveHistory();
    renderCanvas();
    renderLayerPanel();
    renderTimeline();
});

dupFrameBtn.addEventListener('click', () => {
    saveCurrentFrameToAnimation();
    state.animationManager.duplicateFrame();
    const frameData = state.animationManager.getCurrentFrame();
    state.layerManager = LayerManager.fromJSON(frameData);
    state.historyManager.clear();
    saveHistory();
    renderCanvas();
    renderLayerPanel();
    renderTimeline();
});

delFrameBtn.addEventListener('click', () => {
    const am = state.animationManager;
    if (am.getFrameCount() <= 1) return;
    am.deleteFrame(am.currentFrameIndex);
    const frameData = am.getCurrentFrame();
    state.layerManager = LayerManager.fromJSON(frameData);
    state.historyManager.clear();
    saveHistory();
    renderCanvas();
    renderLayerPanel();
    renderTimeline();
});

prevFrameBtn.addEventListener('click', () => {
    const am = state.animationManager;
    if (am.currentFrameIndex > 0) switchToFrame(am.currentFrameIndex - 1);
});

nextFrameBtn.addEventListener('click', () => {
    const am = state.animationManager;
    if (am.currentFrameIndex < am.getFrameCount() - 1) switchToFrame(am.currentFrameIndex + 1);
});

playBtn.addEventListener('click', () => {
    const am = state.animationManager;
    if (am.playing) {
        am.stop();
        renderTimeline();
    } else {
        saveCurrentFrameToAnimation();
        am.play((frameData, frameIndex) => {
            state.layerManager = LayerManager.fromJSON(frameData);
            renderCanvas();
            renderTimeline();
        });
        renderTimeline();
    }
});

fpsInput.addEventListener('change', () => {
    state.animationManager.setFps(parseInt(fpsInput.value) || 8);
});

onionSkinBtn.addEventListener('click', () => {
    const am = state.animationManager;
    am.onionSkinEnabled = !am.onionSkinEnabled;
    onionSkinBtn.classList.toggle('active', am.onionSkinEnabled);
});

// ---------------------------------------------------------------
//  File Management Events
// ---------------------------------------------------------------

saveBtn.addEventListener('click', () => {
    saveCurrentFrameToAnimation();
    FileManager.saveProject({
        gridSize: state.gridSize,
        layers: state.layerManager.toJSON(),
        animation: state.animationManager.toJSON(),
    });
});

loadBtn.addEventListener('click', () => {
    FileManager.loadProject((data) => {
        if (!data) return;
        state.gridSize = data.gridSize;
        gridSizeSelect.value = String(data.gridSize);
        state.layerManager = LayerManager.fromJSON(data.layers);
        if (data.animation) {
            state.animationManager = AnimationManager.fromJSON(data.animation);
        } else {
            state.animationManager = new AnimationManager(data.gridSize);
            state.animationManager.setCurrentFrame(state.layerManager.toJSON());
        }
        state.historyManager.clear();

        // Rebuild canvas DOM
        const size = state.gridSize;
        const maxCanvasWidth = Math.min(560, window.innerWidth - 40);
        const cellSize = Math.floor(maxCanvasWidth / size);
        canvas.innerHTML = '';
        canvas.style.gridTemplateColumns = `repeat(${size}, ${cellSize}px)`;
        canvas.style.gridTemplateRows = `repeat(${size}, ${cellSize}px)`;
        state.pixels = [];
        for (let i = 0; i < size * size; i++) {
            const pixel = document.createElement('div');
            pixel.className = 'pixel';
            pixel.dataset.index = i;
            canvas.appendChild(pixel);
            state.pixels.push(pixel);
        }

        saveHistory();
        renderCanvas();
        renderLayerPanel();
        renderTimeline();
    });
});

exportGifBtn.addEventListener('click', () => {
    const frames = getCompositeFrames();
    if (frames.length === 0) return;
    FileManager.exportGIF(frames, state.gridSize, state.animationManager.fps);
});

exportSheetBtn.addEventListener('click', () => {
    const frames = getCompositeFrames();
    if (frames.length === 0) return;
    const columns = Math.min(frames.length, 8);
    FileManager.exportSpriteSheet(frames, state.gridSize, columns);
});

// ---------------------------------------------------------------
//  Color Tools UI
// ---------------------------------------------------------------

function updateColorTools() {
    // Harmony
    const harmonies = ColorTools.analogous(state.color);
    const complements = ColorTools.complementary(state.color);
    const allHarmony = [...harmonies, ...complements.slice(1)];

    colorHarmony.innerHTML = '';
    allHarmony.forEach(hex => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.background = hex;
        swatch.addEventListener('click', () => pickColor(hex));
        colorHarmony.appendChild(swatch);
    });

    // Gradient
    const grad = ColorTools.gradient(state.color, complements[1] || '#ffffff', 8);
    colorGradient.innerHTML = '';
    grad.forEach(hex => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.background = hex;
        swatch.addEventListener('click', () => pickColor(hex));
        colorGradient.appendChild(swatch);
    });

    // History
    state.colorHistory.add(state.color);
    renderColorHistory();
}

function renderColorHistory() {
    colorHistoryEl.innerHTML = '';
    state.colorHistory.getAll().forEach(hex => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.background = hex;
        swatch.addEventListener('click', () => pickColor(hex));
        colorHistoryEl.appendChild(swatch);
    });
}

function pickColor(hex) {
    state.color = hex;
    colorPicker.value = hex;
    updatePaletteActive();
    updateColorTools();
    if (state.tool === 'eraser') setTool('brush');
}

// ---------------------------------------------------------------
//  Selection Tool Events
// ---------------------------------------------------------------

function updateSelectionVisuals() {
    const sm = state.selectionManager;
    state.pixels.forEach((pixel, i) => {
        pixel.classList.toggle('selected', sm.isSelected(i));
    });
    selectionBar.style.display = sm.getSelectedIndices().length > 0 ? 'flex' : 'none';
}

selCopy.addEventListener('click', () => {
    state.selectionManager.copy(state.layerManager);
});

selCut.addEventListener('click', () => {
    state.selectionManager.cut(state.layerManager);
    saveHistory();
    renderCanvas();
    renderLayerPanel();
    updateSelectionVisuals();
});

selPaste.addEventListener('click', () => {
    state.selectionManager.paste(state.layerManager, 0, 0);
    saveHistory();
    renderCanvas();
    renderLayerPanel();
});

selDeselect.addEventListener('click', () => {
    state.selectionManager.deselect();
    updateSelectionVisuals();
});

selFlipH.addEventListener('click', () => {
    state.selectionManager.flipHorizontal(state.layerManager);
    saveHistory();
    renderCanvas();
    renderLayerPanel();
});

selFlipV.addEventListener('click', () => {
    state.selectionManager.flipVertical(state.layerManager);
    saveHistory();
    renderCanvas();
    renderLayerPanel();
});

// ---------------------------------------------------------------
//  Symmetry Mode
// ---------------------------------------------------------------

symmetryMode.addEventListener('change', () => {
    state.symmetryMode = symmetryMode.value;
});

// ---------------------------------------------------------------
//  Init
// ---------------------------------------------------------------

initPalette();
createCanvas();

// Initialize managers
state.animationManager = new AnimationManager(state.gridSize);
state.animationManager.setCurrentFrame(state.layerManager.toJSON());
state.selectionManager = new SelectionManager(state.gridSize);
renderTimeline();
updateColorTools();
