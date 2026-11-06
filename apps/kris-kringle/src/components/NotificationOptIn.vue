<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import { pushPublicKey } from '../lib/push-public-key'

const publicKey = pushPublicKey
const state = ref<'hidden' | 'available' | 'enabled' | 'blocked' | 'install' | 'saving' | 'error'>('hidden')
const showHelp = ref(false)
function activate() {
  if (state.value === 'install' || state.value === 'blocked') showHelp.value = !showHelp.value
  else void enable()
}
function applicationKey(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), char => char.charCodeAt(0))
}
async function saveSubscription(subscription: PushSubscription) {
  if (!supabase) throw new Error('No connection')
  const { data } = await supabase.auth.getSession()
  const keys = subscription.toJSON().keys
  if (!data.session || !keys?.p256dh || !keys.auth) throw new Error('Missing subscription')
  const result = await supabase.from('push_subs').upsert({
    member_id: data.session.user.id, endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth,
  }, { onConflict: 'endpoint' })
  if (result.error) throw result.error
}
async function enable() {
  // Ask only from this button click, before awaiting any other work (required on iOS).
  state.value = 'saving'
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') { state.value = permission === 'denied' ? 'blocked' : 'available'; return }
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
      userVisibleOnly: true, applicationServerKey: applicationKey(publicKey!),
    })
    await saveSubscription(subscription)
    state.value = 'enabled'
  } catch { state.value = 'error'; showHelp.value = true }
}
onMounted(async () => {
  if (!publicKey || !('serviceWorker' in navigator)) return
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !standalone) { state.value = 'install'; return }
  if (!('PushManager' in window) || !('Notification' in window)) return
  if (Notification.permission === 'denied') { state.value = 'blocked'; return }
  if (Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        state.value = 'enabled'
        await saveSubscription(subscription)
        return
      }
    } catch {
      // Keep an already enabled device out of the way; sync again next visit.
      if (state.value === 'enabled') return
    }
  }
  state.value = 'available'
})
</script>

<template>
  <section
    v-if="state !== 'hidden' && state !== 'enabled'"
    class="notification-opt-in"
    aria-label="Message notifications"
  >
    <button
      class="notification-toggle"
      type="button"
      :disabled="state === 'saving'"
      :aria-label="state === 'blocked' ? 'Notification settings' : 'Enable notifications'"
      :aria-expanded="state === 'install' || state === 'blocked' ? showHelp : undefined"
      @click="activate"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </svg>
      {{ state === 'saving' ? 'Enabling…' : 'Notifications' }}
    </button>
    <p
      v-if="showHelp && state === 'install'"
      class="notification-hint"
    >
      Add to Home Screen in Safari, then enable notifications in the app.
    </p>
    <p
      v-else-if="showHelp && state === 'blocked'"
      class="notification-hint"
    >
      Allow notifications in your browser settings.
    </p>
    <p
      v-else-if="showHelp && state === 'error'"
      class="notification-hint"
      role="alert"
    >
      Couldn't enable. Tap to retry.
    </p>
  </section>
</template>
