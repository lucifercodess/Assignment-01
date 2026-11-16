import { useEffect, useRef, useState } from 'react'
import { CATEGORIES, categorize, catById } from '../lib/categorize'
import { parseMany, parseUpiQr, upiLink, prettyMerchant } from '../lib/parser'
import { money, dayKey, timeLabel, dayLabel, haptic } from '../lib/utils'
import { Sheet, Btn, Field, inputCls, CatIcon } from './ui'

function CategoryPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => { haptic(); onChange(c.id) }}
          className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-medium transition ${value === c.id ? 'bg-accent/15 text-ink ring-2 ring-accent' : 'bg-sunken text-muted'}`}
        >
          <span className="text-xl">{c.emoji}</span>
          {c.label.split(' ')[0]}
        </button>
      ))}
    </div>
  )
}

function AmountInput({ value, onChange, autoFocus }) {
  return (
    <div className="flex items-center justify-center gap-1 py-3">
      <span className="text-3xl font-semibold text-muted">₹</span>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        style={{ width: `${Math.max(1, value.length) + 0.6}ch` }}
        className="num max-w-[80%] bg-transparent text-left text-5xl font-semibold outline-none placeholder:text-line"
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
      <div className="mx-auto mt-1 grid w-60 grid-cols-2 rounded-full bg-sunken p-1 text-sm font-semibold">
        {[['debit', 'Spent'], ['credit', 'Received']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setType(v)} className={`rounded-full py-1.5 transition ${type === v ? (v === 'credit' ? 'bg-surface text-good shadow' : 'bg-surface text-ink shadow') : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      <AmountInput value={amount} onChange={setAmount} autoFocus={!expense && !draft} />
      <div className="space-y-4">
        {draft?.raw && (
          <div className="rounded-2xl bg-sunken p-3 text-xs text-muted">
            <p className="mb-1 font-semibold text-ink">From your bank</p>
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
          <details className="rounded-2xl bg-sunken p-3 text-xs text-muted">
            <summary className="cursor-pointer font-medium">Original bank message</summary>
            <p className="mt-2 whitespace-pre-wrap break-words">{expense.raw}</p>
          </details>
        )}
        {expense?.ref && <p className="text-xs text-muted">UPI ref: <span className="num">{expense.ref}</span>{expense.verified && ' · ✓ confirmed by bank SMS'}</p>}
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
        <div className="relative mb-4 overflow-hidden rounded-3xl bg-black">
          <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
          <div className="pointer-events-none absolute inset-10 rounded-3xl border-4 border-white/80" />
          <button onClick={stopScan} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-black">Cancel</button>
        </div>
      ) : (
        <button onClick={startScan} className="mb-4 flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line py-5 font-semibold text-accent active:bg-sunken">
          <span className="text-2xl">⌗</span> Scan QR code
        </button>
      )}
      {err && <p className="mb-3 text-sm text-warn">{err}</p>}
      <AmountInput value={amount} onChange={setAmount} />
      <div className="space-y-4">
        <Field label="UPI ID">
          <input className={inputCls} placeholder="merchant@okaxis" autoCapitalize="off" autoCorrect="off" value={pa} onChange={(e) => setPa(e.target.value.trim())} />
        </Field>
        {pn && <p className="-mt-2 text-sm">Paying <b>{pn}</b></p>}
        <Field label="Category">
          <CategoryPicker value={category} onChange={(c) => { setTouchedCat(true); setCategory(c) }} />
        </Field>
        <Field label="Note">
          <input className={inputCls} placeholder="optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Btn className="w-full" disabled={!valid} onClick={pay}>Pay {parseFloat(amount) ? money(parseFloat(amount), true) : ''} → opens your UPI app</Btn>
        <p className="text-center text-xs text-muted">GPay / PhonePe / Paytm opens with details filled. You enter your PIN there — this app never sees it.</p>
      </div>
    </Sheet>
  )
}

/* ---------------- Paste / share bank SMS ---------------- */
export function PasteSheet({ open, onClose, onImport, initialText }) {
  const [text, setText] = useState('')
  useEffect(() => { if (open) setText(initialText || '') }, [open, initialText])
  const parsed = parseMany(text)

  const pasteClip = async () => {
    try { setText(await navigator.clipboard.readText()) } catch { /* ignore */ }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Import bank SMS">
      <p className="mb-3 text-sm text-muted">Long-press bank messages in Messages → Copy (or Share → Tripwise). Paste one or many — duplicates are skipped.</p>
      <textarea
        className={`${inputCls} h-36 resize-none py-3 text-sm`}
        placeholder="Rs.450.00 debited from A/c XX1234 to VPA swiggy@icici UPI Ref 4321…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <Btn variant="soft" className="h-10 flex-1 text-sm" onClick={pasteClip}>📋 Paste</Btn>
        {text && <Btn variant="soft" className="h-10 text-sm" onClick={() => setText('')}>Clear</Btn>}
      </div>
      {parsed.length > 0 && (
        <ul className="mt-4 space-y-2">
          {parsed.map((p, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl bg-sunken p-3 animate-pop">
              <CatIcon id={p.type === 'credit' ? 'other' : categorize(p.merchant, {}, p.vpa || '')} size="h-9 w-9 text-lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.merchant}</div>
                <div className="text-xs text-muted">{dayLabel(p.date)} · {p.method}{p.ref ? ` · ${p.ref}` : ''}</div>
              </div>
              <div className={`num font-semibold ${p.type === 'credit' ? 'text-good' : ''}`}>{p.type === 'credit' ? '+' : ''}{money(p.amount, true)}</div>
            </li>
          ))}
        </ul>
      )}
      {text && !parsed.length && <p className="mt-4 text-sm text-warn">Couldn’t find a completed payment in that text.</p>}
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
          <div className="flex items-center gap-3 rounded-2xl bg-sunken p-4">
            <CatIcon id={pending.category} />
            <div className="flex-1">
              <div className="font-semibold">{pending.merchant}</div>
              <div className="text-xs text-muted">{pending.vpa} · {timeLabel(pending.at)}</div>
            </div>
            <div className="num text-lg font-semibold">{money(pending.amount, true)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Btn variant="soft" onClick={onCancel}>No, cancelled</Btn>
            <Btn onClick={onConfirm}>Yes, paid ✓</Btn>
          </div>
          <button className="w-full text-center text-sm text-accent" onClick={() => (window.location.href = pending.link)}>Open UPI app again</button>
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
  const [emoji, setEmoji] = useState(trip?.emoji || '🏝️')
  const EMO = ['🏝️', '🏔️', '🏙️', '🕌', '🏕️', '✈️', '🚗', '🌴']
  const ok = name.trim() && start && end && end >= start
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); ok && onSave({ name: name.trim(), budget: parseFloat(budget) || 0, start, end, emoji }) }}>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {EMO.map((x) => (
          <button type="button" key={x} onClick={() => setEmoji(x)} className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl ${emoji === x ? 'bg-accent/15 ring-2 ring-accent' : 'bg-sunken'}`}>{x}</button>
        ))}
      </div>
      <Field label="Trip name"><input className={inputCls} placeholder="Goa with friends" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Budget (₹)" hint="Used for daily limits and pace alerts. Leave empty to just track.">
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
      <p className="mb-4 text-sm text-muted">These bank messages mention money but couldn’t be read automatically. Nothing is skipped silently — check each one.</p>
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id} className="rounded-2xl bg-sunken p-4 animate-pop">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-warn">{r.reason}</span>
              <span className="shrink-0 text-muted">{dayLabel(r.ts)} · {timeLabel(r.ts)}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm">{r.text}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {/lite/i.test(r.reason) ? (
                <>
                  <Btn variant="soft" className="h-10 text-sm" onClick={() => onAdd(r)}>Count as spent</Btn>
                  <Btn className="h-10 text-sm" onClick={() => onDismiss(r.id)}>Ignore top-up</Btn>
                </>
              ) : (
                <>
                  <Btn variant="soft" className="h-10 text-sm" onClick={() => onDismiss(r.id)}>Not an expense</Btn>
                  <Btn className="h-10 text-sm" onClick={() => onAdd(r)}>Add{r.amount ? ` ${money(r.amount, true)}` : ''}</Btn>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!items.length && <p className="py-10 text-center text-muted">All clear ✓</p>}
    </Sheet>
  )
}
