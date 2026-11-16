// Parses Indian bank / UPI transaction SMS & notification text into structured
// transactions. Works with the common formats used by SBI, HDFC, ICICI, Axis,
// Kotak, PNB, BoB, Paytm, PhonePe, GPay notifications, etc.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

const AMOUNT_RE = /(?:rs\.?|inr|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i
const AMOUNT_ALT_RE = /(?:debited|credited|paid|sent|spent|deducted)\s+(?:by|for|of|with)?\s*([\d,]+(?:\.\d{1,2})?)\b/i
const VPA_RE = /\b([a-z0-9][a-z0-9._-]{1,}@[a-z][a-z0-9]{1,})\b/i
const REF_RE = /(?:upi\s*:?\s*(?=\d)|(?:upi\s*)?(?:ref(?:erence)?|rrn|txn\s*id|transaction\s*id)\.?\s*(?:no\.?|number|id)?\s*[:#-]?\s*)([0-9]{9,14})/i
const UPI_PATH_RE = /UPI\/(?:P2[AM]\/|CR\/|DR\/)?([0-9]{9,14})\/([^/\n.]+)/i

const DEBIT_WORDS = /\b(debited|debit|sent|paid|spent|withdrawn|deducted|purchase|txn of|payment of|transferred)\b/i
const CREDIT_WORDS = /\b(credited|received|refund(?:ed)?|deposited|cashback|reversed)\b/i
const NOISE = /\b(offer|valid till|apply now|pre-approved|get (?:flat )?(?:cashback|rs|inr)|(?:upto|up to) (?:rs|inr|₹)|win|click|otp|one time password|will be debited|is due|due on|request(?:ed)? (?:money|payment)|collect request|emi of .* due|failed|declined|unsuccessful)\b/i

const MERCHANT_PATTERNS = [
  /;\s*(.+?)\s+credited\b/i,
  /\bto\s+VPA\s+([^\s(]+)/i,
  /\btrf\s+to\s+(.+?)\s+(?:ref|on\b|upi|\.|$)/i,
  /\bInfo:\s*(?:UPI\/[^/]+\/[^/]+\/)?(.+?)(?:\.|\s+avl|\s+avbl|$)/i,
  /\bcredited\s+to\s+(?:a\/?c\s+\S+\s+of\s+)?(.+?)\s+(?:on\b|via|ref|upi|\.|$)/i,
  /\b(?:paid|sent|payment)\s+(?:of\s+\S+\s+)?to\s+(.+?)\s+(?:on\b|via|from|using|ref|upi|\.|$)/i,
  /\bto\s+(.+?)\s+(?:on\s+\d|on\b|ref|upi|via|\.|$)/i,
  /\bat\s+(.+?)\s+(?:on\s+\d|on\b|ref|txn|\.|$)/i,
  /\bfrom\s+VPA\s+([^\s(]+)/i,
  /\bby\s+(?:VPA\s+)?([a-z0-9._-]+@[a-z]+)/i,
]

function titleCase(s) {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
}

export function prettyMerchant(raw) {
  if (!raw) return 'Unknown'
  let s = String(raw).trim().replace(/[()"'*]/g, ' ')
  // VPA: take the handle part
  const vpa = s.match(/^([a-z0-9._-]+)@[a-z0-9]+$/i)
  if (vpa) {
    let h = vpa[1]
    if (/^(paytmqr|bharatpe|q\d|gpay-|mab\.|ombk|yespay|pos)/i.test(h) || /^\d+$/.test(h)) return 'QR merchant'
    h = h.replace(/\.(rzp|payu|cf|pg|razorpay)$/i, '').replace(/[._-]+/g, ' ').replace(/\d{4,}/g, '').trim()
    return titleCase(h || vpa[1])
  }
  s = s.replace(/\b(a\/c|ac|account|xx\d+|x+\d+|\*+\d+)\b/gi, ' ')
  s = s.replace(/\s{2,}/g, ' ').trim()
  if (s.length > 32) s = s.slice(0, 32).trim()
  return titleCase(s) || 'Unknown'
}

function parseDate(text, fallback = new Date()) {
  let m
  // 16-11-26, 16/11/2026, 16.11.26
  if ((m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/))) {
    let [, d, mo, y] = m
    y = +y < 100 ? 2000 + +y : +y
    const dt = new Date(y, +mo - 1, +d, fallback.getHours(), fallback.getMinutes())
    if (!isNaN(dt) && +mo <= 12) return dt
  }
  // 16-Nov-26, 16 Nov 2026, 16Nov26
  if ((m = text.match(/\b(\d{1,2})[-\s]?([a-z]{3})[a-z]*[-\s,]?(\d{2,4})\b/i)) && MONTHS[m[2].toLowerCase()] !== undefined) {
    let y = +m[3] < 100 ? 2000 + +m[3] : +m[3]
    return new Date(y, MONTHS[m[2].toLowerCase()], +m[1], fallback.getHours(), fallback.getMinutes())
  }
  // 2026-11-16
  if ((m = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/))) {
    return new Date(+m[1], +m[2] - 1, +m[3], fallback.getHours(), fallback.getMinutes())
  }
  return fallback
}

/** Parse one message. Returns null if it doesn't look like a completed transaction. */
export function parseMessage(text, fallbackDate) {
  if (!text || typeof text !== 'string') return null
  const t = text.replace(/\s+/g, ' ').trim()
  if (NOISE.test(t)) return null
  if (UPI_LITE.test(t) && /\b(top.?up|load|add(?:ed)?|transfer(?:red)?)\b/i.test(t)) return null

  let am = t.match(AMOUNT_RE) || t.match(AMOUNT_ALT_RE)
  if (!am) return null
  const amount = parseFloat(am[1].replace(/,/g, ''))
  if (!amount || amount <= 0) return null

  const isDebit = DEBIT_WORDS.test(t)
  const isCredit = CREDIT_WORDS.test(t)
  if (!isDebit && !isCredit) return null
  if (!MONEYISH.test(t) && !VPA_RE.test(t)) return null // must reference an account/UPI/card
  // "debited ... credited to X" is still a debit (money left your account)
  let type = isDebit ? 'debit' : 'credit'
  if (isDebit && isCredit) {
    const di = t.search(DEBIT_WORDS), ci = t.search(CREDIT_WORDS)
    type = di <= ci || /credited to/i.test(t) ? 'debit' : 'credit'
  }

  let ref = null, merchantRaw = null
  const up = t.match(UPI_PATH_RE)
  if (up) { ref = up[1]; merchantRaw = up[2] }
  if (!ref) { const r = t.match(REF_RE); if (r) ref = r[1] }

  const vpaM = t.match(VPA_RE)
  const vpa = vpaM ? vpaM[1] : null

  if (!merchantRaw) {
    for (const re of MERCHANT_PATTERNS) {
      const m = t.match(re)
      if (m && m[1] && !/^(your|a\/c|ac|account|xx|rs|inr)\b/i.test(m[1]) && !/^\d+$/.test(m[1])) {
        merchantRaw = m[1]; break
      }
    }
  }
  if (!merchantRaw && vpa) merchantRaw = vpa

  const date = parseDate(t, fallbackDate ? new Date(fallbackDate) : new Date())
  const isUpi = /\bupi\b|@[a-z]{2,}/i.test(t)

  return {
    amount,
    type,
    merchant: prettyMerchant(merchantRaw),
    vpa,
    ref,
    date: date.toISOString(),
    method: isUpi ? 'UPI' : /card/i.test(t) ? 'Card' : 'Bank',
    raw: text.trim(),
  }
}

const MONEYISH = /\b(a\/?c|acct|account|upi|card|bank|debit|credit|txn|transaction|wallet|paid|sent|spent|vpa)\b/i
const SKIP = /\b(otp|one time password|will be debited|is due|due on|due date|collect request|request(?:ed)? (?:money|payment)|offer|cashback upto|win|loan|pre-approved|apply now|failed|declined|unsuccessful)\b/i
const UPI_LITE = /upi\s*lite/i

/**
 * For a message parseMessage() could not use: should a human look at it?
 * Returns a short reason, or null if it's clearly not a transaction (OTP, promo, failed).
 */
export function reviewReason(text) {
  if (!text) return null
  const t = text.replace(/\s+/g, ' ')
  if (UPI_LITE.test(t) && AMOUNT_RE.test(t)) return 'UPI Lite top-up: money moved to your Lite wallet, not spent yet'
  if (SKIP.test(t)) return null
  if ((AMOUNT_RE.test(t) || AMOUNT_ALT_RE.test(t)) && MONEYISH.test(t)) return 'Unrecognised bank message format'
  return null
}

/** Best-effort amount from any text (used to prefill review items). */
export function guessAmount(text) {
  const m = String(text || '').match(AMOUNT_RE) || String(text || '').match(AMOUNT_ALT_RE)
  return m ? parseFloat(m[1].replace(/,/g, '')) : 0
}

/** Parse a blob that may contain several pasted messages. */
export function parseMany(blob) {
  if (!blob) return []
  let chunks = blob.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean)
  if (chunks.length === 1) {
    const lines = blob.split('\n').map((l) => l.trim()).filter(Boolean)
    const parsedLines = lines.filter((l) => parseMessage(l))
    if (parsedLines.length > 1) chunks = parsedLines
  }
  return chunks.map((c) => parseMessage(c)).filter(Boolean)
}

/** Build a upi:// intent link. */
export function upiLink({ pa, pn, am, tn }) {
  const p = new URLSearchParams()
  p.set('pa', pa)
  if (pn) p.set('pn', pn)
  if (am) p.set('am', Number(am).toFixed(2))
  p.set('cu', 'INR')
  if (tn) p.set('tn', tn.slice(0, 50))
  return 'upi://pay?' + p.toString().replace(/\+/g, '%20')
}

/** Parse a scanned UPI QR payload. */
export function parseUpiQr(data) {
  try {
    if (!/^upi:\/\//i.test(data)) return null
    const q = new URLSearchParams(data.split('?')[1] || '')
    return { pa: q.get('pa'), pn: q.get('pn') || '', am: q.get('am') || '', tn: q.get('tn') || '' }
  } catch {
    return null
  }
}
