'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Skins = require('../skins.js');

function fakeStorage(init = {}) {
  const d = { ...init };
  return { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = v; }, d };
}

test('hay 4 skins con paletas completas de 16 entradas', () => {
  assert.deepEqual(Object.keys(Skins.SKINS), ['retro', 'neon', 'pastel', 'pixel']);
  for (const s of Object.values(Skins.SKINS)) {
    assert.equal(s.dark.length, 16);
    assert.equal(s.light.length, 16);
    assert.equal(s.dark[0], null);
    assert.equal(typeof s.drawBlock, 'function');
  }
});

test('getSkin cae a retro con ids inválidos', () => {
  assert.equal(Skins.getSkin('nope').id, 'retro');
  assert.equal(Skins.getSkin('__proto__').id, 'retro');
  assert.equal(Skins.getSkin('neon').id, 'neon');
});

test('persistencia: guarda y carga, ignora valores inválidos', () => {
  const st = fakeStorage();
  assert.equal(Skins.loadSkin(st), 'retro');
  assert.equal(Skins.saveSkin(st, 'pastel'), true);
  assert.equal(Skins.loadSkin(st), 'pastel');
  assert.equal(Skins.saveSkin(st, 'x'), false);
  assert.equal(Skins.loadSkin(fakeStorage({ 'tetris-skin': 'basura' })), 'retro');
});

test('storage que lanza error no rompe', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(Skins.loadSkin(bad), 'retro');
  assert.equal(Skins.saveSkin(bad, 'neon'), false);
});

test('cada drawBlock dibuja sin error sobre un contexto simulado', () => {
  const calls = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  for (const s of Object.values(Skins.SKINS)) {
    calls.length = 0;
    s.drawBlock(ctx, 30, 60, 30, s.dark[1]);
    assert.ok(calls.length > 0, s.id);
  }
});
