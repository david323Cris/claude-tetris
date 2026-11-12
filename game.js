'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#b0bec5', // Tuerca - gris metálico
  '#f06292', // Cruz (+) - rosa
  '#4db6ac', // U - verde azulado
  '#dce775', // Y - lima
  '#ff8a65', // Single 1×1 - coral
  '#eceff1', // Comodín (Tinte)
  '#607d8b', // Basura (Modo Desafío)
  '#8d6e63', // Bloque sembrado (Modo Desafío)
];

// Variantes más saturadas para buen contraste sobre fondo claro
const COLORS_LIGHT = [
  null,
  '#00acc1', '#f9a825', '#8e24aa', '#43a047', '#e53935', '#1e88e5', '#fb8c00', '#78909c',
  '#d81b60', '#00897b', '#9e9d24', '#f4511e', '#90a4ae', '#455a64', '#6d4c41',
];

// Formas y reglas de aparición viven en pieces.js (módulo puro, con tests)
// PIECES, NUT y WILD ya existen como `const` globales declarados en pieces.js / powerups.js
// (los scripts clásicos comparten el ámbito léxico global). Redeclararlos aquí lanzaría
// "SyntaxError: Identifier has already been declared" y game.js no se ejecutaría (pantalla vacía).

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl =document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');
const classicBtn = document.getElementById('classic-toggle');
const muteBtn = document.getElementById('mute-toggle');
const comboEl = document.getElementById('combo');
const b2bEl = document.getElementById('b2b');
const popupsEl = document.getElementById('popups');
const freezeEl = document.getElementById('freeze');
const overlayDetail = document.getElementById('overlay-detail');
const nextLevelBtn = document.getElementById('next-level-btn');
const levelsBtn = document.getElementById('levels-btn');
const challengeBtn = document.getElementById('challenge-btn');
const levelSelectEl = document.getElementById('level-select');
const levelListEl = document.getElementById('level-list');
const challengeInfoEl = document.getElementById('challenge-info');
const challengeNameEl = document.getElementById('challenge-name');
const challengeTimerEl = document.getElementById('challenge-timer');
const challengeGoalEl = document.getElementById('challenge-goal');
const energyBarEl = document.getElementById('energy-bar');
const energyFillEl = document.getElementById('energy-fill');
const energyTextEl = document.getElementById('energy-text');
const visionEl = document.getElementById('vision');
const slowEl = document.getElementById('slow');
const visionCanvas = document.getElementById('vision-canvas');
const visionCtx = visionCanvas.getContext('2d');
const abilitySelectEl = document.getElementById('ability-select');
const abilityTitleEl = document.getElementById('ability-title');
const abilityListEl = document.getElementById('ability-list');

// Modo desafío: las reglas viven en challenge.js; aquí solo se aplican al juego.
// ---- Tabla de records (solo modo clásico) ----
const startScreenEl = document.getElementById('start-screen');
const startRecordsEl = document.getElementById('start-records');
const overlayRecordsEl = document.getElementById('overlay-records');
const recordForm = document.getElementById('record-form');
const recordNameEl = document.getElementById('record-name');
const recordMsgEl = document.getElementById('record-msg');
let records = Records.load(localStorageSafe());
let runMaxCombo = 1;       // mejor combo de la partida en curso
let pendingRank = -1;      // puesto del top pendiente de guardar (-1 = ninguno)
let savedRank = -1;        // puesto resaltado tras guardar

function renderRecords(el, highlight = -1) {
  el.textContent = '';
  const h = document.createElement('h3');
  h.textContent = 'MEJORES PUNTUACIONES';
  const ol = document.createElement('ol');
  for (let i = 0; i < Records.TOP_SIZE; i++) {
    const e = records.top[i];
    const li = document.createElement('li');
    const a = document.createElement('span');
    const b = document.createElement('span');
    if (e) {
      a.textContent = `${i + 1}. ${e.name}`;
      b.textContent = e.score.toLocaleString();
      if (i === highlight) li.className = 'highlight';
    } else {
      a.textContent = `${i + 1}. ---`;
      li.className = 'empty';
    }
    li.append(a, b);
    ol.appendChild(li);
  }
  const stats = document.createElement('p');
  stats.className = 'rec-stats';
  stats.textContent = `Mejor combo: x${Math.max(records.bestCombo, 1)} · Líneas máx.: ${records.maxLines}`;
  el.append(h, ol, stats);
}

// Guarda la puntuación pendiente (nombre del formulario) y resalta su puesto.
function commitRecord() {
  if (pendingRank === -1) return;
  const res = Records.submit(records, {
    name: recordNameEl.value, score: score, lines, combo: runMaxCombo,
  });
  records = res.records;
  Records.save(localStorageSafe(), records);
  savedRank = res.rank;
  pendingRank = -1;
  recordForm.classList.add('hidden');
  renderRecords(overlayRecordsEl, savedRank);
}

function showStartScreen() {
  menuOpen = true;
  cancelAnimationFrame(animId);
  renderRecords(startRecordsEl);
  startScreenEl.classList.remove('hidden');
}

let currentLevel = null;   // null = modo clásico
let challengeRun = null;   // motor de reglas de la partida en curso
let menuOpen = false;
let challengeProgress = Challenge.loadProgress(localStorageSafe());

function localStorageSafe() {
  try { return window.localStorage; } catch (_) { return { getItem() { return null; }, setItem() {} }; }
}

let theme = 'dark';
let gridColor = '#22222e';

let holdPiece, holdUsedThisTurn;
let classicMode = false, rewardSingle = false, rng = Math.random;
let scoreState, lastWasRotation, muted = false;
let powerProgress, freezeMs; // líneas hacia el próximo power-up / ms de Congelar restantes
const powerUpOptions = { axis: PowerUps.POWERUP_CONFIG.LIGHTNING_AXIS, freezeMs: PowerUps.POWERUP_CONFIG.FREEZE_MS };
const powerUpEvery = PowerUps.POWERUP_CONFIG.EVERY_LINES;
let ab, abilityMenu = null, pieceStartScore; // habilidades: estado (energía/timers/instantánea) y selector (null = cerrado)
let queue; // cola de piezas: queue[0] = NEXT; Visión muestra las 5
let startLevel = 1, baseLevel = 1, resumeGuardUntil = 0; // nivel inicial elegido en el menú de pausa / el de la partida en curso
let board, current, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

// `rng` es inyectable (ver `setRng`) para generar secuencias reproducibles
function randomPiece() {
  return createPiece(Pieces.pickType(rng, level, { CLASSIC: classicMode }));
}

function setRng(fn) { rng = fn; }

const QUEUE_SIZE = 5;

// Pieza en posición y rotación de spawn
function createPiece(type) {
  return Pieces.createPiece(type, COLS);
}

function collide(shape, ox, oy) {
  return Pieces.collides(board, shape, ox, oy);
}

function tryRotate() {
  const dir = challengeRun && challengeRun.rotationInverted() ? -1 : 1;
  const res = Pieces.rotateWithKicks(board, current, dir);
  if (!res) return;
  current.shape = res.shape;
  current.x = res.x;
  if (current.marked) current.marked = PowerUps.rotateMarked(current.marked, current.shape.length);
  lastWasRotation = true; // un kick también cuenta como T-spin completo
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// Quita las líneas completas del tablero (con comodines en cadena) y devuelve cuántas fueron.
function removeFullLines() {
  const res = PowerUps.clearFullLines(board);
  board = res.board;
  return res.cleared;
}

// Marca la pieza con un power-up aleatorio y elige su bloque marcado
function applyPowerUpMark(piece) {
  piece.powerUp = PowerUps.pickKind(rng);
  piece.marked = PowerUps.pickMarkedCell(piece.shape, rng);
  piece.spawnMarked = { ...piece.marked }; // para recrear la pieza en Deshacer
}

// Efecto del power-up de la pieza que se acaba de fusionar
function triggerPowerUp() {
  const kind = current.powerUp;
  const marked = { x: current.x + current.marked.c, y: current.y + current.marked.r };
  const res = PowerUps.applyEffect(kind, board, { type: current.type, marked, options: powerUpOptions });
  board = res.board;
  if (res.freezeMs) freezeMs = res.freezeMs;
  showPowerUp(kind);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  if (gy > current.y) lastWasRotation = false;
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastWasRotation = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  // Instantánea para Deshacer (solo la última pieza), antes de tocar el tablero
  ab = { ...ab, snapshot: Abilities.takeSnapshot({
    board, score: pieceStartScore, lines, level, dropInterval, scoreState, powerProgress, freezeMs,
    holdPiece, holdUsedThisTurn, queue, rewardSingle, piece: current,
  }) };
  // T-spin se evalúa sobre el tablero sin la pieza fusionada
  const tspin = Scoring.detectTSpin(board, current.type, current.x, current.y, lastWasRotation);
  merge();
  if (current.powerUp) triggerPowerUp();
  const cleared = removeFullLines();
  const result = Scoring.evaluateLock(scoreState, {
    lines: cleared, tspin, level, boardEmpty: Scoring.isBoardEmpty(board),
  });
  scoreState = result.state;
  runMaxCombo = Math.max(runMaxCombo, Scoring.comboOf(scoreState));
  score += result.points;
  if (cleared) {
    lines += cleared;
    level = baseLevel + Math.floor(lines / 10);
    dropInterval = speedFor(level);
    // Cada N líneas, la siguiente pieza lleva un power-up
    const adv = PowerUps.advanceProgress(powerProgress, cleared, powerUpEvery);
    powerProgress = adv.progress;
    if (adv.triggered && !queue[0].powerUp) applyPowerUpMark(queue[0]);
  }
  ab = Abilities.gainEnergy(ab, cleared);
  // Recompensa: tras un Tetris la siguiente pieza de la cola es una 1×1
  if (cleared === 4 && !classicMode) rewardSingle = true;
  updateHUD();
  showFeedback(result);
  if (challengeRun) {
    challengeRun.onLock({ lines, score });
    if (checkChallenge()) return; // victoria/derrota: no se genera otra pieza
  }
  holdUsedThisTurn = false;
  spawn();
}

function holdCurrent() {
  if (holdUsedThisTurn || current.powerUp) return; // la pieza con power-up no se reserva
  const type = current.type;
  if (holdPiece === null) {
    holdPiece = type;
    spawn();
  } else {
    const incoming = createPiece(holdPiece);
    holdPiece = type;
    current = incoming;
    lastWasRotation = false;
    if (collide(current.shape, current.x, current.y)) endGame();
  }
  holdUsedThisTurn = true;
  drawHold();
}

function spawn() {
  lastWasRotation = false;
  current = queue.shift();
  queue.push(randomPiece());
  if (rewardSingle) queue[0] = createPiece(Pieces.SINGLE); // la siguiente de la cola
  rewardSingle = false;
  pieceStartScore = score;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  const combo = Scoring.comboOf(scoreState);
  comboEl.textContent = `COMBO x${combo}`;
  comboEl.classList.toggle('hidden', combo < 2);
  b2bEl.classList.toggle('hidden', !scoreState.b2b);
  updateFreezeHUD();
  updateAbilityHUD();
}

function updateFreezeHUD() {
  freezeEl.classList.toggle('hidden', freezeMs <= 0);
  if (freezeMs > 0) freezeEl.textContent = `❄️ ${(freezeMs / 1000).toFixed(1)}s`;
}

function updateAbilityHUD() {
  const pct = Math.round(ab.energy);
  const ready = Abilities.isReady(ab);
  energyFillEl.style.width = `${pct}%`;
  energyTextEl.textContent = ready ? 'LISTA (E)' : `${pct}%`;
  energyBarEl.classList.toggle('ready', ready);
  energyBarEl.setAttribute('aria-valuenow', String(pct));
  visionEl.classList.toggle('hidden', ab.visionMs <= 0);
  if (ab.visionMs > 0) visionEl.textContent = `👁 ${(ab.visionMs / 1000).toFixed(1)}s`;
  slowEl.classList.toggle('hidden', ab.slowMs <= 0);
  if (ab.slowMs > 0) slowEl.textContent = `🐢 ${(ab.slowMs / 1000).toFixed(1)}s`;
  const showVision = ab.visionMs > 0;
  if (visionCanvas.classList.contains('hidden') === showVision) { // cambió el estado de Visión
    visionCanvas.classList.toggle('hidden', !showVision);
    drawNext();
  }
}

// ---- Habilidades: selector (el juego queda en pausa mientras está abierto) ----
function openAbilitySelect() {
  if (abilityMenu || paused || gameOver || menuOpen || !Abilities.isReady(ab)) return;
  cancelAnimationFrame(animId); // sin loop no corren los timers: la pausa no consume tiempo
  abilityMenu = { mode: 'list', index: 0, choices: [] };
  renderAbilityMenu();
}

// Cierra el selector (Esc = sin gastar energía; también se usa tras activar una habilidad)
function closeAbilitySelect() {
  abilityMenu = null;
  abilitySelectEl.classList.add('hidden');
  if (gameOver || paused) return;
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function renderAbilityMenu() {
  const swap = abilityMenu.mode === 'swap';
  abilityTitleEl.textContent = swap ? 'ELIGE UNA PIEZA' : 'HABILIDADES';
  abilityListEl.textContent = '';
  const entries = swap
    ? abilityMenu.choices.map(t => ({ name: Pieces.PIECE_DEFS[t].name, type: t }))
    : Abilities.ABILITIES.map(a => ({ name: `${a.icon} ${a.name}`, description: a.description, disabled: !a.canUse(ab, {}) }));
  entries.forEach((en, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'level-item' + (i === abilityMenu.index ? ' selected' : '');
    btn.disabled = !!en.disabled;
    const name = document.createElement('span');
    name.className = 'lvl-name';
    name.textContent = `${i + 1}. ${en.name}`;
    btn.appendChild(name);
    if (en.type) {
      const cv = document.createElement('canvas');
      cv.width = 120; cv.height = 90;
      btn.appendChild(cv);
      drawQueuePiece(cv.getContext('2d'), createPiece(en.type), 22, 120, 90, 0);
    } else {
      const d = document.createElement('span');
      d.className = 'lvl-meta';
      d.textContent = en.description;
      btn.appendChild(d);
    }
    btn.addEventListener('click', () => { abilityMenu.index = i; confirmAbility(); btn.blur(); });
    li.appendChild(btn);
    abilityListEl.appendChild(li);
  });
  abilitySelectEl.classList.remove('hidden');
}

function confirmAbility() {
  if (!abilityMenu) return;
  if (abilityMenu.mode === 'swap') {
    const piece = createPiece(abilityMenu.choices[abilityMenu.index]);
    if (collide(piece.shape, piece.x, piece.y)) return; // no cabe: no se gasta energía
    applyAbility('swap', { choice: piece });
    return;
  }
  const def = Abilities.ABILITIES[abilityMenu.index];
  if (!def || !def.canUse(ab, {})) return; // p. ej. Deshacer sin instantánea
  if (def.id === 'swap') { // segundo paso: 3 opciones aleatorias del pool
    const pool = Abilities.swapPool(Pieces, classicMode);
    abilityMenu = { mode: 'swap', index: 0, choices: Abilities.pickSwapChoices(rng, pool) };
    renderAbilityMenu();
    return;
  }
  applyAbility(def.id, { board });
}

function applyAbility(id, ctx) {
  const res = Abilities.activate(id, ab, ctx);
  if (!res.ok) return;
  ab = res.state;
  if (res.swapTo) { current = res.swapTo; lastWasRotation = false; }
  if (res.board) board = res.board;
  if (res.restore) restoreSnapshot(res.restore);
  closeAbilitySelect();
  updateHUD();
  drawNext();
  drawHold();
  draw();
  if (res.board && challengeRun && !gameOver) checkChallenge(); // Limpieza puede cumplir el objetivo
}

// Deshacer: vuelve al estado previo a la última pieza y la recrea en su posición de aparición.
// La energía ganada con esa pieza no se devuelve.
function restoreSnapshot(s) {
  board = s.board.map(r => r.slice());
  score = s.score; lines = s.lines; level = s.level; dropInterval = s.dropInterval;
  scoreState = { ...s.scoreState };
  powerProgress = s.powerProgress; freezeMs = s.freezeMs;
  holdPiece = s.holdPiece; holdUsedThisTurn = s.holdUsedThisTurn;
  queue = s.queue.map(p => ({ ...p, shape: p.shape.map(r => r.slice()) }));
  rewardSingle = s.rewardSingle;
  current = createPiece(s.piece.type);
  if (s.piece.powerUp) {
    current.powerUp = s.piece.powerUp;
    current.marked = { ...s.piece.marked };
    current.spawnMarked = { ...s.piece.marked };
  }
  pieceStartScore = score;
  lastWasRotation = false;
}

// Teclado con el selector abierto: 1–5, ↑↓ + Enter, Esc cancela
function abilityKey(e) {
  const n = abilityMenu.mode === 'swap' ? abilityMenu.choices.length : Abilities.ABILITIES.length;
  if (e.code === 'Escape') { closeAbilitySelect(); return; }
  if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); confirmAbility(); return; }
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (m) {
    if (Number(m[1]) <= n) { abilityMenu.index = Number(m[1]) - 1; confirmAbility(); }
    return;
  }
  if (e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
  e.preventDefault();
  abilityMenu.index = (abilityMenu.index + (e.code === 'ArrowDown' ? 1 : n - 1)) % n;
  renderAbilityMenu();
}

// Animación (clase en el tablero), texto y sonido propios de cada efecto
function showPowerUp(kind) {
  const el = document.createElement('div');
  el.className = `popup popup-powerup popup-pu-${kind}`;
  el.textContent = `${PowerUps.EFFECTS[kind].icon} ${PowerUps.EFFECTS[kind].name}`;
  popupsEl.appendChild(el);
  setTimeout(() => el.remove(), 1400);
  for (const k of PowerUps.KINDS) canvas.classList.remove(`pu-${k}`);
  void canvas.offsetWidth; // reinicia la animación
  canvas.classList.add(`pu-${kind}`);
  playPowerUp(kind);
}

// ---- Feedback: texto emergente, efecto en el tablero y sonido ----
function showFeedback(result) {
  if (!result.events.length) return;
  const combo = result.combo;
  for (const e of result.events) {
    const el = document.createElement('div');
    el.className = `popup popup-${e.kind}`;
    el.textContent = e.text;
    popupsEl.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
  // La intensidad del efecto escala con el combo (y con eventos especiales)
  const special = result.events.some(e => e.kind !== 'line');
  const intensity = Math.min(combo + (special ? 2 : 0), 12);
  canvas.style.setProperty('--fx', intensity);
  canvas.classList.remove('fx');
  void canvas.offsetWidth; // reinicia la animación
  canvas.classList.add('fx');
  for (const e of result.events) playEvent(e.kind, combo);
}

let audioCtx = null;
function tone(freq, start, dur, type = 'square', vol = 0.06) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

function playEvent(kind, combo) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (_) { return; }
  const up = Math.pow(2, (combo - 1) / 12); // sube un semitono por nivel de combo
  switch (kind) {
    case 'line':    tone(440 * up, 0, 0.15, 'triangle'); break;
    case 'combo':   tone(660 * up, 0.05, 0.12, 'sine'); tone(880 * up, 0.13, 0.12, 'sine'); break;
    case 'tetris':  tone(523 * up, 0, 0.12, 'sawtooth'); tone(784 * up, 0.1, 0.2, 'sawtooth'); break;
    case 'tspin':   tone(392 * up, 0, 0.1, 'square'); tone(587 * up, 0.1, 0.1, 'square'); tone(784 * up, 0.2, 0.15, 'square'); break;
    case 'perfect': [523, 659, 784, 1047].forEach((f, i) => tone(f * up, i * 0.1, 0.25, 'triangle')); break;
  }
}

function playPowerUp(kind) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (_) { return; }
  switch (kind) {
    case 'bomb':      tone(110, 0, 0.35, 'sawtooth', 0.1); tone(70, 0.05, 0.4, 'square', 0.08); break;
    case 'lightning': tone(1200, 0, 0.06, 'sawtooth'); tone(300, 0.06, 0.12, 'sawtooth'); tone(900, 0.16, 0.08, 'square'); break;
    case 'tint':      [500, 650, 800].forEach((f, i) => tone(f, i * 0.07, 0.15, 'sine')); break;
    case 'gravity':   [600, 450, 300, 200].forEach((f, i) => tone(f, i * 0.07, 0.12, 'triangle')); break;
    case 'freeze':    tone(1400, 0, 0.3, 'sine'); tone(1750, 0.08, 0.35, 'sine'); break;
  }
}

function applyMute(m, save = true) {
  muted = m;
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.textContent = muted ? '🔇' : '🔊';
  if (save) {
    try { localStorage.setItem('tetris-muted', muted ? '1' : '0'); } catch (_) {}
  }
}

// Indicador de power-up: borde pulsante e ícono sobre el bloque marcado
function drawPowerMark(context, x, y, kind, size, alpha) {
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 150);
  context.globalAlpha = alpha ?? 1;
  context.lineWidth = 2;
  context.strokeStyle = `rgba(255, 235, 59, ${0.5 + 0.5 * pulse})`;
  context.shadowColor = '#ffeb3b';
  context.shadowBlur = 4 + 8 * pulse;
  context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
  context.shadowBlur = 0;
  context.font = `${Math.round(size * 0.55)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(PowerUps.EFFECTS[kind].icon, x * size + size / 2, y * size + size / 2 + 1);
  context.globalAlpha = 1;
}

// ---- Skins: cada una define su paleta y su función de dibujo de bloque ----
function lighten(hex, amt) { // mezcla con blanco (amt 0–1)
  const n = parseInt(hex.slice(1), 16);
  const ch = s => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * amt);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    name: 'Retro',
    palette: t => (t === 'light' ? COLORS_LIGHT : COLORS),
    draw(context, px, py, color, size) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    name: 'Neon',
    palette: () => COLORS_LIGHT.map(c => c && lighten(c, 0.2)),
    draw(context, px, py, color, size) {
      context.shadowColor = color;
      context.shadowBlur = size * 0.5;
      context.fillStyle = 'rgba(0,0,0,0.85)';
      context.fillRect(px + 2, py + 2, size - 4, size - 4);
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 2, py + 2, size - 4, size - 4);
      context.shadowBlur = 0;
      context.fillStyle = color;
      context.globalAlpha *= 0.35;
      context.fillRect(px + 5, py + 5, size - 10, size - 10);
    },
  },
  pastel: {
    name: 'Pastel',
    palette: () => COLORS.map(c => c && lighten(c, 0.35)),
    draw(context, px, py, color, size) {
      roundRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, size * 0.3);
      context.fillStyle = color;
      context.fill();
      roundRectPath(context, px + size * 0.2, py + 4, size * 0.6, size * 0.16, size * 0.08);
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fill();
    },
  },
  pixel: {
    name: 'Pixel art',
    palette: t => (t === 'light' ? COLORS_LIGHT : COLORS),
    draw(context, px, py, color, size) {
      const u = size / 6; // "píxel" del patrón
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.35)'; // luz arriba/izquierda
      context.fillRect(px + 1, py + 1, size - 2, u);
      context.fillRect(px + 1, py + 1, u, size - 2);
      context.fillStyle = 'rgba(0,0,0,0.35)'; // sombra abajo/derecha
      context.fillRect(px + 1, py + size - 1 - u, size - 2, u);
      context.fillRect(px + size - 1 - u, py + 1, u, size - 2);
      context.fillStyle = 'rgba(0,0,0,0.18)'; // textura de damero
      for (let i = 1; i < 5; i++)
        for (let j = 1; j < 5; j++)
          if ((i + j) % 2 === 0) context.fillRect(px + i * u, py + j * u, u, u);
    },
  },
};

let skin = 'retro';

function skinColor(colorIndex) {
  return SKINS[skin].palette(theme)[colorIndex];
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  SKINS[skin].draw(context, x * size, y * size, skinColor(colorIndex), size);
  context.shadowBlur = 0;
  context.globalAlpha = alpha ?? 1;
  if (colorIndex === WILD) { // comodín: diagonal para distinguirlo
    context.strokeStyle = 'rgba(0,0,0,0.3)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x * size + 5, y * size + size - 5);
    context.lineTo(x * size + size - 5, y * size + 5);
    context.stroke();
  }
  context.globalAlpha = 1;
}

// Agujero redondo de la tuerca, centrado en la celda (x, y)
function drawNutHole(context, x, y, size, alpha) {
  const color = skinColor(NUT);
  const cx = x * size + size / 2;
  const cy = y * size + size / 2;
  context.globalAlpha = alpha ?? 1;
  context.beginPath();
  context.arc(cx, cy, size * 0.38, 0, Math.PI * 2);
  context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--board-bg').trim() || '#1a1a25';
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = color;
  context.stroke();
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  // A ciegas: las piezas asentadas no se dibujan (siguen ocupando celdas); basura y sembrados sí
  const hideLocked = challengeRun && challengeRun.hidesLockedPieces();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (hideLocked && v !== Challenge.GARBAGE && v !== Challenge.SEEDED) continue;
      drawBlock(ctx, c, r, v, BLOCK);
    }

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  if (current.type === NUT) drawNutHole(ctx, current.x + 1, gy + 1, BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  if (current.type === NUT) drawNutHole(ctx, current.x + 1, current.y + 1, BLOCK);
  if (current.powerUp) drawPowerMark(ctx, current.x + current.marked.c, current.y + current.marked.r, current.powerUp, BLOCK);
}

function drawPreview(context, cvs, piece, dimmed) {
  const NB = 30;
  const alpha = dimmed ? 0.35 : 1;
  context.clearRect(0, 0, cvs.width, cvs.height);
  if (!piece) return;
  const shape = piece.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB, alpha);
  if (piece.type === NUT) drawNutHole(context, offX + 1, offY + 1, NB, alpha);
  if (piece.powerUp) drawPowerMark(context, offX + piece.marked.c, offY + piece.marked.r, piece.powerUp, NB, alpha);
}

// Pieza centrada en un área de areaW×areaH px que empieza en `top` px, con bloques de `size` px
function drawQueuePiece(context, piece, size, areaW, areaH, top) {
  const shape = piece.shape;
  const offX = (areaW / size - shape[0].length) / 2;
  const offY = top / size + (areaH / size - shape.length) / 2;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], size);
  if (piece.type === NUT) drawNutHole(context, offX + 1, offY + 1, size);
}

function drawNext() {
  drawPreview(nextCtx, nextCanvas, queue[0], false);
  // Visión: las 4 piezas siguientes (junto a NEXT son las próximas 5)
  if (ab.visionMs > 0) {
    visionCtx.clearRect(0, 0, visionCanvas.width, visionCanvas.height);
    for (let i = 1; i < QUEUE_SIZE; i++) drawQueuePiece(visionCtx, queue[i], 15, 120, 60, (i - 1) * 60);
  }
}

function drawHold() {
  drawPreview(holdCtx, holdCanvas, holdPiece === null ? null : createPiece(holdPiece), holdUsedThisTurn);
  holdCanvas.classList.toggle('dimmed', holdUsedThisTurn);
}

function applyTheme(t, save = true) {
  theme = t === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  themeBtn.setAttribute('aria-checked', String(theme === 'light'));
  if (save) {
    try { localStorage.setItem('tetris-theme', theme); } catch (_) {}
  }
  // Repintar (el loop está cancelado en pausa / game over)
  if (current && queue) { draw(); drawNext(); drawHold(); }
}

// Cambia de skin sin recargar: paleta + función de dibujo + fondo (vía data-skin en CSS)
function applySkin(s, save = true) {
  skin = SKINS[s] ? s : 'retro';
  document.documentElement.dataset.skin = skin;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  skinSelect.value = skin;
  if (save) {
    try { localStorage.setItem('tetris-skin', skin); } catch (_) {}
  }
  if (current && queue) { draw(); drawNext(); drawHold(); }
}

function toggleTheme() {
  applyTheme(theme === 'light' ? 'dark' : 'light');
}

function setOverlayButtons(challengeResult, canAdvance) {
  levelsBtn.classList.toggle('hidden', !challengeResult);
  nextLevelBtn.classList.toggle('hidden', !canAdvance);
  restartBtn.textContent = challengeResult ? 'Reintentar' : 'Reiniciar';
}

function endGame() {
  if (challengeRun) { // top-out en un desafío = derrota
    challengeRun.lose('topout');
    checkChallenge();
    return;
  }
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayTitle.classList.remove('win');
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayDetail.textContent = '';
  setOverlayButtons(false, false);
  showRecordsOnGameOver();
  overlay.classList.remove('hidden');
}

function showRecordsOnGameOver() {
  pendingRank = Records.rankOf(records, score);
  savedRank = -1;
  if (pendingRank === -1) {
    // No entra al top, pero combo y líneas máximas sí cuentan
    records = Records.noteStats(records, { lines, combo: runMaxCombo });
    Records.save(localStorageSafe(), records);
    recordForm.classList.add('hidden');
  } else {
    recordMsgEl.textContent = pendingRank === 0 ? '¡Nuevo récord! Puesto #1' : `¡Entras al top! Puesto #${pendingRank + 1}`;
    recordNameEl.value = '';
    recordForm.classList.remove('hidden');
  }
  if (pendingRank === -1) {
    renderRecords(overlayRecordsEl);
  } else { // vista previa: inserta la fila resaltada sin guardar aún
    const saved = records;
    records = Records.submit(records, { name: '…', score, lines, combo: runMaxCombo }).records;
    renderRecords(overlayRecordsEl, pendingRank);
    records = saved;
    setTimeout(() => recordNameEl.focus(), 0);
  }
}

// ---- Modo desafío ----

// Evalúa el motor de reglas; si la partida terminó, muestra el resultado y devuelve true.
function checkChallenge() {
  const status = challengeRun.evaluate(board);
  if (status === 'playing') return false;
  finishChallenge(status === 'won');
  return true;
}

function finishChallenge(won) {
  gameOver = true;
  cancelAnimationFrame(animId);
  const timeMs = challengeRun.state.elapsedMs;
  const levels = Challenge.getLevels();
  const idx = levels.findIndex(l => l.id === currentLevel.id);
  if (won) {
    challengeProgress = Challenge.recordResult(challengeProgress, currentLevel.id, { won: true, timeMs, score });
    Challenge.saveProgress(localStorageSafe(), challengeProgress);
  }
  const best = challengeProgress.completed[currentLevel.id];
  const reasons = { timeout: 'Se agotó el tiempo', topout: 'El tablero se llenó' };
  overlayTitle.textContent = won ? 'VICTORIA' : 'DERROTA';
  overlayTitle.classList.toggle('win', won);
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayDetail.textContent = [
    `${currentLevel.name} — tiempo: ${Challenge.formatTime(timeMs)}`,
    won ? '' : (reasons[challengeRun.state.reason] || ''),
    best ? `Mejor: ${Challenge.formatTime(best.bestTimeMs)} · ${best.bestScore.toLocaleString()} pts` : '',
  ].filter(Boolean).join('\n');
  setOverlayButtons(true, won && idx >= 0 && idx < levels.length - 1);
  overlay.classList.remove('hidden');
}

function updateChallengeHUD() {
  if (!challengeRun) return;
  const s = challengeRun.state;
  const remaining = challengeRun.remainingMs();
  challengeTimerEl.textContent = Challenge.formatTime(remaining === null ? s.elapsedMs : remaining);
  const mods = currentLevel.modifiers;
  const parts = [];
  if (mods.targetLines !== undefined) parts.push(`Líneas ${Math.min(lines, mods.targetLines)}/${mods.targetLines}`);
  if (mods.presetBoard && mods.presetBoard.mustClear) parts.push(`Sembrados: ${Challenge.countSeeded(board)}`);
  if (mods.invertedRotation && challengeRun.rotationInverted()) parts.push('🔄 Rotación invertida');
  challengeGoalEl.textContent = parts.join(' · ');
}

// Sube una fila de basura; si la pieza activa queda dentro de bloques, se empuja hacia arriba.
function applyGarbage() {
  const res = Challenge.addGarbageRow(board, rng);
  board = res.board;
  if (res.overflow) { endGame(); return; }
  while (current.y > -2 && collide(current.shape, current.x, current.y)) current.y--;
  if (collide(current.shape, current.x, current.y)) endGame();
}

function startChallenge(level) {
  currentLevel = level;
  closeLevelSelect();
  init();
}

function startClassic() {
  currentLevel = null;
  closeLevelSelect();
  init();
}

function openLevelSelect() {
  if (abilityMenu) closeAbilitySelect(); // cancela el selector de habilidades sin gastar energía
  if (!paused && !gameOver) togglePause();
  menuOpen = true;
  const levels = Challenge.getLevels();
  levelListEl.textContent = '';
  levels.forEach((lvl, i) => {
    const unlocked = Challenge.isUnlocked(levels, challengeProgress, i);
    const best = challengeProgress.completed[lvl.id];
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'level-item';
    btn.disabled = !unlocked;
    const mk = (cls, text) => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = text;
      btn.appendChild(s);
    };
    mk('lvl-name', `${unlocked ? (best ? '✔' : '▶') : '🔒'} ${i + 1}. ${lvl.name}`);
    mk('lvl-meta', lvl.description);
    mk('lvl-meta', `Objetivo: ${lvl.objective} · Derrota: ${lvl.lose}`);
    if (best) mk('lvl-meta', `Mejor: ${Challenge.formatTime(best.bestTimeMs)} · ${best.bestScore.toLocaleString()} pts`);
    btn.addEventListener('click', () => startChallenge(lvl));
    li.appendChild(btn);
    levelListEl.appendChild(li);
  });
  levelSelectEl.classList.remove('hidden');
}

function closeLevelSelect() {
  menuOpen = false;
  levelSelectEl.classList.add('hidden');
}

function speedFor(lvl) { return Math.max(100, 1000 - (lvl - 1) * 90); }

const pauseMenu = document.getElementById('pause-menu');
const startLevelValue = document.getElementById('start-level-value');
const pauseControlsEl = document.getElementById('pause-controls');
const pauseControlsBtn = document.getElementById('pause-controls-btn');
const MAX_START_LEVEL = 15;

function setStartLevel(n) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, n));
  startLevelValue.textContent = startLevel;
}

function closePauseMenu() {
  pauseMenu.classList.add('hidden');
  pauseControlsEl.classList.add('hidden');
  pauseControlsBtn.setAttribute('aria-expanded', 'false');
  pauseControlsBtn.textContent = 'Ver controles';
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    closePauseMenu();
    resumeGuardUntil = performance.now() + 200; // evita movimientos accidentales (teclas aún pulsadas)
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    startLevelValue.textContent = startLevel;
    document.getElementById('start-level-note').classList.toggle('hidden', !!currentLevel);
    pauseMenu.classList.remove('hidden');
    document.getElementById('resume-btn').focus();
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeMs > 0) {
    // Congelar: sin caída automática; en pausa el loop se cancela, así que no consume tiempo
    freezeMs = Math.max(0, freezeMs - dt);
    dropAccum = 0;
    updateFreezeHUD();
  } else {
    dropAccum += dt;
  }
  if (challengeRun) {
    const { garbageRows } = challengeRun.tick(dt);
    for (let i = 0; i < garbageRows && !gameOver; i++) applyGarbage();
    if (!gameOver) checkChallenge(); // puede terminar por tiempo
    if (gameOver) { draw(); updateChallengeHUD(); return; }
    updateChallengeHUD();
  }
  if (ab.visionMs > 0 || ab.slowMs > 0) { // timers de Visión/Ralentizar: avanzan solo con el loop
    ab = Abilities.tick(ab, dt);
    updateAbilityHUD();
  }
  if (dropAccum >= Abilities.effectiveInterval(ab, dropInterval)) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastWasRotation = false;
    } else {
      lockPiece();
    }
  }
  draw();
  if (queue[0].powerUp) drawNext(); // el indicador del preview pulsa
  // endGame() pudo ejecutarse dentro de este frame (lockPiece → spawn);
  // cancelAnimationFrame no cancela el frame en curso, así que no re-agendar.
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  commitRecord(); // si había un record sin guardar, se guarda con el nombre escrito
  overlayRecordsEl.textContent = '';
  recordForm.classList.add('hidden');
  runMaxCombo = 1;
  challengeRun = currentLevel ? Challenge.createRun(currentLevel) : null;
  board = createBoard();
  if (challengeRun) board = challengeRun.setupBoard(board);
  challengeInfoEl.classList.toggle('hidden', !challengeRun);
  if (currentLevel) challengeNameEl.textContent = currentLevel.name.toUpperCase();
  setOverlayButtons(false, false);
  score = 0;
  lines = 0;
  baseLevel = currentLevel ? 1 : startLevel;
  level = baseLevel;
  paused = false;
  gameOver = false;
  dropInterval = speedFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  holdPiece = null;
  holdUsedThisTurn = false;
  rewardSingle = false;
  powerProgress = 0;
  freezeMs = 0;
  for (const k of PowerUps.KINDS) canvas.classList.remove(`pu-${k}`);
  scoreState =Scoring.createScoreState();
  lastWasRotation = false;
  popupsEl.textContent = '';
  ab = Abilities.createState();
  abilityMenu = null;
  abilitySelectEl.classList.add('hidden');
  queue = Array.from({ length: QUEUE_SIZE }, randomPiece);
  spawn();
  drawHold();
  updateHUD();
  updateChallengeHUD();
  overlayTitle.classList.remove('win');
  overlay.classList.add('hidden');
  closePauseMenu();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return; // escribiendo el nombre
  if (menuOpen) return;
  if (e.code === 'Escape' && !abilityMenu) { e.preventDefault(); if (!gameOver) togglePause(); return; }
  if (paused && !gameOver) { // menú de pausa abierto: solo P/Esc reanudan; el resto de inputs del juego se bloquea
    if (e.code === 'KeyP') togglePause();
    else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
    return;
  }
  if (performance.now() < resumeGuardUntil && !abilityMenu) return;
  if (abilityMenu) { abilityKey(e); return; }
  if (e.code === 'KeyE') { openAbilitySelect(); return; } // solo abre con la barra llena
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyT') { toggleTheme(); return; }
  if (e.code === 'KeyM') { applyMute(!muted); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastWasRotation = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastWasRotation = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdCurrent();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

// Controles táctiles: reutilizan el manejador de teclado (repiten al mantener ← → ↓)
document.querySelectorAll('.touch-controls button').forEach(btn => {
  const fire = () => document.dispatchEvent(new KeyboardEvent('keydown', { code: btn.dataset.key, cancelable: true }));
  let timer = null;
  const stop = () => { clearTimeout(timer); clearInterval(timer); timer = null; };
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    fire();
    if (/^Arrow(Left|Right|Down)$/.test(btn.dataset.key)) {
      timer = setTimeout(() => { timer = setInterval(fire, 80); }, 220);
    }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => btn.addEventListener(ev, stop));
  btn.addEventListener('contextmenu', e => e.preventDefault());
});

restartBtn.addEventListener('click', init); // en un desafío, reintenta el mismo nivel
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('pause-restart-btn').addEventListener('click', init);
document.getElementById('start-level-dec').addEventListener('click', () => setStartLevel(startLevel - 1));
document.getElementById('start-level-inc').addEventListener('click', () => setStartLevel(startLevel + 1));
pauseControlsBtn.addEventListener('click', () => {
  const show = pauseControlsEl.classList.toggle('hidden') === false;
  pauseControlsBtn.setAttribute('aria-expanded', String(show));
  pauseControlsBtn.textContent = show ? 'Ocultar controles' : 'Ver controles';
});
recordForm.addEventListener('submit', e => { e.preventDefault(); commitRecord(); });
document.getElementById('start-btn').addEventListener('click', () => {
  startScreenEl.classList.add('hidden');
  menuOpen = false;
  init();
});
document.getElementById('reset-records-btn').addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) return;
  records = Records.reset(localStorageSafe());
  renderRecords(startRecordsEl);
});
levelsBtn.addEventListener('click', openLevelSelect);
nextLevelBtn.addEventListener('click', () => {
  const levels = Challenge.getLevels();
  const idx = levels.findIndex(l => l.id === currentLevel.id);
  if (idx >= 0 && idx < levels.length - 1) startChallenge(levels[idx + 1]);
});
challengeBtn.addEventListener('click', () => { openLevelSelect(); challengeBtn.blur(); });
document.getElementById('classic-play-btn').addEventListener('click', startClassic);
document.getElementById('select-close-btn').addEventListener('click', closeLevelSelect);
themeBtn.addEventListener('click', () => {
  toggleTheme();
  themeBtn.blur(); // evita que Space active el botón en vez de hacer hard drop
});

muteBtn.addEventListener('click', () => {
  applyMute(!muted);
  muteBtn.blur(); // evita que Space active el botón en vez de hacer hard drop
});

function applyClassic(on, save = true) {
  classicMode = on;
  classicBtn.setAttribute('aria-pressed', String(on));
  if (save) {
    try { localStorage.setItem('tetris-classic', on ? '1' : '0'); } catch (_) {}
  }
}

classicBtn.addEventListener('click', () => {
  applyClassic(!classicMode); // afecta a las piezas que se generen a partir de ahora
  classicBtn.blur();
});

let savedClassic = null;
try { savedClassic = localStorage.getItem('tetris-classic'); } catch (_) {}
applyClassic(savedClassic === '1', false);

let savedMuted = null;
try { savedMuted = localStorage.getItem('tetris-muted'); } catch (_) {}
applyMute(savedMuted === '1', false);

let savedTheme = null;
try { savedTheme = localStorage.getItem('tetris-theme'); } catch (_) {}
applyTheme(savedTheme === 'light' ? 'light' : 'dark', false);

for (const [id, s] of Object.entries(SKINS)) skinSelect.add(new Option(s.name, id));
skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que Space/flechas cambien la opción en vez de jugar
});
let savedSkin = null;
try { savedSkin = localStorage.getItem('tetris-skin'); } catch (_) {}
applySkin(savedSkin, false);
init();
showStartScreen(); // pantalla de inicio con records; "Jugar" reinicia la partida
