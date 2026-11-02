<script setup lang="ts">
defineProps<{ active: 'home' | 'chats' | 'missions'; unread?: boolean }>()
const emit = defineEmits<{ select: [tab: 'home' | 'chats' | 'missions'] }>()
const items = [{ id: 'home', label: 'Home' }, { id: 'chats', label: 'Chats' }, { id: 'missions', label: 'Missions' }] as const
</script>
<template>
  <nav
    class="bottom-nav"
    aria-label="Main navigation"
  >
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      :aria-current="active === item.id ? 'page' : undefined"
      @click="emit('select', item.id)"
    >
      <span
        class="nav-icon"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <template v-if="item.id === 'home'"><path d="M7 12V7a5 5 0 0 1 10 0v5a5 5 0 0 1-10 0Z" /><path d="M12 17v5" /></template>
          <template v-else-if="item.id === 'chats'"><path d="M4 5h13a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-5 3V8a3 3 0 0 1 3-3" /><path d="M8 10h8M8 13h5" /></template>
          <path
            v-else
            d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"
          />
        </svg><span
          v-if="item.id === 'chats' && unread"
          class="unread-dot"
        />
      </span>{{ item.label }}
    </button>
  </nav>
</template>
