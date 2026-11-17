import { useState } from 'react'
import { money, dayLabel } from '../lib/utils'
import { CAT_ICONS } from './ui'

/** Daily spend bars with a dashed daily-budget reference line. Tap a bar for that day. */
export function DailyChart({ days, dailyBudget }) {
  const todayIdx = days.findIndex((d) => d.future) - 1
  const lastIdx = todayIdx < 0 ? days.length - 1 : todayIdx
  const [sel, setSel] = useState(Math.max(0, lastIdx))
  const max = Math.max(dailyBudget * 1.2, ...days.map((d) => d.total), 1)
  const H = 112
  const colW = days.length > 14 ? 22 : undefined
  const s = days[sel] || days[0]
  const refY = dailyBudget ? H - (dailyBudget / max) * H : null
  const over = dailyBudget && s.total > dailyBudget

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="text-[13px] text-muted">{dayLabel(s.date)}{s.future ? ' · upcoming' : ''}</div>
          <div className="num text-[28px] font-semibold tracking-tight">{money(s.total)}</div>
        </div>
        {dailyBudget > 0 && (
          <div className="text-right text-[12.5px] text-muted">
            <span className="mr-1.5 inline-block w-4 border-t-[1.5px] border-dashed border-muted align-middle" />
            {money(dailyBudget)}/day
            {!s.future && s.total > 0 && (
              <div className={`mt-0.5 font-medium ${over ? 'text-bad' : 'text-good'}`}>{over ? `${money(s.total - dailyBudget)} over` : `${money(dailyBudget - s.total)} under`}</div>
            )}
          </div>
        )}
      </div>
      <div className="no-scrollbar -mx-1 overflow-x-auto">
        <div className="relative px-1" style={{ height: H + 22, minWidth: colW ? days.length * colW : undefined }}>
          {refY != null && <div className="absolute inset-x-1 border-t-[1.5px] border-dashed border-muted/50" style={{ top: refY }} aria-hidden />}
          <div className="absolute inset-x-1 bottom-[22px] border-t border-line" aria-hidden />
          <div className="absolute inset-x-1 top-0 flex items-end" style={{ height: H }}>
            {days.map((d, i) => {
              const h = d.total ? Math.max(4, (d.total / max) * H) : 0
              return (
                <button key={d.key} onClick={() => setSel(i)} className="relative flex h-full flex-1 items-end justify-center" aria-label={`${dayLabel(d.date)}: ${money(d.total)}`}>
                  {d.total > 0 && (
                    <span className="w-[56%] max-w-[20px] rounded-t-[4px] transition-colors" style={{ height: h, background: sel === i ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 35%, var(--surface))' }} />
                  )}
                </button>
              )
            })}
          </div>
          <div className="absolute inset-x-1 bottom-0 flex">
            {days.map((d, i) => (
              <span key={d.key} className={`num flex-1 text-center text-[10.5px] ${sel === i ? 'font-semibold text-ink' : 'text-muted'}`}>
                {days.length <= 10 || i % Math.ceil(days.length / 8) === 0 || sel === i ? d.date.getDate() : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** One segmented bar + labeled rows (identity never by color alone). */
export function CategoryBreakdown({ byCat, total, onPick }) {
  if (!byCat.length) return null
  return (
    <div>
      <div className="mb-3 flex h-2 w-full gap-[2px] overflow-hidden rounded-full">
        {byCat.map((c) => (
          <div key={c.id} title={`${c.label} ${money(c.total)}`} style={{ flexGrow: c.total, background: `var(--c-${c.id})` }} className="min-w-[3px]" />
        ))}
      </div>
      <ul className="-mx-1">
        {byCat.map((c) => {
          const Icon = CAT_ICONS[c.id]
          return (
            <li key={c.id}>
              <button onClick={() => onPick?.(c.id)} className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left active:bg-sunken">
                <Icon size={17} strokeWidth={1.9} style={{ color: `var(--c-${c.id})` }} />
                <span className="flex-1 text-[14.5px]">{c.label}</span>
                <span className="num text-[13px] text-muted">{Math.round((c.total / total) * 100)}%</span>
                <span className="num w-20 text-right text-[14.5px] font-medium">{money(c.total)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
