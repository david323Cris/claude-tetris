'use strict';
// Módulo puro (sin DOM): definición declarativa de piezas, rotación, colisión
// y generador con RNG inyectable. Global `Pieces` en el navegador, `require` en Node.

// Índice = valor en el tablero = índice en COLORS (game.js). 0 está reservado.
const PIECE_DEFS = [
  null,
  { name: 'I',      shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  { name: 'O',      shape: [[2,2],[2,2]] },
  { name: 'T',      shape: [[0,3,0],[3,3,3],[0,0,0]] },
  { name: 'S',      shape: [[0,4,4],[4,4,0],[0,0,0]] },
  { name: 'Z',      shape: [[5,5,0],[0,5,5],[0,0,0]] },
  { name: 'J',      shape: [[6,0,0],[6,6,6],[0,0,0]] },
  { name: 'L',      shape: [[0,0,7],[7,7,7],[0,0,0]] },
  { name: 'Tuerca', shape: [[8,8,8],[8,0,8],[8,8,8]], hollow: true },    // 3×3 hueca (reto)
  { name: 'Cruz',   shape: [[0,9,0],[9,9,9],[0,9,0]] },                  // pentominó +
  { name: 'U',      shape: [[10,0,10],[10,10,10],[0,0,0]] },             // pentominó U
  { name: 'Y',      shape: [[0,11,0,0],[11,11,11,11],[0,0,0,0],[0,0,0,0]] }, // pentominó Y
  { name: 'Single', shape: [[12]] },                                      // 1×1
];

const PIECES = PIECE_DEFS.map(d => d && d.shape);
const STANDARD = [1, 2, 3, 4, 5, 6, 7];
const NUT = 8;
const PENTOMINOS = [9, 10, 11];
const SINGLE = 12;

const SPAWN_CONFIG = {
  PENTO_CHANCE: 0.05,     // probabilidad de reemplazar una pieza estándar por un pentominó
  HOLLOW_CHANCE: 0.02,    // probabilidad de la 3×3 hueca (reto)
  HOLLOW_MIN_LEVEL: 3,    // nivel mínimo para que aparezca la 3×3 hueca
  CLASSIC: false,         // true = solo las 7 piezas clásicas
};

const KICKS = [0, -1, 1, -2, 2];

// PRNG con semilla (mulberry32): devuelve () => número en [0, 1)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Devuelve el tipo de la siguiente pieza. Orden de tiradas fijo (reproducible).
function pickType(rng, level, config) {
  const cfg = { ...SPAWN_CONFIG, ...config };
  const base = Math.floor(rng() * 7) + 1;
  const roll = rng();
  if (cfg.CLASSIC) return base;
  if (level >= cfg.HOLLOW_MIN_LEVEL && roll < cfg.HOLLOW_CHANCE) return NUT;
  if (roll >= cfg.HOLLOW_CHANCE && roll < cfg.HOLLOW_CHANCE + cfg.PENTO_CHANCE) {
    return PENTOMINOS[Math.floor(rng() * PENTOMINOS.length)];
  }
  return base;
}

// Pieza en posición y rotación de spawn (centrada horizontalmente)
function createPiece(type, cols = 10) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(cols / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collides(board, shape, ox, oy) {
  const rows = board.length, cols = board[0].length;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c, ny = oy + r;
      if (nx < 0 || nx >= cols || ny >= rows) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

// Rota con wall kicks horizontales. Devuelve { shape, x } o null si no cabe.
function rotateWithKicks(board, piece) {
  const rotated = rotateCW(piece.shape);
  for (const kick of KICKS) {
    if (!collides(board, rotated, piece.x + kick, piece.y)) {
      return { shape: rotated, x: piece.x + kick };
    }
  }
  return null;
}

const Pieces = {
  PIECE_DEFS, PIECES, STANDARD, NUT, PENTOMINOS, SINGLE, SPAWN_CONFIG, KICKS,
  mulberry32, pickType, createPiece, collides, rotateCW, rotateWithKicks,
};

if (typeof module !== 'undefined' && module.exports) module.exports = Pieces;
