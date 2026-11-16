import { useMemo, useRef, useState } from 'react'
import { CATEGORIES, catById } from '../lib/categorize'
import { money, dayKey, dayLabel, timeLabel, insights, toCSV, download, ago } from '../lib/utils'
import { DailyChart, CategoryBreakdown } from './Charts'
import { CatIcon, Btn, Field, inputCls } from './ui'
import { TripForm } from './Sheets'

const SOURCE_BADGE = { auto: '⚡ Auto', upi: 'UPI', sms: 'SMS', manual: '' }

export function ExpenseRow({ e, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-sunken">
      <CatIcon id={e.category} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{e.merchant}</div>
        <div className="truncate text-xs text-muted">
          {e.type === 'credit' ? 'Received' : catById[e.category]?.label} · {timeLabel(e.date)}
          {SOURCE_BADGE[e.source] && <span className="ml-1.5 rounded-md bg-sunken px-1.5 py-0.5 text-[10px] font-semibold">{SOURCE_BADGE[e.source]}</span>}
          {e.note && ` · ${e.note}`}
        </div>
      </div>
      <div className={`num shrink-0 font-semibold ${e.type === 'credit' ? 'text-good' : ''}`}>{e.type === 'credit' ? '+' : ''}{money(e.amount, true)}</div>
    </button>
  )
}

function Card({ children, className = '', title, action }) {
  return (
    <section className={`rounded-3xl bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,.04)] ${className}`}>
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/* ---------------- Home ---------------- */
export function Home({ trip, stats, onEdit, onSeeAll, onPickCat, syncing, onSync, autoOn, onSetupAuto, lastSms, reviewCount, onReview }) {
  const pct = stats.budget ? Math.min(1, stats.spent / stats.budget) : 0
  const tips = insights(stats)
  const recent = [...stats.list].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 6)
  const remaining = stats.budget - stats.spent

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] p-5 text-white shadow-lg">
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative">
          <div className="text-sm text-white/80">
            {stats.notStarted ? `Starts ${dayLabel(trip.start + 'T00:00')}` : stats.over ? 'Trip complete' : `Day ${stats.dayNum} of ${stats.totalDays}`}
          </div>
          <div className="num mt-1 text-4xl font-bold tracking-tight">{money(stats.spent)}</div>
          <div className="text-sm text-white/80">{stats.budget ? `spent of ${money(stats.budget)}` : `spent · ${stats.count} payments`}</div>
          {stats.received > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs">
              <span className="num font-semibold">+{money(stats.received)}</span> received
              <span className="text-white/70">· {stats.countCredits ? 'subtracted' : `net ${money(stats.gross - stats.received)}`}</span>
            </div>
          )}
          {stats.budget > 0 && (
            <>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct * 100}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/15 p-3">
                  <div className="text-xs text-white/80">{stats.over || stats.daysLeft === 0 ? 'Left over' : 'Safe to spend today'}</div>
                  <div className="num text-xl font-semibold">{money(stats.over ? Math.max(0, remaining) : stats.safeToday)}</div>
                </div>
                <div className="rounded-2xl bg-white/15 p-3">
                  <div className="text-xs text-white/80">{remaining >= 0 ? 'Remaining' : 'Over budget'}</div>
                  <div className="num text-xl font-semibold">{money(Math.abs(remaining))}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Auto-capture status */}
      {autoOn ? (
        <button onClick={onSync} className="flex w-full items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-left text-sm">
          <span className="relative flex h-2.5 w-2.5"><span className={`absolute inline-flex h-full w-full rounded-full bg-good ${syncing ? 'animate-ping' : ''}`} /><span className="relative h-2.5 w-2.5 rounded-full bg-good" /></span>
          <span className="flex-1">Auto-capture on <span className="text-muted">· {syncing ? 'checking…' : `last SMS ${ago(lastSms)}`}</span></span>
          <span className="text-accent">Refresh</span>
        </button>
      ) : (
        <button onClick={onSetupAuto} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-accent/50 bg-accent/5 px-4 py-3 text-left">
          <span className="text-2xl">⚡</span>
          <span className="flex-1 text-sm"><b>Turn on auto-capture</b><br /><span className="text-muted">Every bank SMS becomes an expense — no typing.</span></span>
          <span className="text-accent">›</span>
        </button>
      )}

      {reviewCount > 0 && (
        <button onClick={onReview} className="flex w-full items-center gap-3 rounded-2xl bg-warn/10 px-4 py-3 text-left">
          <span className="text-2xl">🔎</span>
          <span className="flex-1 text-sm"><b>{reviewCount} bank message{reviewCount > 1 ? 's' : ''} need{reviewCount > 1 ? '' : 's'} a look</b><br /><span className="text-muted">Couldn’t read automatically: tap to add or dismiss.</span></span>
          <span className="text-warn">›</span>
        </button>
      )}

      {/* Insights */}
      {tips.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
          {tips.map((t, i) => (
            <div key={i} className="w-64 shrink-0 rounded-2xl bg-surface p-4 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-lg">{t.icon}</span>
                <span className={`text-xs font-semibold uppercase tracking-wide ${t.tone === 'bad' ? 'text-bad' : t.tone === 'warn' ? 'text-warn' : t.tone === 'good' ? 'text-good' : 'text-muted'}`}>
                  {t.tone === 'bad' ? 'Alert' : t.tone === 'warn' ? 'Heads up' : t.tone === 'good' ? 'Looking good' : 'Insight'}
                </span>
              </div>
              {t.text}
            </div>
          ))}
        </div>
      )}

      {stats.count > 0 ? (
        <>
          <Card title="Daily spending"><DailyChart days={stats.days} dailyBudget={stats.dailyBudget} /></Card>
          <Card title="Where it went"><CategoryBreakdown byCat={stats.byCat} total={stats.byCat.reduce((a, c) => a + c.total, 0)} onPick={onPickCat} /></Card>
          <Card title="Recent" action={<button onClick={onSeeAll} className="text-sm font-medium text-accent">See all</button>}>
            <div className="-mx-2">{recent.map((e) => <ExpenseRow key={e.id} e={e} onClick={() => onEdit(e)} />)}</div>
          </Card>
        </>
      ) : (
        <Card className="text-center">
          <div className="text-5xl">{trip.emoji}</div>
          <p className="mt-3 font-semibold">No expenses yet</p>
          <p className="mt-1 text-sm text-muted">Tap <b>＋</b> to pay with UPI, add one by hand, or import bank SMS.</p>
        </Card>
      )}
    </div>
  )
}

/* ---------------- Activity ---------------- */
export function Activity({ stats, onEdit, filter, setFilter }) {
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const ql = q.toLowerCase()
    const list = stats.list
      .filter((e) => !filter || (filter === 'received' ? e.type === 'credit' : e.category === filter && e.type !== 'credit'))
      .filter((e) => !ql || `${e.merchant} ${e.note || ''} ${e.vpa || ''} ${e.amount}`.toLowerCase().includes(ql))
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    const g = []
    for (const e of list) {
      const k = dayKey(e.date)
      if (!g.length || g[g.length - 1].k !== k) g.push({ k, date: e.date, items: [] })
      g[g.length - 1].items.push(e)
    }
    return g
  }, [stats.list, q, filter])
  const net = (items) => items.reduce((b, e) => b + (e.type === 'credit' ? (stats.countCredits ? -e.amount : 0) : e.amount), 0)
  const total = groups.reduce((a, g) => a + net(g.items), 0)

  return (
    <div className="space-y-3">
      <input className={inputCls + ' bg-surface'} placeholder="🔍  Search merchant, note, amount" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button onClick={() => setFilter(null)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${!filter ? 'bg-ink text-surface' : 'bg-surface'}`}>All</button>
        <button onClick={() => setFilter(filter === 'received' ? null : 'received')} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${filter === 'received' ? 'bg-ink text-surface' : 'bg-surface text-good'}`}>＋ Received</button>
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setFilter(filter === c.id ? null : c.id)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${filter === c.id ? 'bg-ink text-surface' : 'bg-surface'}`}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      {(q || filter) && <p className="px-1 text-sm text-muted">Total: <b className="num text-ink">{money(filter === 'received' ? groups.reduce((a, g) => a + g.items.reduce((b, e) => b + e.amount, 0), 0) : total)}</b></p>}
      {groups.map((g) => (
        <section key={g.k} className="rounded-3xl bg-surface p-3">
          <div className="flex justify-between px-2 pb-1 text-sm">
            <span className="font-semibold">{dayLabel(g.date)}</span>
            <span className="num text-muted">{money(net(g.items))}</span>
          </div>
          {g.items.map((e) => <ExpenseRow key={e.id} e={e} onClick={() => onEdit(e)} />)}
        </section>
      ))}
      {!groups.length && <p className="py-16 text-center text-muted">Nothing here yet.</p>}
    </div>
  )
}

/* ---------------- Settings ---------------- */
export function Settings({ state, actions, trip, stats, toast, onSync }) {
  const [key, setKey] = useState(state.settings.syncKey)
  const [testing, setTesting] = useState(false)
  const fileRef = useRef(null)
  const endpoint = `${location.origin}/api/ingest?key=${encodeURIComponent(key || 'YOUR_KEY')}`

  const saveKey = async () => {
    actions.setSettings({ syncKey: key.trim(), lastSync: 0 })
    setTesting(true)
    try {
      const r = await fetch(`/api/ingest?since=${Date.now()}`, { headers: { 'X-Ingest-Key': key.trim() } })
      const j = await r.json().catch(() => ({}))
      if (r.ok) { toast('✓ Connected — auto-capture is on'); setTimeout(onSync, 300) }
      else toast(j.error || `Error ${r.status}`)
    } catch { toast('Could not reach /api/ingest — is the app deployed on Vercel?') }
    setTesting(false)
  }

  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('Copied') } catch { /* ignore */ } }

  const importJSON = async (f) => {
    try {
      const data = JSON.parse(await f.text())
      if (!Array.isArray(data.expenses)) throw new Error()
      actions.replaceAll(data)
      toast('Backup restored')
    } catch { toast('That file is not a Tripwise backup') }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-surface p-5">
        <h3 className="mb-1 font-semibold">⚡ Auto-capture from bank SMS</h3>
        <p className="mb-4 text-sm text-muted">Your Pixel forwards each bank SMS to this app’s private inbox. Payments appear here automatically — even ones made directly in GPay or PhonePe.</p>
        <Field label="Secret key" hint="Same value as INGEST_KEY in your Vercel project settings.">
          <div className="flex gap-2">
            <input className={inputCls} type="password" placeholder="your-secret-key" value={key} onChange={(e) => setKey(e.target.value)} />
            <Btn onClick={saveKey} disabled={!key.trim() || testing}>{testing ? '…' : 'Connect'}</Btn>
          </div>
        </Field>
        <ol className="mt-5 space-y-3 text-sm">
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">1</span>
            <span>Install <b>SMS Forwarder</b> (by bogkonstantin — free, open source, on Play Store) on your Pixel.</span></li>
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">2</span>
            <span>Add a forwarding rule → <b>Sender</b>: leave as <i>*</i> (or your bank’s sender) → <b>Webhook URL</b>:
              <button onClick={() => copy(endpoint)} className="mt-1.5 block w-full break-all rounded-xl bg-sunken p-2.5 text-left font-mono text-xs">{endpoint} <span className="text-accent">⧉</span></button>
              Leave the JSON template as is: the app reads the <code>text</code> field. Allow SMS permission.
            </span></li>
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">3</span>
            <span>Pay anywhere with UPI. Open this app — new payments are added and categorised. Non-payment SMS (OTPs etc.) are ignored.</span></li>
        </ol>
        <div className="mt-5 rounded-2xl bg-sunken p-4 text-sm">
          <p className="mb-2 font-semibold">So nothing gets missed</p>
          <ul className="space-y-1.5 text-muted">
            <li>🔋 Settings → Apps → SMS Forwarder → Battery → <b className="text-ink">Unrestricted</b></li>
            <li>💳 Turn off <b className="text-ink">UPI Lite</b> in GPay/PhonePe: Lite payments send no bank SMS</li>
            <li>📶 No data when an SMS arrived? Use <b className="text-ink">＋ → Import bank SMS</b>. Duplicates are skipped</li>
            <li>🔎 Messages the app can’t read appear under <b className="text-ink">Needs review</b> on Home</li>
          </ul>
        </div>
        <label className="mt-5 flex items-center justify-between gap-3 text-sm">
          <span>Subtract money received from total<br /><span className="text-xs text-muted">Refunds and friends paying you back are always recorded (in green). Turn this on to reduce your trip total by them.</span></span>
          <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={state.settings.includeCredits} onChange={(e) => actions.setSettings({ includeCredits: e.target.checked })} />
        </label>
      </section>

      <section className="rounded-3xl bg-surface p-5">
        <h3 className="mb-4 font-semibold">{trip.emoji} Trip details</h3>
        <TripForm key={trip.id} trip={trip} submitLabel="Save trip" onSave={(t) => { actions.updateTrip(trip.id, t); toast('Trip saved') }} />
      </section>

      <section className="space-y-2 rounded-3xl bg-surface p-5">
        <h3 className="mb-2 font-semibold">Your data</h3>
        <p className="mb-2 text-sm text-muted">Everything is stored on this phone only.</p>
        <Btn variant="soft" className="w-full" onClick={() => download(`${trip.name}-expenses.csv`, toCSV(stats.list), 'text/csv')}>Export CSV (Sheets / Excel)</Btn>
        <Btn variant="soft" className="w-full" onClick={() => download('tripwise-backup.json', JSON.stringify(state), 'application/json')}>Download backup</Btn>
        <Btn variant="soft" className="w-full" onClick={() => fileRef.current.click()}>Restore backup</Btn>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && importJSON(e.target.files[0])} />
        <Btn variant="danger" className="w-full" onClick={() => confirm(`Delete "${trip.name}" and all its expenses?`) && actions.deleteTrip(trip.id)}>Delete this trip</Btn>
      </section>
    </div>
  )
}
