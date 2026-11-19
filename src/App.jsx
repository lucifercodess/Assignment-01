import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './lib/store'
import { tripStats, haptic } from './lib/utils'
import { parseUpiQr, parseMessage } from './lib/parser'
import { Home, Activity, Settings } from './components/Screens'
import { ExpenseSheet, PaySheet, PasteSheet, ConfirmSheet, TripForm, ReviewSheet } from './components/Sheets'
import { House, List, Settings as Cog, Plus, IndianRupee, ScanLine, PenLine, MessageSquareText, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { Sheet, Toast, Btn } from './components/ui'

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
        toast([added && `${added} new payment${added > 1 ? 's' : ''} added`, rv && `${rv} need${rv > 1 ? '' : 's'} review`].filter(Boolean).join(' · '))
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
    // one-tap setup link: /?key=SECRET saves the auto-capture key on this phone
    const k = p.get('key')
    if (k) { actions.setSettings({ syncKey: k, lastSync: 0 }); setTimeout(() => toast('Auto-capture connected'), 300) }
    if (text || a || k) history.replaceState(null, '', '/')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!trip) {
    return (
      <div className="mx-auto min-h-dvh max-w-md px-5 pb-10 pt-safe">
        <div className="pb-8 pt-12">
          <div className="eyebrow">Tripwise</div>
          <h1 className="display mt-4 text-[44px]">Every rupee of your trip, tracked.</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-muted">Pay with UPI from here, or let your bank SMS log expenses for you. No typing.</p>
        </div>
        <div className="rounded-[22px] border border-line bg-surface p-5"><TripForm onSave={actions.createTrip} /></div>
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
      <header className="sticky top-0 z-30 bg-bg/90 px-5 pb-3 pt-safe backdrop-blur-md">
        <button onClick={() => setSheet('trips')} className="flex items-center gap-1.5 text-left">
          <span className="text-[17px] font-semibold tracking-tight">{trip.name}</span>
          <ChevronDown size={17} className="text-muted" />
        </button>
        {tab !== 'home' && <h1 className="display mt-4 text-[34px]">{tab === 'activity' ? 'Expenses' : 'Settings'}</h1>}
      </header>

      <main className="px-4 pb-36 pt-1">
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
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 pb-safe pt-1.5">
          <NavBtn active={tab === 'home'} onClick={() => setTab('home')} icon={House} label="Home" />
          <NavBtn active={tab === 'activity'} onClick={() => setTab('activity')} icon={List} label="Expenses" />
          <button
            onClick={() => { haptic(); setSheet('menu') }}
            className="mx-1 flex h-12 items-center gap-1.5 rounded-full bg-accent px-5 text-[15px] font-semibold text-[var(--accent-ink)] active:opacity-90"
            aria-label="Add expense"
          ><Plus size={19} strokeWidth={2.4} /> Add</button>
          <NavBtn active={false} onClick={() => setSheet('pay')} icon={IndianRupee} label="Pay" />
          <NavBtn active={tab === 'settings'} onClick={() => setTab('settings')} icon={Cog} label="Settings" />
        </div>
      </nav>

      {/* Add menu */}
      <Sheet open={sheet === 'menu'} onClose={closeSheet} title="Add">
        <div className="divide-y divide-line overflow-hidden rounded-[22px] border border-line">
          <MenuItem icon={ScanLine} title="Pay with UPI" sub="Scan a QR and pay. Logged automatically." onClick={() => setSheet('pay')} />
          <MenuItem icon={PenLine} title="Add manually" sub="Cash, card, or money received" onClick={() => setSheet('add')} />
          <MenuItem icon={MessageSquareText} title="Import bank SMS" sub="Paste messages; we read them for you" onClick={() => setSheet('paste')} />
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
        open={sheet === 'paste'} onClose={closeSheet} initialText={shared.text} tripStart={trip.start}
        onImport={(list) => { const n = actions.importParsed(list, 'sms'); toast(n ? `Added ${n} entr${n > 1 ? 'ies' : 'y'}` : 'Already added — no duplicates') }}
      />
      <ConfirmSheet
        pending={sheet ? null : state.pending}
        onConfirm={() => {
          const p = state.pending
          actions.addExpense({ amount: p.amount, merchant: p.merchant, vpa: p.vpa, category: p.category, note: p.note, date: new Date(p.at).toISOString(), source: 'upi', method: 'UPI' })
          actions.setPending(null); haptic(20); toast('Payment logged')
        }}
        onCancel={() => actions.setPending(null)}
      />

      <ReviewSheet open={sheet === 'review'} onClose={closeSheet} items={review} onAdd={reviewAdd} onDismiss={actions.dismissReview} />

      {/* Trip switcher */}
      <Sheet open={sheet === 'trips'} onClose={closeSheet} title="Your trips">
        <div className="divide-y divide-line overflow-hidden rounded-[22px] border border-line">
          {state.trips.map((t) => (
            <button key={t.id} onClick={() => { actions.setActiveTrip(t.id); closeSheet() }} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-sunken">
              <span className="flex-1"><span className="block text-[15px] font-semibold">{t.name}</span><span className="text-[12.5px] text-muted">{fmtRange(t.start, t.end)}</span></span>
              {t.id === trip.id && <Check size={18} className="text-accent" />}
            </button>
          ))}
        </div>
        <Btn variant="soft" className="mt-3 w-full" onClick={() => setSheet('newtrip')}><Plus size={17} /> New trip</Btn>
      </Sheet>
      <Sheet open={sheet === 'newtrip'} onClose={closeSheet} title="New trip">
        <TripForm onSave={(t) => { actions.createTrip(t); closeSheet(); setTab('home') }} />
      </Sheet>

      <Toast msg={toastMsg} />
    </div>
  )
}

function NavBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={`flex w-14 flex-col items-center gap-1 py-1.5 text-[11px] font-medium ${active ? 'text-ink' : 'text-muted'}`}>
      <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />{label}
    </button>
  )
}

function MenuItem({ icon: Icon, title, sub, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 px-4 py-4 text-left active:bg-sunken">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--accent-soft)] text-accent"><Icon size={19} strokeWidth={1.9} /></span>
      <span className="flex-1"><span className="block text-[15px] font-semibold">{title}</span><span className="block text-[13px] text-muted">{sub}</span></span>
      <ChevronRight size={18} className="text-muted" />
    </button>
  )
}

function fmtRange(a, b) {
  const f = (d) => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return `${f(a)} – ${f(b)}`
}

