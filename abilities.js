'use strict';

// Habilidades cargables: módulo puro (sin DOM ni estado global).
// Global `Abilities` en el navegador, require() en Node (tests).
// Todas las funciones devuelven estados nuevos; no mutan sus argumentos.

const ABILITY_CONFIG = {
  ENERGY_MAX: 100,
  ENERGY_GAIN: [0, 10, 25, 40, 60], // por 0-4 líneas limpiadas de una vez
  VISION_MS: 20000,
  SLOW_MS: 10000,
  SLOW_FACTOR: 0.5,                 // velocidad de caída durante Ralentizar
  SWAP_CHOICES: 3,
};

function createState() {
  // energy 0-100; visionMs/slowMs = tiempo restante de cada efecto; snapshot = instantánea para Deshacer
  return { energy: 0, visionMs: 0, slowMs: 0, snapshot: null };
}

function gainEnergy(state, lines, cfg = ABILITY_CONFIG) {
  const idx = Math.max(0, Math.min(lines, cfg.ENERGY_GAIN.length - 1));
  const energy = Math.min(cfg.ENERGY_MAX, state.energy + cfg.ENERGY_GAIN[idx]);
  return { ...state, energy };
}

function isReady(state, cfg = ABILITY_CONFIG) {
  return state.energy >= cfg.ENERGY_MAX;
}

// Los timers solo avanzan cuando se llama a tick(): el juego no lo llama en pausa,
// así que la pausa no consume tiempo.
function tick(state, dt) {
  return {
    ...state,
    visionMs: Math.max(0, state.visionMs - dt),
    slowMs: Math.max(0, state.slowMs - dt),
  };
}

// Intervalo de caída efectivo: Ralentizar es un multiplicador sobre el del nivel
function effectiveInterval(state, baseInterval, cfg = ABILITY_CONFIG) {
  return state.slowMs > 0 ? baseInterval / cfg.SLOW_FACTOR : baseInterval;
}

function copyBoard(board) {
  return board.map(row => row.slice());
}

// Instantánea del estado previo a asentar una pieza (solo se guarda la última).
// `g` = { board, score, lines, level, dropInterval, scoreState, powerProgress, freezeMs,
//         holdPiece, holdUsedThisTurn, queue, rewardSingle, piece }
function takeSnapshot(g) {
  const clonePiece = p => ({ ...p, shape: p.shape.map(r => r.slice()) });
  return {
    board: copyBoard(g.board),
    score: g.score,
    lines: g.lines,
    level: g.level,
    dropInterval: g.dropInterval,
    scoreState: { ...g.scoreState },
    powerProgress: g.powerProgress,
    freezeMs: g.freezeMs,
    holdPiece: g.holdPiece,
    holdUsedThisTurn: g.holdUsedThisTurn,
    queue: g.queue.map(clonePiece),
    rewardSingle: g.rewardSingle,
    piece: { type: g.piece.type, powerUp: g.piece.powerUp || null, marked: g.piece.spawnMarked ? { ...g.piece.spawnMarked } : null },
  };
}

// Quita la fila inferior; el resto baja una fila
function clearBottomRow(board) {
  const cols = board[0].length;
  return [new Array(cols).fill(0), ...board.slice(0, -1).map(r => r.slice())];
}

// Tipos que puede ofrecer Intercambio (Tuerca y pentominós solo fuera del modo clásico)
function swapPool(pieces, classic) {
  return classic ? pieces.STANDARD.slice() : [...pieces.STANDARD, pieces.NUT, ...pieces.PENTOMINOS];
}

// Elige `n` tipos distintos del pool
function pickSwapChoices(rng, pool, n = ABILITY_CONFIG.SWAP_CHOICES) {
  const left = pool.slice();
  const out = [];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(rng() * left.length), 1)[0]);
  return out;
}

// Registro con interfaz común: { id, name, icon, description, needsChoice?, canUse(state, ctx), apply(state, ctx) }
// apply devuelve { state, ...datos para el juego } sin tocar la energía (lo hace activate).
const ABILITIES = [
  {
    id: 'vision', name: 'Visión', icon: '👁', description: 'Ver las próximas 5 piezas (20 s)',
    canUse: () => true,
    apply: (state, ctx, cfg = ABILITY_CONFIG) => ({ state: { ...state, visionMs: cfg.VISION_MS } }),
  },
  {
    id: 'swap', name: 'Intercambio', icon: '🔀', description: 'Cambiar la pieza activa (elige 1 de 3)',
    needsChoice: true,
    canUse: () => true, // la elección la exige activate()
    apply: (state, ctx) => ({ state, swapTo: ctx.choice }),
  },
  {
    id: 'slow', name: 'Ralentizar', icon: '🐢', description: 'Caída al 50 % durante 10 s',
    canUse: () => true,
    apply: (state, ctx, cfg = ABILITY_CONFIG) => ({ state: { ...state, slowMs: cfg.SLOW_MS } }),
  },
  {
    id: 'undo', name: 'Deshacer', icon: '↩', description: 'Revertir la última pieza colocada',
    canUse: state => state.snapshot !== null,
    apply: state => ({ state: { ...state, snapshot: null }, restore: state.snapshot }),
  },
  {
    id: 'clear', name: 'Limpieza', icon: '🧹', description: 'Eliminar la fila inferior',
    canUse: () => true,
    apply: (state, ctx) => ({ state, board: clearBottomRow(ctx.board) }),
  },
];

function getAbility(id) {
  return ABILITIES.find(a => a.id === id) || null;
}

// Usa una habilidad: exige barra llena y que la habilidad sea utilizable.
// Si falla no se gasta energía; si funciona la barra se vacía.
function activate(id, state, ctx = {}, cfg = ABILITY_CONFIG) {
  const ability = getAbility(id);
  if (!ability || !isReady(state, cfg) || !ability.canUse(state, ctx)) return { ok: false, state };
  if (ability.needsChoice && (ctx.choice === undefined || ctx.choice === null)) return { ok: false, state };
  const res = ability.apply(state, ctx, cfg);
  return { ...res, ok: true, state: { ...res.state, energy: 0 } };
}

const Abilities = {
  ABILITY_CONFIG, ABILITIES, createState, gainEnergy, isReady, tick, effectiveInterval,
  takeSnapshot, clearBottomRow, swapPool, pickSwapChoices, getAbility, activate,
};

if (typeof module !== 'undefined' && module.exports) module.exports = Abilities;
