import { reactive } from 'vue'
import type { Camera } from '@/types/game'
import { CELL_SIZE, CHUNK_SIZE, MIN_ZOOM, MAX_ZOOM } from '@/types/game'

export function useCamera(): Camera {
  const camera: Camera = reactive({
    x: 0,
    y: 0,
    zoom: 1,
  })
  return camera
}

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number
): { wx: number; wy: number } {
  const wx = camera.x + (screenX - canvasWidth / 2) / camera.zoom
  const wy = camera.y + (screenY - canvasHeight / 2) / camera.zoom
  return { wx, wy }
}

export function worldToCell(wx: number, wy: number): { cx: number; cy: number } {
  return {
    cx: Math.floor(wx / CELL_SIZE),
    cy: Math.floor(wy / CELL_SIZE),
  }
}

export function getVisibleChunkRange(
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number
) {
  const halfW = canvasWidth / 2 / camera.zoom
  const halfH = canvasHeight / 2 / camera.zoom

  const startCellX = Math.floor((camera.x - halfW) / CELL_SIZE)
  const startCellY = Math.floor((camera.y - halfH) / CELL_SIZE)
  const endCellX = Math.ceil((camera.x + halfW) / CELL_SIZE)
  const endCellY = Math.ceil((camera.y + halfH) / CELL_SIZE)

  return {
    startCellX,
    startCellY,
    endCellX,
    endCellY,
    startChunkX: Math.floor(startCellX / CHUNK_SIZE),
    startChunkY: Math.floor(startCellY / CHUNK_SIZE),
    endChunkX: Math.floor(endCellX / CHUNK_SIZE),
    endChunkY: Math.floor(endCellY / CHUNK_SIZE),
  }
}
