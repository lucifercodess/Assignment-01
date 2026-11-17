import { CATEGORIES } from './categorize'

const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
export const money = (n, exact = false) => (exact && n % 1 ? inr2 : inr0).format(n || 0)

export const DAY = 864e5
export const dayKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const todayISO = () => dayKey(new Date())

export function dayLabel(d) {
  const k = dayKey(d)
  if (k === dayKey(Date.now())) return 'Today'
  if (k === dayKey(Date.now() - DAY)) return 'Yesterday'
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}
export function ago(ts) {
  if (!ts) return 'never'
  const m = Math.round((Date.now() - ts) / 6e4)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
export const timeLabel = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

/** All the derived numbers the dashboard needs. */
export function tripStats(trip, expenses, countCredits = false) {
  const list = expenses.filter((e) => e.tripId === trip.id)
  const spends = list.filter((e) => e.type !== 'credit')
  const credits = list.filter((e) => e.type === 'credit')
  const gross = spends.reduce((a, e) => a + e.amount, 0)
  const received = credits.reduce((a, e) => a + e.amount, 0)
  const spent = countCredits ? gross - received : gross

  const start = startOfDay(trip.start + 'T00:00')
  const end = startOfDay(trip.end + 'T00:00')
  const today = startOfDay(Date.now())
  const totalDays = Math.max(1, Math.round((end - start) / DAY) + 1)
  const dayNum = Math.min(totalDays, Math.max(1, Math.round((today - start) / DAY) + 1))
  const notStarted = today < start
  const over = today > end
  const daysLeft = notStarted ? totalDays : over ? 0 : totalDays - dayNum + 1
  const budget = Number(trip.budget) || 0

  const byDay = {}
  for (const e of spends) byDay[dayKey(e.date)] = (byDay[dayKey(e.date)] || 0) + e.amount
  const todaySpent = byDay[dayKey(Date.now())] || 0

  const elapsed = notStarted ? 0 : dayNum
  const avgPerDay = elapsed ? spent / elapsed : 0
  const projected = elapsed ? avgPerDay * totalDays : spent
  const dailyBudget = budget / totalDays
  // what's left, spread over remaining days (incl. today, adding back what's already spent today)
  const safeToday = budget && daysLeft ? Math.max(0, (budget - spent + todaySpent) / daysLeft - todaySpent) : 0

  const byCat = CATEGORIES.map((c) => ({ ...c, total: spends.filter((e) => e.category === c.id).reduce((a, e) => a + e.amount, 0) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)

  const days = []
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(+start + i * DAY)
    days.push({ key: dayKey(d), date: d, total: byDay[dayKey(d)] || 0, future: d > today })
  }

  return { list, spent, gross, received, countCredits, budget, totalDays, dayNum, daysLeft, notStarted, over, todaySpent, avgPerDay, projected, dailyBudget, safeToday, byCat, days, count: spends.length }
}

/** Short, human, actionable insights. */
export function insights(s) {
  const out = []
  if (!s.count) return out
  if (s.budget) {
    const pct = s.spent / s.budget
    if (pct >= 1) out.push({ tone: 'bad', icon: '🚨', text: `You're over budget by ${money(s.spent - s.budget)}.` })
    else if (!s.notStarted && !s.over && s.projected > s.budget * 1.05)
      out.push({ tone: 'warn', icon: '📈', text: `At this pace you'll spend ${money(s.projected)}, ${money(s.projected - s.budget)} over budget. Aim for ${money(s.safeToday + s.todaySpent)} a day.` })
    else if (!s.notStarted && !s.over && s.dayNum > 1)
      out.push({ tone: 'good', icon: '✅', text: `On track: projected ${money(s.projected)} of ${money(s.budget)}.` })
  }
  if (s.byCat[0] && s.spent > 0) {
    const c = s.byCat[0]
    out.push({ tone: 'info', text: `${c.label} is ${Math.round((c.total / s.spent) * 100)}% of spending (${money(c.total)}).` })
  }
  const past = s.days.filter((d) => !d.future && d.total > 0)
  if (past.length >= 2) {
    const top = past.reduce((a, b) => (b.total > a.total ? b : a))
    out.push({ tone: 'info', icon: '📅', text: `Priciest day: ${dayLabel(top.date)} at ${money(top.total)}.` })
  }
  return out
}

export function toCSV(rows) {
  const head = ['Date', 'Time', 'Merchant', 'Category', 'Amount', 'Type', 'Method', 'UPI Ref', 'Note', 'Source']
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map((e) => [dayKey(e.date), timeLabel(e.date), e.merchant, e.category, e.amount, e.type, e.method || '', e.ref || '', e.note || '', e.source].map(esc).join(','))
  return [head.join(','), ...lines].join('\n')
}

export function download(name, text, type = 'text/plain') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const haptic = (ms = 10) => { try { navigator.vibrate?.(ms) } catch { /* ignore */ } }
