<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import AppButton from './AppButton.vue'
import { pushPublicKey } from '../lib/push-public-key'

const publicKey = pushPublicKey
const state = ref<'hidden' | 'available' | 'enabled' | 'blocked' | 'install' | 'saving' | 'error'>('hidden')
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
  } catch { state.value = 'error' }
}
onMounted(async () => {
  if (!publicKey || !('serviceWorker' in navigator)) return
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !standalone) { state.value = 'install'; return }
  if (!('PushManager' in window) || !('Notification' in window)) return
  if (Notification.permission === 'denied') { state.value = 'blocked'; return }
  state.value = 'available'
  if (Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) { await saveSubscription(subscription); state.value = 'enabled' }
    } catch { state.value = 'error' }
  }
})
</script>

<template>
  <section
    v-if="state !== 'hidden'"
    class="notification-opt-in"
    aria-label="Message notifications"
  >
    <template v-if="state === 'enabled'">
      <strong>Message notifications are on</strong>
      <p>We'll notify this device when a new message arrives.</p>
    </template>
    <template v-else-if="state === 'install'">
      <strong>Get message notifications on your iPhone</strong>
      <p>In Safari, tap Share, then Add to Home Screen. Open the installed app to enable notifications.</p>
    </template>
    <template v-else-if="state === 'blocked'">
      <strong>Notifications are blocked</strong>
      <p>Allow notifications in your browser or device settings to get message alerts.</p>
    </template>
    <template v-else>
      <strong>Don't miss a message</strong>
      <p>Get a notification on this device, even when the app is closed.</p>
      <AppButton
        variant="dark"
        :loading="state === 'saving'"
        @click="enable"
      >
        Enable notifications
      </AppButton>
      <p
        v-if="state === 'error'"
        role="alert"
      >
        Couldn't enable notifications. Please try again.
      </p>
    </template>
  </section>
</template>
