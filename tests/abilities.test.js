'use strict';
const test = require('node:test');
const assert = require('node:assert');
const A = require('../abilities.js');

const emptyBoard = () => Array.from({ length: 20 }, () => new Array(10).fill(0));
const full = () => ({ ...A.createState(), energy: 100 });
const mockGame = () => {
  const calls = [];
  return {
    calls,
    startEffect: n => calls.push('effect:' + n),
    undo: () => { calls.push('undo'); return true; },
    clearBottom: () => calls.push('clear'),
    beginSwap: () => calls.push('swap'),
  };
};

test('energía: 1/2/3/4 líneas suman 10/25/40/60', () => {
  [[1, 10], [2, 25], [3, 40], [4, 60]].forEach(([l, e]) =>
    assert.strictEqual(A.addEnergy(A.createState(), l).energy, e));
});

test('energía: 90 % + Single llega a 100 % y queda lista', () => {
  const s = A.addEnergy({ ...A.createState(), energy: 90 }, 1);
  assert.strictEqual(s.energy, 100);
  assert.ok(A.isReady(s));
});

test('energía: tope en 100; sin líneas no suma; valores configurables', () => {
  assert.strictEqual(A.addEnergy({ ...A.createState(), energy: 80 }, 4).energy, 100);
  assert.strictEqual(A.addEnergy(A.createState(), 0).energy, 0);
  const cfg = { ...A.ABILITY_CONFIG, ENERGY_GAIN: [0, 50, 0, 0, 0] };
  assert.strictEqual(A.addEnergy(A.createState(), 1, cfg).energy, 50);
});

test('con la barra incompleta no se puede usar ninguna habilidad', () => {
  const g = mockGame();
  const s = A.use({ ...A.createState(), energy: 99 }, 'clear', g);
  assert.strictEqual(s.energy, 99);
  assert.deepStrictEqual(g.calls, []);
});

test('usar una habilidad vacía la barra', () => {
  const g = mockGame();
  const s = A.use(full(), 'clear', g);
  assert.strictEqual(s.energy, 0);
  assert.deepStrictEqual(g.calls, ['clear']);
});

test('Visión y Ralentizar arrancan su efecto', () => {
  const g = mockGame();
  A.use(full(), 'vision', g);
  A.use(full(), 'slow', g);
  assert.deepStrictEqual(g.calls, ['effect:vision', 'effect:slow']);
});

test('Ralentizar: caída al 50 % durante 10 s y luego vuelve a la del nivel', () => {
  let s = A.startEffect(A.createState(), 'slow', A.ABILITY_CONFIG.SLOW_MS);
  assert.strictEqual(A.effectiveInterval(s, 500), 1000);
  s = A.tick(s, 9999);
  assert.strictEqual(A.effectiveInterval(s, 500), 1000);
  s = A.tick(s, 1);
  assert.strictEqual(A.effectiveInterval(s, 500), 500);
});

test('timers: sin tick (pausa) no se consume tiempo; no baja de 0', () => {
  let s = A.startEffect(A.createState(), 'vision', 20000);
  assert.strictEqual(s.effects.vision, 20000);
  s = A.tick(s, 25000);
  assert.strictEqual(s.effects.vision, 0);
  assert.ok(!A.isActive(s, 'vision'));
});

test('Limpieza: elimina la fila inferior y baja el resto', () => {
  const b = emptyBoard();
  b[19].fill(1); b[18][0] = 2;
  const out = A.clearBottomRow(b);
  assert.strictEqual(out.length, 20);
  assert.strictEqual(out[19][0], 2);
  assert.ok(out[0].every(v => v === 0));
  assert.strictEqual(b[19][0], 1); // no muta el original
});

test('Intercambio: abrir no gasta energía (Esc la conserva); confirmar sí', () => {
  const g = mockGame();
  const s = A.use(full(), 'swap', g);
  assert.strictEqual(s.energy, 100);
  assert.deepStrictEqual(g.calls, ['swap']);
  assert.strictEqual(A.spend(s).energy, 0);
});

test('Intercambio: 3 opciones distintas del pool', () => {
  const opts = A.pickOptions(Math.random, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.strictEqual(opts.length, 3);
  assert.strictEqual(new Set(opts).size, 3);
});

test('Deshacer: sin instantánea no gasta energía', () => {
  const g = { ...mockGame(), undo: () => false };
  assert.strictEqual(A.use(full(), 'undo', g).energy, 100);
});

test('instantánea: copia profunda de tablero, puntuación, líneas y combo', () => {
  const board = emptyBoard();
  const g = {
    board, score: 500, lines: 3, level: 1, dropInterval: 1000,
    scoreState: { chain: 2, b2b: true }, currentType: 3, queueTypes: [1, 2],
    holdPiece: null, holdUsedThisTurn: false, rewardSingle: false,
  };
  const snap = A.takeSnapshot(g);
  board[0][0] = 9; g.scoreState.chain = 0; g.queueTypes.push(5);
  assert.strictEqual(snap.board[0][0], 0);
  assert.deepStrictEqual(snap.scoreState, { chain: 2, b2b: true });
  assert.deepStrictEqual(snap.queueTypes, [1, 2]);
  assert.strictEqual(snap.score, 500);
});
