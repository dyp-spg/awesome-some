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
};

const canvas = document.getElementById('canvas');
const colorPicker = document.getElementById('color-picker');
const palette = document.getElementById('palette');
const gridSizeSelect = document.getElementById('grid-size');
const toggleGridBtn = document.getElementById('toggle-grid');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const toolButtons = document.querySelectorAll('[data-tool]');

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
            if (state.tool === 'eraser') {
                setTool('brush');
            }
        });
        palette.appendChild(el);
    });
}

function updatePaletteActive() {
    document.querySelectorAll('.palette-color').forEach((el, i) => {
        el.classList.toggle('active', DEFAULT_COLORS[i] === state.color);
    });
}

function createCanvas() {
    const size = state.gridSize;
    const maxCanvasWidth = Math.min(560, window.innerWidth - 40);
    const cellSize = Math.floor(maxCanvasWidth / size);

    canvas.innerHTML = '';
    canvas.style.gridTemplateColumns = `repeat(${size}, ${cellSize}px)`;
    canvas.style.gridTemplateRows = `repeat(${size}, ${cellSize}px)`;
    canvas.classList.toggle('show-grid', state.showGrid);

    state.pixels = [];

    for (let i = 0; i < size * size; i++) {
        const pixel = document.createElement('div');
        pixel.className = 'pixel';
        pixel.dataset.index = i;
        canvas.appendChild(pixel);
        state.pixels.push(pixel);
    }
}

function getPixelColor(pixel) {
    return pixel.style.backgroundColor || 'rgb(255, 255, 255)';
}

function setPixelColor(pixel, color) {
    pixel.style.backgroundColor = color;
}

function paint(pixel) {
    if (state.tool === 'brush') {
        setPixelColor(pixel, state.color);
    } else if (state.tool === 'eraser') {
        setPixelColor(pixel, '#ffffff');
    } else if (state.tool === 'fill') {
        floodFill(pixel);
    }
}

function floodFill(startPixel) {
    const targetColor = getPixelColor(startPixel);
    const fillColor = rgbFromHex(state.color);

    if (targetColor === fillColor) return;

    const size = state.gridSize;
    const startIndex = parseInt(startPixel.dataset.index);
    const visited = new Set();
    const stack = [startIndex];

    while (stack.length > 0) {
        const idx = stack.pop();
        if (visited.has(idx)) continue;
        if (idx < 0 || idx >= size * size) continue;

        const pixel = state.pixels[idx];
        if (getPixelColor(pixel) !== targetColor) continue;

        visited.add(idx);
        setPixelColor(pixel, state.color);

        const row = Math.floor(idx / size);
        const col = idx % size;

        if (col > 0) stack.push(idx - 1);
        if (col < size - 1) stack.push(idx + 1);
        if (row > 0) stack.push(idx - size);
        if (row < size - 1) stack.push(idx + size);
    }
}

function rgbFromHex(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
}

function setTool(tool) {
    state.tool = tool;
    toolButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });
}

function exportAsPNG() {
    const size = state.gridSize;
    const scale = Math.max(1, Math.floor(512 / size));
    const c = document.createElement('canvas');
    c.width = size * scale;
    c.height = size * scale;
    const ctx = c.getContext('2d');

    state.pixels.forEach((pixel, i) => {
        const row = Math.floor(i / size);
        const col = i % size;
        const color = pixel.style.backgroundColor || '#ffffff';
        ctx.fillStyle = color;
        ctx.fillRect(col * scale, row * scale, scale, scale);
    });

    const link = document.createElement('a');
    link.download = `pixel-art-${size}x${size}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
}

// Event listeners
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
    state.painting = false;
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
});

colorPicker.addEventListener('input', (e) => {
    state.color = e.target.value;
    updatePaletteActive();
    if (state.tool === 'eraser') {
        setTool('brush');
    }
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
    if (confirm('캔버스를 초기화하시겠습니까?')) {
        state.pixels.forEach(p => setPixelColor(p, '#ffffff'));
    }
});

exportBtn.addEventListener('click', exportAsPNG);

// Init
initPalette();
createCanvas();
