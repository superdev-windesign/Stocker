// POST /api/logout — clear the stored session from Turso.
import { clearTokens } from './_lib/paytm.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  await clearTokens()
  res.json({ ok: true })
}
