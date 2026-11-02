<template>
  <div
    class="paleta-row"
    aria-hidden="true"
  >
    <span
      v-for="colour in ['#C2185B', '#FF9E00', '#7CB342', '#3949AB', '#F4511E']"
      :key="colour"
      class="paleta"
      :style="{ background: colour }"
    />
  </div>
</template>
