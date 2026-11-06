<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { supabase } from '../lib/supabase'
import AppButton from '../components/AppButton.vue'
import FlavourHome from './FlavourHome.vue'
import ChatView from './ChatView.vue'

const props = defineProps<{ phase: string; userId: string }>()
const emit = defineEmits<{ signOut: [] }>()
type Flavour = { name: string; heroHex: string; inkHex: string; imageUrl: string }
const flavour = ref<Flavour | null>(null)
const answers = ref<{ question: string; answer: string }[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const page = ref<'home' | 'flavourChat' | 'santaChat'>('home')
type Direction = 'to_flavour' | 'to_santa'
type Message = { direction: string; created_at: string }
const latestIncoming = ref<Record<Direction, number>>({ to_flavour: 0, to_santa: 0 })
const lastRead = ref<Record<Direction, number>>({ to_flavour: 0, to_santa: 0 })
const unreadFlavour = computed(() => latestIncoming.value.to_flavour > lastRead.value.to_flavour)
const unreadSanta = computed(() => latestIncoming.value.to_santa > lastRead.value.to_santa)
// Show unread chats on the browser tab and the installed app icon too.
watchEffect(() => {
  const count = Number(unreadFlavour.value) + Number(unreadSanta.value)
  document.title = count ? `(${count}) Kris Kringle` : 'Kris Kringle'
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  void (count ? nav.setAppBadge?.(count) : nav.clearAppBadge?.())?.catch(() => {})
})
let refreshVersion = 0
let refreshTimer: ReturnType<typeof setInterval> | undefined
const storageKey = (direction: Direction) => `kringle:last-read:${props.userId}:${direction}`
function readMarkers() {
  for (const direction of ['to_flavour', 'to_santa'] as const) {
    try { lastRead.value[direction] = Number(localStorage.getItem(storageKey(direction))) || 0 } catch { /* In-memory state still works. */ }
  }
}
function markRead(direction: Direction, timestamp: string) {
  const value = Date.parse(timestamp)
  if (!Number.isFinite(value)) return
  lastRead.value[direction] = Math.max(lastRead.value[direction], value)
  try { localStorage.setItem(storageKey(direction), String(lastRead.value[direction])) } catch { /* In-memory state still works. */ }
}
function latest(messages: Message[], outgoing: Direction) {
  return messages.reduce((max, message) => message.direction === outgoing ? max : Math.max(max, Date.parse(message.created_at) || 0), 0)
}
async function refreshUnread() {
  if (!supabase || document.visibilityState !== 'visible') return
  const version = ++refreshVersion
  try {
    const [flavourChat, santaChat] = await Promise.all([supabase.rpc('chat_with_flavour'), supabase.rpc('chat_with_santa')])
    if (version !== refreshVersion) return
    if (!flavourChat.error) latestIncoming.value.to_flavour = latest(flavourChat.data, 'to_flavour')
    if (!santaChat.error) latestIncoming.value.to_santa = latest(santaChat.data, 'to_santa')
  } catch { /* Keep the previous indicator until the next refresh. */ }
}
function onVisibility() { if (document.visibilityState === 'visible') void refreshUnread() }
async function load() {
  if (!supabase) { status.value = 'error'; return }
  status.value = 'loading'
  try {
    const [identity, survey] = await Promise.all([supabase.rpc('my_flavour'), supabase.rpc('my_flavour_survey')])
    if (identity.error || survey.error || !identity.data[0]) throw new Error('Flavour unavailable')
    const row = identity.data[0]
    flavour.value = { name: row.name, heroHex: row.hero_hex, inkHex: row.ink_hex, imageUrl: `/paletas/${encodeURIComponent(row.flavour_id)}.webp` }
    answers.value = survey.data.map(row => ({ question: row.prompt, answer: row.answer_text ?? 'No answer provided.' }))
    status.value = 'ready'
  } catch { status.value = 'error' }
}
onMounted(() => { readMarkers(); void load(); void refreshUnread(); document.addEventListener('visibilitychange', onVisibility); refreshTimer = setInterval(() => { void refreshUnread() }, 30000) })
onUnmounted(() => { refreshVersion++; document.title = 'Kris Kringle'; document.removeEventListener('visibilitychange', onVisibility); if (refreshTimer) clearInterval(refreshTimer) })
</script>
<template>
  <section
    v-if="status === 'loading'"
    class="welcome"
    role="status"
  >
    <p>Loading your flavour...</p>
  </section>
  <section
    v-else-if="status === 'error'"
    class="welcome"
  >
    <h1>Couldn't load your flavour</h1><p>Please try again.</p><AppButton @click="load">
      Try again
    </AppButton><button
      class="text-button"
      type="button"
      @click="emit('signOut')"
    >
      Sign out
    </button>
  </section>
  <template v-else-if="flavour">
    <FlavourHome
      v-if="page === 'home'"
      :flavour="flavour"
      christmas-at="2026-12-11T13:00:00Z"
      :answers="answers"
      :unread-flavour="unreadFlavour"
      :unread-santa="unreadSanta"
      :santa-chat-started="latestIncoming.to_santa > 0"
      @flavour-chat="page = 'flavourChat'"
      @santa-chat="page = 'santaChat'"
    />
    <ChatView
      v-else-if="page === 'flavourChat' || page === 'santaChat'"
      :key="page"
      :direction="page === 'flavourChat' ? 'to_flavour' : 'to_santa'"
      :flavour-name="flavour.name"
      :hero-hex="flavour.heroHex"
      :ink-hex="flavour.inkHex"
      :closed="phase === 'closed'"
      @back="page = 'home'"
      @read="markRead"
    />
    <div
      v-if="page === 'home'"
      class="setup-signout post-signout"
    >
      <button
        class="text-button"
        type="button"
        @click="emit('signOut')"
      >
        Sign out
      </button>
    </div>
  </template>
</template>
