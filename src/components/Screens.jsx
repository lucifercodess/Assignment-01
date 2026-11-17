import { useMemo, useRef, useState } from 'react'
import { Search, Zap, TriangleAlert, TrendingUp, Check, Sparkles, ChevronRight, Copy, Download, Upload, Trash2, RefreshCw } from 'lucide-react'
import { CATEGORIES, catById } from '../lib/categorize'
import { money, dayKey, dayLabel, timeLabel, insights, toCSV, download, ago } from '../lib/utils'
import { DailyChart, CategoryBreakdown } from './Charts'
import { CatIcon, Btn, Field, inputCls, Row } from './ui'
import { TripForm } from './Sheets'

const SOURCE_LABEL = { auto: 'Auto', upi: 'UPI', sms: 'SMS', manual: '' }

export function ExpenseRow({ e, onClick }) {
  const credit = e.type === 'credit'
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3.5 px-4 py-3 text-left active:bg-sunken">
      <CatIcon id={e.category} credit={credit} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{e.merchant}</div>
        <div className="truncate text-[12.5px] text-muted">
          {credit ? 'Received' : catById[e.category]?.label} · {timeLabel(e.date)}
          {SOURCE_LABEL[e.source] && ` · ${SOURCE_LABEL[e.source]}`}
          {e.note && ` · ${e.note}`}
        </div>
      </div>
      <div className={`num shrink-0 text-[15px] font-semibold ${credit ? 'text-good' : ''}`}>{credit ? '+' : ''}{money(e.amount, true)}</div>
    </button>
  )
}

function Section({ title, action, children, flush }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h3 className="eyebrow">{title}</h3>
        {action}
      </div>
      <div className={`overflow-hidden rounded-[22px] border border-line bg-surface ${flush ? '' : 'p-5'}`}>{children}</div>
    </section>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div className="min-w-0 flex-1 px-3 first:pl-0 last:pr-0">
      <div className="truncate text-[12.5px] text-muted">{label}</div>
      <div className={`num truncate text-[19px] font-semibold tracking-tight ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : ''}`}>{value}</div>
    </div>
  )
}

const TIP_ICON = { bad: TriangleAlert, warn: TrendingUp, good: Check, info: Sparkles }
const TIP_COLOR = { bad: 'var(--bad)', warn: 'var(--warn)', good: 'var(--good)', info: 'var(--muted)' }

/* ---------------- Home ---------------- */
export function Home({ trip, stats, onEdit, onSeeAll, onPickCat, syncing, onSync, autoOn, onSetupAuto, lastSms, reviewCount, onReview }) {
  const pct = stats.budget ? Math.min(1, stats.spent / stats.budget) : 0
  const pace = stats.notStarted ? 0 : stats.dayNum / stats.totalDays
  const tips = insights(stats)
  const recent = [...stats.list].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 5)
  const remaining = stats.budget - stats.spent
  const fill = pct >= 1 ? 'var(--bad)' : stats.budget && stats.projected > stats.budget * 1.05 ? 'var(--warn)' : 'var(--accent)'

  return (
    <div className="space-y-7">
      {/* Hero */}
      <section className="px-1 pt-2">
        <div className="text-[13.5px] text-muted">
          {stats.notStarted ? `Starts ${dayLabel(trip.start + 'T00:00')}` : stats.over ? 'Trip complete' : `Day ${stats.dayNum} of ${stats.totalDays}`} · spent so far
        </div>
        <div className="num display mt-2 text-[60px]">{money(stats.spent)}</div>
        <div className="mt-2 text-[14.5px] text-muted">
          {stats.budget ? <>of <span className="num text-ink">{money(stats.budget)}</span> budget</> : `${stats.count} payments`}
        </div>

        {stats.budget > 0 && (
          <div className="relative mt-5">
            <div className="h-[6px] overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: fill }} />
            </div>
            {!stats.notStarted && !stats.over && (
              <div className="absolute -top-[5px] h-4 w-[2px] rounded-full bg-ink" style={{ left: `calc(${pace * 100}% - 1px)` }} title="Where you'd be at an even pace" />
            )}
            <div className="mt-2 flex justify-between text-[12px] text-muted">
              <span className="num">{Math.round(pct * 100)}% used</span>
              {!stats.notStarted && !stats.over && <span className="num">Expected by today: {money(stats.budget * pace)}</span>}
            </div>
          </div>
        )}

        <div className="mt-6 flex divide-x divide-line border-y border-line py-4">
          {stats.budget > 0 ? (
            <>
              <Stat label={stats.over || stats.daysLeft === 0 ? 'Left over' : 'Safe today'} value={money(stats.over ? Math.max(0, remaining) : stats.safeToday)} />
              <Stat label={remaining >= 0 ? 'Remaining' : 'Over'} value={money(Math.abs(remaining))} tone={remaining < 0 ? 'bad' : undefined} />
            </>
          ) : (
            <>
              <Stat label="Today" value={money(stats.todaySpent)} />
              <Stat label="Per day" value={money(stats.avgPerDay)} />
            </>
          )}
          <Stat label="Received" value={stats.received ? `+${money(stats.received)}` : '—'} tone={stats.received ? 'good' : undefined} />
        </div>
      </section>

      {/* Status + alerts */}
      <div className="space-y-2.5">
        {reviewCount > 0 && (
          <Row icon={TriangleAlert} tone="warn" onClick={onReview}
            title={`${reviewCount} bank message${reviewCount > 1 ? 's' : ''} to review`}
            sub="Couldn’t be read automatically"
            right={<ChevronRight size={18} className="text-muted" />} />
        )}
        {autoOn ? (
          <button onClick={onSync} className="flex w-full items-center gap-2.5 px-1 text-left text-[13px] text-muted">
            <span className={`h-2 w-2 rounded-full bg-good ${syncing ? 'animate-pulse' : ''}`} />
            <span className="flex-1">Auto-capture on · {syncing ? 'checking…' : `last SMS ${ago(lastSms)}`}</span>
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          </button>
        ) : (
          <Row icon={Zap} tone="accent" onClick={onSetupAuto}
            title="Turn on auto-capture"
            sub="Bank SMS become expenses automatically"
            right={<ChevronRight size={18} className="text-muted" />} />
        )}
      </div>

      {tips.length > 0 && (
        <Section title="Insights">
          <ul className="space-y-3.5">
            {tips.map((t, i) => {
              const I = TIP_ICON[t.tone]
              return (
                <li key={i} className="flex gap-3 text-[14.5px] leading-snug">
                  <I size={17} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color: TIP_COLOR[t.tone] }} />
                  <span>{t.text}</span>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {stats.count > 0 || stats.received > 0 ? (
        <>
          {stats.count > 0 && <Section title="Daily spending"><DailyChart days={stats.days} dailyBudget={stats.dailyBudget} /></Section>}
          {stats.count > 0 && <Section title="By category"><CategoryBreakdown byCat={stats.byCat} total={stats.byCat.reduce((a, c) => a + c.total, 0)} onPick={onPickCat} /></Section>}
          <Section title="Recent" flush action={<button onClick={onSeeAll} className="text-[13px] font-semibold text-accent">See all</button>}>
            <div className="divide-y divide-line">{recent.map((e) => <ExpenseRow key={e.id} e={e} onClick={() => onEdit(e)} />)}</div>
          </Section>
        </>
      ) : (
        <div className="rounded-[22px] border border-dashed border-line px-6 py-10 text-center">
          <p className="text-[16px] font-semibold">Nothing spent yet</p>
          <p className="mx-auto mt-1.5 max-w-[260px] text-[14px] text-muted">Tap <b className="text-ink">Add</b> to pay with UPI, log cash, or import bank SMS.</p>
        </div>
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
  const total = filter === 'received'
    ? groups.reduce((a, g) => a + g.items.reduce((b, e) => b + e.amount, 0), 0)
    : groups.reduce((a, g) => a + net(g.items), 0)

  const chip = (active) => `shrink-0 h-9 rounded-full px-4 text-[13.5px] font-medium border transition ${active ? 'border-ink bg-ink text-[var(--bg)]' : 'border-line bg-surface text-ink'}`

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input className={inputCls + ' pl-11'} placeholder="Search merchant, note, amount" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button onClick={() => setFilter(null)} className={chip(!filter)}>All</button>
        <button onClick={() => setFilter(filter === 'received' ? null : 'received')} className={chip(filter === 'received')}>Received</button>
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setFilter(filter === c.id ? null : c.id)} className={chip(filter === c.id)}>{c.label}</button>
        ))}
      </div>
      {(q || filter) && <p className="px-1 text-[13.5px] text-muted">{groups.reduce((a, g) => a + g.items.length, 0)} entries · <b className="num text-ink">{money(total)}</b></p>}
      {groups.map((g) => (
        <section key={g.k}>
          <div className="mb-2 flex justify-between px-1">
            <span className="eyebrow">{dayLabel(g.date)}</span>
            <span className="num text-[12.5px] font-medium text-muted">{money(net(g.items))}</span>
          </div>
          <div className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
            {g.items.map((e) => <ExpenseRow key={e.id} e={e} onClick={() => onEdit(e)} />)}
          </div>
        </section>
      ))}
      {!groups.length && <p className="py-20 text-center text-muted">Nothing here yet.</p>}
    </div>
  )
}

/* ---------------- Settings ---------------- */
function Step({ n, children }) {
  return (
    <li className="flex gap-3.5">
      <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-[12px] font-semibold">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </li>
  )
}

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
      if (r.ok) { toast('Connected. Auto-capture is on'); setTimeout(onSync, 300) }
      else toast(j.error || `Error ${r.status}`)
    } catch { toast('Could not reach /api/ingest. Is the app deployed?') }
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
    <div className="space-y-7">
      <Section title="Auto-capture">
        <p className="mb-5 text-[14.5px] leading-relaxed text-muted">Your Pixel forwards bank SMS to this app’s private inbox, so payments made anywhere (GPay, PhonePe, card) show up on their own.</p>
        <Field label="Secret key" hint="Same value as INGEST_KEY in your Vercel project.">
          <div className="flex gap-2">
            <input className={inputCls} type="password" placeholder="your-secret-key" value={key} onChange={(e) => setKey(e.target.value)} />
            <Btn onClick={saveKey} disabled={!key.trim() || testing}>{testing ? '…' : 'Connect'}</Btn>
          </div>
        </Field>
        <ol className="mt-6 space-y-4 text-[14px] leading-relaxed">
          <Step n={1}>Install <b>SMS Forwarder</b> by bogkonstantin (free, Play Store).</Step>
          <Step n={2}>
            Add a rule with sender <b>*</b> and this webhook URL:
            <button onClick={() => copy(endpoint)} className="mt-2 flex w-full items-start gap-2 rounded-xl bg-sunken p-3 text-left font-mono text-[11.5px] leading-relaxed">
              <span className="min-w-0 flex-1 break-all">{endpoint}</span><Copy size={14} className="mt-0.5 shrink-0 text-muted" />
            </button>
            <span className="mt-1.5 block text-muted">Keep the default JSON template.</span>
          </Step>
          <Step n={3}>Pay as usual. New payments appear when you open the app.</Step>
        </ol>
      </Section>

      <Section title="So nothing gets missed">
        <ul className="space-y-3 text-[14px] leading-snug">
          <li><b>Battery:</b> <span className="text-muted">Settings → Apps → SMS Forwarder → Battery → Unrestricted</span></li>
          <li><b>UPI Lite off:</b> <span className="text-muted">Lite payments don’t send bank SMS</span></li>
          <li><b>No signal?</b> <span className="text-muted">Copy the SMS later and use Add → Import bank SMS. Duplicates are skipped.</span></li>
        </ul>
        <label className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-5 text-[14px]">
          <span><b>Subtract money received</b><br /><span className="text-[13px] text-muted">Refunds and paybacks are always recorded. Turn on to reduce your trip total by them.</span></span>
          <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--accent)]" checked={state.settings.includeCredits} onChange={(e) => actions.setSettings({ includeCredits: e.target.checked })} />
        </label>
      </Section>

      <Section title="Trip">
        <TripForm key={trip.id} trip={trip} submitLabel="Save changes" onSave={(t) => { actions.updateTrip(trip.id, t); toast('Trip saved') }} />
      </Section>

      <Section title="Data">
        <p className="mb-4 text-[14px] text-muted">Stored on this phone only.</p>
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="soft" onClick={() => download(`${trip.name}-expenses.csv`, toCSV(stats.list), 'text/csv')}><Download size={16} /> CSV</Btn>
          <Btn variant="soft" onClick={() => download('tripwise-backup.json', JSON.stringify(state), 'application/json')}><Download size={16} /> Backup</Btn>
          <Btn variant="soft" onClick={() => fileRef.current.click()}><Upload size={16} /> Restore</Btn>
          <Btn variant="danger" onClick={() => confirm(`Delete "${trip.name}" and all its expenses?`) && actions.deleteTrip(trip.id)}><Trash2 size={16} /> Delete trip</Btn>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && importJSON(e.target.files[0])} />
      </Section>
    </div>
  )
}
