// GET /api/token/retrieve — return the stored token plus expiry info so the UI can
// offer "copy stored token from DB" (no re-login needed while the token is valid).
import { getValidTokens, tokenExp, isValid } from '../_lib/paytm.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const tokens = await getValidTokens()
  if (!tokens?.public_access_token) {
    return res.status(404).json({
      error: 'No token stored. Please log in first via /api/login.',
      public_access_token: null,
    })
  }
  const exp = tokenExp(tokens.access_token)
  res.json({
    public_access_token: tokens.public_access_token,
    generated_at: tokens.generated_at,
    expires_at: exp ? exp * 1000 : null,
    is_valid: isValid(tokens),
    expires_in_hours: exp ? Math.round((exp * 1000 - Date.now()) / (1000 * 60 * 60)) : 'unknown',
  })
}
