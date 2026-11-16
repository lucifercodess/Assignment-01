import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './lib/store'
import { tripStats, haptic } from './lib/utils'
import { parseUpiQr, parseMessage } from './lib/parser'
import { Home, Activity, Settings } from './components/Screens'
import { ExpenseSheet, PaySheet, PasteSheet, ConfirmSheet, TripForm, ReviewSheet } from './components/Sheets'
import { Sheet, Toast } from './components/ui'

export default function App() {
  const [state, actions] = useStore()
  const [tab, setTab] = useState('home')
  const [sheet, setSheet] = useState(null) // 'menu' | 'add' | 'pay' | 'paste' | 'trips' | 'newtrip'
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(null)
  const [shared, setShared] = useState({ text: '', qr: null })
  const [filter, setFilter] = useState(null)
  const [toastMsg, setToastMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const toastT = useRef()

  const toast = useCallback((m) => {
    setToastMsg(m)
    clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToastMsg(''), 2600)
  }, [])

  const trip = state.trips.find((t) => t.id === state.activeTripId)
  const stats = useMemo(() => trip && tripStats(trip, state.expenses, state.settings.includeCredits), [trip, state.expenses, state.settings.includeCredits])
  const review = state.review.filter((r) => !trip || r.tripId === trip.id)

  const sync = useCallback(async (quiet) => {
    if (!state.settings.syncKey) return
    setSyncing(true)
    try {
      const { added, review: rv } = await actions.sync()
      if (added || rv) {
        haptic(20)
        toast([added && `⚡ ${added} new payment${added > 1 ? 's' : ''} added`, rv && `${rv} need${rv > 1 ? '' : 's'} review`].filter(Boolean).join(' · '))
      }
      else if (!quiet) toast('Up to date')
    } catch (e) { if (!quiet) toast(e.message) }
    setSyncing(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.syncKey, state.activeTripId])

  // Auto-sync on open and whenever the app comes back to the foreground
  useEffect(() => {
    if (!trip) return
    sync(true)
    const onVis = () => document.visibilityState === 'visible' && sync(true)
    document.addEventListener('visibilitychange', onVis)
    const iv = setInterval(() => document.visibilityState === 'visible' && sync(true), 60000)
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(iv) }
  }, [trip?.id, sync]) // eslint-disable-line react-hooks/exhaustive-deps

  // Android share target (Messages → Share → Tripwise) and app shortcuts
  useEffect(() => {
    const p = new URLSearchParams(location.search)
    const text = [p.get('text'), p.get('title'), p.get('url')].filter(Boolean).join('\n')
    if (text) {
      const qr = parseUpiQr(text.trim())
      if (qr) { setShared({ text: '', qr }); setSheet('pay') }
      else { setShared({ text, qr: null }); setSheet('paste') }
    }
    const a = p.get('action')
    if (a === 'pay' || a === 'add' || a === 'paste') setSheet(a)
    if (text || a) history.replaceState(null, '', '/')
  }, [])

  if (!trip) {
    return (
      <div className="mx-auto min-h-dvh max-w-md px-5 pt-safe">
        <div className="pb-6 pt-10">
          <div className="text-5xl">🧳</div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Tripwise</h1>
          <p className="mt-2 text-muted">Track every rupee of your trip. Pay with UPI, or let your bank SMS log expenses for you.</p>
        </div>
        <div className="rounded-3xl bg-surface p-5"><TripForm onSave={actions.createTrip} /></div>
      </div>
    )
  }

  const openEdit = (e) => { setEditing(e); setSheet('add') }
  const closeSheet = () => { setSheet(null); setEditing(null); setDraft(null); setShared({ text: '', qr: null }) }
  const reviewAdd = (r) => {
    const p = parseMessage(r.text, r.ts)
    setDraft({ amount: r.amount, raw: r.text, date: new Date(r.ts).toISOString(), reviewId: r.id, type: p?.type || (/credited|received|refund/i.test(r.text) ? 'credit' : 'debit'), merchant: p?.merchant && p.merchant !== 'Unknown' ? p.merchant : '' })
    setSheet('add')
  }

  const onPay = (p) => {
    actions.setPending({ ...p, at: Date.now() })
    setSheet(null)
    window.location.href = p.link
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <header className="sticky top-0 z-30 bg-bg/85 px-4 pb-3 pt-safe backdrop-blur-lg">
        <button onClick={() => setSheet('trips')} className="flex items-center gap-2 text-left">
          <span className="text-2xl">{trip.emoji}</span>
          <span>
            <span className="block text-xs text-muted">{tab === 'home' ? 'Your trip' : tab === 'activity' ? 'All expenses' : 'Settings'}</span>
            <span className="flex items-center gap-1 text-lg font-bold leading-tight">{trip.name} <span className="text-sm text-muted">▾</span></span>
          </span>
        </button>
      </header>

      <main className="px-4 pb-32">
        {tab === 'home' && (
          <Home
            trip={trip} stats={stats} onEdit={openEdit}
            onSeeAll={() => setTab('activity')}
            onPickCat={(c) => { setFilter(c); setTab('activity') }}
            syncing={syncing} onSync={() => sync(false)}
            autoOn={!!state.settings.syncKey} onSetupAuto={() => setTab('settings')}
            lastSms={state.settings.lastInboxTs} reviewCount={review.length} onReview={() => setSheet('review')}
          />
        )}
        {tab === 'activity' && <Activity stats={stats} onEdit={openEdit} filter={filter} setFilter={setFilter} />}
        {tab === 'settings' && <Settings state={state} actions={actions} trip={trip} stats={stats} toast={toast} onSync={() => sync(false)} />}
      </main>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md pb-safe">
        <div className="relative mx-3 mb-3 flex items-center justify-around rounded-[28px] bg-surface/90 px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,.12)] backdrop-blur-lg">
          {[['home', '◉', 'Home'], ['activity', '☰', 'Expenses']].map(([id, ic, l]) => (
            <NavBtn key={id} active={tab === id} onClick={() => setTab(id)} icon={ic} label={l} />
          ))}
          <button
            onClick={() => { haptic(); setSheet('menu') }}
            className="-mt-8 grid h-16 w-16 place-items-center rounded-full bg-accent text-3xl font-light text-white shadow-lg shadow-accent/40 active:scale-95"
            aria-label="Add expense"
          >＋</button>
          <NavBtn active={false} onClick={() => setSheet('pay')} icon="₹" label="Pay" />
          <NavBtn active={tab === 'settings'} onClick={() => setTab('settings')} icon="⚙" label="Settings" />
        </div>
      </nav>

      {/* Add menu */}
      <Sheet open={sheet === 'menu'} onClose={closeSheet} title="Add an expense">
        <div className="space-y-2">
          <MenuItem icon="📷" title="Pay with UPI" sub="Scan a QR, pay in GPay/PhonePe — logged automatically" onClick={() => setSheet('pay')} />
          <MenuItem icon="✍️" title="Add manually" sub="Cash, card, or anything else" onClick={() => setSheet('add')} />
          <MenuItem icon="💬" title="Import bank SMS" sub="Paste or share messages — we read them for you" onClick={() => setSheet('paste')} />
        </div>
      </Sheet>

      <ExpenseSheet
        open={sheet === 'add'} onClose={() => (draft ? setSheet('review') : closeSheet())} learned={state.learned} expense={editing} draft={draft}
        onSave={(e) => {
          if (editing) return actions.updateExpense(editing.id, e)
          if (draft) {
            actions.addExpense({ ...e, raw: draft.raw, source: 'sms' })
            actions.dismissReview(draft.reviewId)
            setDraft(null)
            setTimeout(() => setSheet(review.length > 1 ? 'review' : null), 0)
            return
          }
          actions.addExpense(e)
        }}
        onDelete={(id) => { actions.deleteExpense(id); toast('Deleted') }}
      />
      <PaySheet open={sheet === 'pay'} onClose={closeSheet} learned={state.learned} onPay={onPay} initialQr={shared.qr} />
      <PasteSheet
        open={sheet === 'paste'} onClose={closeSheet} initialText={shared.text}
        onImport={(list) => { const n = actions.importParsed(list, 'sms'); toast(n ? `Added ${n} entr${n > 1 ? 'ies' : 'y'}` : 'Already added — no duplicates') }}
      />
      <ConfirmSheet
        pending={sheet ? null : state.pending}
        onConfirm={() => {
          const p = state.pending
          actions.addExpense({ amount: p.amount, merchant: p.merchant, vpa: p.vpa, category: p.category, note: p.note, date: new Date(p.at).toISOString(), source: 'upi', method: 'UPI' })
          actions.setPending(null); haptic(20); toast('Payment logged ✓')
        }}
        onCancel={() => actions.setPending(null)}
      />

      <ReviewSheet open={sheet === 'review'} onClose={closeSheet} items={review} onAdd={reviewAdd} onDismiss={actions.dismissReview} />

      {/* Trip switcher */}
      <Sheet open={sheet === 'trips'} onClose={closeSheet} title="Your trips">
        <div className="space-y-2">
          {state.trips.map((t) => (
            <button key={t.id} onClick={() => { actions.setActiveTrip(t.id); closeSheet() }}
              className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${t.id === trip.id ? 'bg-accent/10 ring-2 ring-accent' : 'bg-sunken'}`}>
              <span className="text-2xl">{t.emoji}</span>
              <span className="flex-1"><b>{t.name}</b><br /><span className="text-xs text-muted">{t.start} → {t.end}</span></span>
            </button>
          ))}
          <button onClick={() => setSheet('newtrip')} className="w-full rounded-2xl border-2 border-dashed border-line p-3 font-semibold text-accent">＋ New trip</button>
        </div>
      </Sheet>
      <Sheet open={sheet === 'newtrip'} onClose={closeSheet} title="New trip">
        <TripForm onSave={(t) => { actions.createTrip(t); closeSheet(); setTab('home') }} />
      </Sheet>

      <Toast msg={toastMsg} />
    </div>
  )
}

function NavBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex w-14 flex-col items-center gap-0.5 py-1 text-[11px] font-medium ${active ? 'text-accent' : 'text-muted'}`}>
      <span className="text-lg leading-none">{icon}</span>{label}
    </button>
  )
}

function MenuItem({ icon, title, sub, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-2xl bg-sunken p-4 text-left active:brightness-95">
      <span className="text-2xl">{icon}</span>
      <span className="flex-1"><b>{title}</b><br /><span className="text-sm text-muted">{sub}</span></span>
      <span className="text-muted">›</span>
    </button>
  )
}

