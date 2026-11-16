import { useCallback, useEffect, useRef, useState } from 'react'
import { categorize, keyOf } from './categorize'
import { parseMessage, reviewReason, guessAmount } from './parser'

const KEY = 'tripwise:v1'

const initial = {
  trips: [],
  activeTripId: null,
  expenses: [],
  learned: {},
  seen: {}, // ids / refs already imported (dedupe)
  pending: null, // UPI payment awaiting confirmation
  review: [], // forwarded SMS that mention money but couldn't be read automatically
  settings: { syncKey: '', syncUrl: '/api/ingest', lastSync: 0, includeCredits: false },
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s) return { ...initial, ...s, settings: { ...initial.settings, ...s.settings } }
  } catch { /* ignore */ }
  return initial
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export function useStore() {
  const [state, setState] = useState(load)
  const ref = useRef(state)
  ref.current = state

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state])

  const update = useCallback((fn) => setState((s) => ({ ...s, ...fn(s) })), [])

  const actions = {
    createTrip(trip) {
      const t = { id: uid(), createdAt: Date.now(), ...trip }
      update((s) => ({ trips: [...s.trips, t], activeTripId: t.id }))
    },
    updateTrip(id, patch) {
      update((s) => ({ trips: s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
    },
    deleteTrip(id) {
      update((s) => {
        const trips = s.trips.filter((t) => t.id !== id)
        return { trips, expenses: s.expenses.filter((e) => e.tripId !== id), activeTripId: trips[0]?.id || null }
      })
    },
    setActiveTrip(id) { update(() => ({ activeTripId: id })) },

    addExpense(e) {
      update((s) => {
        const category = e.category || categorize(e.merchant, s.learned, e.note)
        const exp = { id: uid(), tripId: s.activeTripId, createdAt: Date.now(), date: new Date().toISOString(), source: 'manual', type: 'debit', ...e, category }
        const seen = { ...s.seen }
        if (exp.ref) seen['ref:' + exp.ref] = 1
        return { expenses: [exp, ...s.expenses], seen }
      })
    },
    updateExpense(id, patch) {
      update((s) => {
        const old = s.expenses.find((e) => e.id === id)
        const learned = { ...s.learned }
        // learn from category corrections
        if (old && patch.category && patch.category !== old.category) learned[keyOf(patch.merchant || old.merchant)] = patch.category
        return { expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)), learned }
      })
    },
    deleteExpense(id) { update((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })) },

    dismissReview(id) { update((s) => ({ review: s.review.filter((r) => r.id !== id) })) },
    setPending(p) { update(() => ({ pending: p })) },
    setSettings(patch) { update((s) => ({ settings: { ...s.settings, ...patch } })) },
    replaceAll(data) { setState({ ...initial, ...data }) },

    /** Import parsed transactions, skipping duplicates. Returns number added. */
    importParsed(list, source = 'sms') {
      const s = ref.current
      const newSeen = {}
      const has = (k) => s.seen[k] || newSeen[k]
      const fresh = []
      const linked = {}
      for (const p of list) {
        if (!p) continue
        const dk = p.ref ? 'ref:' + p.ref : null
        if ((dk && has(dk)) || (p.inboxId && has('in:' + p.inboxId))) continue
        if (dk) newSeen[dk] = 1
        if (p.inboxId) newSeen['in:' + p.inboxId] = 1
        // A payment made through the app's Pay button is already logged: link the SMS to it instead.
        const t = +new Date(p.date)
        const dup = s.expenses.find((e) => e.source === 'upi' && !e.ref && !linked[e.id] && Math.abs(e.amount - p.amount) < 0.01 && Math.abs(+new Date(e.date) - t) < 36e5 * 24)
        if (dup) { linked[dup.id] = p.ref || 'sms'; continue }
        fresh.push({
          id: uid(), tripId: s.activeTripId, createdAt: Date.now(), source,
          amount: p.amount, merchant: p.merchant, vpa: p.vpa, ref: p.ref, date: p.date,
          type: p.type, method: p.method, raw: p.raw,
          category: p.type === 'credit' ? 'other' : categorize(p.merchant, s.learned, p.vpa || ''),
        })
      }
      update((cur) => ({
        expenses: [...fresh, ...cur.expenses.map((e) => (linked[e.id] ? { ...e, ref: linked[e.id], verified: true } : e))],
        seen: { ...cur.seen, ...newSeen },
      }))
      return fresh.length
    },

    /** Pull new SMS from the /api/ingest inbox. */
    async sync() {
      const { syncKey, syncUrl, lastSync } = ref.current.settings
      if (!syncKey || !ref.current.activeTripId) return { added: 0, skipped: true }
      const trip = ref.current.trips.find((t) => t.id === ref.current.activeTripId)
      const url = `${syncUrl}${syncUrl.includes('?') ? '&' : '?'}since=${Math.max(lastSync - 6e5, 0)}`
      const r = await fetch(url, { headers: { 'X-Ingest-Key': syncKey } })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `Sync failed (${r.status})`)
      const start = trip?.start ? +new Date(trip.start + 'T00:00') : 0
      const items = (j.items || []).filter((it) => it.ts >= start)
      const parsed = []
      const review = []
      const cur = ref.current
      for (const it of items) {
        const p = parseMessage(it.text, it.ts)
        if (p) { parsed.push({ ...p, inboxId: it.id }); continue }
        const reason = reviewReason(it.text)
        if (reason && !cur.seen['in:' + it.id] && !cur.review.some((r) => r.id === it.id)) {
          review.push({ id: it.id, ts: it.ts, text: it.text, sender: it.sender, reason, amount: guessAmount(it.text), tripId: cur.activeTripId })
        }
      }
      const added = actions.importParsed(parsed, 'auto')
      const lastInboxTs = Math.max(cur.settings.lastInboxTs || 0, ...(j.items || []).map((i) => i.ts))
      update((s) => ({
        review: [...review, ...s.review],
        seen: { ...s.seen, ...Object.fromEntries(review.map((r) => ['in:' + r.id, 1])) },
        settings: { ...s.settings, lastSync: Date.now(), lastInboxTs },
      }))
      return { added, review: review.length }
    },
  }

  return [state, actions]
}

export function sameDay(a, b) {
  const x = new Date(a), y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}
