'use strict';
const test = require('node:test');
const assert = require('node:assert');
const P = require('../pieces.js');

const emptyBoard = () => Array.from({ length: 20 }, () => new Array(10).fill(0));

test('todas las piezas tienen forma cuadrada y color (índice) propio', () => {
  for (let t = 1; t < P.PIECES.length; t++) {
    const s = P.PIECES[t];
    assert.ok(s.every(row => row.length === s.length), `pieza ${t} no cuadrada`);
    const vals = new Set(s.flat().filter(Boolean));
    assert.deepStrictEqual([...vals], [t]);
  }
  assert.strictEqual(P.PIECES.length, 13);
});

test('anillo 3×3 tiene 8 bloques y centro vacío; single tiene 1', () => {
  assert.strictEqual(P.PIECES[P.NUT].flat().filter(Boolean).length, 8);
  assert.strictEqual(P.PIECES[P.NUT][1][1], 0);
  assert.strictEqual(P.PIECES[P.SINGLE].flat().filter(Boolean).length, 1);
});

test('spawn centrado', () => {
  assert.strictEqual(P.createPiece(P.SINGLE).x, 5);
  assert.strictEqual(P.createPiece(9).x, 4);
  assert.strictEqual(P.createPiece(11).x, 3);
});

test('rotar 4 veces devuelve la forma original', () => {
  for (let t = 1; t < P.PIECES.length; t++) {
    let s = P.PIECES[t];
    for (let i = 0; i < 4; i++) s = P.rotateCW(s);
    assert.deepStrictEqual(s, P.PIECES[t]);
  }
});

test('cruz es simétrica al rotar; U cambia', () => {
  assert.deepStrictEqual(P.rotateCW(P.PIECES[9]), P.PIECES[9]);
  assert.notDeepStrictEqual(P.rotateCW(P.PIECES[10]), P.PIECES[10]);
});

test('colisión con paredes, suelo y bloques', () => {
  const b = emptyBoard();
  const u = P.PIECES[10];
  assert.ok(P.collides(b, u, -1, 0));
  assert.ok(P.collides(b, u, 8, 0));
  assert.ok(P.collides(b, u, 3, 19));
  assert.ok(!P.collides(b, u, 3, 5));
  b[5][3] = 1;
  assert.ok(P.collides(b, u, 3, 5));
});

test('Y vertical junto a la pared derecha aplica wall kick', () => {
  const b = emptyBoard();
  // Y horizontal (4x4) rota a vertical en la columna 2 de su matriz
  const piece = { shape: P.PIECES[11], x: 6, y: 0 };
  const res = P.rotateWithKicks(b, piece);
  assert.ok(res);
  assert.ok(!P.collides(b, res.shape, res.x, 0));
});

test('rotación sin espacio no rota', () => {
  const b = emptyBoard();
  // Rodea la pieza con bloques para que ninguna rotación/kick quepa
  for (let r = 0; r < 20; r++) for (let c = 0; c < 10; c++) b[r][c] = 1;
  for (const [r, c] of [[1, 3], [1, 4], [1, 5], [1, 6]]) b[r][c] = 0;
  const piece = { shape: P.PIECES[1], x: 3, y: 0 };
  assert.strictEqual(P.rotateWithKicks(b, piece), null);
});

test('misma semilla → misma secuencia', () => {
  const seq = seed => {
    const rng = P.mulberry32(seed);
    return Array.from({ length: 200 }, (_, i) => P.pickType(rng, 1 + (i % 10), {}));
  };
  assert.deepStrictEqual(seq(42), seq(42));
  assert.notDeepStrictEqual(seq(42), seq(43));
});

test('modo clásico: solo las 7 piezas estándar', () => {
  const rng = P.mulberry32(7);
  for (let i = 0; i < 5000; i++) {
    const t = P.pickType(rng, 10, { CLASSIC: true });
    assert.ok(P.STANDARD.includes(t));
  }
});

test('anillo 3×3 no aparece bajo el nivel mínimo', () => {
  const rng = P.mulberry32(1);
  for (let i = 0; i < 20000; i++) {
    assert.notStrictEqual(P.pickType(rng, 1, { HOLLOW_MIN_LEVEL: 3 }), P.NUT);
  }
});

test('probabilidades aproximadas: pentominós ~5 %, anillo ~2 %', () => {
  const rng = P.mulberry32(123);
  const n = 100000;
  let pento = 0, nut = 0;
  for (let i = 0; i < n; i++) {
    const t = P.pickType(rng, 5, {});
    if (P.PENTOMINOS.includes(t)) pento++;
    if (t === P.NUT) nut++;
  }
  assert.ok(Math.abs(pento / n - 0.05) < 0.01, `pento=${pento / n}`);
  assert.ok(Math.abs(nut / n - 0.02) < 0.01, `nut=${nut / n}`);
});

test('probabilidades configurables y single nunca sale del generador', () => {
  const rng = P.mulberry32(5);
  for (let i = 0; i < 2000; i++) {
    const t = P.pickType(rng, 5, { PENTO_CHANCE: 1, HOLLOW_CHANCE: 0 });
    assert.ok(P.PENTOMINOS.includes(t));
  }
});
