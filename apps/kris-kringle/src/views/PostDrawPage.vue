<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import AppButton from '../components/AppButton.vue'
import BottomNav from '../components/BottomNav.vue'
import FlavourHome from './FlavourHome.vue'
import FlavourSurvey from './FlavourSurvey.vue'
import ChatView from './ChatView.vue'

defineProps<{ phase: string }>()
const emit = defineEmits<{ signOut: [] }>()
type Flavour = { name: string; heroHex: string; inkHex: string; imageUrl: string }
const flavour = ref<Flavour | null>(null)
const answers = ref<{ question: string; answer: string }[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const page = ref<'home' | 'survey' | 'chats' | 'flavourChat' | 'santaChat' | 'missions'>('home')
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
function select(tab: 'home' | 'chats' | 'missions') { page.value = tab }
onMounted(() => { void load() })
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
      christmas-at="2026-12-24T13:00:00Z"
      @survey="page = 'survey'"
      @flavour-chat="page = 'flavourChat'"
      @santa-chat="page = 'santaChat'"
    />
    <FlavourSurvey
      v-else-if="page === 'survey'"
      :answers="answers"
      @back="page = 'home'"
    />
    <ChatView
      v-else-if="page === 'flavourChat' || page === 'santaChat'"
      :key="page"
      :direction="page === 'flavourChat' ? 'to_flavour' : 'to_santa'"
      :flavour-name="flavour.name"
      :hero-hex="flavour.heroHex"
      :ink-hex="flavour.inkHex"
      :closed="phase === 'closed'"
      @back="page = 'chats'"
    />
    <section
      v-else-if="page === 'chats'"
      class="flavour-home"
    >
      <h1>Chats</h1><AppButton @click="page = 'flavourChat'">
        Chat with {{ flavour.name }}
      </AppButton><AppButton
        variant="secondary"
        @click="page = 'santaChat'"
      >
        Chat with Your Santa
      </AppButton>
    </section>
    <section
      v-else
      class="flavour-home"
    >
      <h1>Missions</h1><p>Missions are coming soon.</p>
    </section>
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
    <BottomNav
      :active="page === 'missions' ? 'missions' : page === 'chats' || page === 'flavourChat' || page === 'santaChat' ? 'chats' : 'home'"
      @select="select"
    />
  </template>
</template>
