'use strict';
// Ejecutar con: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const R = require('../records.js');

const fakeStorage = (init = {}) => {
  const m = { ...init };
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
    _m: m,
  };
};
const entry = (score, name = 'A') => ({ name, score, lines: 1, maxCombo: 0, date: '2026-01-01' });

test('load: sin storage o vacío devuelve datos vacíos', () => {
  assert.deepStrictEqual(R.load(null), { list: [], bestCombo: 0, maxLines: 0 });
  assert.deepStrictEqual(R.load(fakeStorage()), { list: [], bestCombo: 0, maxLines: 0 });
});

test('load: JSON corrupto no lanza', () => {
  const s = fakeStorage({ [R.KEY]: '{no json' });
  assert.deepStrictEqual(R.load(s).list, []);
});

test('load: sanea entradas mal formadas', () => {
  const s = fakeStorage({ [R.KEY]: JSON.stringify({
    list: [null, 5, { name: '<b>x</b>', score: '300', lines: -4 }, { score: 'abc' }, { name: 'Z', score: 900 }],
    bestCombo: 'x', maxLines: 7.9,
  }) });
  const d = R.load(s);
  assert.deepStrictEqual(d.list.map(e => e.score), [900, 300]);
  assert.strictEqual(d.list[1].name, 'bx/b');
  assert.strictEqual(d.list[1].lines, 0);
  assert.strictEqual(d.bestCombo, 0);
  assert.strictEqual(d.maxLines, 7);
});

test('save/load ida y vuelta; reset borra', () => {
  const s = fakeStorage();
  const data = { list: [entry(100)], bestCombo: 3, maxLines: 12 };
  assert.ok(R.save(s, data));
  assert.deepStrictEqual(R.load(s).list[0].score, 100);
  assert.strictEqual(R.load(s).bestCombo, 3);
  R.reset(s);
  assert.deepStrictEqual(R.load(s), { list: [], bestCombo: 0, maxLines: 0 });
});

test('save: storage que lanza devuelve false', () => {
  const s = { setItem() { throw new Error('quota'); } };
  assert.strictEqual(R.save(s, { list: [] }), false);
});

test('qualifies: score 0 nunca; hueco libre sí; lleno exige superar al último', () => {
  assert.strictEqual(R.qualifies([], 0), false);
  assert.strictEqual(R.qualifies([], 10), true);
  const full = [500, 400, 300, 200, 100].map(s => entry(s));
  assert.strictEqual(R.qualifies(full, 100), false);
  assert.strictEqual(R.qualifies(full, 101), true);
});

test('insert: ordena, limita a 5 y devuelve el índice', () => {
  let list = [];
  for (const s of [300, 100, 500, 200, 400]) list = R.insert(list, entry(s)).list;
  assert.deepStrictEqual(list.map(e => e.score), [500, 400, 300, 200, 100]);
  const r = R.insert(list, entry(350, 'N'));
  assert.strictEqual(r.index, 2);
  assert.deepStrictEqual(r.list.map(e => e.score), [500, 400, 350, 300, 200]);
  assert.strictEqual(R.insert(list, entry(50)).index, -1);
  assert.strictEqual(R.insert(list, entry(50)).list.length, 5);
});

test('insert: empate queda detrás; no muta la lista original', () => {
  const list = [entry(100, 'Viejo')];
  const r = R.insert(list, entry(100, 'Nuevo'));
  assert.strictEqual(r.index, 1);
  assert.strictEqual(list.length, 1);
});

test('sanitizeName: recorta a 12, quita < > y usa valor por defecto', () => {
  assert.strictEqual(R.sanitizeName('  abcdefghijklmnop '), 'abcdefghijkl');
  assert.strictEqual(R.sanitizeName('<>'), R.DEFAULT_NAME);
  assert.strictEqual(R.sanitizeName(undefined), R.DEFAULT_NAME);
});

test('updateStats: solo sube los máximos', () => {
  let d = R.updateStats({ list: [], bestCombo: 3, maxLines: 10 }, { maxCombo: 2, lines: 15 });
  assert.strictEqual(d.bestCombo, 3);
  assert.strictEqual(d.maxLines, 15);
  d = R.updateStats(d, { maxCombo: 5, lines: 1 });
  assert.strictEqual(d.bestCombo, 5);
  assert.strictEqual(d.maxLines, 15);
});
