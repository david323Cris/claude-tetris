'use strict';

// Tabla de records local (módulo puro: sin DOM; el storage se inyecta).
const Records = (() => {
  const KEY = 'tetris-records';
  const TOP_SIZE = 5;
  const NAME_MAX = 12;

  function empty() {
    return { top: [], bestCombo: 0, maxLines: 0 };
  }

  function sanitizeName(name) {
    const n = String(name == null ? '' : name).replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
    return n || 'Anónimo';
  }

  function normalize(data) {
    const out = empty();
    if (!data || typeof data !== 'object') return out;
    if (Array.isArray(data.top)) {
      out.top = data.top
        .filter(e => e && Number.isFinite(e.score) && e.score > 0)
        .map(e => ({ name: sanitizeName(e.name), score: Math.floor(e.score) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_SIZE);
    }
    if (Number.isFinite(data.bestCombo) && data.bestCombo > 0) out.bestCombo = Math.floor(data.bestCombo);
    if (Number.isFinite(data.maxLines) && data.maxLines > 0) out.maxLines = Math.floor(data.maxLines);
    return out;
  }

  function load(storage) {
    try {
      const raw = storage && storage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : empty();
    } catch (_) {
      return empty();
    }
  }

  function save(storage, data) {
    try { storage.setItem(KEY, JSON.stringify(data)); } catch (_) { /* sin storage */ }
  }

  function reset(storage) {
    try { storage.removeItem(KEY); } catch (_) { /* sin storage */ }
    return empty();
  }

  // Posición (0-based) que ocuparía `score` en el top, o -1 si no entra.
  // A igualdad de puntos, el record antiguo conserva el puesto.
  function rankOf(data, score) {
    if (!(score > 0)) return -1;
    let i = data.top.findIndex(e => score > e.score);
    if (i === -1) i = data.top.length;
    return i < TOP_SIZE ? i : -1;
  }

  // Devuelve nuevos records (sin mutar) con la partida registrada.
  // Combo y líneas máximas se actualizan siempre; la puntuación solo si entra al top.
  function submit(data, { name, score, lines = 0, combo = 0 }) {
    const rank = rankOf(data, score);
    const top = data.top.slice();
    if (rank !== -1) {
      top.splice(rank, 0, { name: sanitizeName(name), score: Math.floor(score) });
      top.length = Math.min(top.length, TOP_SIZE);
    }
    return {
      rank,
      records: {
        top,
        bestCombo: Math.max(data.bestCombo, combo),
        maxLines: Math.max(data.maxLines, lines),
      },
    };
  }

  // Marca combo/líneas récord sin tocar el top (para partidas que no entran).
  function noteStats(data, { lines = 0, combo = 0 }) {
    return {
      top: data.top,
      bestCombo: Math.max(data.bestCombo, combo),
      maxLines: Math.max(data.maxLines, lines),
    };
  }

  return { KEY, TOP_SIZE, NAME_MAX, empty, load, save, reset, rankOf, submit, noteStats, sanitizeName };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Records;
