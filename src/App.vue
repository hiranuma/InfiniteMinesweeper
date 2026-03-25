<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import GameCanvas from '@/components/GameCanvas.vue'
import { useCamera } from '@/composables/useCamera'
import { clampZoom } from '@/composables/useCamera'
import { MIN_ZOOM, MAX_ZOOM, UNLOCK_COST } from '@/types/game'

const camera = useCamera()
const gameCanvasRef = ref<InstanceType<typeof GameCanvas> | null>(null)

// Zoom bar
const zoomPercent = computed({
  get: () => {
    const range = MAX_ZOOM - MIN_ZOOM
    return ((camera.zoom - MIN_ZOOM) / range) * 100
  },
  set: (val: number) => {
    const range = MAX_ZOOM - MIN_ZOOM
    camera.zoom = clampZoom(MIN_ZOOM + (val / 100) * range)
  },
})

// Unlock dialog
const showUnlockDialog = ref(false)
const unlockTarget = ref<{ bx: number; by: number } | null>(null)
const canFreeUnlockCurrent = ref(false)

watch(
  () => gameCanvasRef.value?.pendingUnlock,
  (val) => {
    if (val) {
      unlockTarget.value = { ...val }
      canFreeUnlockCurrent.value =
        gameCanvasRef.value?.canFreeUnlock(val.bx, val.by) ?? false
      showUnlockDialog.value = true
      // Clear pending
      if (gameCanvasRef.value) {
        gameCanvasRef.value.pendingUnlock = null
      }
    }
  },
  { deep: true }
)

function unlockWithCoins() {
  if (!unlockTarget.value || !gameCanvasRef.value) return
  const { bx, by } = unlockTarget.value
  gameCanvasRef.value.unlockBlock(bx, by, 'coins')
  showUnlockDialog.value = false
  unlockTarget.value = null
}

function unlockFree() {
  if (!unlockTarget.value || !gameCanvasRef.value) return
  const { bx, by } = unlockTarget.value
  gameCanvasRef.value.unlockBlock(bx, by, 'free')
  showUnlockDialog.value = false
  unlockTarget.value = null
}

function closeDialog() {
  showUnlockDialog.value = false
  unlockTarget.value = null
}
</script>

<template>
  <div class="app-container">
    <header class="header">
      <span class="header-title">Infinity Minesweeper</span>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-icon">&#x1FA99;</span>
          <span class="stat-value">{{ gameCanvasRef?.state?.coins ?? 0 }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon">&#x1F6A9;</span>
          <span class="stat-value">{{ gameCanvasRef?.state?.flagCount ?? 0 }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon">&#x2B50;</span>
          <span class="stat-value">{{ gameCanvasRef?.state?.revealedCount ?? 0 }}</span>
        </div>
      </div>
    </header>

    <GameCanvas ref="gameCanvasRef" :camera="camera" />

    <!-- Zoom bar -->
    <div class="zoom-bar">
      <span class="zoom-label">-</span>
      <input
        type="range"
        class="zoom-slider"
        :min="0"
        :max="100"
        :value="zoomPercent"
        @input="zoomPercent = Number(($event.target as HTMLInputElement).value)"
      />
      <span class="zoom-label">+</span>
    </div>

    <!-- Unlock dialog -->
    <Transition name="fade">
      <div v-if="showUnlockDialog" class="unlock-overlay" @click.self="closeDialog">
        <div class="unlock-dialog">
          <div class="unlock-title">Block Locked</div>
          <div class="unlock-desc">This block is locked due to a mine explosion.</div>
          <div class="unlock-actions">
            <button
              v-if="canFreeUnlockCurrent"
              class="unlock-btn unlock-btn--free"
              @click="unlockFree"
            >
              Unlock (Adjacent Cleared)
            </button>
            <button
              class="unlock-btn unlock-btn--coins"
              :disabled="(gameCanvasRef?.state?.coins ?? 0) < UNLOCK_COST"
              @click="unlockWithCoins"
            >
              Unlock ({{ UNLOCK_COST }} Coins)
            </button>
            <button class="unlock-btn unlock-btn--cancel" @click="closeDialog">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
