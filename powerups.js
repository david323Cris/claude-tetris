'use strict';

// Power-ups: módulo puro (sin DOM). Global `PowerUps` en el navegador, `require` en Node.
// Cada efecto es una estrategia con la interfaz común `apply(board, context)`:
//   context = { type, marked: {x, y}, options }
//   devuelve { board, freezeMs? } sin mutar el tablero recibido.
// Para agregar un efecto basta con registrarlo en EFFECTS.

const WILD = 13; // comodín: cuenta como relleno en cualquier fila

const POWERUP_CONFIG = {
  EVERY_LINES: 10,        // líneas limpiadas entre power-ups
  LIGHTNING_AXIS: 'row',  // 'row' | 'column'
  FREEZE_MS: 5000,
};

const clone = board => board.map(row => row.slice());

// Cada bloque cae hasta apoyarse, columna por columna (opcionalmente solo en `cols`).
function compact(board, cols) {
  const out = clone(board);
  const rows = out.length, width = out[0].length;
  const list = cols || Array.from({ length: width }, (_, c) => c);
  for (const c of list) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (out[r][c] !== 0) {
        const v = out[r][c];
        out[r][c] = 0;
        out[write][c] = v;
        write--;
      }
    }
  }
  return out;
}

// Quita filas completas. Si una fila con comodines se limpia, los comodines
// conectados (4 direcciones, de forma transitiva) en otras filas también se eliminan.
// Devuelve { board, cleared } (cleared = filas completas).
function clearFullLines(board) {
  const rows = board.length, cols = board[0].length;
  const out = clone(board);
  const full = new Set();
  for (let r = 0; r < rows; r++) if (out[r].every(v => v !== 0)) full.add(r);
  if (!full.size) return { board: out, cleared: 0 };

  const seen = new Set();
  const stack = [];
  for (const r of full)
    for (let c = 0; c < cols; c++)
      if (out[r][c] === WILD) { seen.add(r * cols + c); stack.push([r, c]); }
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const k = nr * cols + nc;
      if (!seen.has(k) && out[nr][nc] === WILD) { seen.add(k); stack.push([nr, nc]); }
    }
  }
  for (const k of seen) {
    const r = Math.floor(k / cols);
    if (!full.has(r)) out[r][k % cols] = 0;
  }

  const kept = out.filter((_, r) => !full.has(r));
  while (kept.length < rows) kept.unshift(new Array(cols).fill(0));
  return { board: kept, cleared: full.size };
}

const EFFECTS = {
  // 3×3 centrado en el bloque marcado; los bloques superiores caen en esas columnas
  bomb: {
    name: 'BOMBA', icon: '💣',
    apply(board, { marked }) {
      const out = clone(board);
      const cols = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const r = marked.y + dy, c = marked.x + dx;
          if (r >= 0 && r < out.length && c >= 0 && c < out[0].length) out[r][c] = 0;
        }
      for (let c = marked.x - 1; c <= marked.x + 1; c++)
        if (c >= 0 && c < out[0].length) cols.push(c);
      return { board: compact(out, cols) };
    },
  },
  // Limpia la fila (o columna, configurable) del bloque marcado
  lightning: {
    name: 'RAYO', icon: '⚡',
    apply(board, { marked, options }) {
      const axis = (options && options.axis) || POWERUP_CONFIG.LIGHTNING_AXIS;
      const out = clone(board);
      if (axis === 'column') {
        for (let r = 0; r < out.length; r++) out[r][marked.x] = 0;
        return { board: out };
      }
      out.splice(marked.y, 1);
      out.unshift(new Array(out[0].length).fill(0));
      return { board: out };
    },
  },
  // Los bloques del color de la pieza pasan a ser comodines
  tint: {
    name: 'TINTE', icon: '🎨',
    apply(board, { type }) {
      return { board: board.map(row => row.map(v => (v === type ? WILD : v))) };
    },
  },
  // Compacta todo el tablero (los huecos se rellenan)
  gravity: {
    name: 'GRAVEDAD', icon: '⬇️',
    apply(board) { return { board: compact(board) }; },
  },
  // Detiene la caída automática
  freeze: {
    name: 'CONGELAR', icon: '❄️',
    apply(board, { options }) {
      return { board: clone(board), freezeMs: (options && options.freezeMs) || POWERUP_CONFIG.FREEZE_MS };
    },
  },
};

const KINDS = Object.keys(EFFECTS);

function pickKind(rng) { return KINDS[Math.floor(rng() * KINDS.length)]; }

// Elige al azar un bloque de la forma como bloque marcado → { r, c } (relativo a la forma)
function pickMarkedCell(shape, rng) {
  const cells = [];
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) if (shape[r][c]) cells.push({ r, c });
  return cells[Math.floor(rng() * cells.length)];
}

// Rotación horaria de la celda marcada en una forma cuadrada (coherente con Pieces.rotateCW)
function rotateMarked(marked, rowsBefore) {
  return { r: marked.c, c: rowsBefore - 1 - marked.r };
}

// Lleva la cuenta de líneas hacia el próximo power-up. Devuelve { progress, triggered }.
// Si se cruza el umbral con varias líneas (p. ej. un Tetris), sobra el resto.
function advanceProgress(progress, cleared, every = POWERUP_CONFIG.EVERY_LINES) {
  const total = progress + cleared;
  return { progress: total % every, triggered: total >= every };
}

// Aplica el efecto `kind` tras asentar una pieza.
function applyEffect(kind, board, context) {
  return EFFECTS[kind].apply(board, context);
}

const PowerUps = {
  WILD, POWERUP_CONFIG, EFFECTS, KINDS,
  compact, clearFullLines, pickKind, pickMarkedCell, rotateMarked, advanceProgress, applyEffect,
};

if (typeof module !== 'undefined' && module.exports) module.exports = PowerUps;
