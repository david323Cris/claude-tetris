'use strict';
// Ejecutar con: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const S = require('../scoring.js');

const emptyBoard = () => Array.from({ length: 20 }, () => new Array(10).fill(0));
const ev = (state, o = {}) =>
  S.evaluateLock(state, { lines: 0, tspin: false, level: 1, boardEmpty: false, ...o });

test('combo: tres limpiezas seguidas -> x3 en la tercera', () => {
  let st = S.createScoreState();
  let r;
  for (let i = 0; i < 3; i++) { r = ev(st, { lines: 1 }); st = r.state; }
  assert.strictEqual(r.combo, 3);
  assert.strictEqual(r.points, 300);
  assert.ok(r.events.some(e => e.text === 'COMBO x3'));
});

test('combo: pieza sin limpiar reinicia a x1', () => {
  let st = S.createScoreState();
  for (let i = 0; i < 3; i++) st = ev(st, { lines: 1 }).state;
  const r = ev(st);
  assert.strictEqual(r.combo, 1);
  assert.strictEqual(S.comboOf(r.state), 1);
  assert.strictEqual(r.points, 0);
});

test('combo: respeta el tope configurable', () => {
  let st = { chain: 50, b2b: false };
  assert.strictEqual(ev(st, { lines: 1 }).combo, 10);
  const cfg = { ...S.SCORING_CONFIG, COMBO_MAX: 4 };
  const r = S.evaluateLock(st, { lines: 1, tspin: false, level: 1, boardEmpty: false }, cfg);
  assert.strictEqual(r.combo, 4);
});

test('T-spin Double', () => {
  const r = ev(S.createScoreState(), { lines: 2, tspin: true });
  assert.strictEqual(r.points, 800);
  assert.strictEqual(r.events[0].text, 'T-SPIN DOUBLE');
});

test('T-spin sin líneas, single y triple', () => {
  const st = S.createScoreState();
  assert.strictEqual(ev(st, { tspin: true }).points, 400);
  assert.strictEqual(ev(st, { lines: 1, tspin: true }).points, 800);
  assert.strictEqual(ev(st, { lines: 3, tspin: true }).points, 1200);
});

test('T-spin sin líneas no rompe combo ni B2B... el combo sí se reinicia', () => {
  const r = ev({ chain: 2, b2b: true }, { tspin: true });
  assert.strictEqual(r.state.chain, 0);
  assert.strictEqual(r.state.b2b, true);
});

test('B2B: Tetris seguido de Tetris aplica x1.5', () => {
  let r = ev(S.createScoreState(), { lines: 4 });
  assert.strictEqual(r.points, 800);
  r = ev({ chain: 0, b2b: r.state.b2b }, { lines: 4 });
  assert.strictEqual(r.points, 1200);
  assert.strictEqual(r.events[0].text, 'B2B TETRIS');
});

test('B2B: limpieza normal rompe la cadena; pieza sin limpiar no', () => {
  let st = ev(S.createScoreState(), { lines: 4 }).state;
  st = ev(st).state;
  assert.strictEqual(st.b2b, true);
  st = ev(st, { lines: 1 }).state;
  assert.strictEqual(st.b2b, false);
});

test('B2B: T-spin con líneas cuenta como difícil', () => {
  let st = ev(S.createScoreState(), { lines: 2, tspin: true }).state;
  const r = ev(st, { lines: 4 });
  assert.strictEqual(r.events[0].text, 'B2B TETRIS');
});

test('Perfect Clear suma bonus y aviso', () => {
  const r = ev(S.createScoreState(), { lines: 4, boardEmpty: true });
  assert.strictEqual(r.points, 800 + 2000);
  assert.ok(r.events.some(e => e.text === 'PERFECT CLEAR'));
});

test('el nivel multiplica los puntos', () => {
  assert.strictEqual(ev(S.createScoreState(), { lines: 2, level: 3 }).points, 900);
});

test('detectTSpin: 3 esquinas ocupadas', () => {
  const b = emptyBoard();
  b[10][3] = 1; b[10][5] = 1; b[12][3] = 1; // esquinas de la T en x=3,y=10
  assert.strictEqual(S.detectTSpin(b, 3, 3, 10, true), true);
});

test('detectTSpin: 2 esquinas no basta', () => {
  const b = emptyBoard();
  b[10][3] = 1; b[10][5] = 1;
  assert.strictEqual(S.detectTSpin(b, 3, 3, 10, true), false);
});

test('detectTSpin: requiere rotación previa y pieza T', () => {
  const b = emptyBoard();
  b[10][3] = 1; b[10][5] = 1; b[12][3] = 1;
  assert.strictEqual(S.detectTSpin(b, 3, 3, 10, false), false);
  assert.strictEqual(S.detectTSpin(b, 8, 3, 10, true), false);
});

test('detectTSpin: paredes y suelo cuentan como ocupados', () => {
  const b = emptyBoard();
  // pegada al suelo: esquinas inferiores (y=20) fuera del tablero
  assert.strictEqual(S.detectTSpin(b, 3, 4, 18, true), true);
  // pared izquierda (2 esquinas fuera) sola no basta; con una esquina más sí
  assert.strictEqual(S.detectTSpin(b, 3, -1, 5, true), false);
  b[5][1] = 1;
  assert.strictEqual(S.detectTSpin(b, 3, -1, 5, true), true);
});

test('isBoardEmpty', () => {
  const b = emptyBoard();
  assert.strictEqual(S.isBoardEmpty(b), true);
  b[19][0] = 1;
  assert.strictEqual(S.isBoardEmpty(b), false);
});
