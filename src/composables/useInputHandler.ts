import type { Ref } from 'vue'
import type { Camera } from '@/types/game'
import type { GameEngine } from '@/composables/useGameEngine'
import { LONG_PRESS_MS, DRAG_THRESHOLD } from '@/types/game'
import { clampZoom, screenToWorld, worldToCell } from '@/composables/useCamera'

type InputState = 'idle' | 'pending' | 'dragging' | 'pinching'

export function useInputHandler(
  canvasRef: Ref<HTMLCanvasElement | null>,
  camera: Camera,
  engine: GameEngine
) {
  let inputState: InputState = 'idle'
  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0
  let lastX = 0
  let lastY = 0
  let initialPinchDist = 0
  let initialZoom = 1
  let pinchCenterX = 0
  let pinchCenterY = 0
  let didLongPress = false
  let activePointerId = -1

  function getCanvasRect() {
    return canvasRef.value!.getBoundingClientRect()
  }

  function clearLongPress() {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'touch') return // handled by touch events
    e.preventDefault()

    // Capture pointer so events continue even outside canvas
    canvasRef.value?.setPointerCapture(e.pointerId)
    activePointerId = e.pointerId

    const rect = getCanvasRect()
    startX = e.clientX - rect.left
    startY = e.clientY - rect.top
    lastX = startX
    lastY = startY
    inputState = 'pending'
    didLongPress = false

    clearLongPress()
    longPressTimer = setTimeout(() => {
      if (inputState === 'pending') {
        didLongPress = true
        const { wx, wy } = screenToWorld(startX, startY, camera, rect.width, rect.height)
        const { cx, cy } = worldToCell(wx, wy)
        engine.toggleFlag(cx, cy)
        inputState = 'idle'
      }
    }, LONG_PRESS_MS)
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerType === 'touch') return
    if (inputState === 'idle') return
    e.preventDefault()

    const rect = getCanvasRect()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top

    if (inputState === 'pending') {
      const dx = currentX - startX
      const dy = currentY - startY
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        inputState = 'dragging'
        clearLongPress()
      }
    }

    if (inputState === 'dragging') {
      const dx = currentX - lastX
      const dy = currentY - lastY
      camera.x -= dx / camera.zoom
      camera.y -= dy / camera.zoom
    }

    lastX = currentX
    lastY = currentY
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerType === 'touch') return
    e.preventDefault()
    clearLongPress()

    // Release pointer capture
    if (activePointerId >= 0) {
      canvasRef.value?.releasePointerCapture(activePointerId)
      activePointerId = -1
    }

    if (inputState === 'pending' && !didLongPress) {
      const rect = getCanvasRect()
      const { wx, wy } = screenToWorld(startX, startY, camera, rect.width, rect.height)
      const { cx, cy } = worldToCell(wx, wy)
      engine.handleTap(cx, cy)
    }

    inputState = 'idle'
  }

  // Mouse wheel zoom
  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const rect = getCanvasRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const { wx: worldBeforeX, wy: worldBeforeY } = screenToWorld(
      mouseX, mouseY, camera, rect.width, rect.height
    )

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    camera.zoom = clampZoom(camera.zoom * zoomFactor)

    const { wx: worldAfterX, wy: worldAfterY } = screenToWorld(
      mouseX, mouseY, camera, rect.width, rect.height
    )

    camera.x += worldBeforeX - worldAfterX
    camera.y += worldBeforeY - worldAfterY
  }

  // Touch events for mobile
  function onTouchStart(e: TouchEvent) {
    e.preventDefault()

    if (e.touches.length === 2) {
      inputState = 'pinching'
      clearLongPress()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      initialPinchDist = Math.hypot(dx, dy)
      initialZoom = camera.zoom
      const rect = getCanvasRect()
      pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
      pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
      return
    }

    if (e.touches.length === 1) {
      const rect = getCanvasRect()
      startX = e.touches[0].clientX - rect.left
      startY = e.touches[0].clientY - rect.top
      lastX = startX
      lastY = startY
      inputState = 'pending'
      didLongPress = false

      clearLongPress()
      longPressTimer = setTimeout(() => {
        if (inputState === 'pending') {
          didLongPress = true
          const { wx, wy } = screenToWorld(startX, startY, camera, rect.width, rect.height)
          const { cx, cy } = worldToCell(wx, wy)
          engine.toggleFlag(cx, cy)
          inputState = 'idle'
        }
      }, LONG_PRESS_MS)
    }
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault()

    if (e.touches.length === 2 && inputState === 'pinching') {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const rect = getCanvasRect()

      const newCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
      const newCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top

      const { wx: worldBeforeX, wy: worldBeforeY } = screenToWorld(
        pinchCenterX, pinchCenterY, camera, rect.width, rect.height
      )

      camera.zoom = clampZoom(initialZoom * (dist / initialPinchDist))

      const { wx: worldAfterX, wy: worldAfterY } = screenToWorld(
        newCenterX, newCenterY, camera, rect.width, rect.height
      )

      camera.x += worldBeforeX - worldAfterX
      camera.y += worldBeforeY - worldAfterY

      pinchCenterX = newCenterX
      pinchCenterY = newCenterY
      return
    }

    if (e.touches.length === 1) {
      const rect = getCanvasRect()
      const currentX = e.touches[0].clientX - rect.left
      const currentY = e.touches[0].clientY - rect.top

      if (inputState === 'pending') {
        const ddx = currentX - startX
        const ddy = currentY - startY
        if (Math.hypot(ddx, ddy) > DRAG_THRESHOLD) {
          inputState = 'dragging'
          clearLongPress()
        }
      }

      if (inputState === 'dragging') {
        const ddx = currentX - lastX
        const ddy = currentY - lastY
        camera.x -= ddx / camera.zoom
        camera.y -= ddy / camera.zoom
      }

      lastX = currentX
      lastY = currentY
    }
  }

  function onTouchEnd(e: TouchEvent) {
    e.preventDefault()

    if (inputState === 'pinching') {
      if (e.touches.length < 2) {
        inputState = 'idle'
      }
      return
    }

    clearLongPress()

    if (inputState === 'pending' && !didLongPress && e.touches.length === 0) {
      const rect = getCanvasRect()
      const { wx, wy } = screenToWorld(startX, startY, camera, rect.width, rect.height)
      const { cx, cy } = worldToCell(wx, wy)
      engine.handleTap(cx, cy)
    }

    if (e.touches.length === 0) {
      inputState = 'idle'
    }
  }

  function attach() {
    const canvas = canvasRef.value
    if (!canvas) return
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })
  }

  function detach() {
    const canvas = canvasRef.value
    if (!canvas) return
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('touchstart', onTouchStart)
    canvas.removeEventListener('touchmove', onTouchMove)
    canvas.removeEventListener('touchend', onTouchEnd)
  }

  return { attach, detach }
}
