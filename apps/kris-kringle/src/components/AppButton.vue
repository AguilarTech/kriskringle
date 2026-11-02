<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'secondary' | 'dark'; loading?: boolean; disabled?: boolean }>(), { variant: 'primary', loading: false, disabled: false })
</script>
<template>
  <button
    :class="['button', `button--${variant}`]"
    :disabled="disabled || loading"
    :aria-busy="loading"
  >
    <span
      v-if="loading"
      class="spinner"
      aria-label="Loading"
    /><slot v-else />
  </button>
</template>
