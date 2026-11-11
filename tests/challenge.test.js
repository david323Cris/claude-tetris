'use strict';
// Ejecutar con: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../challenge.js');
const Pieces = require('../pieces.js');

const emptyBoard = () => Array.from({ length: 20 }, () => new Array(10).fill(0));
const level = (modifiers, extra = {}) => ({
  id: 'x', order: 1, name: 'X', description: 'd', objective: 'o', lose: 'l', modifiers, ...extra,
});
const run = mods => C.createRun(level(mods));

// ---- Validación y carga de niveles ----

test('los 5 niveles iniciales se cargan desde /levels y son válidos', () => {
  C.clearLevels();
  const dir = path.join(__dirname, '..', 'levels');
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.js'))) {
    delete require.cache[require.resolve(path.join(dir, f))];
    require(path.join(dir, f));
  }
  assert.deepStrictEqual(C.getLevels().map(l => l.id),
    ['sprint', 'marea-de-basura', 'tablero-sembrado', 'a-ciegas', 'mundo-al-reves']);
});

test('un nivel nuevo con modificadores válidos se registra sin tocar código', () => {
  C.clearLevels();
  C.registerLevel(level({ targetLines: 5, invisiblePieces: true, garbageInterval: 20 }, { id: 'nuevo', order: 9 }));
  assert.strictEqual(C.getLevels()[0].id, 'nuevo');
});

test('validación: rechaza esquemas inválidos', () => {
  const bad = [
    level({ foo: 1 }),                                  // modificador desconocido
    level({ targetLines: 0 }),
    level({ timeLimit: -5, targetLines: 3 }),
    level({ timeLimit: { seconds: 10, onExpire: 'x' } }),
    level({ garbageInterval: 'a', targetLines: 1 }),
    level({ presetBoard: { rows: ['##'] } }),
    level({ invertedRotation: { afterLines: 1, afterSeconds: 2 }, targetLines: 1 }),
    level({ invisiblePieces: true }),                   // sin condición de victoria
    level({ targetLines: 1 }, { id: 'Mal Id' }),
    level({ targetLines: 1 }, { name: '' }),
    null,
  ];
  for (const l of bad) assert.strictEqual(C.validateLevel(l).valid, false, JSON.stringify(l));
  assert.throws(() => C.registerLevel(bad[0]), /inválido/);
});

// ---- Modificadores ----

test('timeLimit: derrota al agotarse el tiempo sin cumplir el objetivo', () => {
  const r = run({ targetLines: 40, timeLimit: 120 });
  r.tick(119000);
  assert.strictEqual(r.evaluate(emptyBoard()), 'playing');
  assert.strictEqual(r.remainingMs(), 1000);
  r.tick(1000);
  assert.strictEqual(r.evaluate(emptyBoard()), 'lost');
  assert.strictEqual(r.state.reason, 'timeout');
});

test('timeLimit con onExpire "win": sobrevivir gana', () => {
  const r = run({ timeLimit: { seconds: 180, onExpire: 'win' } });
  r.tick(180000);
  assert.strictEqual(r.evaluate(emptyBoard()), 'won');
  assert.strictEqual(r.state.reason, 'survived');
});

test('targetLines: victoria al llegar a 40 líneas antes de 2:00', () => {
  const r = run({ targetLines: 40, timeLimit: 120 });
  r.tick(90000);
  r.onLock({ lines: 39, score: 1000 });
  assert.strictEqual(r.evaluate(emptyBoard()), 'playing');
  r.onLock({ lines: 40, score: 1200 });
  assert.strictEqual(r.evaluate(emptyBoard()), 'won');
  assert.strictEqual(r.state.elapsedMs, 90000);
});

test('victoria tiene prioridad si el objetivo se cumple justo al vencer el tiempo', () => {
  const r = run({ targetLines: 40, timeLimit: 120 });
  r.tick(120000);
  r.onLock({ lines: 40, score: 1 });
  assert.strictEqual(r.evaluate(emptyBoard()), 'won');
});

test('el resultado es definitivo: tras ganar o perder no cambia', () => {
  const r = run({ targetLines: 1 });
  r.onLock({ lines: 1, score: 0 });
  r.evaluate(emptyBoard());
  r.lose();
  assert.strictEqual(r.state.status, 'won');
  const r2 = run({ targetLines: 1 });
  r2.lose('topout');
  r2.onLock({ lines: 5, score: 0 });
  assert.strictEqual(r2.evaluate(emptyBoard()), 'lost');
});

test('garbageInterval: cada 10 s pide exactamente una fila', () => {
  const r = run({ garbageInterval: 10, timeLimit: { seconds: 180, onExpire: 'win' } });
  let total = 0;
  for (let i = 0; i < 99; i++) total += r.tick(100).garbageRows; // 9.9 s
  assert.strictEqual(total, 0);
  assert.strictEqual(r.tick(100).garbageRows, 1);              // 10.0 s
  assert.strictEqual(r.tick(10000).garbageRows, 1);            // 20.0 s
});

test('addGarbageRow: sube el tablero y deja exactamente un hueco', () => {
  const b = emptyBoard();
  b[19][0] = 3;
  const res = C.addGarbageRow(b, () => 0.55); // hueco en columna 5
  assert.strictEqual(res.hole, 5);
  assert.strictEqual(res.overflow, false);
  const row = res.board[19];
  assert.strictEqual(row.filter(v => v === 0).length, 1);
  assert.strictEqual(row[5], 0);
  assert.ok(row.every((v, c) => c === 5 || v === C.GARBAGE));
  assert.strictEqual(res.board[18][0], 3);                      // lo anterior subió
  assert.strictEqual(b[19][0], 3);                              // no muta el original
  assert.strictEqual(res.board.length, 20);
});

test('addGarbageRow: overflow si la fila superior estaba ocupada', () => {
  const b = emptyBoard();
  b[0][4] = 1;
  assert.strictEqual(C.addGarbageRow(b, Math.random).overflow, true);
});

test('garbageInterval: no genera basura en el instante en que termina el tiempo', () => {
  const r = run({ garbageInterval: 10, timeLimit: { seconds: 10, onExpire: 'win' } });
  assert.strictEqual(r.tick(10000).garbageRows, 0);
});

test('presetBoard: coloca bloques sembrados abajo y gana al limpiarlos todos', () => {
  const preset = { mustClear: true, rows: ['#.........', '.#........'] };
  const r = run({ presetBoard: preset });
  const b = r.setupBoard(emptyBoard());
  assert.strictEqual(b[18][0], C.SEEDED);
  assert.strictEqual(b[19][1], C.SEEDED);
  assert.strictEqual(C.countSeeded(b), 2);
  assert.strictEqual(r.evaluate(b), 'playing');
  b[18][0] = 0;
  assert.strictEqual(r.evaluate(b), 'playing');
  b[19][1] = 0;
  b[19][5] = 3; // piezas normales no impiden ganar
  assert.strictEqual(r.evaluate(b), 'won');
  assert.strictEqual(r.state.reason, 'cleared');
});

test('invisiblePieces: se reporta como activo solo cuando el nivel lo pide', () => {
  assert.strictEqual(run({ targetLines: 1, invisiblePieces: true }).hidesLockedPieces(), true);
  assert.strictEqual(run({ targetLines: 1, invisiblePieces: false }).hidesLockedPieces(), false);
  assert.strictEqual(run({ targetLines: 1 }).hidesLockedPieces(), false);
});

test('invisiblePieces: las celdas siguen ocupadas (colisión intacta)', () => {
  const b = emptyBoard();
  b[19][4] = 3;
  assert.strictEqual(Pieces.collides(b, [[1]], 4, 19), true);
});

test('invertedRotation: se activa tras N líneas', () => {
  const r = run({ targetLines: 30, invertedRotation: { afterLines: 10 } });
  r.onLock({ lines: 9, score: 0 });
  assert.strictEqual(r.rotationInverted(), false);
  r.onLock({ lines: 10, score: 0 });
  assert.strictEqual(r.rotationInverted(), true);
});

test('invertedRotation: afterSeconds y siempre activa', () => {
  const r = run({ targetLines: 5, invertedRotation: { afterSeconds: 30 } });
  r.tick(29000);
  assert.strictEqual(r.rotationInverted(), false);
  r.tick(1000);
  assert.strictEqual(r.rotationInverted(), true);
  assert.strictEqual(run({ targetLines: 5, invertedRotation: true }).rotationInverted(), true);
});

test('rotación antihoraria: CW seguido de CCW devuelve la forma original', () => {
  const b = emptyBoard();
  const p = Pieces.createPiece(3);
  const cw = Pieces.rotateWithKicks(b, p, 1);
  const back = Pieces.rotateWithKicks(b, { ...p, shape: cw.shape, x: cw.x }, -1);
  assert.deepStrictEqual(back.shape, p.shape);
  const ccw = Pieces.rotateWithKicks(b, p, -1);
  assert.notDeepStrictEqual(ccw.shape, cw.shape);
});

test('los modificadores se combinan en un mismo nivel', () => {
  const r = run({
    targetLines: 2, timeLimit: 60, garbageInterval: 10, invisiblePieces: true,
    invertedRotation: true, presetBoard: { rows: ['#.........'] },
  });
  assert.strictEqual(C.countSeeded(r.setupBoard(emptyBoard())), 1);
  assert.strictEqual(r.tick(10000).garbageRows, 1);
  assert.strictEqual(r.hidesLockedPieces(), true);
  assert.strictEqual(r.rotationInverted(), true);
  r.onLock({ lines: 2, score: 0 });
  assert.strictEqual(r.evaluate(emptyBoard()), 'won');
});

// ---- Progreso ----

const memStorage = () => {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } };
};

test('progreso: derrota no guarda; victoria guarda mejor tiempo y puntuación', () => {
  let p = C.emptyProgress();
  p = C.recordResult(p, 'sprint', { won: false, timeMs: 1, score: 1 });
  assert.deepStrictEqual(p.completed, {});
  p = C.recordResult(p, 'sprint', { won: true, timeMs: 100000, score: 500 });
  p = C.recordResult(p, 'sprint', { won: true, timeMs: 110000, score: 900 });
  assert.deepStrictEqual(p.completed.sprint, { bestTimeMs: 100000, bestScore: 900 });
});

test('desbloqueo: completar un nivel desbloquea el siguiente y persiste', () => {
  C.clearLevels();
  for (const [i, id] of ['a', 'b', 'c'].entries()) C.registerLevel(level({ targetLines: 1 }, { id, order: i + 1 }));
  const levels = C.getLevels();
  const st = memStorage();
  let p = C.loadProgress(st);
  assert.deepStrictEqual(levels.map((_, i) => C.isUnlocked(levels, p, i)), [true, false, false]);
  p = C.recordResult(p, 'a', { won: true, timeMs: 5, score: 5 });
  C.saveProgress(st, p);
  const reloaded = C.loadProgress(st); // "recargar el juego"
  assert.deepStrictEqual(levels.map((_, i) => C.isUnlocked(levels, reloaded, i)), [true, true, false]);
});

test('progreso: datos corruptos o almacenamiento roto dan progreso vacío', () => {
  const st = memStorage();
  st.setItem(C.STORAGE_KEY, '{no json');
  assert.deepStrictEqual(C.loadProgress(st), C.emptyProgress());
  assert.deepStrictEqual(C.loadProgress({ getItem() { throw new Error('x'); } }), C.emptyProgress());
});

test('formatTime', () => {
  assert.strictEqual(C.formatTime(95300), '1:35.3');
  assert.strictEqual(C.formatTime(0), '0:00.0');
});
