// POST /api/exchange { request_token } — exchange a Paytm request_token for the
// token set and persist it in Turso. Called by the React app when Paytm's Return
// URL redirect lands on the app root with ?requestToken=...
import { exchangeRequestToken } from './_lib/paytm.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const requestToken = req.body?.request_token || req.body?.requestToken
  if (!requestToken) return res.status(400).json({ error: 'request_token is required' })
  try {
    const tokens = await exchangeRequestToken(requestToken)
    res.json({ public_access_token: tokens.public_access_token })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
