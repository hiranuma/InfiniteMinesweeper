export interface Cell {
  x: number
  y: number
  isMine: boolean
  isRevealed: boolean
  isFlagged: boolean
  adjacentMines: number // -1 = not yet calculated
}

export interface Chunk {
  originX: number
  originY: number
  cells: Cell[][]
  generated: boolean
}

export interface BlockState {
  isLocked: boolean
}

export interface Camera {
  x: number
  y: number
  zoom: number
}

export interface GameState {
  coins: number
  flagCount: number
  revealedCount: number
}

export type ChunkKey = `${number},${number}`
export type BlockKey = `${number},${number}`

// Constants
export const CELL_SIZE = 32
export const CHUNK_SIZE = 16
export const BLOCK_SIZE = 8
export const MINE_DENSITY = 0.15
export const MAX_CACHED_CHUNKS = 256
export const GLOBAL_SEED = 42
export const LONG_PRESS_MS = 400
export const DRAG_THRESHOLD = 8
export const MIN_ZOOM = 0.3
export const MAX_ZOOM = 3.0
export const UNLOCK_COST = 10
