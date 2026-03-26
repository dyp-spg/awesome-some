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
    pixels: [],
    layerManager: null,
};

const canvas = document.getElementById('canvas');
const colorPicker = document.getElementById('color-picker');
const palette = document.getElementById('palette');
const gridSizeSelect = document.getElementById('grid-size');
const toggleGridBtn = document.getElementById('toggle-grid');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const toolButtons = document.querySelectorAll('[data-tool]');

// Layer panel elements
const layerList = document.getElementById('layer-list');
const addLayerBtn = document.getElementById('add-layer-btn');
const mergeLayerBtn = document.getElementById('merge-layer-btn');
const flattenBtn = document.getElementById('flatten-btn');
const deleteLayerBtn = document.getElementById('delete-layer-btn');

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

    // Create or resize the layer manager
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

// ---------------------------------------------------------------
//  Drawing
// ---------------------------------------------------------------

function paint(pixel) {
    const lm = state.layerManager;
    const idx = parseInt(pixel.dataset.index);

    if (state.tool === 'brush') {
        lm.setPixel(idx, state.color);
        renderPixel(idx);
    } else if (state.tool === 'eraser') {
        lm.setPixel(idx, null);
        renderPixel(idx);
    } else if (state.tool === 'fill') {
        floodFill(idx);
    }
}

function renderPixel(index) {
    state.pixels[index].style.backgroundColor = state.layerManager.getCompositePixel(index);
}

function floodFill(startIndex) {
    const lm = state.layerManager;
    const activeLayer = lm.getActiveLayer();
    if (!activeLayer || activeLayer.locked) return;

    const targetColor = activeLayer.data[startIndex]; // null or hex
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
}

// ---------------------------------------------------------------
//  Layer Panel UI
// ---------------------------------------------------------------

function renderLayerPanel() {
    const lm = state.layerManager;
    if (!lm) return;

    layerList.innerHTML = '';

    // Render layers top-to-bottom (reverse order since top layer = last in array)
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

        // Thumbnail
        const thumb = document.createElement('canvas');
        thumb.className = 'layer-thumbnail';
        thumb.width = 32;
        thumb.height = 32;
        renderLayerThumbnail(thumb, layer);

        // Visibility toggle
        const visBtn = document.createElement('button');
        visBtn.className = 'layer-visibility' + (layer.visible ? '' : ' hidden');
        visBtn.textContent = layer.visible ? '👁' : '—';
        visBtn.title = '가시성 토글';
        visBtn.addEventListener('click', () => {
            lm.toggleVisibility(layer.id);
            renderCanvas();
            renderLayerPanel();
        });

        // Name input
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
            // Re-focus the input after re-render
            const newInput = layerList.querySelector(`.layer-item.active .layer-name`);
            if (newInput) newInput.focus();
        });

        // Opacity slider
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

        // Lock button
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
//  Event Listeners — Canvas
// ---------------------------------------------------------------

canvas.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('pixel')) {
        state.painting = true;
        paint(e.target);
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (state.painting && state.tool !== 'fill' && e.target.classList.contains('pixel')) {
        paint(e.target);
    }
});

document.addEventListener('mouseup', () => {
    if (state.painting) {
        state.painting = false;
        renderLayerPanel(); // Update thumbnails after stroke
    }
});

// Touch support
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && target.classList.contains('pixel')) {
        state.painting = true;
        paint(target);
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!state.painting || state.tool === 'fill') return;
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && target.classList.contains('pixel')) {
        paint(target);
    }
});

canvas.addEventListener('touchend', () => {
    state.painting = false;
    renderLayerPanel();
});

// ---------------------------------------------------------------
//  Event Listeners — Toolbar
// ---------------------------------------------------------------

colorPicker.addEventListener('input', (e) => {
    state.color = e.target.value;
    updatePaletteActive();
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
            renderLayerPanel();
        }
    }
});

exportBtn.addEventListener('click', exportAsPNG);

// ---------------------------------------------------------------
//  Event Listeners — Layer Panel
// ---------------------------------------------------------------

addLayerBtn.addEventListener('click', () => {
    state.layerManager.addLayer();
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
    renderCanvas();
    renderLayerPanel();
});

flattenBtn.addEventListener('click', () => {
    if (confirm('모든 레이어를 하나로 병합하시겠습니까?')) {
        state.layerManager.flattenAll();
        renderCanvas();
        renderLayerPanel();
    }
});

// ---------------------------------------------------------------
//  Init
// ---------------------------------------------------------------

initPalette();
createCanvas();
