<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import AppButton from '../components/AppButton.vue'

type Message = { id: string; body: string; direction: string; created_at: string }
const props = defineProps<{ direction: 'to_flavour' | 'to_santa'; flavourName: string; heroHex: string; inkHex: string; closed: boolean }>()
const emit = defineEmits<{ back: [] }>()
const messages = ref<Message[]>([])
const text = ref('')
const loading = ref(true)
const sending = ref(false)
const error = ref('')
const serverQuota = ref(false)
function melbourneWeek(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const get = (name: string) => Number(parts.find(part => part.type === name)?.value)
  const date = new Date(Date.UTC(get('year'), get('month') - 1, get('day')))
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  return date.toISOString().slice(0, 10)
}
const quotaUsed = computed(() => serverQuota.value || messages.value.some(m => m.direction === props.direction && melbourneWeek(new Date(m.created_at)) === melbourneWeek(new Date())))
async function load() {
  if (!supabase) return
  loading.value = true; error.value = ''
  try {
    const result = props.direction === 'to_flavour' ? await supabase.rpc('chat_with_flavour') : await supabase.rpc('chat_with_santa')
    if (result.error) throw result.error
    messages.value = result.data
  } catch { error.value = "Couldn't load this chat. Please try again." } finally { loading.value = false }
}
async function send() {
  if (!supabase || sending.value || quotaUsed.value || props.closed || !text.value.trim()) return
  sending.value = true; error.value = ''
  try {
    const result = await supabase.functions.invoke('send-message', { body: { direction: props.direction, raw_text: text.value.trim() } })
    if (result.error) {
      if (result.error instanceof FunctionsHttpError && result.error.context.status === 429) { serverQuota.value = true; error.value = 'Your weekly message has already been sent.'; return }
      if (result.error instanceof FunctionsHttpError && result.error.context.status === 409) { error.value = 'Chat is now read-only.'; return }
      throw result.error
    }
    text.value = ''
    await load()
  } catch { error.value = "Couldn't send. Please try again." } finally { sending.value = false }
}
onMounted(() => { void load() })
</script>
<template>
  <section
    class="chat-screen"
    :class="{ 'chat-neutral': direction === 'to_santa' }"
    :style="direction === 'to_flavour' ? { '--chat-hero': heroHex, '--chat-ink': inkHex } : undefined"
  >
    <button
      class="text-button back-link"
      type="button"
      @click="emit('back')"
    >
      Back
    </button>
    <header class="chat-header">
      <h1>{{ direction === 'to_santa' ? 'Your Secret Santa' : `Chat with ${flavourName}` }}</h1>
    </header>
    <p
      v-if="loading"
      role="status"
    >
      Loading chat...
    </p>
    <div
      v-else
      class="chat-history"
      aria-live="polite"
    >
      <p v-if="!messages.length">
        No messages yet.
      </p>
      <article
        v-for="message in messages"
        :key="message.id"
        class="chat-bubble"
        :class="{ sent: message.direction === direction }"
      >
        <p>{{ message.body }}</p><time :datetime="message.created_at">{{ new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Melbourne' }).format(new Date(message.created_at)) }}</time>
      </article>
    </div>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
    <AppButton
      v-if="error && !messages.length && !sending && !serverQuota"
      variant="secondary"
      @click="load"
    >
      Retry loading
    </AppButton>
    <p
      v-if="closed"
      class="quota-chip"
    >
      Chat is read-only.
    </p>
    <p
      v-else
      class="quota-chip"
    >
      {{ quotaUsed ? 'Weekly message sent! Resets Monday.' : '1 message available this week. Resets Monday.' }}
    </p>
    <form
      v-if="!closed"
      @submit.prevent="send"
    >
      <label for="chat-message">Your message</label>
      <textarea
        id="chat-message"
        v-model="text"
        maxlength="1000"
        rows="4"
        :disabled="loading || sending || quotaUsed"
        placeholder="Write a message..."
      />
      <p class="helper">
        Your message will be reworded to help keep you anonymous.
      </p>
      <AppButton
        :disabled="loading || quotaUsed || !text.trim()"
        :loading="sending"
      >
        {{ sending ? 'Rewording and sending...' : 'Send message' }}
      </AppButton>
      <p
        v-if="sending"
        role="status"
      >
        Rewording and sending...
      </p>
    </form>
  </section>
</template>
