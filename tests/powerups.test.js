'use strict';
const test = require('node:test');
const assert = require('node:assert');
const PU = require('../powerups.js');
const P = require('../pieces.js');
const S = require('../scoring.js');

const W = PU.WILD;
const empty = () => Array.from({ length: 20 }, () => new Array(10).fill(0));
const ctx = (extra) => Object.assign({ type: 3, marked: { x: 5, y: 10 } }, extra);

test('bomba: borra 3×3 y los bloques superiores caen', () => {
  const b = empty();
  for (let r = 8; r < 14; r++) for (let c = 4; c <= 6; c++) b[r][c] = 1;
  b[7][5] = 2;
  const orig = JSON.stringify(b);
  const { board } = PU.applyEffect('bomb', b, ctx());
  assert.strictEqual(JSON.stringify(b), orig, 'no muta la entrada');
  assert.strictEqual(board[7][5], 0);
  assert.strictEqual(board[12][5], 2, 'cae 3 filas');
  assert.strictEqual(board[13][5], 1);
  assert.strictEqual(board[13][4], 1);
});

test('bomba en el borde no falla', () => {
  const b = empty(); b[19][0] = 1;
  const { board } = PU.applyEffect('bomb', b, ctx({ marked: { x: 0, y: 19 } }));
  assert.strictEqual(board[19][0], 0);
});

test('rayo: limpia la fila del bloque marcado y baja lo de arriba', () => {
  const b = empty();
  b[10].fill(1); b[9][2] = 4;
  const { board } = PU.applyEffect('lightning', b, ctx());
  assert.strictEqual(board[10][2], 4);
  assert.strictEqual(board[10][0], 0);
  assert.strictEqual(board[9][2], 0);
});

test('rayo en modo columna', () => {
  const b = empty();
  for (let r = 0; r < 20; r++) b[r][5] = 1;
  b[19][4] = 2;
  const { board } = PU.applyEffect('lightning', b, ctx({ options: { axis: 'column' } }));
  assert.ok(board.every(row => row[5] === 0));
  assert.strictEqual(board[19][4], 2);
});

test('tinte: convierte en comodines el color de la pieza', () => {
  const b = empty();
  b[19][0] = 3; b[19][1] = 2; b[18][0] = 3;
  const { board } = PU.applyEffect('tint', b, ctx({ type: 3 }));
  assert.strictEqual(board[19][0], W);
  assert.strictEqual(board[18][0], W);
  assert.strictEqual(board[19][1], 2);
});

test('gravedad: no quedan bloques flotando', () => {
  const b = empty();
  b[5][0] = 1; b[10][0] = 2; b[19][3] = 3; b[2][3] = 4;
  const { board } = PU.applyEffect('gravity', b, ctx());
  for (let c = 0; c < 10; c++) {
    let seenEmpty = false;
    for (let r = 19; r >= 0; r--) {
      if (board[r][c] === 0) seenEmpty = true;
      else assert.ok(!seenEmpty, `flotando en columna ${c}`);
    }
  }
  assert.deepStrictEqual([board[19][0], board[18][0], board[19][3], board[18][3]], [2, 1, 3, 4]);
});

test('congelar: devuelve 5 s y no cambia el tablero', () => {
  const b = empty(); b[19][0] = 1;
  const res = PU.applyEffect('freeze', b, ctx());
  assert.strictEqual(res.freezeMs, 5000);
  assert.deepStrictEqual(res.board, b);
});

test('gravedad + clearFullLines: las filas completadas se limpian', () => {
  const b = empty();
  for (let c = 0; c < 9; c++) b[19][c] = 1;
  b[10][9] = 2;
  const { board } = PU.applyEffect('gravity', b, ctx());
  const res = PU.clearFullLines(board);
  assert.strictEqual(res.cleared, 1);
  assert.ok(res.board.every(row => row.every(v => v === 0)));
});

test('clearFullLines: comodín cuenta como relleno y arrastra comodines conectados', () => {
  const b = empty();
  b[19].fill(1); b[19][4] = W;
  b[18][4] = W;
  b[17][4] = W;
  b[18][0] = 5;
  b[16][8] = W;
  const { board, cleared } = PU.clearFullLines(b);
  assert.strictEqual(cleared, 1);
  assert.strictEqual(board[19][0], 5);
  assert.strictEqual(board[19][4], 0);
  assert.strictEqual(board[18][4], 0);
  assert.strictEqual(board[17][8], W);
});

test('las líneas de un power-up suman y cuentan para el combo', () => {
  const b = empty();
  for (let c = 0; c < 9; c++) b[19][c] = 1;
  b[10][9] = 2;
  const { board } = PU.applyEffect('gravity', b, ctx());
  const { cleared } = PU.clearFullLines(board);
  let r = S.evaluateLock(S.createScoreState(), { lines: cleared, tspin: false, level: 1, boardEmpty: false });
  assert.ok(r.points > 0);
  r = S.evaluateLock(r.state, { lines: 1, tspin: false, level: 1, boardEmpty: false });
  assert.strictEqual(r.combo, 2);
});

test('advanceProgress: aparece cada 10 líneas y conserva el resto', () => {
  assert.deepStrictEqual(PU.advanceProgress(0, 4), { progress: 4, triggered: false });
  assert.deepStrictEqual(PU.advanceProgress(8, 4), { progress: 2, triggered: true });
  assert.deepStrictEqual(PU.advanceProgress(9, 1), { progress: 0, triggered: true });
});

test('rotateMarked sigue a la celda al rotar la forma', () => {
  for (const type of [1, 3, 8, 9, 11]) {
    const shape = P.PIECES[type];
    const m = PU.pickMarkedCell(shape, P.mulberry32(type));
    const rot = P.rotateCW(shape);
    const m2 = PU.rotateMarked(m, shape.length);
    assert.ok(rot[m2.r][m2.c], `celda marcada fuera de la pieza (tipo ${type})`);
  }
});

test('pickKind devuelve un efecto registrado', () => {
  const rng = P.mulberry32(1);
  for (let i = 0; i < 50; i++) assert.ok(PU.EFFECTS[PU.pickKind(rng)]);
});
