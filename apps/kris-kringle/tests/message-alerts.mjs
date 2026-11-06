// Run with: node tests/message-alerts.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
try {
  const { default: Home } = await server.ssrLoadModule('/src/views/FlavourHome.vue')
  const base = { flavour: { name: 'Mango', heroHex: '#FFB627', inkHex: '#1E1310' }, christmasAt: '2026-12-12T00:00:00Z', answers: [], unreadFlavourCount: 0, unreadSantaCount: 0, santaChatStarted: false }
  const render = props => renderToString(createSSRApp(Home, { ...base, ...props }))
  const waiting = await render({})
  assert.match(waiting, /disabled[^>]*aria-describedby="santa-first-message"/)
  assert.match(waiting, /Your Santa will message you first/)
  const unread = await render({ unreadSantaCount: 2, unreadFlavourCount: 1, santaChatStarted: true })
  assert.match(unread, /3<\/span> messages waiting/)
  assert.match(unread, /Read message from Your Santa/)
  assert.match(unread, /Read reply from Mango/)
  assert.match(unread, /2 NEW/)
  assert.match(unread, /1 NEW/)
  const read = await render({ santaChatStarted: true })
  assert.doesNotMatch(read, /class="inbox-notice"/)
  assert.doesNotMatch(read, /santa-first-message/)
  assert.match(read, /Reply to Your Santa/)
  console.log('PASS: waiting for Santa, prominent counts, changed chat buttons, and read state')
} finally { await server.close() }

const handlers = new Map()
const shown = []
const opened = []
const navigated = []
let windows = []
let badged = false
const context = {
  URL,
  self: {
    addEventListener: (name, handler) => handlers.set(name, handler),
    registration: { showNotification: async (...args) => shown.push(args) },
    location: { origin: 'https://kringle.example' },
    navigator: { setAppBadge: async () => { badged = true } },
  },
  clients: { matchAll: async () => windows, openWindow: async url => opened.push(url) },
}
vm.runInNewContext(await fs.readFile(new URL('../public/push-events.js', import.meta.url), 'utf8'), context)
const pending = []
handlers.get('push')({ data: { json: () => ({ title: 'New message', body: 'Your Secret Santa sent you a message.', url: '/chats/santa' }) }, waitUntil: task => pending.push(task) })
await Promise.all(pending)
assert.equal(shown[0][0], 'New message')
assert.equal(shown[0][1].data.url, '/chats/santa')
assert.equal(badged, true)
const click = () => handlers.get('notificationclick')({ notification: { close() {}, data: { url: '/chats/santa' } }, waitUntil: task => pending.push(task) })
click()
await Promise.all(pending)
assert.deepEqual(opened, ['https://kringle.example/chats/santa'])
windows = [{ url: 'https://kringle.example/', navigate: async url => navigated.push(url), focus: async () => {} }]
click()
await Promise.all(pending)
assert.deepEqual(navigated, ['https://kringle.example/chats/santa'])
console.log('PASS: push notification, app badge, and opening the correct conversation')
