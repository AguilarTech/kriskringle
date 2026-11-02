<script setup lang="ts">
defineProps<{ answers: { question: string; answer: string }[] }>()
const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <section class="survey-detail">
    <button
      class="text-button back-link"
      type="button"
      @click="emit('back')"
    >
      Back
    </button>
    <h1>A few gift clues</h1>
    <p>Here are the answers your flavour shared.</p>
    <article
      v-for="(item, index) in answers"
      :key="index"
      class="survey-answer"
    >
      <h2>{{ item.question }}</h2>
      <p>{{ item.answer }}</p>
    </article>
    <p v-if="!answers.length">
      No answers are available yet.
    </p>
  </section>
</template>
