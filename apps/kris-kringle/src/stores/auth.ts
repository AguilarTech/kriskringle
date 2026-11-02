import { defineStore } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthStatus = 'loading' | 'signed-out' | 'member' | 'not-invited' | 'error' | 'unavailable'
export const useAuthStore = defineStore('auth', {
  state: () => ({ status: 'loading' as AuthStatus, email: '', userId: '', initialized: false, generation: 0 }),
  actions: {
    async resolve(session: Session | null) {
      const generation = ++this.generation
      const alreadyMember = this.status === 'member' && this.userId === session?.user.id
      this.email = session?.user.email ?? ''
      this.userId = session?.user.id ?? ''
      if (!session) { this.status = 'signed-out'; return }
      if (!alreadyMember) this.status = 'loading'
      if (!supabase) { this.status = 'unavailable'; return }
      try {
        const claim = await supabase.rpc('claim_membership')
        if (generation !== this.generation) return
        if (claim.error) { this.status = 'error'; return }
        const member = await supabase.from('members').select('id').eq('id', session.user.id).maybeSingle()
        if (generation !== this.generation) return
        this.status = member.error ? 'error' : member.data ? 'member' : 'not-invited'
      } catch {
        if (generation === this.generation) this.status = 'error'
      }
    },
    initialize() {
      if (this.initialized) return
      this.initialized = true
      if (!supabase) { this.status = 'unavailable'; return }
      supabase.auth.onAuthStateChange((event, session) => {
        // Defer database calls until the auth callback has returned.
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          setTimeout(() => { void this.resolve(session) }, 0)
        }
      })
    },
    async retry() {
      if (!supabase) { this.status = 'unavailable'; return }
      this.status = 'loading'
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) { this.status = 'error'; return }
        await this.resolve(data.session)
      } catch { this.status = 'error' }
    },
    async signIn() {
      if (!supabase) return
      try {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
        if (error) this.status = 'error'
      } catch { this.status = 'error' }
    },
    async signOut() {
      if (!supabase) return
      try {
        const { error } = await supabase.auth.signOut()
        if (error) this.status = 'error'
        else await this.resolve(null)
      } catch { this.status = 'error' }
    },
  },
})
