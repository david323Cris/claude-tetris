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
];

// Variantes más saturadas para buen contraste sobre fondo claro
const COLORS_LIGHT = [
  null,
  '#00acc1', '#f9a825', '#8e24aa', '#43a047', '#e53935', '#1e88e5', '#fb8c00', '#78909c',
  '#d81b60', '#00897b', '#9e9d24', '#f4511e',
];

// Formas y reglas de aparición viven en pieces.js (módulo puro, con tests)
const PIECES = Pieces.PIECES;
const NUT = Pieces.NUT;

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
const classicBtn = document.getElementById('classic-toggle');
const muteBtn = document.getElementById('mute-toggle');
const comboEl = document.getElementById('combo');
const b2bEl = document.getElementById('b2b');
const popupsEl = document.getElementById('popups');

let theme = 'dark';
let gridColor = '#22222e';

let holdPiece, holdUsedThisTurn;
let classicMode = false, rewardSingle = false, rng = Math.random;
let scoreState, lastWasRotation, muted = false;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
// Habilidades: `queue` son las próximas piezas (next === queue[0]); `selector` != null con el menú abierto
let abState, queue, snapshot, selector;
const energyEl = document.getElementById('energy');
const energyFillEl = document.getElementById('energy-fill');
const energyTextEl = document.getElementById('energy-text');
const selectorEl = document.getElementById('selector');
const selectorTitleEl = document.getElementById('selector-title');
const selectorListEl = document.getElementById('selector-list');

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

// `rng` es inyectable (ver `setRng`) para generar secuencias reproducibles
function randomPiece() {
  return createPiece(Pieces.pickType(rng, level, { CLASSIC: classicMode }));
}

function setRng(fn) { rng = fn; }

// Pieza en posición y rotación de spawn
function createPiece(type) {
  return Pieces.createPiece(type, COLS);
}

function collide(shape, ox, oy) {
  return Pieces.collides(board, shape, ox, oy);
}

function tryRotate() {
  const res = Pieces.rotateWithKicks(board, current);
  if (!res) return;
  current.shape = res.shape;
  current.x = res.x;
  lastWasRotation = true; // un kick también cuenta como T-spin completo
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// Quita las líneas completas del tablero y devuelve cuántas fueron.
function removeFullLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
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
  // Solo la última instantánea, tomada antes de asentar la pieza (para Deshacer)
  snapshot = Abilities.takeSnapshot({
    board, score, lines, level, dropInterval, scoreState,
    currentType: current.type, queueTypes: queue.map(p => p.type),
    holdPiece, holdUsedThisTurn, rewardSingle,
  });
  // T-spin se evalúa sobre el tablero sin la pieza fusionada
  const tspin = Scoring.detectTSpin(board, current.type, current.x, current.y, lastWasRotation);
  merge();
  const cleared = removeFullLines();
  const result = Scoring.evaluateLock(scoreState, {
    lines: cleared, tspin, level, boardEmpty: Scoring.isBoardEmpty(board),
  });
  scoreState = result.state;
  score += result.points;
  if (cleared) {
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    abState = Abilities.addEnergy(abState, cleared);
    updateEnergy();
  }
  // Recompensa: tras un Tetris la siguiente pieza de la cola es una 1×1
  if (cleared === 4 && !classicMode) rewardSingle = true;
  updateHUD();
  showFeedback(result);
  holdUsedThisTurn = false;
  spawn();
}

function holdCurrent() {
  if (holdUsedThisTurn) return;
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
  queue.push(rewardSingle ? createPiece(Pieces.SINGLE) : randomPiece());
  next = queue[0];
  rewardSingle = false;
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

function applyMute(m, save = true) {
  muted = m;
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.textContent = muted ? '🔇' : '🔊';
  if (save) {
    try { localStorage.setItem('tetris-muted', muted ? '1' : '0'); } catch (_) {}
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = (theme === 'light' ? COLORS_LIGHT : COLORS)[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

// Agujero redondo de la tuerca, centrado en la celda (x, y)
function drawNutHole(context, x, y, size, alpha) {
  const color = (theme === 'light' ? COLORS_LIGHT : COLORS)[NUT];
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
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

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
}

function drawPreview(context, cvs, piece, dimmed, NB = 30, ox = 0, oy = 0, clear = true) {
  const alpha = dimmed ? 0.35 : 1;
  if (clear) context.clearRect(0, 0, cvs.width, cvs.height);
  if (!piece) return;
  const shape = piece.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  // ox/oy desplazan la pieza (en px) para dibujar varias en el mismo canvas
  context.save();
  context.translate(ox, oy);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB, alpha);
  if (piece.type === NUT) drawNutHole(context, offX + 1, offY + 1, NB, alpha);
  context.restore();
}

function drawNext() {
  if (Abilities.isActive(abState, 'vision')) {
    // Visión: 5 piezas pequeñas (3 columnas × 2 filas) en el mismo canvas de 120×120
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    queue.slice(0, Abilities.ABILITY_CONFIG.VISION_COUNT).forEach((p, i) =>
      drawPreview(nextCtx, nextCanvas, p, false, 10, (i % 3) * 40, Math.floor(i / 3) * 40, false));
  } else {
    drawPreview(nextCtx, nextCanvas, next, false);
  }
}

// ---- Energía y habilidades ----
function updateEnergy() {
  const ready = Abilities.isReady(abState);
  energyFillEl.style.width = abState.energy + '%';
  energyTextEl.textContent = ready ? 'LISTA (E)' : abState.energy + '%';
  energyEl.classList.toggle('ready', ready);
}

const gameApi = {
  startEffect(name) {
    const ms = name === 'vision' ? Abilities.ABILITY_CONFIG.VISION_MS : Abilities.ABILITY_CONFIG.SLOW_MS;
    abState = Abilities.startEffect(abState, name, ms);
    drawNext();
  },
  undo() {
    if (!snapshot) return false;
    const s = snapshot;
    snapshot = null;
    board = s.board;
    score = s.score; lines = s.lines; level = s.level; dropInterval = s.dropInterval;
    scoreState = s.scoreState;
    holdPiece = s.holdPiece; holdUsedThisTurn = s.holdUsedThisTurn; rewardSingle = s.rewardSingle;
    current = createPiece(s.currentType);
    queue = s.queueTypes.map(createPiece);
    next = queue[0];
    lastWasRotation = false;
    dropAccum = 0;
    updateHUD(); drawNext(); drawHold();
    return true;
  },
  clearBottom() {
    board = Abilities.clearBottomRow(board);
    // El contenido baja una fila y podría solaparse con la pieza activa: subirla hasta que quepa
    while (collide(current.shape, current.x, current.y) && current.y > -2) current.y--;
  },
  beginSwap() {
    const pool = classicMode ? Pieces.STANDARD : [...Pieces.STANDARD, Pieces.NUT, ...Pieces.PENTOMINOS];
    openSelector({ mode: 'swap', options: Abilities.pickOptions(rng, pool), index: 0 });
  },
};

function renderSelector() {
  selectorEl.classList.remove('hidden');
  selectorListEl.textContent = '';
  const items = selector.mode === 'swap'
    ? selector.options.map(t => ({ name: ['', 'I', 'O', 'T', 'S', 'Z', 'J', 'L', 'Tuerca', 'Cruz', 'U', 'Y', '1×1'][t], desc: '' }))
    : Abilities.ABILITIES;
  selectorTitleEl.textContent = selector.mode === 'swap' ? 'ELIGE UNA PIEZA' : 'HABILIDADES';
  items.forEach((a, i) => {
    const li = document.createElement('li');
    li.className = i === selector.index ? 'sel' : '';
    li.innerHTML = '<kbd></kbd> <b></b> <small></small>';
    li.children[0].textContent = i + 1;
    li.children[1].textContent = a.name;
    li.children[2].textContent = a.desc;
    li.addEventListener('click', () => chooseSelector(i));
    selectorListEl.appendChild(li);
  });
}

// Abre el selector pausando el juego (el loop se cancela, así los timers no avanzan)
function openSelector(state) {
  selector = state;
  paused = true;
  cancelAnimationFrame(animId);
  renderSelector();
}

function closeSelector() {
  selector = null;
  selectorEl.classList.add('hidden');
  paused = false;
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function requestSelector() {
  if (paused || gameOver || !Abilities.isReady(abState)) return;
  openSelector({ mode: 'menu', index: 0 });
}

function chooseSelector(i) {
  if (selector.mode === 'swap') {
    const piece = createPiece(selector.options[i]);
    if (collide(piece.shape, piece.x, piece.y)) return; // no cabe: elegir otra
    current = piece;
    lastWasRotation = false;
    abState = Abilities.spend(abState);
    updateEnergy();
    closeSelector();
    draw();
    return;
  }
  const id = Abilities.ABILITIES[i].id;
  const before = abState;
  abState = Abilities.use(abState, id, gameApi);
  if (selector && selector.mode === 'swap') return; // Intercambio: sigue el sub-menú
  if (abState === before) return;                   // no aplicable (p. ej. Deshacer sin instantánea)
  updateEnergy();
  closeSelector();
  draw();
}

function selectorKey(e) {
  const n = selector.mode === 'swap' ? selector.options.length : Abilities.ABILITIES.length;
  if (e.code === 'Escape') {
    closeSelector(); // cancelar no gasta energía
  } else if (e.code === 'ArrowUp') { selector.index = (selector.index + n - 1) % n; renderSelector(); }
  else if (e.code === 'ArrowDown') { selector.index = (selector.index + 1) % n; renderSelector(); }
  else if (e.code === 'Enter') chooseSelector(selector.index);
  else if (/^Digit[1-9]$/.test(e.code) && +e.code.slice(5) <= n) chooseSelector(+e.code.slice(5) - 1);
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
  if (current && next) { draw(); drawNext(); drawHold(); }
}

function toggleTheme() {
  applyTheme(theme === 'light' ? 'dark' : 'light');
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  // Los timers de efectos avanzan solo aquí: en pausa/selector el loop está cancelado
  const hadVision = Abilities.isActive(abState, 'vision');
  abState = Abilities.tick(abState, dt);
  if (hadVision && !Abilities.isActive(abState, 'vision')) drawNext();
  dropAccum += dt;
  if (dropAccum >= Abilities.effectiveInterval(abState, dropInterval)) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastWasRotation = false;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame() pudo ejecutarse dentro de este frame (lockPiece → spawn);
  // cancelAnimationFrame no cancela el frame en curso, así que no re-agendar.
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  holdPiece = null;
  holdUsedThisTurn = false;
  rewardSingle = false;
  scoreState =Scoring.createScoreState();
  lastWasRotation = false;
  popupsEl.textContent = '';
  abState = Abilities.createState();
  snapshot = null;
  selector = null;
  selectorEl.classList.add('hidden');
  queue = Array.from({ length: Abilities.ABILITY_CONFIG.VISION_COUNT + 1 }, randomPiece);
  next = queue[0];
  spawn();
  drawHold();
  updateHUD();
  updateEnergy();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyT') { toggleTheme(); return; }
  if (e.code === 'KeyM') { applyMute(!muted); return; }
  if (selector) { e.preventDefault(); selectorKey(e); return; } // el selector captura el resto (P incluida)
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyE') { requestSelector(); return; }
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

restartBtn.addEventListener('click', init);
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
init();
