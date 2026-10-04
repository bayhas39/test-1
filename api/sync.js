// DHRE shared sync endpoint (Vercel Serverless Function, zero dependencies).
//
// Stores site data in Upstash Redis (REST API) so every dashboard / owner portal
// tab (Chrome, Edge, phone, different device) sees the SAME data.
//
// Uses Upstash Redis REST API directly - compatible with Vercel KV format.
// Credentials are baked in for zero-config deployment.

export const config = { runtime: 'nodejs' }

// Upstash Redis REST API credentials (provided by user)
const URL = 'https://qstash-us-east-1.upstash.io'
const TOKEN = 'eyJVc2VySUQiOiI0ZWM0NDYxNy0xMGU2LTQ5YzQtOGE3My05ZDNhNzg2YTBiNmUiLCJQYXNzd29yZCI6IjU4ZTZmZWZhOGVmMTRkZDNiNmRhOThmZjY3Zjk2ZGFkIn0='

const COLLECTIONS = ['sites', 'incidents', 'accidents']

function headers(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

async function kv(cmd) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  })
  if (!r.ok) throw new Error(`kv ${r.status}`)
  return r.json()
}

export default async function handler(req, res) {
  headers(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const collection = String(req.query?.collection || req.body?.collection || '')
  if (!COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'unknown collection' })
  }

  try {
    if (req.method === 'GET') {
      const out = await kv(['GET', `dhre:${collection}`])
      const raw = out?.result
      if (!raw) return res.status(200).json(null)
      try {
        return res.status(200).json(JSON.parse(raw))
      } catch {
        return res.status(200).json(null)
      }
    }

    if (req.method === 'POST') {
      const payload = req.body?.payload
      if (payload === undefined) return res.status(400).json({ error: 'missing payload' })
      const row = { payload, rev: Date.now() }
      await kv(['SET', `dhre:${collection}`, JSON.stringify(row)])
      return res.status(200).json({ ok: true, rev: row.rev })
    }

    return res.status(405).json({ error: 'method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) })
  }
}
