'use strict';
// Tabla de récords local: módulo puro (sin DOM). Global `Records` en el navegador, `require` en Node.

const RECORDS_CONFIG = { MAX_ENTRIES: 5, MAX_NAME: 12, DEFAULT_NAME: 'Anónimo', STORAGE_KEY: 'tetris-records' };

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

const num = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

function sanitizeName(name) {
  const clean = String(name == null ? '' : name).replace(/\s+/g, ' ').trim().slice(0, RECORDS_CONFIG.MAX_NAME);
  return clean || RECORDS_CONFIG.DEFAULT_NAME;
}

// Lectura tolerante: datos ausentes o corruptos devuelven una tabla vacía.
function loadRecords(storage) {
  try {
    const data = JSON.parse(storage.getItem(RECORDS_CONFIG.STORAGE_KEY));
    if (data && Array.isArray(data.top)) {
      const top = data.top
        .filter(e => e && num(e.score) > 0)
        .map(e => ({ name: sanitizeName(e.name), score: num(e.score), lines: num(e.lines), combo: num(e.combo) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, RECORDS_CONFIG.MAX_ENTRIES);
      return { top, bestCombo: num(data.bestCombo), maxLines: num(data.maxLines) };
    }
  } catch (_) { /* sin datos o corruptos */ }
  return emptyRecords();
}

function saveRecords(storage, records) {
  try { storage.setItem(RECORDS_CONFIG.STORAGE_KEY, JSON.stringify(records)); } catch (_) { /* sin almacenamiento */ }
}

// Posición (0-based) que ocuparía la puntuación en el top, o -1 si no entra.
// En empate, la entrada más antigua conserva el puesto.
function rankOf(records, score) {
  const s = num(score);
  if (s <= 0) return -1;
  let idx = records.top.findIndex(e => s > e.score);
  if (idx === -1) idx = records.top.length;
  return idx < RECORDS_CONFIG.MAX_ENTRIES ? idx : -1;
}

// Actualiza los máximos globales (mejor combo y líneas) al terminar una partida.
function updateStats(records, { combo = 0, lines = 0 } = {}) {
  return {
    ...records,
    bestCombo: Math.max(records.bestCombo, num(combo)),
    maxLines: Math.max(records.maxLines, num(lines)),
  };
}

// Inserta la partida en el top si califica. Devuelve { records, rank } (rank -1 = no entró).
function addEntry(records, { name, score, lines = 0, combo = 0 }) {
  const rank = rankOf(records, score);
  if (rank === -1) return { records, rank };
  const entry = { name: sanitizeName(name), score: num(score), lines: num(lines), combo: num(combo) };
  const top = [...records.top.slice(0, rank), entry, ...records.top.slice(rank)].slice(0, RECORDS_CONFIG.MAX_ENTRIES);
  return { records: { ...records, top }, rank };
}

const Records = {
  RECORDS_CONFIG, emptyRecords, sanitizeName, loadRecords, saveRecords, rankOf, updateStats, addEntry,
};

if (typeof module !== 'undefined' && module.exports) module.exports = Records;
