// Vercel serverless function: receives bank/UPI SMS from your phone's
// SMS forwarder (POST) and hands them to the app (GET).
//
// Storage: a PRIVATE Vercel Blob store (BLOB_READ_WRITE_TOKEN is set when the
// store is connected to the project). Each SMS is one small JSON file under inbox/.
// Env:
//   INGEST_KEY  — a secret; the forwarder and the app must both send it.

import { put, list, get, del } from '@vercel/blob'

const PREFIX = 'inbox/'
const KEEP_DAYS = 90

function extractText(body) {
  if (!body) return ''
  if (typeof body === 'string') {
    try { return extractText(JSON.parse(body)) } catch { return body }
  }
  // Accept the field names used by common SMS forwarder apps / Tasker / MacroDroid
  const keys = ['text', 'message', 'msg', 'sms', 'body', 'content', 'smsBody']
  for (const k of keys) if (typeof body[k] === 'string' && body[k].trim()) return body[k]
  for (const v of Object.values(body)) if (typeof v === 'string' && /rs\.?|inr|₹|debited|credited/i.test(v)) return v
  return ''
}

async function readJSON(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false })
  if (!r || r.statusCode !== 200) return null
  const text = await new Response(r.stream).text()
  try { return JSON.parse(text) } catch { return null }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Ingest-Key, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
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
      const sender = (req.body && typeof req.body === 'object' && (req.body.from || req.body.sender || req.body.address)) || ''
      const ts = Date.now()
      const id = `${ts}-${Math.random().toString(36).slice(2, 8)}`
      const item = { id, ts, text: text.slice(0, 1000), sender: String(sender).slice(0, 40) }
      await put(`${PREFIX}${id}.json`, JSON.stringify(item), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false,
      })
      return res.status(200).json({ ok: true, id })
    }

    if (req.method === 'GET') {
      const since = Number(req.query.since || 0)
      const all = []
      let cursor
      do {
        const page = await list({ prefix: PREFIX, limit: 1000, cursor })
        all.push(...page.blobs)
        cursor = page.hasMore ? page.cursor : undefined
      } while (cursor)

      const tsOf = (b) => Number(b.pathname.slice(PREFIX.length).split('-')[0]) || 0
      const fresh = all.filter((b) => tsOf(b) > since).sort((a, b) => tsOf(b) - tsOf(a)).slice(0, 300)
      const items = (await Promise.all(fresh.map((b) => readJSON(b.pathname)))).filter(Boolean)

      // housekeeping: drop messages older than KEEP_DAYS
      const old = all.filter((b) => tsOf(b) < Date.now() - KEEP_DAYS * 864e5).map((b) => b.url)
      if (old.length) await del(old).catch(() => {})

      return res.status(200).json({ items })
    }
    if (req.method === 'DELETE') {
      // ?id=<id> removes one message; ?all=1 empties the inbox
      const ids = req.query.all ? null : String(req.query.id || '').split(',').filter((x) => /^[\w-]+$/.test(x))
      if (ids && !ids.length) return res.status(400).json({ error: 'Pass ?id= or ?all=1' })
      const page = await list({ prefix: PREFIX, limit: 1000 })
      const urls = page.blobs.filter((b) => !ids || ids.some((id) => b.pathname === `${PREFIX}${id}.json`)).map((b) => b.url)
      if (urls.length) await del(urls)
      return res.status(200).json({ ok: true, deleted: urls.length })
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
