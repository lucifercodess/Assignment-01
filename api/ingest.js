// Vercel serverless function: receives bank/UPI SMS from your phone's
// SMS forwarder (POST) and hands them to the app (GET).
//
// Storage: Upstash Redis (free) — add it in Vercel → Storage → Upstash Redis.
// Env vars (set automatically by the integration, any of these names works):
//   KV_REST_API_URL / KV_REST_API_TOKEN   or   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// Plus one you choose yourself:
//   INGEST_KEY  — a secret; the forwarder and the app must both send it.

const LIST = 'tripwise:inbox'
const MAX = 500

async function redis(cmd) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Storage not configured: add Upstash Redis to this Vercel project')
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  })
  const j = await r.json()
  if (j.error) throw new Error(j.error)
  return j.result
}

function extractText(body) {
  if (!body) return ''
  if (typeof body === 'string') {
    try { return extractText(JSON.parse(body)) } catch { return body }
  }
  // Accept the field names used by common SMS forwarder apps / Tasker / MacroDroid
  const keys = ['text', 'message', 'msg', 'sms', 'body', 'content', 'smsBody', 'key']
  for (const k of keys) if (typeof body[k] === 'string' && body[k].trim()) return body[k]
  for (const v of Object.values(body)) if (typeof v === 'string' && /rs\.?|inr|₹|debited|credited/i.test(v)) return v
  return ''
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Ingest-Key, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const secret = process.env.INGEST_KEY
  if (!secret) return res.status(500).json({ error: 'Set INGEST_KEY in Vercel environment variables' })
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const given = req.query.key || req.headers['x-ingest-key'] || auth
  if (given !== secret) return res.status(401).json({ error: 'Wrong or missing key' })

  try {
    if (req.method === 'POST') {
      const text = extractText(req.body).trim()
      if (!text) return res.status(400).json({ error: 'No message text found in body' })
      const sender = (req.body && (req.body.from || req.body.sender || req.body.address)) || ''
      const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ts: Date.now(), text: text.slice(0, 1000), sender: String(sender).slice(0, 40) }
      await redis(['LPUSH', LIST, JSON.stringify(item)])
      await redis(['LTRIM', LIST, 0, MAX - 1])
      return res.status(200).json({ ok: true, id: item.id })
    }
    if (req.method === 'GET') {
      const since = Number(req.query.since || 0)
      const raw = (await redis(['LRANGE', LIST, 0, MAX - 1])) || []
      const items = raw.map((s) => { try { return JSON.parse(s) } catch { return null } }).filter((x) => x && x.ts > since)
      return res.status(200).json({ items })
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
