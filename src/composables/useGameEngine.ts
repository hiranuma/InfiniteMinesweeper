import { reactive, ref } from 'vue'
import type { Cell, Chunk, Camera, GameState, ChunkKey, BlockKey, BlockState } from '@/types/game'
import {
  CELL_SIZE,
  CHUNK_SIZE,
  BLOCK_SIZE,
  MINE_DENSITY,
  MAX_CACHED_CHUNKS,
  GLOBAL_SEED,
  UNLOCK_COST,
} from '@/types/game'

function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function chunkSeed(cx: number, cy: number): number {
  const a = cx >= 0 ? 2 * cx : -2 * cx - 1
  const b = cy >= 0 ? 2 * cy : -2 * cy - 1
  const paired = ((a + b) * (a + b + 1)) / 2 + b
  return (GLOBAL_SEED ^ (paired * 2654435761)) >>> 0
}

function chunkKey(cx: number, cy: number): ChunkKey {
  return `${cx},${cy}`
}

function blockKey(bx: number, by: number): BlockKey {
  return `${bx},${by}`
}

function cellToChunk(cellCoord: number): number {
  return Math.floor(cellCoord / CHUNK_SIZE)
}

function cellToBlock(cellCoord: number): number {
  return Math.floor(cellCoord / BLOCK_SIZE)
}

export type TapResult =
  | { type: 'reveal' | 'chord' | 'flag' | 'noop' }
  | { type: 'locked'; bx: number; by: number }

export function useGameEngine(camera: Camera) {
  const chunks = new Map<ChunkKey, Chunk>()
  const blocks = new Map<BlockKey, BlockState>()

  const state: GameState = reactive({
    coins: 0,
    flagCount: 0,
    revealedCount: 0,
  })

  const pendingUnlock = ref<{ bx: number; by: number } | null>(null)

  function generateChunk(cx: number, cy: number): Chunk {
    const rng = mulberry32(chunkSeed(cx, cy))
    const cells: Cell[][] = []
    const originX = cx * CHUNK_SIZE
    const originY = cy * CHUNK_SIZE

    for (let dy = 0; dy < CHUNK_SIZE; dy++) {
      cells[dy] = []
      for (let dx = 0; dx < CHUNK_SIZE; dx++) {
        cells[dy][dx] = {
          x: originX + dx,
          y: originY + dy,
          isMine: rng() < MINE_DENSITY,
          isRevealed: false,
          isFlagged: false,
          adjacentMines: -1,
        }
      }
    }
    return { originX, originY, cells, generated: true }
  }

  function ensureChunk(cx: number, cy: number): Chunk {
    const key = chunkKey(cx, cy)
    let chunk = chunks.get(key)
    if (!chunk) {
      chunk = generateChunk(cx, cy)
      chunks.set(key, chunk)
      evictDistantChunks()
    }
    return chunk
  }

  function evictDistantChunks(): void {
    if (chunks.size <= MAX_CACHED_CHUNKS) return

    const cameraCX = cellToChunk(Math.floor(camera.x / CELL_SIZE))
    const cameraCY = cellToChunk(Math.floor(camera.y / CELL_SIZE))

    const entries = [...chunks.entries()]
      .map(([key, chunk]) => {
        const cx = chunk.originX / CHUNK_SIZE
        const cy = chunk.originY / CHUNK_SIZE
        const dist = Math.abs(cx - cameraCX) + Math.abs(cy - cameraCY)
        return { key, dist, hasRevealed: hasRevealedCells(chunk) }
      })
      .filter((e) => !e.hasRevealed)
      .sort((a, b) => b.dist - a.dist)

    const removeCount = Math.min(
      entries.length,
      Math.floor(chunks.size * 0.25)
    )
    for (let i = 0; i < removeCount; i++) {
      chunks.delete(entries[i].key)
    }
  }

  function hasRevealedCells(chunk: Chunk): boolean {
    for (let dy = 0; dy < CHUNK_SIZE; dy++) {
      for (let dx = 0; dx < CHUNK_SIZE; dx++) {
        if (chunk.cells[dy][dx].isRevealed || chunk.cells[dy][dx].isFlagged) {
          return true
        }
      }
    }
    return false
  }

  function getCell(x: number, y: number): Cell {
    const cx = cellToChunk(x)
    const cy = cellToChunk(y)
    const chunk = ensureChunk(cx, cy)
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    return chunk.cells[localY][localX]
  }

  function computeAdjacentMines(x: number, y: number): number {
    let count = 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        if (getCell(x + dx, y + dy).isMine) count++
      }
    }
    return count
  }

  function ensureAdjacentMines(cell: Cell): void {
    if (cell.adjacentMines === -1) {
      cell.adjacentMines = computeAdjacentMines(cell.x, cell.y)
    }
  }

  // Block system
  function isBlockLocked(bx: number, by: number): boolean {
    const key = blockKey(bx, by)
    const block = blocks.get(key)
    return block?.isLocked ?? false
  }

  function lockBlock(bx: number, by: number): void {
    const key = blockKey(bx, by)
    blocks.set(key, { isLocked: true })
  }

  function isBlockCleared(bx: number, by: number): boolean {
    const originX = bx * BLOCK_SIZE
    const originY = by * BLOCK_SIZE
    for (let dy = 0; dy < BLOCK_SIZE; dy++) {
      for (let dx = 0; dx < BLOCK_SIZE; dx++) {
        const cell = getCell(originX + dx, originY + dy)
        if (!cell.isMine && !cell.isRevealed) return false
      }
    }
    return true
  }

  function canFreeUnlock(bx: number, by: number): boolean {
    // All 4 cardinal-adjacent blocks must be cleared
    const neighbors = [
      [bx - 1, by],
      [bx + 1, by],
      [bx, by - 1],
      [bx, by + 1],
    ]
    return neighbors.every(([nx, ny]) => {
      if (isBlockLocked(nx, ny)) return false
      return isBlockCleared(nx, ny)
    })
  }

  function unlockBlock(bx: number, by: number, method: 'free' | 'coins'): boolean {
    if (!isBlockLocked(bx, by)) return false

    if (method === 'free') {
      if (!canFreeUnlock(bx, by)) return false
    } else {
      if (state.coins < UNLOCK_COST) return false
      state.coins -= UNLOCK_COST
    }

    const key = blockKey(bx, by)
    blocks.set(key, { isLocked: false })
    return true
  }

  function revealCell(startX: number, startY: number): void {
    const queue: [number, number][] = [[startX, startY]]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const [x, y] = queue.shift()!
      const key = `${x},${y}`
      if (visited.has(key)) continue
      visited.add(key)

      // Don't reveal into locked blocks
      const bx = cellToBlock(x)
      const by = cellToBlock(y)
      if (isBlockLocked(bx, by)) continue

      const cell = getCell(x, y)
      if (cell.isRevealed || cell.isFlagged) continue

      cell.isRevealed = true
      state.revealedCount++

      if (cell.isMine) {
        // Lock the block instead of coin penalty
        lockBlock(bx, by)
        continue
      }

      state.coins++
      ensureAdjacentMines(cell)

      if (cell.adjacentMines === 0) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            queue.push([x + dx, y + dy])
          }
        }
      }
    }
  }

  function chordCell(x: number, y: number): void {
    const cell = getCell(x, y)
    if (!cell.isRevealed) return
    ensureAdjacentMines(cell)
    if (cell.adjacentMines <= 0) return

    // Count flags AND revealed mines as "accounted for"
    let accountedCount = 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const neighbor = getCell(x + dx, y + dy)
        if (neighbor.isFlagged || (neighbor.isRevealed && neighbor.isMine)) {
          accountedCount++
        }
      }
    }

    if (accountedCount === cell.adjacentMines) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const neighbor = getCell(x + dx, y + dy)
          if (!neighbor.isFlagged && !neighbor.isRevealed) {
            revealCell(x + dx, y + dy)
          }
        }
      }
    }
  }

  function toggleFlag(x: number, y: number): void {
    const bx = cellToBlock(x)
    const by = cellToBlock(y)
    if (isBlockLocked(bx, by)) return

    const cell = getCell(x, y)
    if (cell.isRevealed) return
    cell.isFlagged = !cell.isFlagged
    state.flagCount += cell.isFlagged ? 1 : -1
  }

  function handleTap(x: number, y: number): TapResult {
    const bx = cellToBlock(x)
    const by = cellToBlock(y)

    if (isBlockLocked(bx, by)) {
      pendingUnlock.value = { bx, by }
      return { type: 'locked', bx, by }
    }

    const cell = getCell(x, y)
    if (cell.isFlagged) return { type: 'noop' }

    if (cell.isRevealed) {
      chordCell(x, y)
      return { type: 'chord' }
    } else {
      revealCell(x, y)
      return { type: 'reveal' }
    }
  }

  return {
    state,
    chunks,
    blocks,
    pendingUnlock,
    ensureChunk,
    getCell,
    ensureAdjacentMines,
    handleTap,
    toggleFlag,
    isBlockLocked,
    canFreeUnlock,
    unlockBlock,
  }
}

export type GameEngine = ReturnType<typeof useGameEngine>
