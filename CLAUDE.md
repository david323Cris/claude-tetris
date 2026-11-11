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

## Gotchas

- Canvas size is hard-coded in `index.html` (`#board` 300×600, `#next-canvas` 120×120). If `COLS`, `ROWS` or `BLOCK` change in `game.js`, update the canvas `width`/`height` to match (`COLS*BLOCK` × `ROWS*BLOCK`).
- Level speed formula is duplicated in `clearLines` (`max(100, 1000 - (level-1)*90)`) and the initial `1000` in `init`.
- The README controls table mentions `X` for rotate in addition to `↑`; the on-page controls list does not.
