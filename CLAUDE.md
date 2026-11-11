# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris in vanilla JavaScript + HTML5 Canvas. No `package.json`, no build, no tests, no linter. README is in Spanish; UI strings are Spanish too.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, and `game.js` (all logic, one global script with `'use strict'`, no modules).

- `game.js` keeps all state in top-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, ...), reset by `init()`. Restart button calls `init()` again.
- Board is a `ROWS × COLS` matrix of `0` or a piece-type index 1–7; the same index selects the entry in `COLORS` and `PIECES` (index 0 is `null` in both).
- Flow: `loop` (requestAnimationFrame) → gravity drop → `lockPiece` → `merge` → `clearLines` → `spawn`. `spawn` calls `endGame` if the new piece collides. Keyboard handling is a single `keydown` listener at the bottom.
- Pausing/game over cancels the animation frame (`cancelAnimationFrame(animId)`); `togglePause` restarts `loop` manually, resetting `lastTime`.
- Rotation (`tryRotate`) is clockwise only, with simple horizontal kicks `[0, -1, 1, -2, 2]` (not SRS). Spawn uses random piece selection, not a 7-bag.

## Gotchas

- Canvas size is hard-coded in `index.html` (`#board` 300×600, `#next-canvas` 120×120). If `COLS`, `ROWS` or `BLOCK` change in `game.js`, update the canvas `width`/`height` to match (`COLS*BLOCK` × `ROWS*BLOCK`).
- Level speed formula is duplicated in `clearLines` (`max(100, 1000 - (level-1)*90)`) and the initial `1000` in `init`.
- The README controls table mentions `X` for rotate in addition to `↑`; the on-page controls list does not.
