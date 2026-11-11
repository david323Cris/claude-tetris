'use strict';

// Módulo de habilidades puro: sin DOM ni estado global.
// Global `Abilities` en el navegador y require() en Node (tests).
// Los timers se avanzan con `tick(state, dt)` desde el loop del juego, por lo que
// respetan la pausa (el loop no corre en pausa ni con el selector abierto).

const ABILITY_CONFIG = {
  ENERGY_MAX: 100,
  ENERGY_GAIN: [0, 10, 25, 40, 60],   // energía por 0-4 líneas (configurable)
  VISION_MS: 20000,
  VISION_COUNT: 5,                    // piezas visibles con Visión
  SLOW_MS: 10000,
  SLOW_FACTOR: 0.5,                   // velocidad de caída durante Ralentizar
  SWAP_OPTIONS: 3,
};

function createState() {
  return { energy: 0, effects: { vision: 0, slow: 0 } };
}

function addEnergy(state, lines, cfg = ABILITY_CONFIG) {
  const gain = cfg.ENERGY_GAIN[Math.min(lines, cfg.ENERGY_GAIN.length - 1)] || 0;
  return { ...state, energy: Math.min(cfg.ENERGY_MAX, state.energy + gain) };
}

function isReady(state, cfg = ABILITY_CONFIG) {
  return state.energy >= cfg.ENERGY_MAX;
}

function spend(state) {
  return { ...state, energy: 0 };
}

function startEffect(state, name, ms) {
  return { ...state, effects: { ...state.effects, [name]: ms } };
}

function isActive(state, name) {
  return state.effects[name] > 0;
}

// Avanza los timers `dt` ms (solo se llama mientras el juego corre)
function tick(state, dt) {
  const effects = {};
  for (const k of Object.keys(state.effects)) effects[k] = Math.max(0, state.effects[k] - dt);
  return { ...state, effects };
}

// Intervalo de caída efectivo: Ralentizar actúa como multiplicador sin pisar el del nivel
function effectiveInterval(state, baseInterval, cfg = ABILITY_CONFIG) {
  return isActive(state, 'slow') ? baseInterval / cfg.SLOW_FACTOR : baseInterval;
}

// Devuelve un tablero nuevo sin la fila inferior (el resto desciende)
function clearBottomRow(board) {
  const cols = board[0].length;
  return [new Array(cols).fill(0), ...board.slice(0, -1).map(r => r.slice())];
}

// Elige `n` tipos distintos del pool
function pickOptions(rng, pool, n = ABILITY_CONFIG.SWAP_OPTIONS) {
  const rest = pool.slice();
  const out = [];
  while (out.length < n && rest.length) out.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
  return out;
}

// Instantánea del estado previo a asentar una pieza (copias profundas)
function takeSnapshot(g) {
  return {
    board: g.board.map(r => r.slice()),
    score: g.score, lines: g.lines, level: g.level, dropInterval: g.dropInterval,
    scoreState: { ...g.scoreState },          // incluye combo y B2B
    currentType: g.currentType, queueTypes: g.queueTypes.slice(),
    holdPiece: g.holdPiece, holdUsedThisTurn: g.holdUsedThisTurn,
    rewardSingle: g.rewardSingle,
  };
}

// Registro con interfaz común: run(game) -> true si se aplicó (y se gasta la energía).
// `game` expone: startEffect(name), undo() -> bool, clearBottom(), beginSwap().
// Intercambio devuelve false: la energía se gasta al confirmar la elección (Esc cancela).
const ABILITIES = [
  { id: 'vision', name: 'Visión',      desc: 'Ve las próximas 5 piezas (20 s)', run: g => { g.startEffect('vision'); return true; } },
  { id: 'swap',   name: 'Intercambio', desc: 'Cambia la pieza activa',          run: g => { g.beginSwap(); return false; } },
  { id: 'slow',   name: 'Ralentizar',  desc: 'Caída al 50 % (10 s)',            run: g => { g.startEffect('slow'); return true; } },
  { id: 'undo',   name: 'Deshacer',    desc: 'Revierte la última pieza',        run: g => g.undo() },
  { id: 'clear',  name: 'Limpieza',    desc: 'Elimina la fila inferior',        run: g => { g.clearBottom(); return true; } },
];

// Activa una habilidad: exige barra llena; gasta la energía solo si `run` devuelve true.
function use(state, id, game) {
  const ability = ABILITIES.find(a => a.id === id);
  if (!ability || !isReady(state)) return state;
  return ability.run(game) ? spend(state) : state;
}

const Abilities = {
  ABILITY_CONFIG, ABILITIES, createState, addEnergy, isReady, spend, startEffect, isActive,
  tick, effectiveInterval, clearBottomRow, pickOptions, takeSnapshot, use,
};

if (typeof module !== 'undefined' && module.exports) module.exports = Abilities;
