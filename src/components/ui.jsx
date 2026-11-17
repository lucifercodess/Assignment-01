import { useEffect } from 'react'
import { X, UtensilsCrossed, CarTaxiFront, BedDouble, ShoppingBag, Ticket, Fuel, Receipt, Ellipsis, ArrowDownLeft } from 'lucide-react'
import { catById } from '../lib/categorize'

export const CAT_ICONS = {
  food: UtensilsCrossed, transport: CarTaxiFront, stay: BedDouble, shopping: ShoppingBag,
  fun: Ticket, fuel: Fuel, bills: Receipt, other: Ellipsis,
}

export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/45 animate-fade" onClick={onClose} />
      <div role="dialog" aria-label={title} className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-[28px] bg-surface animate-up pb-safe">
        <div className="sticky top-0 z-10 bg-surface px-5 pb-3 pt-2.5">
          <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted" aria-label="Close"><X size={17} /></button>
          </div>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}

export function Btn({ variant = 'primary', className = '', ...p }) {
  const v = {
    primary: 'bg-accent text-[var(--accent-ink)] active:opacity-90 disabled:opacity-30',
    soft: 'border border-line bg-surface text-ink active:bg-sunken',
    danger: 'border border-line text-bad active:bg-sunken',
    ghost: 'text-accent',
  }[variant]
  return <button className={`inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition ${v} ${className}`} {...p} />
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const inputCls = 'w-full h-[50px] rounded-2xl border border-line bg-surface px-4 text-[15px] outline-none transition focus:border-ink placeholder:text-muted/60'

export function CatIcon({ id, credit, size = 40 }) {
  const c = catById[id] || catById.other
  const Icon = credit ? ArrowDownLeft : CAT_ICONS[c.id]
  const color = credit ? 'var(--good)' : `var(--c-${c.id})`
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[12px]"
      style={{ width: size, height: size, color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.9} />
    </span>
  )
}

export function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),14px)] z-[60] flex justify-center px-4">
      <div className="animate-down rounded-full bg-ink px-4 py-2.5 text-[13.5px] font-medium text-[var(--bg)]">{msg}</div>
    </div>
  )
}

export function Row({ icon: Icon, title, sub, onClick, tone, right }) {
  const color = tone === 'warn' ? 'var(--warn)' : tone === 'accent' ? 'var(--accent)' : 'var(--muted)'
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3.5 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left active:bg-sunken">
      {Icon && <Icon size={19} strokeWidth={1.9} style={{ color }} className="shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold leading-snug">{title}</span>
        {sub && <span className="block text-[13px] leading-snug text-muted">{sub}</span>}
      </span>
      {right}
    </button>
  )
}
