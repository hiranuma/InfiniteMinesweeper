# Infinity MineSweeper

## Project Overview
Infinite scrolling Minesweeper built with Vue 3 + TypeScript + Canvas API.

## Tech Stack
- Vue 3 (Composition API, `<script setup lang="ts">`)
- TypeScript (strict mode)
- Vite
- SCSS
- Canvas 2D API (no external canvas libraries)

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build

## Architecture
- `src/types/game.ts` — All TypeScript interfaces and game constants
- `src/composables/useGameEngine.ts` — Core minesweeper logic (chunk generation, reveal, chord, flag)
- `src/composables/useCamera.ts` — Camera position/zoom state and viewport calculations
- `src/composables/useInputHandler.ts` — Touch/mouse event state machine (tap, long-press, drag, pinch)
- `src/composables/useRenderer.ts` — Canvas drawing pipeline with requestAnimationFrame
- `src/components/GameCanvas.vue` — Wires composables to canvas element
- `src/App.vue` — App shell with header stats

## Conventions
- All game state lives in composables, not in components
- Coordinate system: +X right, +Y down, origin at (0,0)
- Chunk size: 16x16 cells, cell size: 32px at zoom=1
- Infinite map uses `Map<ChunkKey, Chunk>` with deterministic seeded PRNG (mulberry32)
- Mine density: 15%
- `touch-action: none` on canvas element always
- Mobile-first SCSS, desktop centered at max-width 480px
- Path alias: `@/` → `src/`
