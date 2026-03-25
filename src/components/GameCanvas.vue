<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Camera } from '@/types/game'
import { useGameEngine } from '@/composables/useGameEngine'
import { useRenderer } from '@/composables/useRenderer'
import { useInputHandler } from '@/composables/useInputHandler'

const props = defineProps<{
  camera: Camera
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const engine = useGameEngine(props.camera)
const renderer = useRenderer(canvasRef, props.camera, engine)
const input = useInputHandler(canvasRef, props.camera, engine)

defineExpose({
  state: engine.state,
  pendingUnlock: engine.pendingUnlock,
  canFreeUnlock: engine.canFreeUnlock,
  unlockBlock: engine.unlockBlock,
})

onMounted(() => {
  renderer.start()
  input.attach()
})

onUnmounted(() => {
  renderer.stop()
  input.detach()
})
</script>

<template>
  <canvas ref="canvasRef" class="game-canvas" />
</template>
