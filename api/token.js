// GET /api/token — the React app reads the cached public_access_token here on load
// to auto-connect the live websocket and to detect a logged-in session.
import { getValidTokens, tokenExp } from './_lib/paytm.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const tokens = await getValidTokens()
  if (!tokens?.public_access_token) return res.status(404).json({ error: 'No token yet. Log in first.' })
  const exp = tokenExp(tokens.access_token)
  res.json({
    public_access_token: tokens.public_access_token,
    generated_at: tokens.generated_at,
    expires_at: exp ? exp * 1000 : null,
  })
}
