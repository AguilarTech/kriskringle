<script setup lang="ts">
import PaletaRow from '../components/PaletaRow.vue'
import AppButton from '../components/AppButton.vue'
defineProps<{ available: boolean }>()
const emit = defineEmits<{ signIn: [] }>()
</script>
<template>
  <section class="welcome">
    <PaletaRow />
    <p class="eyebrow">
      A family Christmas tradition
    </p>
    <h1>Kris<br>Kringle <span>2026</span></h1>
    <p class="tagline">
      Double-blind. Zero spoilers. 100% paletas.
    </p>
    <AppButton
      :disabled="!available"
      @click="emit('signIn')"
    >
      Continue with Google
    </AppButton>
    <p
      v-if="!available"
      class="helper"
    >
      Sign-in is unavailable. Please check the app configuration.
    </p>
  </section>
</template>
