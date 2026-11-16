import { useEffect } from 'react'
import { catById } from '../lib/categorize'

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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div role="dialog" aria-label={title} className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-surface shadow-2xl animate-up pb-safe">
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur px-5 pt-3 pb-2">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-sunken text-muted" aria-label="Close">✕</button>
          </div>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}

export function Btn({ variant = 'primary', className = '', ...p }) {
  const v = {
    primary: 'bg-accent text-white active:brightness-90 disabled:opacity-40',
    soft: 'bg-sunken text-ink active:brightness-95',
    danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
    ghost: 'text-accent',
  }[variant]
  return <button className={`h-12 rounded-2xl px-4 font-semibold transition ${v} ${className}`} {...p} />
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const inputCls = 'w-full h-12 rounded-2xl bg-sunken px-4 text-base outline-none ring-accent/50 focus:ring-2 placeholder:text-muted/70'

export function CatIcon({ id, size = 'h-11 w-11 text-xl' }) {
  const c = catById[id] || catById.other
  return (
    <span className={`grid shrink-0 place-items-center rounded-2xl ${size}`} style={{ background: `color-mix(in srgb, var(--c-${c.id}) 16%, transparent)` }}>
      {c.emoji}
    </span>
  )
}

export function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[60] flex justify-center px-4">
      <div className="animate-down rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-surface shadow-lg">{msg}</div>
    </div>
  )
}
