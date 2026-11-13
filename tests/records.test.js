'use strict';
// Ejecutar con: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const R = require('../records.js');

const mem = (initial) => {
  let v = initial === undefined ? null : initial;
  return { getItem: () => v, setItem: (_, x) => { v = x; }, get value() { return v; } };
};
const fill = (scores) => scores.reduce((r, s, i) => R.addEntry(r, { name: `J${i}`, score: s }).records, R.emptyRecords());

test('rankOf: tabla vacía, puntuación 0 y top lleno', () => {
  assert.equal(R.rankOf(R.emptyRecords(), 100), 0);
  assert.equal(R.rankOf(R.emptyRecords(), 0), -1);
  const full = fill([500, 400, 300, 200, 100]);
  assert.equal(R.rankOf(full, 50), -1);
  assert.equal(R.rankOf(full, 100), -1); // empate con el último: no desplaza
  assert.equal(R.rankOf(full, 350), 2);
  assert.equal(R.rankOf(full, 900), 0);
});

test('addEntry: mantiene orden descendente y recorta a 5', () => {
  let r = fill([500, 400, 300, 200, 100]);
  const res = R.addEntry(r, { name: 'Ana', score: 350, lines: 12, combo: 3 });
  assert.equal(res.rank, 2);
  assert.deepEqual(res.records.top.map(e => e.score), [500, 400, 350, 300, 200]);
  assert.equal(res.records.top[2].name, 'Ana');
  assert.equal(res.records.top[2].lines, 12);
});

test('addEntry: no modifica el original y rechaza lo que no entra', () => {
  const r = fill([500, 400, 300, 200, 100]);
  const res = R.addEntry(r, { name: 'X', score: 10 });
  assert.equal(res.rank, -1);
  assert.equal(res.records, r);
  assert.equal(r.top.length, 5);
});

test('sanitizeName: recorta, colapsa espacios y usa nombre por defecto', () => {
  assert.equal(R.sanitizeName('   '), 'Anónimo');
  assert.equal(R.sanitizeName(null), 'Anónimo');
  assert.equal(R.sanitizeName('  a   b '), 'a b');
  assert.equal(R.sanitizeName('x'.repeat(40)).length, 12);
});

test('updateStats: solo sube los máximos', () => {
  let r = R.updateStats(R.emptyRecords(), { combo: 4, lines: 30 });
  r = R.updateStats(r, { combo: 2, lines: 50 });
  assert.equal(r.bestCombo, 4);
  assert.equal(r.maxLines, 50);
});

test('persistencia: ida y vuelta y datos corruptos', () => {
  const s = mem();
  const r = R.updateStats(fill([300, 100]), { combo: 5, lines: 20 });
  R.saveRecords(s, r);
  assert.deepEqual(R.loadRecords(s), r);
  assert.deepEqual(R.loadRecords(mem('{no json')), R.emptyRecords());
  assert.deepEqual(R.loadRecords(mem('{"top":"x"}')), R.emptyRecords());
  assert.deepEqual(R.loadRecords({ getItem() { throw new Error('bloqueado'); } }), R.emptyRecords());
  assert.doesNotThrow(() => R.saveRecords({ setItem() { throw new Error('lleno'); } }, r));
});

test('loadRecords: ordena y descarta entradas inválidas', () => {
  const raw = JSON.stringify({ top: [{ name: 'a', score: 10 }, { score: -5 }, null, { name: 'b', score: 99 }], bestCombo: 3 });
  const r = R.loadRecords(mem(raw));
  assert.deepEqual(r.top.map(e => e.score), [99, 10]);
  assert.equal(r.bestCombo, 3);
  assert.equal(r.maxLines, 0);
});
