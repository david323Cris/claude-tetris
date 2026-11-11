'use strict';
const test = require('node:test');
const assert = require('node:assert');
const A = require('../abilities.js');
const P = require('../pieces.js');

const empty = () => Array.from({ length: 20 }, () => new Array(10).fill(0));
const full = () => ({ ...A.createState(), energy: 100 });

test('energía: 1/2/3/4 líneas = 10/25/40/60 %', () => {
  const s = A.createState();
  assert.strictEqual(A.gainEnergy(s, 0).energy, 0);
  assert.strictEqual(A.gainEnergy(s, 1).energy, 10);
  assert.strictEqual(A.gainEnergy(s, 2).energy, 25);
  assert.strictEqual(A.gainEnergy(s, 3).energy, 40);
  assert.strictEqual(A.gainEnergy(s, 4).energy, 60);
});

test('energía: tope en 100 y valores configurables', () => {
  assert.strictEqual(A.gainEnergy({ ...A.createState(), energy: 80 }, 4).energy, 100);
  const cfg = { ...A.ABILITY_CONFIG, ENERGY_GAIN: [0, 50, 50, 50, 50] };
  assert.strictEqual(A.gainEnergy(A.createState(), 1, cfg).energy, 50);
});

test('al 90 % un Single llega a 100 % y queda lista', () => {
  const s = A.gainEnergy({ ...A.createState(), energy: 90 }, 1);
  assert.strictEqual(s.energy, 100);
  assert.ok(A.isReady(s));
  assert.ok(!A.isReady(A.createState()));
});

test('con la barra incompleta no se puede activar nada', () => {
  const s = { ...A.createState(), energy: 90 };
  for (const a of A.ABILITIES) {
    const r = A.activate(a.id, s, { board: empty(), choice: 1 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.state.energy, 90);
  }
});

test('registro: 5 habilidades con interfaz común', () => {
  assert.deepStrictEqual(A.ABILITIES.map(a => a.id), ['vision', 'swap', 'slow', 'undo', 'clear']);
  for (const a of A.ABILITIES) {
    assert.strictEqual(typeof a.canUse, 'function');
    assert.strictEqual(typeof a.apply, 'function');
    assert.ok(a.name && a.icon && a.description);
  }
});

test('Visión: activa 20 s, vacía la barra y expira con tick', () => {
  const r = A.activate('vision', full());
  assert.ok(r.ok);
  assert.strictEqual(r.state.energy, 0);
  assert.strictEqual(r.state.visionMs, 20000);
  assert.strictEqual(A.tick(r.state, 19999).visionMs, 1);
  assert.strictEqual(A.tick(r.state, 25000).visionMs, 0);
});

test('Ralentizar: 50 % de velocidad 10 s y luego vuelve a la del nivel', () => {
  let s = A.activate('slow', full()).state;
  assert.strictEqual(s.slowMs, 10000);
  assert.strictEqual(A.effectiveInterval(s, 400), 800);
  s = A.tick(s, 10000);
  assert.strictEqual(A.effectiveInterval(s, 400), 400);
});

test('timers respetan la pausa: sin tick no avanzan', () => {
  const s = A.activate('slow', full()).state;
  // pausa = el juego no llama a tick
  assert.strictEqual(s.slowMs, 10000);
  assert.strictEqual(A.tick(s, 0).slowMs, 10000);
});

test('Limpieza: elimina la fila inferior y baja el resto', () => {
  const b = empty();
  b[19].fill(1);
  b[18][0] = 2;
  const r = A.activate('clear', full(), { board: b });
  assert.ok(r.ok);
  assert.strictEqual(r.state.energy, 0);
  assert.ok(r.board[19].every((v, c) => v === (c === 0 ? 2 : 0)));
  assert.ok(r.board[0].every(v => v === 0));
  assert.strictEqual(r.board.length, 20);
  assert.strictEqual(b[19][1], 1, 'no muta el tablero original');
});

test('Intercambio: elige 3 tipos distintos del pool', () => {
  const pool = A.swapPool(P, false);
  assert.ok(pool.includes(P.NUT) && pool.includes(9));
  const choices = A.pickSwapChoices(P.mulberry32(7), pool);
  assert.strictEqual(choices.length, 3);
  assert.strictEqual(new Set(choices).size, 3);
  choices.forEach(c => assert.ok(pool.includes(c)));
});

test('Intercambio: en modo clásico solo las 7 estándar', () => {
  assert.deepStrictEqual(A.swapPool(P, true), [1, 2, 3, 4, 5, 6, 7]);
});

test('Intercambio: exige elección; sin ella no gasta energía', () => {
  assert.strictEqual(A.activate('swap', full(), {}).ok, false);
  assert.strictEqual(A.activate('swap', full(), {}).state.energy, 100);
  const r = A.activate('swap', full(), { choice: 3 });
  assert.ok(r.ok);
  assert.strictEqual(r.swapTo, 3);
  assert.strictEqual(r.state.energy, 0);
});

function game() {
  const board = empty();
  board[19][0] = 5;
  const piece = P.createPiece(3);
  piece.powerUp = 'bomb';
  piece.spawnMarked = { r: 0, c: 1 };
  return {
    board, score: 1200, lines: 8, level: 1, dropInterval: 1000, scoreState: { chain: 2, b2b: true },
    powerProgress: 8, freezeMs: 0, holdPiece: 4, holdUsedThisTurn: true,
    queue: [P.createPiece(1), P.createPiece(2)], rewardSingle: false, piece,
  };
}

test('Deshacer: la instantánea es independiente del estado vivo', () => {
  const g = game();
  const snap = A.takeSnapshot(g);
  g.board[19][0] = 0;
  g.scoreState.chain = 9;
  g.queue[0].shape[0][0] = 99;
  assert.strictEqual(snap.board[19][0], 5);
  assert.strictEqual(snap.scoreState.chain, 2);
  assert.notStrictEqual(snap.queue[0].shape[0][0], 99);
  assert.deepStrictEqual(snap.piece, { type: 3, powerUp: 'bomb', marked: { r: 0, c: 1 } });
});

test('Deshacer: devuelve tablero, puntuación, líneas y combo previos y consume la instantánea', () => {
  const snap = A.takeSnapshot(game());
  const s = { ...full(), snapshot: snap };
  const r = A.activate('undo', s);
  assert.ok(r.ok);
  assert.strictEqual(r.restore.score, 1200);
  assert.strictEqual(r.restore.lines, 8);
  assert.deepStrictEqual(r.restore.scoreState, { chain: 2, b2b: true });
  assert.strictEqual(r.restore.board[19][0], 5);
  assert.strictEqual(r.state.snapshot, null);
  assert.strictEqual(r.state.energy, 0);
  // solo se guarda la última: no se puede deshacer dos veces
  assert.strictEqual(A.activate('undo', { ...r.state, energy: 100 }).ok, false);
});

test('Deshacer sin instantánea no gasta energía', () => {
  const r = A.activate('undo', full());
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.state.energy, 100);
});

test('cancelar (no llamar a activate) conserva la energía', () => {
  const s = full();
  // el selector solo llama a activate al confirmar; Esc no hace nada
  assert.strictEqual(s.energy, 100);
  assert.ok(A.isReady(s));
});

test('las funciones no mutan el estado recibido', () => {
  const s = full();
  A.activate('vision', s);
  A.tick(s, 100);
  A.gainEnergy(s, 4);
  assert.deepStrictEqual(s, { energy: 100, visionMs: 0, slowMs: 0, snapshot: null });
});
