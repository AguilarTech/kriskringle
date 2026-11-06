<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppButton from '../components/AppButton.vue'
import NotificationOptIn from '../components/NotificationOptIn.vue'

const props = defineProps<{ flavour: { name: string; heroHex: string; inkHex: string; imageUrl?: string }; christmasAt: string; answers: { question: string; answer: string }[]; unreadFlavourCount: number; unreadSantaCount: number; santaChatStarted: boolean }>()
const unreadTotal = computed(() => props.unreadFlavourCount + props.unreadSantaCount)
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
    <section
      v-if="unreadTotal"
      class="inbox-notice"
      aria-live="polite"
      aria-label="Unread messages"
    >
      <p class="inbox-notice-label">
        New messages
      </p>
      <h2><span class="inbox-count">{{ unreadTotal }}</span> {{ unreadTotal === 1 ? 'message waiting' : 'messages waiting' }}</h2>
      <button
        v-if="unreadSantaCount"
        type="button"
        class="inbox-action"
        @click="emit('santaChat')"
      >
        <strong>Your Santa sent you {{ unreadSantaCount === 1 ? 'a message' : `${unreadSantaCount} messages` }}</strong>
        <span>Read now <span aria-hidden="true">&rarr;</span></span>
      </button>
      <button
        v-if="unreadFlavourCount"
        type="button"
        class="inbox-action"
        @click="emit('flavourChat')"
      >
        <strong>{{ flavour.name }} {{ unreadFlavourCount === 1 ? 'replied' : `sent ${unreadFlavourCount} replies` }}</strong>
        <span>Read now <span aria-hidden="true">&rarr;</span></span>
      </button>
    </section>
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
    <AppButton
      :class="{ 'button--unread': unreadFlavourCount > 0 }"
      @click="emit('flavourChat')"
    >
      {{ unreadFlavourCount ? `Read reply from ${flavour.name}` : `Chat with ${flavour.name}` }}
      <span
        v-if="unreadFlavourCount"
        class="unread-badge"
      >{{ unreadFlavourCount }} NEW</span>
    </AppButton>
    <AppButton
      variant="secondary"
      :disabled="!santaChatStarted"
      :aria-describedby="!santaChatStarted ? 'santa-first-message' : undefined"
      :class="{ 'button--unread': unreadSantaCount > 0 }"
      @click="emit('santaChat')"
    >
      {{ unreadSantaCount ? 'Read message from Your Santa' : 'Reply to Your Santa' }}
      <span
        v-if="unreadSantaCount"
        class="unread-badge"
      >{{ unreadSantaCount }} NEW</span>
    </AppButton>
    <p
      v-if="!santaChatStarted"
      id="santa-first-message"
      class="helper"
    >
      Your Santa will message you first. You can reply once they do.
    </p>
    <NotificationOptIn />
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
