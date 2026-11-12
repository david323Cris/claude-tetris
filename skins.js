'use strict';

// Módulo de skins puro: sin DOM ni estado global (solo recibe un contexto 2D).
// Se carga con <script> en el navegador (global `Skins`) y con require() en Node (tests).
// Orden de colores: I, O, T, S, Z, J, L, Tuerca, Cruz, U, Y, Single, Comodín (índice 0 = null).

const RETRO_COLORS = [
  null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d',
  '#b0bec5', '#f06292', '#4db6ac', '#dce775', '#ff8a65', '#eceff1',
];
const RETRO_LIGHT = [
  null, '#00acc1', '#f9a825', '#8e24aa', '#43a047', '#e53935', '#1e88e5', '#fb8c00',
  '#78909c', '#d81b60', '#00897b', '#9e9d24', '#f4511e', '#90a4ae',
];
const NEON_COLORS = [
  null, '#00e5ff', '#ffea00', '#d500f9', '#00e676', '#ff1744', '#448aff', '#ff9100',
  '#b0bec5', '#ff4081', '#1de9b6', '#c6ff00', '#ff6e40', '#ffffff',
];
const PASTEL_COLORS = [
  null, '#a8e6ef', '#fff1b8', '#d9b8e8', '#bde5bf', '#f5b7b7', '#bbdcf7', '#fbd3a1',
  '#cfd8dc', '#f8bbd0', '#a7dbd4', '#e6efae', '#ffccbc', '#f5f7f8',
];
const PASTEL_LIGHT = [
  null, '#7fd3e0', '#f7d97a', '#c597dc', '#9fd6a2', '#ec9a9a', '#93c4f0', '#f5b977',
  '#b0bec5', '#f2a0bb', '#82c9c0', '#d3e07f', '#ffab91', '#cfd8dc',
];
const PIXEL_COLORS = [
  null, '#29b6f6', '#fdd835', '#ab47bc', '#66bb6a', '#ef5350', '#5c6bc0', '#ffa726',
  '#90a4ae', '#ec407a', '#26a69a', '#c0ca33', '#ff7043', '#cfd8dc',
];
const PIXEL_LIGHT = [
  null, '#0288d1', '#f9a825', '#8e24aa', '#388e3c', '#d32f2f', '#3949ab', '#ef6c00',
  '#607d8b', '#c2185b', '#00796b', '#827717', '#e64a19', '#90a4ae',
];

// Retro: bloque plano con brillo superior
function drawRetro(context, x, y, color, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

// Neon: relleno translúcido + contorno con resplandor (shadowBlur)
function drawNeon(context, x, y, color, size, alpha) {
  const px = x * size + 2;
  const py = y * size + 2;
  const s = size - 4;
  const a = alpha ?? 1;
  context.shadowColor = color;
  context.shadowBlur = 12;
  context.fillStyle = color;
  context.globalAlpha = a * 0.35;
  context.fillRect(px, py, s, s);
  context.globalAlpha = a;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 1, py + 1, s - 2, s - 2);
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  context.globalAlpha = 1;
}

// Rectángulo redondeado con arcTo (sin roundRect, por compatibilidad)
function roundedRectPath(context, px, py, w, h, r) {
  context.beginPath();
  context.moveTo(px + r, py);
  context.arcTo(px + w, py, px + w, py + h, r);
  context.arcTo(px + w, py + h, px, py + h, r);
  context.arcTo(px, py + h, px, py, r);
  context.arcTo(px, py, px + w, py, r);
  context.closePath();
}

// Pastel: colores suaves con bordes redondeados
function drawPastel(context, x, y, color, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  roundedRectPath(context, x * size + 1.5, y * size + 1.5, size - 3, size - 3, size * 0.28);
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.55)';
  context.lineWidth = 1.5;
  context.stroke();
  context.globalAlpha = 1;
}

// Pixel art: tablero de ajedrez 4x4 con bisel claro/oscuro
function drawPixel(context, x, y, color, size, alpha) {
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  const cell = Math.max(1, Math.floor(s / 4));
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  context.fillStyle = 'rgba(255,255,255,0.22)';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if ((i + j) % 2 === 0) context.fillRect(px + i * cell, py + j * cell, cell, cell);
    }
  }
  context.fillStyle = 'rgba(255,255,255,0.45)'; // bisel superior/izquierdo
  context.fillRect(px, py, s, cell);
  context.fillRect(px, py, cell, s);
  context.fillStyle = 'rgba(0,0,0,0.35)'; // bisel inferior/derecho
  context.fillRect(px, py + s - cell, s, cell);
  context.fillRect(px + s - cell, py, cell, s);
  context.globalAlpha = 1;
}

const SKINS = {
  retro:  { label: 'Retro', colors: RETRO_COLORS, colorsLight: RETRO_LIGHT, drawBlock: drawRetro },
  neon:   { label: 'Neon', colors: NEON_COLORS, colorsLight: NEON_COLORS, boardBg: '#000000', grid: '#1a1a24', drawBlock: drawNeon },
  pastel: { label: 'Pastel', colors: PASTEL_COLORS, colorsLight: PASTEL_LIGHT, drawBlock: drawPastel },
  pixel:  { label: 'Pixel art', colors: PIXEL_COLORS, colorsLight: PIXEL_LIGHT, drawBlock: drawPixel },
};
const NAMES = Object.keys(SKINS);

function get(name) {
  return Object.prototype.hasOwnProperty.call(SKINS, name) ? SKINS[name] : SKINS.retro;
}

const Skins = { SKINS, NAMES, get };

if (typeof module !== 'undefined' && module.exports) module.exports = Skins;
