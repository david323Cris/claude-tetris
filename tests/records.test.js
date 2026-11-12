'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Records = require('../records.js');

function fakeStorage(initial) {
  const m = new Map(initial ? [[Records.KEY, initial]] : []);
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

test('load: vacío, JSON corrupto y datos inválidos dan records vacíos', () => {
  assert.deepStrictEqual(Records.load(fakeStorage()), Records.empty());
  assert.deepStrictEqual(Records.load(fakeStorage('{no json')), Records.empty());
  assert.deepStrictEqual(Records.load(fakeStorage('{"top":[{"score":"x"}]}')), Records.empty());
});

test('save/load round-trip y reset', () => {
  const st = fakeStorage();
  const { records } = Records.submit(Records.empty(), { name: 'Ana', score: 500, lines: 7, combo: 3 });
  Records.save(st, records);
  assert.deepStrictEqual(Records.load(st), records);
  assert.deepStrictEqual(Records.reset(st), Records.empty());
  assert.deepStrictEqual(Records.load(st), Records.empty());
});

test('submit ordena descendente y limita a 5', () => {
  let r = Records.empty();
  for (const s of [100, 300, 200, 500, 400, 50, 600]) r = Records.submit(r, { name: 'x', score: s }).records;
  assert.deepStrictEqual(r.top.map(e => e.score), [600, 500, 400, 300, 200]);
});

test('rankOf: entra, no entra, empate y score 0', () => {
  let r = Records.empty();
  for (const s of [500, 400, 300, 200, 100]) r = Records.submit(r, { name: 'x', score: s }).records;
  assert.strictEqual(Records.rankOf(r, 450), 1);
  assert.strictEqual(Records.rankOf(r, 100), -1); // empate con el último no desplaza
  assert.strictEqual(Records.rankOf(r, 50), -1);
  assert.strictEqual(Records.rankOf(Records.empty(), 0), -1);
  assert.strictEqual(Records.rankOf(Records.empty(), 10), 0);
});

test('combo y líneas máximas se actualizan aunque no entre al top', () => {
  let r = Records.empty();
  for (const s of [500, 400, 300, 200, 100]) r = Records.submit(r, { name: 'x', score: s, lines: 1, combo: 1 }).records;
  const res = Records.submit(r, { name: 'y', score: 10, lines: 40, combo: 6 });
  assert.strictEqual(res.rank, -1);
  assert.strictEqual(res.records.bestCombo, 6);
  assert.strictEqual(res.records.maxLines, 40);
  assert.deepStrictEqual(res.records.top, r.top);
});

test('sanitizeName: recorta, colapsa espacios y usa Anónimo por defecto', () => {
  assert.strictEqual(Records.sanitizeName('  a   b  '), 'a b');
  assert.strictEqual(Records.sanitizeName(''), 'Anónimo');
  assert.strictEqual(Records.sanitizeName('x'.repeat(50)).length, Records.NAME_MAX);
});

test('submit no muta los records originales', () => {
  const r = Records.empty();
  Records.submit(r, { name: 'a', score: 10, lines: 1, combo: 1 });
  assert.deepStrictEqual(r, Records.empty());
});
