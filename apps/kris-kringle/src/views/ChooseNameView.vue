<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import AppButton from '../components/AppButton.vue'

const emit = defineEmits<{ claimed: []; signOut: [] }>()
type Entry = { id: string; name: string; claimed: boolean }
const status = ref<'loading' | 'ready' | 'error'>('loading')
const entries = ref<Entry[]>([])
const selected = ref('')
const confirming = ref(false)
const saving = ref(false)
const message = ref('')
const selectedName = computed(() => entries.value.find(entry => entry.id === selected.value)?.name ?? '')
const available = computed(() => entries.value.some(entry => !entry.claimed))

const errors: Record<string, string> = {
  name_taken: 'Someone has just claimed that name. Please choose again.',
  already_claimed: 'This account has already claimed a name.',
  not_found: 'That name is no longer on the list. Please choose again.',
  draw_done: 'The draw has already happened, so new players can no longer join.',
  not_confirmed: 'Your sign-in email has not been confirmed.',
}

async function load() {
  if (!supabase) { status.value = 'error'; return }
  status.value = 'loading'
  try {
    const { data, error } = await supabase.rpc('list_roster')
    if (error) throw error
    entries.value = data
    if (!data.some(entry => entry.id === selected.value && !entry.claimed)) selected.value = ''
    status.value = 'ready'
  } catch { status.value = 'error' }
}

async function claim() {
  if (!supabase || !selected.value) return
  saving.value = true
  message.value = ''
  try {
    const { error } = await supabase.rpc('claim_roster_name', { p_roster_id: selected.value })
    if (error) {
      message.value = errors[error.message] ?? 'Could not save your choice. Please try again.'
      confirming.value = false
      if (error.message === 'already_claimed') { emit('claimed'); return }
      await load()
      return
    }
    emit('claimed')
  } catch {
    message.value = 'Could not save your choice. Please try again.'
  } finally {
    saving.value = false
  }
}

onMounted(() => { void load() })
</script>

<template>
  <section
    v-if="status === 'loading'"
    class="welcome"
    role="status"
  >
    <p>Loading the family list...</p>
  </section>
  <section
    v-else-if="status === 'error'"
    class="welcome"
  >
    <h1>Couldn't load the list</h1>
    <p>Please check your connection and try again.</p>
    <AppButton @click="load">
      Try again
    </AppButton>
    <button
      class="text-button"
      type="button"
      @click="emit('signOut')"
    >
      Sign out
    </button>
  </section>
  <section
    v-else-if="confirming"
    class="wizard"
  >
    <h1>Are you {{ selectedName }}?</h1>
    <p>Once you choose a name, nobody else can claim it, and you can't change it yourself. Ask the organiser if you pick the wrong one.</p>
    <AppButton
      :loading="saving"
      @click="claim"
    >
      Yes, I'm {{ selectedName }}
    </AppButton>
    <button
      class="text-button"
      type="button"
      :disabled="saving"
      @click="confirming = false"
    >
      Back
    </button>
  </section>
  <section
    v-else
    class="wizard"
  >
    <h1>Who are you?</h1>
    <p>Pick your name from the family list.</p>
    <p
      v-if="message"
      role="alert"
    >
      {{ message }}
    </p>
    <label
      v-for="entry in entries"
      :key="entry.id"
      class="choice"
      :class="{ 'choice--taken': entry.claimed }"
    ><input
      v-model="selected"
      type="radio"
      name="roster"
      :value="entry.id"
      :disabled="entry.claimed"
    > {{ entry.name }}<span v-if="entry.claimed"> (already taken)</span></label>
    <p v-if="!available">
      Every name has been taken. If yours is missing, check with the organiser.
    </p>
    <AppButton
      :disabled="!selected"
      @click="confirming = true"
    >
      Continue
    </AppButton>
    <p class="helper">
      Not on the list? Check with the organiser.
    </p>
    <button
      class="text-button"
      type="button"
      @click="emit('signOut')"
    >
      Sign out
    </button>
  </section>
</template>
