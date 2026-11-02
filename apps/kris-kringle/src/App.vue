<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import WelcomeView from './views/WelcomeView.vue'
import NotInvitedView from './views/NotInvitedView.vue'
import AppButton from './components/AppButton.vue'
import SetupPage from './views/SetupPage.vue'

const auth = useAuthStore()
onMounted(() => { void auth.initialize() })
</script>

<template>
  <main class="app-shell">
    <WelcomeView
      v-if="auth.status === 'signed-out' || auth.status === 'unavailable'"
      :available="auth.status === 'signed-out'"
      @sign-in="auth.signIn()"
    />
    <NotInvitedView
      v-else-if="auth.status === 'not-invited'"
      :email="auth.email"
      @sign-out="auth.signOut()"
    />
    <section
      v-else-if="auth.status === 'error'"
      class="welcome"
    >
      <h1>Couldn't connect</h1>
      <p>We couldn't check your invitation. Please try again.</p>
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
      <p>Checking your invitation...</p>
    </section>
  </main>
</template>
