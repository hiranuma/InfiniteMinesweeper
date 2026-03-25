# Infinity Minesweeper

An infinite, endlessly scrollable Minesweeper game built with Vue 3 + TypeScript + Canvas API.

## How to Play

### Goal

Reveal as many safe cells as possible without hitting mines. There is no fixed board — the map extends infinitely in all directions!

### Controls

| Action | Mouse | Touch |
|---|---|---|
| Reveal a cell | Left click | Tap |
| Place / remove a flag | Right click | Long press (hold ~0.4s) |
| Chord (reveal neighbors) | Left click on a revealed number (when correct flags are placed around it) | Tap on a revealed number |
| Pan the map | Click and drag | Drag with one finger |
| Zoom in / out | Scroll wheel | Pinch with two fingers |

You can also use the **zoom slider** at the bottom of the screen.

### Header Stats

- **Coin** — Coins earned by revealing safe cells. Used to unlock blocked areas.
- **Flag** — Total number of flags you have placed.
- **Star** — Total number of cells you have revealed.

### Blocks and Locking

The infinite map is divided into **blocks** (8x8 cell regions). When you hit a mine, the block containing that mine becomes **locked** and you cannot interact with its cells.

To unlock a locked block:

- **Free unlock** — If all surrounding blocks are already cleared, you can unlock it for free.
- **Coin unlock** — Spend 10 coins to unlock the block.

### Tips

- Flags are your friend. Mark suspected mines before attempting a chord reveal.
- Explore outward to earn coins, then spend them to recover from mistakes.
- The mine density is 15%, similar to an intermediate difficulty classic Minesweeper.
- The map is procedurally generated with a fixed seed, so the same world loads every time.

## Development

```bash
npm install
npm run dev       # Start dev server
npm run build     # Production build
npm run preview   # Preview production build
```

## Tech Stack

- Vue 3 (Composition API)
- TypeScript (strict mode)
- Vite
- Canvas 2D API
