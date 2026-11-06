<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import WelcomeView from './views/WelcomeView.vue'
import ChooseNameView from './views/ChooseNameView.vue'
import AppButton from './components/AppButton.vue'
import SetupPage from './views/SetupPage.vue'
import NotificationOptIn from './components/NotificationOptIn.vue'

const auth = useAuthStore()
onMounted(() => { void auth.initialize() })
</script>

<template>
  <main class="app-shell">
    <div
      v-if="auth.status === 'member'"
      class="app-tools"
    >
      <NotificationOptIn />
    </div>
    <WelcomeView
      v-if="auth.status === 'signed-out' || auth.status === 'unavailable'"
      :available="auth.status === 'signed-out'"
      @sign-in="auth.signIn()"
    />
    <ChooseNameView
      v-else-if="auth.status === 'choose-name'"
      @claimed="auth.retry()"
      @sign-out="auth.signOut()"
    />
    <section
      v-else-if="auth.status === 'error'"
      class="welcome"
    >
      <h1>Couldn't connect</h1>
      <p>We couldn't check your account. Please try again.</p>
      <AppButton @click="auth.retry()">
        Try again
      </AppButton>
      <button
        class="text-button"
        type="button"
        @click="auth.signOut()"
      >
        Sign out
      </button>
    </section>
    <SetupPage
      v-else-if="auth.status === 'member'"
      :user-id="auth.userId"
      @sign-out="auth.signOut()"
    />
    <section
      v-else
      class="welcome"
      role="status"
    >
      <p>Checking your account...</p>
    </section>
  </main>
</template>
