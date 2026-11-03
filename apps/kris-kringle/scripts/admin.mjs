// Organiser tools. Run from apps/kris-kringle; settings come from .env:
//
//   npm run admin -- status          who has signed up and finished the questions
//   npm run admin -- draw --dry-run  check the draw would work, without saving it
//   npm run admin -- draw            run the draw for real (notifies everyone)
//   npm run admin -- reset           wipe all players, answers, the draw and chats
//
// .env (gitignored) needs, next to the app's existing VITE_SUPABASE_URL:
//   SUPABASE_SECRET_KEY=<the sb_secret_... key, Project Settings > API Keys>
// Never prefix it with VITE_ or add it to Cloudflare's build variables:
// anything named VITE_* is published inside the website.
//
// Nothing here ever reads or prints who has whose flavour.

import { createInterface } from 'node:readline/promises'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Add SUPABASE_SECRET_KEY (and VITE_SUPABASE_URL) to .env (see scripts/admin.mjs).')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const MAX_PLAYERS = 13

function must({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

function melbourne(iso) {
  return new Intl.DateTimeFormat('en-AU', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Australia/Melbourne' }).format(new Date(iso))
}

async function status() {
  const [state, roster, members, questions, answers, exclusions] = await Promise.all([
    db.from('app_state').select('phase, draw_at').eq('id', 1).single().then(r => must(r, 'app_state')),
    db.from('roster').select('name, claimed_by').then(r => must(r, 'roster')),
    db.from('members').select('id, display_name').then(r => must(r, 'members')),
    db.from('questions').select('id').then(r => must(r, 'questions')),
    db.from('answers').select('member_id, answer_text').then(r => must(r, 'answers')),
    db.from('exclusions').select('member_id').then(r => must(r, 'exclusions')),
  ])

  const answered = new Map()
  for (const a of answers) if (a.answer_text.trim()) answered.set(a.member_id, (answered.get(a.member_id) ?? 0) + 1)
  const excluded = new Map()
  for (const e of exclusions) excluded.set(e.member_id, (excluded.get(e.member_id) ?? 0) + 1)
  const memberIds = new Set(members.map(m => m.id))

  const rows = roster
    .map(r => ({ name: r.name, id: r.claimed_by && memberIds.has(r.claimed_by) ? r.claimed_by : null }))
    .concat(members.filter(m => !roster.some(r => r.claimed_by === m.id)).map(m => ({ name: `${m.display_name} (not on list)`, id: m.id })))
    .sort((a, b) => a.name.localeCompare(b.name))

  console.log(`Phase: ${state.phase}`)
  console.log(`Countdown ends: ${state.draw_at ? melbourne(state.draw_at) : 'not set'} (Melbourne)\n`)
  console.table(rows.map(r => ({
    Name: r.name,
    'Signed up': r.id ? 'yes' : 'NO',
    Questions: r.id ? `${answered.get(r.id) ?? 0}/${questions.length}` : '-',
    'Excludes': r.id ? excluded.get(r.id) ?? 0 : '-',
  })))

  const signedUp = rows.filter(r => r.id)
  const done = signedUp.filter(r => (answered.get(r.id) ?? 0) >= questions.length)
  console.log(`\n${signedUp.length} of ${rows.length} signed up; ${done.length} of ${signedUp.length} have answered every question.`)
  if (signedUp.length > MAX_PLAYERS) console.log(`Warning: the draw supports at most ${MAX_PLAYERS} players.`)
  if (signedUp.length === rows.length && done.length === signedUp.length && rows.length > 0) {
    console.log('Everyone is ready. Check with: npm run admin -- draw --dry-run')
  }
}

async function draw(dryRun) {
  const response = await fetch(`${url}/functions/v1/run-draw`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(dryRun ? { dry_run: true } : {}),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error(`Draw failed (${response.status}): ${body.error ?? 'unknown error'}`)
    if (body.details) console.error(JSON.stringify(body.details, null, 2))
    process.exit(1)
  }
  if (dryRun) console.log(`The draw would work for ${body.members} players: ${body.names.join(', ')}. Nothing was saved.`)
  else console.log(`Draw done for ${body.members} players. Everyone has been notified.`)
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try { return (await rl.question(question)).trim() } finally { rl.close() }
}

async function reset() {
  console.log(`This permanently deletes, on ${url}:`)
  console.log('  every player (names on the list become free again), their answers and exclusions,')
  console.log('  the draw, all chat messages and push subscriptions, and sets the phase back to setup.')
  console.log('The family name list, questions and countdown date are kept.')
  if (await confirm('Type "reset" to continue: ') !== 'reset') { console.log('Cancelled.'); return }

  const all = '00000000-0000-0000-0000-000000000000'
  must(await db.from('messages').delete().neq('id', all), 'delete messages')
  must(await db.from('flavour_owner').delete().neq('flavour_id', ''), 'delete flavour owners')
  // Deleting members cascades to answers, exclusions, santa and push_subs,
  // and frees their roster names.
  must(await db.from('members').delete().neq('id', all), 'delete members')
  must(await db.from('app_state').update({ phase: 'setup', updated_at: new Date().toISOString() }).eq('id', 1), 'reset phase')
  console.log('Reset done. Everyone (including you) picks their name again on next sign-in.')
}

const [command, ...flags] = process.argv.slice(2)
try {
  if (command === 'status') await status()
  else if (command === 'draw') await draw(flags.includes('--dry-run'))
  else if (command === 'reset') await reset()
  else {
    console.log('Usage: npm run admin -- status | draw [--dry-run] | reset')
    process.exit(command ? 1 : 0)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
