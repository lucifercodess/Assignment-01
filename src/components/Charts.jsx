import { useState } from 'react'
import { money, dayLabel } from '../lib/utils'

/** Daily spend bars with a dashed daily-budget reference line. Tap a bar for details. */
export function DailyChart({ days, dailyBudget }) {
  const todayIdx = days.findIndex((d) => d.future) - 1
  const lastIdx = todayIdx < 0 ? days.length - 1 : todayIdx
  const [sel, setSel] = useState(Math.max(0, lastIdx))
  const max = Math.max(dailyBudget * 1.15, ...days.map((d) => d.total), 1)
  const H = 120
  const colW = days.length > 14 ? 22 : undefined
  const s = days[sel] || days[0]
  const refY = dailyBudget ? H - (dailyBudget / max) * H : null

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-sm text-muted">{dayLabel(s.date)}{s.future ? ' · upcoming' : ''}</div>
          <div className="num text-2xl font-semibold">{money(s.total)}</div>
        </div>
        {dailyBudget > 0 && (
          <div className="text-right text-xs text-muted">
            <span className="mr-1 inline-block w-4 border-t-2 border-dashed border-muted align-middle" /> Daily budget
            <div className="num text-sm font-medium text-ink">{money(dailyBudget)}</div>
          </div>
        )}
      </div>
      <div className="no-scrollbar -mx-1 overflow-x-auto">
        <div className="relative px-1" style={{ height: H + 22, minWidth: colW ? days.length * colW : undefined }}>
          {refY != null && <div className="absolute inset-x-1 border-t-2 border-dashed border-muted/60" style={{ top: refY }} aria-hidden />}
          <div className="absolute inset-x-1 top-0 flex items-end" style={{ height: H }}>
            {days.map((d, i) => {
              const h = d.total ? Math.max(4, (d.total / max) * H) : 0
              const over = dailyBudget && d.total > dailyBudget
              return (
                <button
                  key={d.key}
                  onClick={() => setSel(i)}
                  className="group relative flex h-full flex-1 items-end justify-center"
                  aria-label={`${dayLabel(d.date)}: ${money(d.total)}`}
                >
                  {d.total === 0 && <span className={`mb-0 h-1 w-1 rounded-full ${d.future ? 'bg-line' : 'bg-muted/40'}`} />}
                  {d.total > 0 && (
                    <span
                      className="w-[62%] max-w-[22px] rounded-t-[4px] transition-opacity"
                      style={{ height: h, background: 'var(--accent)', opacity: sel === i ? 1 : 0.55 }}
                    />
                  )}
                  {over && sel !== i && <span className="absolute -top-0.5 text-[9px] text-bad" style={{ bottom: h + 2, top: 'auto' }}>▲</span>}
                </button>
              )
            })}
          </div>
          <div className="absolute inset-x-1 bottom-0 flex">
            {days.map((d, i) => (
              <span key={d.key} className={`flex-1 text-center text-[10px] num ${sel === i ? 'font-semibold text-ink' : 'text-muted'}`}>
                {days.length <= 10 || i % Math.ceil(days.length / 8) === 0 || sel === i ? d.date.getDate() : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** One segmented bar + labeled legend rows (identity never by color alone). */
export function CategoryBreakdown({ byCat, total, onPick }) {
  if (!byCat.length) return null
  return (
    <div>
      <div className="mb-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {byCat.map((c) => (
          <div key={c.id} title={`${c.label} ${money(c.total)}`} style={{ flexGrow: c.total, background: `var(--c-${c.id})` }} className="min-w-[3px] first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <ul className="space-y-1">
        {byCat.map((c) => (
          <li key={c.id}>
            <button onClick={() => onPick?.(c.id)} className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left active:bg-sunken">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(--c-${c.id})` }} />
              <span className="flex-1 text-[15px]">{c.emoji} {c.label}</span>
              <span className="num text-sm text-muted">{Math.round((c.total / total) * 100)}%</span>
              <span className="num w-20 text-right font-medium">{money(c.total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
