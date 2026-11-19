import { useEffect, useRef, useState } from 'react'
import { CATEGORIES, categorize, catById } from '../lib/categorize'
import { parseMany, parseMessage, parseUpiQr, upiLink, prettyMerchant } from '../lib/parser'
import { money, dayKey, timeLabel, dayLabel, haptic } from '../lib/utils'
import { ScanLine, ClipboardPaste, ExternalLink, FileUp } from 'lucide-react'
import { Sheet, Btn, Field, inputCls, CatIcon, CAT_ICONS } from './ui'

function CategoryPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => { haptic(); onChange(c.id) }}
          className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-[12px] font-medium transition ${value === c.id ? 'border-ink bg-ink text-[var(--bg)]' : 'border-line text-muted'}`}
        >
          {(() => { const I = CAT_ICONS[c.id]; return <I size={19} strokeWidth={1.9} style={{ color: value === c.id ? 'inherit' : `var(--c-${c.id})` }} /> })()}
          {c.label.split(' ')[0]}
        </button>
      ))}
    </div>
  )
}

function AmountInput({ value, onChange, autoFocus }) {
  return (
    <div className="flex items-center justify-center gap-1 py-5">
      <span className="text-[34px] font-medium text-muted">₹</span>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        style={{ width: `${Math.max(1, value.length) + 0.6}ch` }}
        className="num display max-w-[80%] bg-transparent text-left text-[56px] outline-none placeholder:text-line"
      />
    </div>
  )
}

/* ---------------- Manual add / edit ---------------- */
export function ExpenseSheet({ open, onClose, learned, expense, draft, onSave, onDelete }) {
  const [type, setType] = useState('debit')
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [category, setCategory] = useState('food')
  const [touchedCat, setTouchedCat] = useState(false)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(dayKey(Date.now()))

  useEffect(() => {
    if (!open) return
    const src = expense || draft
    setAmount(src?.amount ? String(src.amount) : '')
    setMerchant(src?.merchant || '')
    setCategory(src?.category || 'food')
    setTouchedCat(!!expense)
    setNote(src?.note || '')
    setDate(dayKey(src?.date || Date.now()))
    setType(src?.type || 'debit')
  }, [open, expense, draft])

  // smart: guess category as you type
  useEffect(() => {
    if (!touchedCat && merchant.length > 2) {
      const g = categorize(merchant, learned, note)
      if (g !== 'other') setCategory(g)
    }
  }, [merchant, note, touchedCat, learned])

  const save = () => {
    const amt = parseFloat(amount)
    if (!amt) return
    const keepTime = expense ? new Date(expense.date) : new Date()
    const d = new Date(date + 'T00:00')
    d.setHours(keepTime.getHours(), keepTime.getMinutes())
    onSave({ amount: amt, type, merchant: merchant.trim() || (type === 'credit' ? 'Money received' : catById[category].label), category: type === 'credit' ? 'other' : category, note: note.trim(), date: d.toISOString() })
    haptic(15)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={expense ? 'Edit entry' : draft ? 'Review & add' : 'Add entry'}>
      <div className="grid grid-cols-2 rounded-2xl bg-sunken p-1 text-[14px] font-semibold">
        {[['debit', 'Spent'], ['credit', 'Received']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setType(v)} className={`h-10 rounded-[12px] transition ${type === v ? `bg-surface shadow-sm ${v === 'credit' ? 'text-good' : 'text-ink'}` : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      <AmountInput value={amount} onChange={setAmount} autoFocus={!expense && !draft} />
      <div className="space-y-4">
        {draft?.raw && (
          <div className="rounded-2xl bg-sunken p-4 text-[13px] leading-relaxed text-muted">
            <p className="eyebrow mb-1.5">From your bank</p>
            <p className="whitespace-pre-wrap break-words">{draft.raw}</p>
          </div>
        )}
        <Field label={type === 'credit' ? 'From whom / why' : 'Where / what'}>
          <input className={inputCls} placeholder={type === 'credit' ? 'e.g. Rahul paid back for hotel' : 'e.g. Beach shack lunch'} value={merchant} onChange={(e) => setMerchant(e.target.value)} />
        </Field>
        {type === 'debit' && (
          <Field label="Category">
            <CategoryPicker value={category} onChange={(c) => { setTouchedCat(true); setCategory(c) }} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note">
            <input className={inputCls} placeholder="optional" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        {expense?.raw && !draft && (
          <details className="rounded-2xl bg-sunken p-4 text-[13px] text-muted">
            <summary className="cursor-pointer font-medium">Original bank message</summary>
            <p className="mt-2 whitespace-pre-wrap break-words">{expense.raw}</p>
          </details>
        )}
        {expense?.ref && <p className="text-xs text-muted">UPI ref: <span className="num">{expense.ref}</span>{expense.verified && ' · confirmed by bank SMS'}</p>}
        <Btn className="w-full" onClick={save} disabled={!parseFloat(amount)}>{expense ? 'Save changes' : type === 'credit' ? 'Add money received' : 'Add expense'}</Btn>
        {expense && <Btn variant="danger" className="w-full" onClick={() => { onDelete(expense.id); onClose() }}>Delete</Btn>}
      </div>
    </Sheet>
  )
}

/* ---------------- Pay via UPI ---------------- */
export function PaySheet({ open, onClose, learned, onPay, initialQr }) {
  const [pa, setPa] = useState('')
  const [pn, setPn] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('food')
  const [touchedCat, setTouchedCat] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [err, setErr] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const applyQr = (q) => {
    setPa(q.pa || '')
    setPn(q.pn || '')
    if (q.am) setAmount(String(parseFloat(q.am)))
    if (q.tn) setNote(q.tn)
  }

  useEffect(() => {
    if (!open) { stopScan(); return }
    setPa(''); setPn(''); setAmount(''); setNote(''); setErr(''); setTouchedCat(false); setCategory('food')
    if (initialQr) applyQr(initialQr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!touchedCat) {
      const g = categorize(pn || prettyMerchant(pa), learned, `${pa} ${note}`)
      setCategory(g === 'other' && !pa ? 'food' : g)
    }
  }, [pa, pn, note, touchedCat, learned])

  function stopScan() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  async function startScan() {
    setErr('')
    if (!('BarcodeDetector' in window)) {
      setErr('QR scanning needs Chrome on Android. You can type the UPI ID instead.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setScanning(true)
      await new Promise((r) => setTimeout(r, 50))
      const v = videoRef.current
      v.srcObject = stream
      await v.play()
      const det = new window.BarcodeDetector({ formats: ['qr_code'] })
      const tick = async () => {
        if (!streamRef.current) return
        try {
          const codes = await det.detect(v)
          const q = codes.map((c) => parseUpiQr(c.rawValue)).find(Boolean)
          if (q) { haptic(30); applyQr(q); stopScan(); return }
        } catch { /* keep trying */ }
        requestAnimationFrame(tick)
      }
      tick()
    } catch {
      setErr('Camera permission denied.')
      stopScan()
    }
  }

  const valid = /^[\w.-]+@[\w]+$/.test(pa.trim()) && parseFloat(amount) > 0

  const pay = () => {
    const amt = parseFloat(amount)
    const merchant = pn.trim() || prettyMerchant(pa.trim())
    const link = upiLink({ pa: pa.trim(), pn: merchant, am: amt, tn: note || 'Trip expense' })
    onPay({ amount: amt, merchant, vpa: pa.trim(), category, note: note.trim(), link })
    stopScan()
  }

  return (
    <Sheet open={open} onClose={() => { stopScan(); onClose() }} title="Pay with UPI">
      {scanning ? (
        <div className="relative mb-4 overflow-hidden rounded-[22px] bg-black">
          <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
          <div className="pointer-events-none absolute inset-12 rounded-[22px] border-2 border-white/90" />
          <button onClick={stopScan} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-black">Cancel</button>
        </div>
      ) : (
        <button onClick={startScan} className="flex w-full items-center gap-4 rounded-[22px] bg-accent p-5 text-left text-[var(--accent-ink)] active:opacity-90">
          <ScanLine size={30} strokeWidth={1.7} />
          <span className="flex-1"><span className="block text-[16px] font-semibold">Scan QR code</span><span className="block text-[13px] opacity-75">Any shop’s UPI QR</span></span>
        </button>
      )}
      {err && <p className="mt-3 text-[13.5px] text-warn">{err}</p>}
      <AmountInput value={amount} onChange={setAmount} />
      <div className="space-y-4">
        <Field label="UPI ID">
          <input className={inputCls} placeholder="merchant@okaxis" autoCapitalize="off" autoCorrect="off" value={pa} onChange={(e) => setPa(e.target.value.trim())} />
        </Field>
        {pn && <p className="-mt-2 text-[14px] text-muted">Paying <b className="text-ink">{pn}</b></p>}
        <Field label="Category">
          <CategoryPicker value={category} onChange={(c) => { setTouchedCat(true); setCategory(c) }} />
        </Field>
        <Field label="Note">
          <input className={inputCls} placeholder="optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Btn className="w-full" disabled={!valid} onClick={pay}>Pay {parseFloat(amount) ? money(parseFloat(amount), true) : ''} <ExternalLink size={16} /></Btn>
        <p className="text-center text-[12.5px] leading-relaxed text-muted">Opens GPay, PhonePe or Paytm with the details filled in. You enter your PIN there; this app never sees it.</p>
      </div>
    </Sheet>
  )
}

/* ---------------- Paste / share bank SMS ---------------- */
/** Read an "SMS Backup & Restore" XML file: received SMS since the trip started. */
function parseBackup(xml, sinceMs) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const out = []
  for (const el of doc.getElementsByTagName('sms')) {
    const date = Number(el.getAttribute('date')) || 0
    const type = el.getAttribute('type')
    if (date < sinceMs || (type && type !== '1')) continue
    const p = parseMessage(el.getAttribute('body') || '', date)
    if (p) out.push(p)
  }
  return out.sort((a, b) => +new Date(b.date) - +new Date(a.date))
}

export function PasteSheet({ open, onClose, onImport, initialText, tripStart }) {
  const [text, setText] = useState('')
  const [fromFile, setFromFile] = useState(null)
  const fileRef = useRef(null)
  useEffect(() => { if (open) { setText(initialText || ''); setFromFile(null) } }, [open, initialText])
  const parsed = fromFile || parseMany(text)

  const readFile = async (f) => {
    const sinceMs = tripStart ? +new Date(tripStart + 'T00:00') : 0
    try { setFromFile(parseBackup(await f.text(), sinceMs)); setText('') } catch { setFromFile([]) }
  }

  const pasteClip = async () => {
    try { setText(await navigator.clipboard.readText()) } catch { /* ignore */ }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Import bank SMS">
      <p className="mb-4 text-[14px] leading-relaxed text-muted">In Messages, long-press bank SMS and copy (or Share → Tripwise). Paste one or many; duplicates are skipped.</p>
      <textarea
        className={`${inputCls} h-36 resize-none py-3 text-sm`}
        placeholder="Rs.450.00 debited from A/c XX1234 to VPA swiggy@icici UPI Ref 4321…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <Btn variant="soft" className="h-11 flex-1 text-[14px]" onClick={pasteClip}><ClipboardPaste size={16} /> Paste from clipboard</Btn>
        {(text || fromFile) && <Btn variant="soft" className="h-11 text-[14px]" onClick={() => { setText(''); setFromFile(null) }}>Clear</Btn>}
      </div>
      <Btn variant="soft" className="mt-2 h-11 w-full text-[14px]" onClick={() => fileRef.current.click()}><FileUp size={16} /> Import SMS backup file (.xml)</Btn>
      <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" hidden onChange={(e) => e.target.files[0] && readFile(e.target.files[0])} />
      {fromFile && <p className="mt-3 text-[13.5px] text-muted">Found <b className="text-ink">{fromFile.length}</b> payment{fromFile.length === 1 ? '' : 's'} since your trip started.</p>}
      <div className="hidden">
      </div>
      {parsed.length > 0 && (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[22px] border border-line">
          {parsed.map((p, i) => (
            <li key={i} className="flex items-center gap-3 p-3.5 animate-pop">
              <CatIcon id={categorize(p.merchant, {}, p.vpa || '')} credit={p.type === 'credit'} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{p.merchant}</div>
                <div className="text-[12.5px] text-muted">{dayLabel(p.date)} · {p.method}{p.ref ? ` · ${p.ref}` : ''}</div>
              </div>
              <div className={`num font-semibold ${p.type === 'credit' ? 'text-good' : ''}`}>{p.type === 'credit' ? '+' : ''}{money(p.amount, true)}</div>
            </li>
          ))}
        </ul>
      )}
      {(text || fromFile) && !parsed.length && <p className="mt-4 text-[13.5px] text-warn">Couldn’t find a completed payment in that text.</p>}
      <Btn className="mt-4 w-full" disabled={!parsed.length} onClick={() => { onImport(parsed); onClose() }}>
        Add {parsed.length || ''} {parsed.length === 1 ? 'entry' : 'entries'}
      </Btn>
    </Sheet>
  )
}

/* ---------------- Confirm a UPI payment after returning ---------------- */
export function ConfirmSheet({ pending, onConfirm, onCancel }) {
  return (
    <Sheet open={!!pending} onClose={onCancel} title="Did the payment go through?">
      {pending && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-[22px] border border-line p-4">
            <CatIcon id={pending.category} />
            <div className="flex-1">
              <div className="font-semibold">{pending.merchant}</div>
              <div className="text-[12.5px] text-muted">{pending.vpa} · {timeLabel(pending.at)}</div>
            </div>
            <div className="num text-lg font-semibold">{money(pending.amount, true)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Btn variant="soft" onClick={onCancel}>No, cancelled</Btn>
            <Btn onClick={onConfirm}>Yes, paid</Btn>
          </div>
          <button className="w-full text-center text-[14px] font-medium text-accent" onClick={() => (window.location.href = pending.link)}>Open UPI app again</button>
        </div>
      )}
    </Sheet>
  )
}

/* ---------------- Create / edit trip ---------------- */
export function TripForm({ trip, onSave, submitLabel = 'Start trip' }) {
  const t0 = dayKey(Date.now())
  const [name, setName] = useState(trip?.name || '')
  const [budget, setBudget] = useState(trip?.budget ? String(trip.budget) : '')
  const [start, setStart] = useState(trip?.start || t0)
  const [end, setEnd] = useState(trip?.end || dayKey(Date.now() + 4 * 864e5))
  const ok = name.trim() && start && end && end >= start
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); ok && onSave({ name: name.trim(), budget: parseFloat(budget) || 0, start, end }) }}>
      <Field label="Trip name"><input className={inputCls} placeholder="Goa with friends" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Budget (₹)" hint="Powers daily limits and pace alerts. Optional.">
        <input className={inputCls} inputMode="numeric" placeholder="25000" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ''))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From"><input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="To"><input type="date" className={inputCls} value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <Btn className="w-full" disabled={!ok}>{submitLabel}</Btn>
    </form>
  )
}

/* ---------------- SMS that need a human look ---------------- */
export function ReviewSheet({ open, onClose, items, onAdd, onDismiss }) {
  return (
    <Sheet open={open} onClose={onClose} title="Needs your review">
      <p className="mb-4 text-[14px] leading-relaxed text-muted">These bank messages mention money but couldn’t be read automatically, so they’re here instead of being skipped.</p>
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id} className="rounded-[22px] border border-line p-4 animate-pop">
            <div className="mb-2 flex items-start justify-between gap-3 text-[12.5px]">
              <span className="font-semibold text-warn">{r.reason}</span>
              <span className="shrink-0 text-muted">{dayLabel(r.ts)} · {timeLabel(r.ts)}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{r.text}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {/lite/i.test(r.reason) ? (
                <>
                  <Btn variant="soft" className="h-11 text-[14px]" onClick={() => onAdd(r)}>Count as spent</Btn>
                  <Btn className="h-11 text-[14px]" onClick={() => onDismiss(r.id)}>Ignore top-up</Btn>
                </>
              ) : (
                <>
                  <Btn variant="soft" className="h-11 text-[14px]" onClick={() => onDismiss(r.id)}>Not an expense</Btn>
                  <Btn className="h-11 text-[14px]" onClick={() => onAdd(r)}>Add{r.amount ? ` ${money(r.amount, true)}` : ''}</Btn>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!items.length && <p className="py-10 text-center text-muted">All clear</p>}
    </Sheet>
  )
}
