# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris in vanilla JavaScript + HTML5 Canvas. No `package.json`, no build, no tests, no linter. README is in Spanish; UI strings are Spanish too.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, and `game.js` (all logic, one global script with `'use strict'`, no modules).

- `game.js` keeps all state in top-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, ...), reset by `init()`. Restart button calls `init()` again.
- Board is a `ROWS × COLS` matrix of `0` or a piece-type index 1–8 (8 = Tuerca, pieza reto 3x3 con hueco; se dibuja con `drawNutHole`, probabilidad `NUT_CHANCE`); the same index selects the entry in `COLORS` and `PIECES` (index 0 is `null` in both).
- Flow: `loop` (requestAnimationFrame) → gravity drop → `lockPiece` → `merge` → `clearLines` → `spawn`. `spawn` calls `endGame` if the new piece collides. Keyboard handling is a single `keydown` listener at the bottom.
- Pausing/game over cancels the animation frame (`cancelAnimationFrame(animId)`); `togglePause` restarts `loop` manually, resetting `lastTime`.
- Rotation (`tryRotate`) is clockwise only, with simple horizontal kicks `[0, -1, 1, -2, 2]` (not SRS). Spawn uses random piece selection, not a 7-bag.

## Scoring

`scoring.js` is a pure module (no DOM; global `Scoring` in the browser, `require` in Node) holding the points table (`SCORING_CONFIG`), combo, T-spin (3-corner rule), B2B and Perfect Clear logic. `game.js` calls `Scoring.detectTSpin` before `merge` and `Scoring.evaluateLock` in `lockPiece`; `lastWasRotation` is set in `tryRotate` and cleared by any move/drop/spawn. Unit tests: `node --test tests/` (Node only needed for tests).

## Power-ups

`powerups.js` is a pure module (global `PowerUps`, `require` in Node) with the effect strategies (`EFFECTS`: bomb, lightning, tint, gravity, freeze, each `apply(board, context)`), `clearFullLines` (wildcard cell = index 13, `WILD`, with chain removal of connected wildcards) and `advanceProgress`. `game.js` marks `next` with `powerUp`/`marked` every 10 cleared lines, triggers the effect in `lockPiece` after `merge` and before `removeFullLines`, and `freezeMs` suppresses gravity in `loop`. Pieces with a power-up can't be held. Tests: `tests/powerups.test.js`.

## Habilidades cargables

`abilities.js` is a pure module (global `Abilities`, `require` in Node): energy (`ABILITY_CONFIG.ENERGY_GAIN` = 10/25/40/60 % for 1–4 lines), the `ABILITIES` registry (vision, swap, slow, undo, clear; each `{id, name, canUse, apply}`), `activate` (only when the bar is full; failure spends nothing), timers (`tick`, `effectiveInterval`) and the undo snapshot (`takeSnapshot`). `game.js` takes the snapshot at the start of `lockPiece`, adds energy after clearing, ticks `ab.visionMs`/`ab.slowMs` with `dt` in `loop` (the selector cancels the loop, so pausing consumes no time), and holds `queue` (5 pieces; `queue[0]` = NEXT, Visión draws the other 4 in `#vision-canvas`) instead of a single `next`. Selector overlay: `E`, `1`–`5`/arrows+Enter, `Esc`. Tests: `tests/abilities.test.js`.

## Modo desafío

`challenge.js` is a pure module (global `Challenge`, `require` in Node): level schema validation (`validateLevel`/`registerLevel`), composable modifiers (`MODIFIERS`: `timeLimit`, `garbageInterval`, `presetBoard`, `invisiblePieces`, `invertedRotation`, `targetLines`, each a set of optional hooks), the rules engine (`createRun(level)` → `tick`, `onLock`, `evaluate`, win/lose) and progress persistence (`recordResult`, `isUnlocked`, localStorage key `tetris-challenge-progress`). Levels are data files in `levels/*.js` (each calls `Challenge.registerLevel`) and must be listed as `<script>` in `index.html` before `game.js` (JSON can't be `fetch`ed from `file://`). `game.js` only applies the run: `currentLevel`/`challengeRun` (null = classic), `applyGarbage`, `checkChallenge`/`finishChallenge` (result overlay), level-select overlay. Board cells 14 = garbage, 15 = seeded block. `Pieces.rotateWithKicks(board, piece, dir)` takes `-1` for counter-clockwise. Tests: `tests/challenge.test.js`.

## Skins

`skins.js` (global `Skins`, `require` in Node; listed in `index.html` before `game.js`) holds the 4 skins (`retro`, `neon`, `pastel`, `pixel`): each has `dark`/`light` palettes (index = piece type, same as board values) and `drawBlock(ctx, px, py, size, color)`. `game.js` `drawBlock`/`drawNutHole` delegate to the active skin; `applySkin` sets `html[data-skin]` (CSS adjusts `--board-bg`/`--grid`, e.g. black for neon), repaints and persists in localStorage `tetris-skin`. Selector: `#skin-select` in the toolbar. Tests: `tests/skins.test.js`.

## Gotchas

- Responsive: `#board` is scaled via CSS (`height` from viewport, `aspect-ratio: 1/2`); the canvas keeps its 300×600 internal resolution. Narrow/touch screens (`@media` in `style.css`) shrink the side panels, hide the keyboard controls list and show `.touch-controls` (buttons with `data-key` that dispatch synthetic `keydown` events handled by the same listener in `game.js`).
- Canvas size is hard-coded in `index.html` (`#board` 300×600, `#next-canvas` 120×120). If `COLS`, `ROWS` or `BLOCK` change in `game.js`, update the canvas `width`/`height` to match (`COLS*BLOCK` × `ROWS*BLOCK`).
- Level speed formula is duplicated in `clearLines` (`max(100, 1000 - (level-1)*90)`) and the initial `1000` in `init`.
- The README controls table mentions `X` for rotate in addition to `↑`; the on-page controls list does not.
