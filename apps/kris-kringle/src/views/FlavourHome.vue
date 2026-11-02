<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppButton from '../components/AppButton.vue'

const props = defineProps<{ flavour: { name: string; heroHex: string; inkHex: string; imageUrl?: string }; christmasAt: string }>()
const emit = defineEmits<{ survey: []; flavourChat: []; santaChat: [] }>()
const imageFailed = ref(false)
const now = ref(Date.now())
const days = computed(() => Math.max(0, Math.ceil((new Date(props.christmasAt).getTime() - now.value) / 86400000)))
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 60000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <section class="flavour-home">
    <p class="eyebrow">
      Your Kris Kringle
    </p>
    <div
      class="flavour-card"
      :style="{ backgroundColor: flavour.heroHex, color: flavour.inkHex }"
    >
      <div>
        <p class="eyebrow">
          You are shopping for
        </p><h1>{{ flavour.name }}</h1>
      </div>
      <img
        v-if="flavour.imageUrl && !imageFailed"
        :src="flavour.imageUrl"
        :alt="`${flavour.name} paleta`"
        width="120"
        height="120"
        @error="imageFailed = true"
      >
      <div
        v-else
        class="flavour-art"
        aria-hidden="true"
      >
        <span />
      </div>
      <button
        class="flavour-link"
        type="button"
        @click="emit('survey')"
      >
        See their answers
      </button>
    </div>
    <div class="christmas-countdown">
      <strong>{{ days }}</strong><span>{{ days === 1 ? 'day' : 'days' }} until Christmas</span>
    </div>
    <AppButton @click="emit('flavourChat')">
      Chat with {{ flavour.name }}
    </AppButton>
    <AppButton
      variant="secondary"
      @click="emit('santaChat')"
    >
      Chat with Your Santa
    </AppButton>
  </section>
</template>
