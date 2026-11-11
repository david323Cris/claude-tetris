'use strict';

// Modo desafío: módulo puro (sin DOM). Global `Challenge` en el navegador, `require` en Node.
//  - Niveles: datos declarativos validados al registrarse (ver /levels).
//  - Modificadores: registro MODIFIERS; cada uno es un conjunto de hooks independientes
//    (validate, setupBoard, onTick, rotationInverted, hidesLockedPieces) que se combinan libremente.
//  - Motor de reglas: createRun(level) evalúa victoria/derrota sin conocer el motor de juego.
//  - Progreso: funciones puras + persistencia con almacenamiento inyectable.

const GARBAGE = 14; // fila de basura (Marea de basura)
const SEEDED = 15;  // bloque sembrado (presetBoard); el objetivo es limpiarlos todos
const STORAGE_KEY = 'tetris-challenge-progress';

const isNum = (v, min = 0) => typeof v === 'number' && Number.isFinite(v) && v > min;
const isInt = (v, min = 1) => Number.isInteger(v) && v >= min;

// ---------- Utilidades de tablero ----------

// Sube todo una fila y agrega abajo una fila de basura con exactamente un hueco.
// Devuelve { board, overflow, hole }; overflow = true si se perdió un bloque por arriba.
function addGarbageRow(board, rng) {
  const cols = board[0].length;
  const hole = Math.floor(rng() * cols);
  const row = Array.from({ length: cols }, (_, c) => (c === hole ? 0 : GARBAGE));
  const overflow = board[0].some(v => v !== 0);
  return { board: [...board.slice(1).map(r => r.slice()), row], overflow, hole };
}

// Las filas del preset se alinean abajo ('#' = bloque sembrado).
function applyPresetBoard(board, preset) {
  const out = board.map(r => r.slice());
  const offset = out.length - preset.rows.length;
  preset.rows.forEach((str, i) => {
    for (let c = 0; c < out[0].length; c++) if (str[c] === '#') out[offset + i][c] = SEEDED;
  });
  return out;
}

const countSeeded = board => board.reduce((n, row) => n + row.filter(v => v === SEEDED).length, 0);

const normalizeTimeLimit = v => (typeof v === 'number' ? { seconds: v, onExpire: 'lose' } : v);

// ---------- Modificadores (hooks del ciclo de juego) ----------
// Hooks opcionales:
//   validate(value, cols) -> string[] de errores
//   setupBoard(board, value) -> board
//   onTick(runState, value, dtMs) -> { garbageRows?: n }
//   rotationInverted(value, stats) -> boolean
//   hidesLockedPieces(value) -> boolean
const MODIFIERS = {
  // número = segundos hasta la derrota; objeto {seconds, onExpire:'win'|'lose'}
  timeLimit: {
    validate(v) {
      const o = normalizeTimeLimit(v);
      if (!o || typeof o !== 'object') return ['timeLimit debe ser un número o un objeto'];
      const errs = [];
      if (!isNum(o.seconds)) errs.push('timeLimit.seconds debe ser un número > 0');
      if (o.onExpire !== undefined && !['win', 'lose'].includes(o.onExpire)) errs.push("timeLimit.onExpire debe ser 'win' o 'lose'");
      return errs;
    },
  },
  garbageInterval: {
    validate: v => (isNum(v) ? [] : ['garbageInterval debe ser un número de segundos > 0']),
    onTick(state, seconds, dtMs) {
      state.garbageMs = (state.garbageMs || 0) + dtMs;
      const step = seconds * 1000;
      const rows = Math.floor(state.garbageMs / step);
      state.garbageMs -= rows * step;
      return { garbageRows: rows };
    },
  },
  presetBoard: {
    validate(v, cols) {
      if (!v || !Array.isArray(v.rows) || v.rows.length === 0) return ['presetBoard.rows debe ser un arreglo no vacío'];
      const errs = [];
      v.rows.forEach((r, i) => {
        if (typeof r !== 'string' || r.length !== cols || /[^.#]/.test(r)) errs.push(`presetBoard.rows[${i}] debe ser una cadena de ${cols} caracteres '.' o '#'`);
      });
      if (v.mustClear !== undefined && typeof v.mustClear !== 'boolean') errs.push('presetBoard.mustClear debe ser booleano');
      return errs;
    },
    setupBoard: (board, v) => applyPresetBoard(board, v),
  },
  invisiblePieces: {
    validate: v => (typeof v === 'boolean' ? [] : ['invisiblePieces debe ser booleano']),
    hidesLockedPieces: v => v === true,
  },
  // true = siempre; { afterLines: n } o { afterSeconds: n } = a partir de ese punto del nivel
  invertedRotation: {
    validate(v) {
      if (typeof v === 'boolean') return [];
      if (!v || typeof v !== 'object') return ['invertedRotation debe ser booleano u objeto'];
      const has = ['afterLines', 'afterSeconds'].filter(k => v[k] !== undefined);
      if (has.length !== 1) return ['invertedRotation requiere exactamente uno de afterLines o afterSeconds'];
      return isNum(v[has[0]], -1) ? [] : [`invertedRotation.${has[0]} debe ser un número >= 0`];
    },
    rotationInverted(v, stats) {
      if (typeof v === 'boolean') return v;
      if (v.afterLines !== undefined) return stats.lines >= v.afterLines;
      return stats.elapsedMs >= v.afterSeconds * 1000;
    },
  },
  targetLines: {
    validate: v => (isInt(v) ? [] : ['targetLines debe ser un entero >= 1']),
  },
};

// ---------- Validación de niveles ----------

function hasWinCondition(mods) {
  const tl = mods.timeLimit !== undefined ? normalizeTimeLimit(mods.timeLimit) : null;
  return mods.targetLines !== undefined
    || (tl && tl.onExpire === 'win')
    || !!(mods.presetBoard && mods.presetBoard.mustClear);
}

function validateLevel(level, cols = 10) {
  const errors = [];
  if (!level || typeof level !== 'object') return { valid: false, errors: ['el nivel debe ser un objeto'] };
  if (typeof level.id !== 'string' || !/^[a-z0-9-]+$/.test(level.id)) errors.push('id debe ser un texto en minúsculas, dígitos o guiones');
  if (!isInt(level.order)) errors.push('order debe ser un entero >= 1');
  for (const k of ['name', 'description', 'objective', 'lose']) {
    if (typeof level[k] !== 'string' || !level[k].trim()) errors.push(`${k} debe ser un texto no vacío`);
  }
  const mods = level.modifiers;
  if (!mods || typeof mods !== 'object' || Array.isArray(mods)) {
    errors.push('modifiers debe ser un objeto');
  } else {
    for (const key of Object.keys(mods)) {
      if (!Object.prototype.hasOwnProperty.call(MODIFIERS, key)) { errors.push(`modificador desconocido: ${key}`); continue; }
      errors.push(...MODIFIERS[key].validate(mods[key], cols));
    }
    if (!errors.length && !hasWinCondition(mods)) {
      errors.push('el nivel necesita una condición de victoria (targetLines, timeLimit con onExpire "win" o presetBoard con mustClear)');
    }
  }
  return { valid: errors.length === 0, errors };
}

// ---------- Registro de niveles ----------

const registry = new Map();

function registerLevel(level) {
  const res = validateLevel(level);
  if (!res.valid) throw new Error(`Nivel inválido (${level && level.id}): ${res.errors.join('; ')}`);
  registry.set(level.id, level);
  return level;
}

const getLevels = () => [...registry.values()].sort((a, b) => a.order - b.order);
const clearLevels = () => registry.clear();

// ---------- Motor de reglas ----------
// createRun no toca el DOM ni el tablero del juego: recibe el estado y devuelve decisiones.

function createRun(level) {
  const mods = level.modifiers;
  const state = { elapsedMs: 0, lines: 0, score: 0, status: 'playing', reason: null };
  const timeLimit = mods.timeLimit !== undefined ? normalizeTimeLimit(mods.timeLimit) : null;
  const expired = () => timeLimit && state.elapsedMs >= timeLimit.seconds * 1000;
  const hooks = name => Object.keys(mods).filter(k => MODIFIERS[k][name]);

  function finish(status, reason) {
    if (state.status === 'playing') { state.status = status; state.reason = reason; }
  }

  // La victoria se comprueba primero: cumplir el objetivo en el último instante cuenta como ganar.
  function evaluate(board) {
    if (state.status !== 'playing') return state.status;
    if (mods.targetLines !== undefined && state.lines >= mods.targetLines) finish('won', 'lines');
    else if (mods.presetBoard && mods.presetBoard.mustClear && countSeeded(board) === 0) finish('won', 'cleared');
    else if (expired()) {
      if (timeLimit.onExpire === 'win') finish('won', 'survived');
      else finish('lost', 'timeout');
    }
    return state.status;
  }

  return {
    state,
    setupBoard: board => hooks('setupBoard').reduce((b, k) => MODIFIERS[k].setupBoard(b, mods[k]), board),
    // Avanza el reloj; devuelve { garbageRows } que el motor de juego debe aplicar.
    tick(dtMs) {
      if (state.status !== 'playing') return { garbageRows: 0 };
      state.elapsedMs += dtMs;
      let garbageRows = 0;
      for (const k of hooks('onTick')) garbageRows += MODIFIERS[k].onTick(state, mods[k], dtMs).garbageRows || 0;
      if (expired()) garbageRows = 0; // sin basura en el instante en que termina el tiempo
      return { garbageRows };
    },
    // Llamar tras cada pieza fijada con los totales acumulados
    onLock(totals) { state.lines = totals.lines; state.score = totals.score; },
    evaluate,
    lose(reason = 'topout') { finish('lost', reason); },
    rotationInverted: () => hooks('rotationInverted').some(k => MODIFIERS[k].rotationInverted(mods[k], state)),
    hidesLockedPieces: () => hooks('hidesLockedPieces').some(k => MODIFIERS[k].hidesLockedPieces(mods[k])),
    remainingMs: () => (timeLimit ? Math.max(0, timeLimit.seconds * 1000 - state.elapsedMs) : null),
  };
}

// ---------- Progreso ----------

const emptyProgress = () => ({ completed: {} }); // id -> { bestTimeMs, bestScore }

function loadProgress(storage) {
  try {
    const data = JSON.parse(storage.getItem(STORAGE_KEY));
    if (data && data.completed && typeof data.completed === 'object') return data;
  } catch (_) { /* sin datos o corruptos */ }
  return emptyProgress();
}

function saveProgress(storage, progress) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (_) { /* sin almacenamiento */ }
}

// Solo las victorias cuentan; devuelve un progreso nuevo con mejor tiempo y puntuación.
function recordResult(progress, levelId, result) {
  if (!result.won) return progress;
  const prev = progress.completed[levelId];
  const entry = {
    bestTimeMs: prev ? Math.min(prev.bestTimeMs, result.timeMs) : result.timeMs,
    bestScore: prev ? Math.max(prev.bestScore, result.score) : result.score,
  };
  return { ...progress, completed: { ...progress.completed, [levelId]: entry } };
}

// El primer nivel siempre está disponible; el resto, al completar el anterior.
function isUnlocked(levels, progress, index) {
  return index === 0 || !!progress.completed[levels[index - 1].id];
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}.${tenths}`;
}

const Challenge = {
  GARBAGE, SEEDED, STORAGE_KEY, MODIFIERS,
  addGarbageRow, applyPresetBoard, countSeeded,
  validateLevel, registerLevel, getLevels, clearLevels, createRun,
  emptyProgress, loadProgress, saveProgress, recordResult, isUnlocked, formatTime,
};

if (typeof module !== 'undefined' && module.exports) module.exports = Challenge;
