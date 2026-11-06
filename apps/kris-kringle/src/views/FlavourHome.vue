<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppButton from '../components/AppButton.vue'

const props = defineProps<{ flavour: { name: string; heroHex: string; inkHex: string; imageUrl?: string }; christmasAt: string; answers: { question: string; answer: string }[]; unreadFlavour?: boolean; unreadSanta?: boolean; santaChatStarted: boolean }>()
const emit = defineEmits<{ flavourChat: []; santaChat: [] }>()
const imageFailed = ref(false)
const now = ref(Date.now())
const days = computed(() => Math.max(0, Math.ceil((new Date(props.christmasAt).getTime() - now.value) / 86400000)))
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 60000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <section class="flavour-home">
    <button
      v-if="unreadSanta"
      class="message-alert"
      type="button"
      @click="emit('santaChat')"
    >
      <strong>New message!</strong>
      <span>Your Santa sent you a message. Tap to read it.</span>
    </button>
    <button
      v-if="unreadFlavour"
      class="message-alert"
      type="button"
      @click="emit('flavourChat')"
    >
      <strong>New reply!</strong>
      <span>{{ flavour.name }} replied. Tap to read it.</span>
    </button>
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
    </div>
    <div class="christmas-countdown">
      <strong>{{ days }}</strong><span>{{ days === 1 ? 'day' : 'days' }} until Christmas</span>
    </div>
    <AppButton @click="emit('flavourChat')">
      Chat with {{ flavour.name }}{{ unreadFlavour ? ' (new)' : '' }}
    </AppButton>
    <AppButton
      variant="secondary"
      :disabled="!santaChatStarted"
      :aria-describedby="!santaChatStarted ? 'santa-first-message' : undefined"
      @click="emit('santaChat')"
    >
      Reply to Your Santa{{ unreadSanta ? ' (new)' : '' }}
    </AppButton>
    <p
      v-if="!santaChatStarted"
      id="santa-first-message"
      class="helper"
    >
      Your Santa will message you first. You can reply once they do.
    </p>
    <h2 class="clues-heading">
      Gift clues from {{ flavour.name }}
    </h2>
    <article
      v-for="(item, index) in answers"
      :key="index"
      class="survey-answer"
    >
      <h3>{{ item.question }}</h3>
      <p>{{ item.answer }}</p>
    </article>
    <p v-if="!answers.length">
      No answers are available yet.
    </p>
  </section>
</template>
