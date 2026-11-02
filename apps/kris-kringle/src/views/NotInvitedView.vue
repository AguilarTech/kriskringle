<script setup lang="ts">
import PaletaRow from '../components/PaletaRow.vue'
import AppButton from '../components/AppButton.vue'

defineProps<{ email?: string }>()
const emit = defineEmits<{ signOut: [] }>()
</script>

<template>
  <section class="welcome">
    <PaletaRow />
    <h1>Not on the list?</h1>
    <p class="tagline">
      <template v-if="email">
        {{ email }} isn't on the family allowlist.
      </template>
      <template v-else>
        This account isn't on the family allowlist.
      </template>
    </p>
    <AppButton
      variant="dark"
      @click="emit('signOut')"
    >
      Sign out / try another account
    </AppButton>
    <p class="helper">
      If you think this is a mistake, check with the organiser.
    </p>
  </section>
</template>
