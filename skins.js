'use strict';
// Módulo de skins (apariencia de los bloques). Sin acceso al DOM: las funciones de dibujo
// reciben el contexto de canvas. Global `Skins` en el navegador, `require` en Node.
// Cada skin define: nombre, paleta (oscura/clara), fondo/rejilla del tablero (null = usa el
// tema claro/oscuro) y `drawBlock(ctx, px, py, size, color)` que pinta un bloque en píxeles.

const SKIN_STORAGE_KEY = 'tetris-skin';
const DEFAULT_SKIN = 'retro';

const RETRO_DARK = [
  null,
  '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#b0bec5',
  '#f06292', '#4db6ac', '#dce775', '#ff8a65', '#eceff1', '#607d8b', '#8d6e63',
];
const RETRO_LIGHT = [
  null,
  '#00acc1', '#f9a825', '#8e24aa', '#43a047', '#e53935', '#1e88e5', '#fb8c00', '#78909c',
  '#d81b60', '#00897b', '#9e9d24', '#f4511e', '#90a4ae', '#455a64', '#6d4c41',
];
const NEON = [
  null,
  '#00f0ff', '#fff200', '#d500f9', '#39ff14', '#ff1744', '#2979ff', '#ff9100', '#c0c0ff',
  '#ff4081', '#1de9b6', '#c6ff00', '#ff6e40', '#ffffff', '#78909c', '#a1887f',
];
const PASTEL = [
  null,
  '#a8e6ef', '#fff1a8', '#d7b8e8', '#b9e8bf', '#f4b6b6', '#b5d3f3', '#ffd3a1', '#d5dde1',
  '#f8bbd0', '#a7dbd5', '#e8efb0', '#ffc6b3', '#f5f7f8', '#a9b7bf', '#bcaaa4',
];
const PIXEL = [
  null,
  '#29b6f6', '#fdd835', '#ab47bc', '#66bb6a', '#ef5350', '#5c6bc0', '#ffa726', '#90a4ae',
  '#ec407a', '#26a69a', '#cddc39', '#ff7043', '#cfd8dc', '#546e7a', '#795548',
];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawRetro(ctx, px, py, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawNeon(ctx, px, py, size, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.45;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
  ctx.shadowBlur = 0;
  ctx.globalAlpha *= 0.35;
  ctx.fillStyle = color;
  ctx.fillRect(px + 5, py + 5, size - 10, size - 10);
  ctx.restore();
}

function drawPastel(ctx, px, py, size, color) {
  const r = size * 0.28;
  ctx.fillStyle = color;
  roundRect(ctx, px + 1.5, py + 1.5, size - 3, size - 3, r);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  roundRect(ctx, px + size * 0.2, py + size * 0.14, size * 0.6, size * 0.14, size * 0.07);
  ctx.fill();
}

function drawPixel(ctx, px, py, size, color) {
  const u = Math.max(1, Math.round(size / 6)); // "píxel" grande: 6x6 por bloque
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; // damero de textura
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 6; j++)
      if ((i + j) % 2 === 0) ctx.fillRect(px + 1 + i * u, py + 1 + j * u, Math.min(u, size - 2 - i * u), Math.min(u, size - 2 - j * u));
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; // brillo en esquina superior-izquierda
  ctx.fillRect(px + 1, py + 1, size - 2, u);
  ctx.fillRect(px + 1, py + 1, u, size - 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; // sombra inferior-derecha
  ctx.fillRect(px + 1, py + size - 1 - u, size - 2, u);
  ctx.fillRect(px + size - 1 - u, py + 1, u, size - 2);
}

const SKINS = {
  retro:  { id: 'retro',  name: 'Retro',     dark: RETRO_DARK, light: RETRO_LIGHT, boardBg: null, grid: null, drawBlock: drawRetro },
  neon:   { id: 'neon',   name: 'Neon',      dark: NEON,       light: NEON,        boardBg: '#000000', grid: '#10101c', drawBlock: drawNeon },
  pastel: { id: 'pastel', name: 'Pastel',    dark: PASTEL,     light: PASTEL,      boardBg: null, grid: null, drawBlock: drawPastel },
  pixel:  { id: 'pixel',  name: 'Pixel art', dark: PIXEL,      light: PIXEL,       boardBg: null, grid: null, drawBlock: drawPixel },
};

function isValidSkin(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(SKINS, id);
}

function getSkin(id) {
  return isValidSkin(id) ? SKINS[id] : SKINS[DEFAULT_SKIN];
}

function getPalette(id, theme) {
  const s = getSkin(id);
  return theme === 'light' ? s.light : s.dark;
}

function loadSkin(storage) {
  try {
    const v = storage.getItem(SKIN_STORAGE_KEY);
    return isValidSkin(v) ? v : DEFAULT_SKIN;
  } catch (_) { return DEFAULT_SKIN; }
}

function saveSkin(storage, id) {
  if (!isValidSkin(id)) return false;
  try { storage.setItem(SKIN_STORAGE_KEY, id); return true; } catch (_) { return false; }
}

const Skins = { SKINS, SKIN_STORAGE_KEY, DEFAULT_SKIN, isValidSkin, getSkin, getPalette, loadSkin, saveSkin };

if (typeof module !== 'undefined' && module.exports) module.exports = Skins;
