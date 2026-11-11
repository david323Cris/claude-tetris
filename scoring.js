'use strict';

// Módulo de puntuación puro: sin DOM, canvas ni estado global.
// Se carga con <script> en el navegador (global `Scoring`) y con require() en Node (tests).

const SCORING_CONFIG = {
  LINE_SCORES: [0, 100, 300, 500, 800],     // base por 0-4 líneas (se multiplica por nivel)
  TSPIN_SCORES: [400, 800, 1200, 1600],     // T-spin con 0, 1, 2 y 3 líneas
  PERFECT_CLEAR: 2000,                      // bonus plano (se multiplica por nivel)
  B2B_MULT: 1.5,
  COMBO_MAX: 10,                            // tope del multiplicador de combo
  T_TYPE: 3,
};

const LINE_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];

function createScoreState() {
  return { chain: 0, b2b: false }; // chain = limpiezas consecutivas
}

function comboOf(state, max = SCORING_CONFIG.COMBO_MAX) {
  return Math.max(1, Math.min(state.chain, max));
}

// Regla de las 3 esquinas. `board` debe ser el tablero SIN la pieza fusionada.
// (x, y) = esquina superior izquierda de la matriz 3x3 de la T.
// Paredes y suelo cuentan como ocupados.
function detectTSpin(board, type, x, y, lastWasRotation, cfg = SCORING_CONFIG) {
  if (type !== cfg.T_TYPE || !lastWasRotation) return false;
  const rows = board.length, cols = board[0].length;
  const corners = [[x, y], [x + 2, y], [x, y + 2], [x + 2, y + 2]];
  let filled = 0;
  for (const [cx, cy] of corners) {
    if (cx < 0 || cx >= cols || cy >= rows || (cy >= 0 && board[cy][cx])) filled++;
  }
  return filled >= 3;
}

function isBoardEmpty(board) {
  return board.every(row => row.every(v => v === 0));
}

// Evalúa un asentamiento de pieza.
// input: { lines, tspin, level, boardEmpty }
// Devuelve { points, state, combo, events } sin mutar `state`.
function evaluateLock(state, input, cfg = SCORING_CONFIG) {
  const { lines, tspin, level, boardEmpty } = input;
  const events = [];

  if (lines === 0) {
    const points = tspin ? cfg.TSPIN_SCORES[0] * level : 0;
    if (tspin) events.push({ kind: 'tspin', text: 'T-SPIN', points });
    return { points, state: { chain: 0, b2b: state.b2b }, combo: 1, events };
  }

  const chain = state.chain + 1;
  const combo = Math.max(1, Math.min(chain, cfg.COMBO_MAX));
  const difficult = tspin || lines === 4;
  const b2b = difficult && state.b2b;

  let base = tspin ? cfg.TSPIN_SCORES[Math.min(lines, 3)] : cfg.LINE_SCORES[lines];
  if (b2b) base *= cfg.B2B_MULT;
  let points = Math.round(base * level * combo);

  const name = tspin ? `T-SPIN ${LINE_NAMES[Math.min(lines, 3)]}` : LINE_NAMES[lines];
  events.push({
    kind: tspin ? 'tspin' : (lines === 4 ? 'tetris' : 'line'),
    text: (b2b ? 'B2B ' : '') + name,
    b2b,
    points,
  });
  if (combo >= 2) events.push({ kind: 'combo', text: `COMBO x${combo}`, combo });
  if (boardEmpty) {
    const pc = cfg.PERFECT_CLEAR * level;
    points += pc;
    events.push({ kind: 'perfect', text: 'PERFECT CLEAR', points: pc });
  }

  return { points, state: { chain, b2b: difficult }, combo, events };
}

const Scoring = {
  SCORING_CONFIG, createScoreState, comboOf, detectTSpin, isBoardEmpty, evaluateLock,
};

if (typeof module !== 'undefined' && module.exports) module.exports = Scoring;
