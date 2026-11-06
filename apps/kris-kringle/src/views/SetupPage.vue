<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import SetupWizard from './SetupWizard.vue'
import AppButton from '../components/AppButton.vue'
import PostDrawPage from './PostDrawPage.vue'

const props = defineProps<{ userId: string }>()
const emit = defineEmits<{ signOut: [] }>()
type Member = { id: string; name: string }
type Question = { id: string; text: string }
const status = ref<'loading' | 'ready' | 'error'>('loading')
const phase = ref('setup')
const drawAt = ref('')
const members = ref<Member[]>([])
const questions = ref<Question[]>([])
const exclusions = ref<string[]>([])
const answers = ref<Record<string, string>>({})
const wizard = ref<InstanceType<typeof SetupWizard> | null>(null)

async function load() {
  if (!supabase) { status.value = 'error'; return }
  status.value = 'loading'
  try {
    const [state, people, questionRows, exclusionRows, answerRows] = await Promise.all([
      supabase.from('app_state').select('phase, draw_at').eq('id', 1).single(),
      supabase.rpc('list_exclusion_options'),
      supabase.from('questions').select('id, prompt').order('sort_order'),
      supabase.from('exclusions').select('excluded_id').eq('member_id', props.userId),
      supabase.from('answers').select('question_id, answer_text').eq('member_id', props.userId),
    ])
    if (state.error || !state.data.draw_at || people.error || questionRows.error || exclusionRows.error || answerRows.error) throw new Error('Setup load failed')
    phase.value = state.data.phase
    drawAt.value = state.data.draw_at
    members.value = people.data
    questions.value = questionRows.data.map(row => ({ id: String(row.id), text: row.prompt }))
    exclusions.value = exclusionRows.data.map(row => row.excluded_id)
    answers.value = Object.fromEntries(answerRows.data.map(row => [String(row.question_id), row.answer_text]))
    status.value = 'ready'
  } catch { status.value = 'error' }
}
async function saveExclusions(ids: string[]) {
  if (!supabase) throw new Error('No connection')
  const current = await supabase.from('exclusions').select('excluded_id').eq('member_id', props.userId)
  if (current.error) throw current.error
  const existing = current.data.map(row => row.excluded_id)
  const remove = existing.filter(id => !ids.includes(id))
  const add = ids.filter(id => !existing.includes(id))
  if (remove.length) {
    const result = await supabase.from('exclusions').delete().eq('member_id', props.userId).in('excluded_id', remove)
    if (result.error) throw result.error
  }
  if (add.length) {
    const result = await supabase.from('exclusions').insert(add.map(id => ({ member_id: props.userId, excluded_id: id })))
    if (result.error) throw result.error
  }
}
async function saveAnswers(values: Record<string, string>) {
  if (!supabase) throw new Error('No connection')
  const rows = Object.entries(values).map(([id, answer]) => ({ member_id: props.userId, question_id: Number(id), answer_text: answer, updated_at: new Date().toISOString() }))
  if (!rows.length) return
  const result = await supabase.from('answers').upsert(rows, { onConflict: 'member_id,question_id' })
  if (result.error) throw result.error
}
async function signOut() {
  try { await wizard.value?.flush(); emit('signOut') } catch { /* The wizard displays its save error. */ }
}
onMounted(() => { void load() })
</script>

<template>
  <section
    v-if="status === 'loading'"
    class="welcome"
    role="status"
  >
    <p>Loading your setup...</p>
  </section>
  <section
    v-else-if="status === 'error'"
    class="welcome"
  >
    <h1>Couldn't load setup</h1><p>Please check your connection and try again.</p>
    <AppButton @click="load">
      Try again
    </AppButton>
    <button
      class="text-button"
      type="button"
      @click="signOut"
    >
      Sign out
    </button>
  </section>
  <template v-else-if="phase === 'setup'">
    <SetupWizard
      ref="wizard"
      :members="members"
      :questions="questions"
      :initial-exclusions="exclusions"
      :initial-answers="answers"
      :draw-at="drawAt"
      :save-exclusions="saveExclusions"
      :save-answers="saveAnswers"
    />
    <div class="setup-signout">
      <button
        class="text-button"
        type="button"
        @click="signOut"
      >
        Sign out
      </button>
    </div>
  </template>
  <PostDrawPage
    v-else
    :phase="phase"
    :user-id="userId"
    @sign-out="signOut"
  />
</template>
