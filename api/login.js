// GET /api/login — redirect the user to Paytm's login page.
// Paytm then redirects back to the registered Return URL (the app root, "/"),
// where the React app picks up ?requestToken=... and POSTs it to /api/exchange.
import { apiKey, LOGIN_URL } from './_lib/paytm.js'

export default function handler(req, res) {
  if (!apiKey) return res.status(500).send('PAYTM_API_KEY not configured')
  const state = Math.random().toString(36).slice(2)
  res.redirect(`${LOGIN_URL}${apiKey}&state=${state}`)
}
