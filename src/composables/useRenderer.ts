import type { Ref } from 'vue'
import type { Camera } from '@/types/game'
import type { GameEngine } from '@/composables/useGameEngine'
import { CELL_SIZE, BLOCK_SIZE } from '@/types/game'
import { getVisibleChunkRange } from '@/composables/useCamera'

const NUMBER_COLORS: Record<number, string> = {
  1: '#4fc3f7',
  2: '#81c784',
  3: '#e57373',
  4: '#7986cb',
  5: '#ff8a65',
  6: '#4dd0e1',
  7: '#90a4ae',
  8: '#a1887f',
}

const BLOCK_PX = BLOCK_SIZE * CELL_SIZE

export function useRenderer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  camera: Camera,
  engine: GameEngine
) {
  let animationFrameId = 0
  let ctx: CanvasRenderingContext2D | null = null

  function start() {
    const canvas = canvasRef.value
    if (!canvas) return
    ctx = canvas.getContext('2d')
    if (!ctx) return
    loop()
  }

  function stop() {
    cancelAnimationFrame(animationFrameId)
  }

  function loop() {
    draw()
    animationFrameId = requestAnimationFrame(loop)
  }

  function draw() {
    const canvas = canvasRef.value
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Background
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, w, h)

    const range = getVisibleChunkRange(camera, w, h)

    // Ensure chunks
    for (let cy = range.startChunkY; cy <= range.endChunkY; cy++) {
      for (let cx = range.startChunkX; cx <= range.endChunkX; cx++) {
        engine.ensureChunk(cx, cy)
      }
    }

    // Apply camera transform
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.scale(camera.zoom, camera.zoom)
    ctx.translate(-camera.x, -camera.y)

    const cellScreenSize = CELL_SIZE * camera.zoom
    const showNumbers = cellScreenSize > 8
    const showIcons = cellScreenSize > 6

    // Draw cells
    for (let y = range.startCellY; y <= range.endCellY; y++) {
      for (let x = range.startCellX; x <= range.endCellX; x++) {
        const cell = engine.getCell(x, y)
        engine.ensureAdjacentMines(cell)
        drawCell(ctx!, cell, cellScreenSize, showNumbers)
      }
    }

    // Draw block grid lines
    const startBlockX = Math.floor(range.startCellX / BLOCK_SIZE)
    const startBlockY = Math.floor(range.startCellY / BLOCK_SIZE)
    const endBlockX = Math.ceil(range.endCellX / BLOCK_SIZE)
    const endBlockY = Math.ceil(range.endCellY / BLOCK_SIZE)

    if (cellScreenSize > 4) {
      ctx.strokeStyle = 'rgba(255, 107, 157, 0.25)'
      ctx.lineWidth = 1
      for (let by = startBlockY; by <= endBlockY; by++) {
        const py = by * BLOCK_PX
        ctx.beginPath()
        ctx.moveTo(startBlockX * BLOCK_PX, py)
        ctx.lineTo((endBlockX + 1) * BLOCK_PX, py)
        ctx.stroke()
      }
      for (let bx = startBlockX; bx <= endBlockX; bx++) {
        const px = bx * BLOCK_PX
        ctx.beginPath()
        ctx.moveTo(px, startBlockY * BLOCK_PX)
        ctx.lineTo(px, (endBlockY + 1) * BLOCK_PX)
        ctx.stroke()
      }
    }

    // Draw locked block overlays
    for (let by = startBlockY; by <= endBlockY; by++) {
      for (let bx = startBlockX; bx <= endBlockX; bx++) {
        if (engine.isBlockLocked(bx, by)) {
          drawLockedOverlay(ctx!, bx, by, cellScreenSize, showIcons)
        }
      }
    }

    ctx.restore()
  }

  function drawCell(
    ctx: CanvasRenderingContext2D,
    cell: ReturnType<GameEngine['getCell']>,
    cellScreenSize: number,
    showNumbers: boolean
  ) {
    const px = cell.x * CELL_SIZE
    const py = cell.y * CELL_SIZE
    const s = CELL_SIZE
    const pad = 0.5

    if (!cell.isRevealed) {
      // Unrevealed cell with gradient reflection
      const grad = ctx.createLinearGradient(px, py, px + s, py + s)
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(0.4, '#fafafa')
      grad.addColorStop(1, '#e8e8e8')
      ctx.fillStyle = grad
      ctx.fillRect(px + pad, py + pad, s - pad * 2, s - pad * 2)

      // Subtle border
      ctx.strokeStyle = '#ddd'
      ctx.lineWidth = 0.5
      ctx.strokeRect(px + pad, py + pad, s - pad * 2, s - pad * 2)

      if (cell.isFlagged && cellScreenSize > 6) {
        drawFlag(ctx, px, py, s)
      }
    } else {
      // Revealed cell
      ctx.fillStyle = '#efefef'
      ctx.fillRect(px + pad, py + pad, s - pad * 2, s - pad * 2)

      ctx.strokeStyle = '#e0e0e0'
      ctx.lineWidth = 0.3
      ctx.strokeRect(px + pad, py + pad, s - pad * 2, s - pad * 2)

      if (cell.isMine) {
        if (cellScreenSize > 6) drawBomb(ctx, px, py, s)
      } else if (cell.adjacentMines > 0 && showNumbers) {
        const color = NUMBER_COLORS[cell.adjacentMines] || '#64b5f6'
        ctx.fillStyle = color
        const fontSize = Math.max(1, s * 0.55)
        ctx.font = `bold ${fontSize}px -apple-system, "Segoe UI", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(cell.adjacentMines), px + s / 2, py + s / 2 + 1)
      }
    }
  }

  function drawLockedOverlay(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    cellScreenSize: number,
    showIcons: boolean
  ) {
    const px = bx * BLOCK_PX
    const py = by * BLOCK_PX

    // Semi-transparent white overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
    ctx.fillRect(px, py, BLOCK_PX, BLOCK_PX)

    // Border
    ctx.strokeStyle = 'rgba(200, 60, 60, 0.3)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(px + 0.5, py + 0.5, BLOCK_PX - 1, BLOCK_PX - 1)

    // Lock icon
    if (showIcons && cellScreenSize > 10) {
      const cx = px + BLOCK_PX / 2
      const cy = py + BLOCK_PX / 2
      const iconSize = Math.min(BLOCK_PX * 0.3, 40)

      // Lock body
      ctx.fillStyle = 'rgba(100, 100, 100, 0.6)'
      const bodyW = iconSize * 0.7
      const bodyH = iconSize * 0.5
      const bodyX = cx - bodyW / 2
      const bodyY = cy - bodyH / 4
      ctx.beginPath()
      ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 3)
      ctx.fill()

      // Lock shackle
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.6)'
      ctx.lineWidth = iconSize * 0.1
      ctx.lineCap = 'round'
      const shackleR = bodyW * 0.3
      ctx.beginPath()
      ctx.arc(cx, bodyY, shackleR, Math.PI, 0)
      ctx.stroke()

      // Keyhole
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.beginPath()
      ctx.arc(cx, bodyY + bodyH * 0.4, iconSize * 0.06, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function drawFlag(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    s: number
  ) {
    const cx = px + s / 2
    const cy = py + s / 2

    // Pole
    ctx.strokeStyle = '#888'
    ctx.lineWidth = s * 0.06
    ctx.beginPath()
    ctx.moveTo(cx, cy - s * 0.3)
    ctx.lineTo(cx, cy + s * 0.3)
    ctx.stroke()

    // Flag triangle
    ctx.fillStyle = '#ff6b9d'
    ctx.beginPath()
    ctx.moveTo(cx, cy - s * 0.3)
    ctx.lineTo(cx + s * 0.28, cy - s * 0.12)
    ctx.lineTo(cx, cy + s * 0.05)
    ctx.closePath()
    ctx.fill()
  }

  function drawBomb(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    s: number
  ) {
    const cx = px + s / 2
    const cy = py + s / 2
    const r = s * 0.25

    // Body
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()

    // Spikes
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = s * 0.06
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 4
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(angle) * r * 0.8, cy + Math.sin(angle) * r * 0.8)
      ctx.lineTo(cx + Math.cos(angle) * r * 1.5, cy + Math.sin(angle) * r * 1.5)
      ctx.stroke()
    }

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.beginPath()
    ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.2, 0, Math.PI * 2)
    ctx.fill()
  }

  return { start, stop }
}
