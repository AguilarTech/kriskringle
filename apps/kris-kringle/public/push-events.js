/* global clients */
self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data?.json() ?? {} } catch { /* Use neutral fallback text. */ }
  event.waitUntil(self.registration.showNotification(payload.title || 'New message', {
    body: payload.body || 'You have a new Kris Kringle message.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.url || 'kringle-message',
    renotify: true,
    data: { url: payload.url || '/' },
  }))
  if (self.navigator.setAppBadge) event.waitUntil(self.navigator.setAppBadge().catch(() => {}))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const destination = new URL(event.notification.data?.url || '/', self.location.origin)
  if (destination.origin !== self.location.origin) return
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (existing) { await existing.navigate(destination.href); await existing.focus() }
    else await clients.openWindow(destination.href)
  })())
})
