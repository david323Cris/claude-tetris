'use strict';
// Tabla de records local. Módulo puro (sin DOM): `Records` en el navegador, `require` en Node.
// `storage` es cualquier objeto con getItem/setItem/removeItem (p. ej. localStorage).

const KEY = 'tetris-records';
const MAX_ENTRIES = 5;
const MAX_NAME = 12;
const DEFAULT_NAME = 'Anónimo';

function emptyData() {
  return { list: [], bestCombo: 0, maxLines: 0 };
}

function num(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sanitizeName(name) {
  const s = String(name == null ? '' : name)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, MAX_NAME)
    .trim();
  return s || DEFAULT_NAME;
}

function sanitizeEntry(e) {
  if (!e || typeof e !== 'object') return null;
  const score = num(e.score);
  if (score <= 0) return null;
  return {
    name: sanitizeName(e.name),
    score,
    lines: num(e.lines),
    maxCombo: num(e.maxCombo),
    date: typeof e.date === 'string' ? e.date.slice(0, 40) : '',
  };
}

function sanitizeList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(sanitizeEntry).filter(Boolean)
    .sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
}

function sanitizeData(d) {
  if (!d || typeof d !== 'object') return emptyData();
  return { list: sanitizeList(d.list), bestCombo: num(d.bestCombo), maxLines: num(d.maxLines) };
}

function load(storage) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return emptyData();
    return sanitizeData(JSON.parse(raw));
  } catch (_) {
    return emptyData();
  }
}

function save(storage, data) {
  try {
    storage.setItem(KEY, JSON.stringify(sanitizeData(data)));
    return true;
  } catch (_) {
    return false;
  }
}

function reset(storage) {
  try { storage.removeItem(KEY); } catch (_) {}
  return emptyData();
}

// ¿Entra la puntuación en el top? (score > 0 y hay hueco o supera al último)
function qualifies(list, score) {
  const s = num(score);
  if (s <= 0) return false;
  const l = sanitizeList(list);
  return l.length < MAX_ENTRIES || s > l[l.length - 1].score;
}

// Inserta manteniendo el top ordenado; ante empate el nuevo queda después de los existentes.
// Devuelve { list, index } con index = -1 si no entró.
function insert(list, entry) {
  const e = sanitizeEntry(entry);
  const l = sanitizeList(list);
  if (!e) return { list: l, index: -1 };
  let idx = l.findIndex(x => e.score > x.score);
  if (idx === -1) idx = l.length;
  l.splice(idx, 0, e);
  if (idx >= MAX_ENTRIES) return { list: l.slice(0, MAX_ENTRIES), index: -1 };
  return { list: l.slice(0, MAX_ENTRIES), index: idx };
}

// Actualiza los máximos históricos (combo y líneas); devuelve un objeto nuevo
function updateStats(data, { maxCombo, lines }) {
  const d = sanitizeData(data);
  return {
    list: d.list,
    bestCombo: Math.max(d.bestCombo, num(maxCombo)),
    maxLines: Math.max(d.maxLines, num(lines)),
  };
}

const Records = {
  KEY, MAX_ENTRIES, MAX_NAME, DEFAULT_NAME,
  load, save, reset, qualifies, insert, updateStats, sanitizeName,
};

if (typeof module !== 'undefined' && module.exports) module.exports = Records;
