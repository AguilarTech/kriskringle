<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppButton from '../components/AppButton.vue'

type Member = { id: string; name: string }
type Question = { id: string; text: string }
const props = defineProps<{ members: Member[]; questions: Question[]; initialExclusions: string[]; initialAnswers: Record<string, string>; drawAt: string; saveExclusions: (ids: string[]) => Promise<void>; saveAnswers: (answers: Record<string, string>) => Promise<void> }>()
const step = ref(props.questions.length > 0 && props.questions.every(q => props.initialAnswers[q.id]?.trim()) ? 3 : 1)
const exclusions = ref([...props.initialExclusions])
const answers = ref({ ...props.initialAnswers })
const status = ref<'saved' | 'saving' | 'error'>('saved')
const now = ref(Date.now())
const remaining = computed(() => Math.max(0, new Date(props.drawAt).getTime() - now.value))
const days = computed(() => Math.floor(remaining.value / 86400000))
const hours = computed(() => Math.floor(remaining.value / 3600000) % 24)
const minutes = computed(() => Math.floor(remaining.value / 60000) % 60)
const complete = computed(() => props.questions.length > 0 && props.questions.every(q => answers.value[q.id]?.trim()))
const timer = setInterval(() => { now.value = Date.now() }, 1000)
let debounce: ReturnType<typeof setTimeout> | undefined
let pending: Promise<void> = Promise.resolve()
let revision = 0
let savedRevision = 0
function queueSave() {
  clearTimeout(debounce)
  status.value = 'saving'
  revision++
  debounce = setTimeout(() => { void flush().catch(() => {}) }, 600)
}
async function flush() {
  clearTimeout(debounce)
  const target = revision
  if (target <= savedRevision) return pending
  const snapshot = { ...answers.value }
  pending = pending.catch(() => {}).then(async () => {
    await props.saveAnswers(snapshot)
    savedRevision = Math.max(savedRevision, target)
  })
  try { await pending; status.value = savedRevision === revision ? 'saved' : 'saving' } catch { status.value = 'error'; throw new Error('Save failed') }
}
defineExpose({ flush })
watch(answers, queueSave, { deep: true })
async function back() {
  try { await flush(); step.value = 1 } catch { status.value = 'error' }
}
async function next() {
  try {
    if (step.value === 1) { status.value = 'saving'; await props.saveExclusions(exclusions.value); status.value = 'saved' }
    if (step.value === 2) await flush()
    step.value++
  } catch { status.value = 'error' }
}
onBeforeUnmount(() => { clearInterval(timer); clearTimeout(debounce) })
</script>

<template>
  <section class="wizard">
    <p class="eyebrow">
      Step {{ step }} of 3
    </p>
    <template v-if="step === 1">
      <h1>Who can't you buy for?</h1>
      <p>Choose anyone you need to exclude, such as a spouse or someone you bought for last year.</p>
      <label
        v-for="member in members"
        :key="member.id"
        class="choice"
      ><input
        v-model="exclusions"
        type="checkbox"
        :value="member.id"
      > {{ member.name }}</label>
      <p v-if="!members.length">
        No other players are on the list yet.
      </p>
      <AppButton
        :loading="status === 'saving'"
        @click="next"
      >
        Continue
      </AppButton>
    </template>
    <template v-else-if="step === 2">
      <h1>Tell us about you</h1>
      <p>Give your Santa some ideas without giving yourself away.</p>
      <label
        v-for="question in questions"
        :key="question.id"
        class="survey-input"
      ><strong>{{ question.text }}</strong><textarea
        v-model="answers[question.id]"
        rows="3"
        @blur="flush().catch(() => {})"
      /></label>
      <p role="status">
        {{ status === 'saving' ? 'Saving...' : status === 'error' ? 'Could not save. Please try again.' : 'Saved' }}
      </p>
      <AppButton
        :disabled="!complete || status === 'saving'"
        @click="next"
      >
        Continue
      </AppButton>
      <button
        class="text-button"
        type="button"
        @click="back"
      >
        Back
      </button>
    </template>
    <template v-else>
      <h1>You're all set!</h1>
      <p>The draw takes place on {{ new Intl.DateTimeFormat('en-AU', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Australia/Melbourne' }).format(new Date(drawAt)) }} Melbourne time.</p>
      <div
        class="countdown"
        aria-label="Time until the draw"
      >
        <strong>{{ days }}</strong> days <strong>{{ hours }}</strong> hours <strong>{{ minutes }}</strong> minutes
      </div>
      <button
        class="text-button"
        type="button"
        @click="step = 2"
      >
        Review your answers
      </button>
    </template>
    <p
      v-if="status === 'error' && step === 1"
      role="alert"
    >
      Could not save. Please try again.
    </p>
  </section>
</template>
