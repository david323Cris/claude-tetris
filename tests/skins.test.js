'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Skins = require('../skins.js');

function stubCtx() {
  const ctx = { shadowBlur: 0, globalAlpha: 1 };
  const noop = () => {};
  ['fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'arcTo', 'quadraticCurveTo',
    'closePath', 'fill', 'stroke', 'arc'].forEach(m => { ctx[m] = noop; });
  return ctx;
}

test('hay cuatro skins', () => {
  assert.deepStrictEqual(Skins.NAMES.slice().sort(), ['neon', 'pastel', 'pixel', 'retro']);
});

for (const name of Skins.NAMES) {
  const s = Skins.SKINS[name];
  test(`${name}: colores válidos`, () => {
    assert.ok(s.label);
    for (const key of ['colors', 'colorsLight']) {
      assert.strictEqual(s[key].length, 14);
      assert.strictEqual(s[key][0], null);
      for (const c of s[key].slice(1)) assert.match(c, /^#[0-9a-f]{6}$/i);
    }
  });
  test(`${name}: drawBlock no lanza y deja shadowBlur en 0`, () => {
    const ctx = stubCtx();
    s.drawBlock(ctx, 3, 4, s.colors[1], 30, 0.5);
    s.drawBlock(ctx, 0, 0, s.colors[3], 30);
    assert.strictEqual(ctx.shadowBlur, 0);
    assert.strictEqual(ctx.globalAlpha, 1);
  });
}

test('get() cae a retro', () => {
  assert.strictEqual(Skins.get('nope'), Skins.SKINS.retro);
  assert.strictEqual(Skins.get('__proto__'), Skins.SKINS.retro);
  assert.strictEqual(Skins.get('neon'), Skins.SKINS.neon);
});
