// Token-helper backend for Stocker.
//
// Why this exists: Paytm's token exchange (request_token -> access tokens) cannot run in
// the browser — the endpoint blocks cross-origin calls and, more importantly, your
// api_secret must never ship in frontend code. This tiny server holds the secret, runs
// the exchange server-side, and hands ONLY the public_access_token to the React app.
//
// Flow:
//   1. Browser hits GET /login            -> we redirect to Paytm's login page
//   2. User logs in; Paytm redirects to    -> GET /  (your registered Return URL)
//      http://localhost:3000/?requestToken=...&state=...
//   3. We exchange requestToken for tokens, cache the public_access_token in memory,
//      and redirect the browser back to the React app (Vite, :5173).
//   4. React calls GET /api/token to read the public_access_token and auto-connects.

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT || 3000)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
// Accept either the backend-style names or the VITE_-prefixed ones already in .env.
const API_KEY = process.env.PAYTM_API_KEY || process.env.VITE_PAYTM_API_KEY
const API_SECRET = process.env.PAYTM_API_SECRET || process.env.VITE_PAYTM_API_SECRET

const LOGIN_URL = 'https://login.paytmmoney.com/merchant-login?apiKey='
const GETTOKEN_URL = 'https://developer.paytmmoney.com/accounts/v2/gettoken'

if (!API_KEY || !API_SECRET) {
  console.warn('\n[stocker] WARNING: PAYTM_API_KEY / PAYTM_API_SECRET missing in .env — token exchange will fail.\n')
}

// Token cache, persisted to disk so backend restarts don't force a re-login.
// Paytm tokens expire at midnight IST; we read the JWT's `exp` claim to know exactly.
let tokens = null // { public_access_token, access_token, read_access_token, generated_at }

const TOKENS_FILE = path.join(__dirname, '.tokens.json')

// Decode the `exp` (UNIX seconds) from a JWT without verifying the signature.
function tokenExp(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString())
    return payload.exp || null
  } catch {
    return null
  }
}

// A token set is usable only while its access_token JWT hasn't expired.
function isValid(t) {
  if (!t?.access_token) return false
  const exp = tokenExp(t.access_token)
  return exp ? exp * 1000 > Date.now() : true
}

function saveTokens() {
  try {
    if (tokens) fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens), { mode: 0o600 })
  } catch (err) {
    console.warn('[stocker] could not persist tokens:', err.message)
  }
}

function clearTokens() {
  tokens = null
  try {
    fs.existsSync(TOKENS_FILE) && fs.unlinkSync(TOKENS_FILE)
  } catch {
    /* ignore */
  }
}

// Restore a previously saved session on startup (if still valid).
function loadTokens() {
  try {
    if (!fs.existsSync(TOKENS_FILE)) return
    const saved = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'))
    if (isValid(saved)) {
      tokens = saved
      const exp = tokenExp(saved.access_token)
      console.log(`[stocker] restored saved session (valid until ${exp ? new Date(exp * 1000).toLocaleString() : 'unknown'}).`)
    } else {
      console.log('[stocker] saved session expired — login required.')
      fs.unlinkSync(TOKENS_FILE)
    }
  } catch (err) {
    console.warn('[stocker] could not restore tokens:', err.message)
  }
}
loadTokens()

const app = express()
app.use(cors({ origin: FRONTEND_URL }))
app.use(express.json())

// Log every incoming request (method, path, query) so we can see exactly what
// Paytm's Return-URL redirect delivers — invaluable for debugging the login flow.
app.use((req, res, next) => {
  const q = Object.keys(req.query).length ? ` query=${JSON.stringify(req.query)}` : ''
  console.log(`[stocker] ${req.method} ${req.path}${q}`)
  next()
})

// Step 1: send the user to Paytm's login page.
app.get('/login', (req, res) => {
  if (!API_KEY) return res.status(500).send('PAYTM_API_KEY not configured in .env')
  const state = Math.random().toString(36).slice(2)
  res.redirect(`${LOGIN_URL}${API_KEY}&state=${state}`)
})

// Step 2+3: Paytm's Return URL callback. Exchange requestToken -> tokens, then bounce to the UI.
app.get('/', async (req, res) => {
  const requestToken = req.query.requestToken || req.query.request_token
  if (!requestToken) {
    // Landing page when opened directly (no token in the URL).
    return res.type('html').send(`
      <body style="font-family:system-ui;background:#0b0e11;color:#eaecef;display:grid;place-items:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h2>📈 Stocker — Paytm token helper</h2>
          <p style="color:#9aa4b2">Click below to log in to Paytm and generate your access token.</p>
          <a href="/login" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none">Login with Paytm</a>
        </div>
      </body>`)
  }

  try {
    const resp = await fetch(GETTOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'openapi-client-src': 'sdk' },
      body: JSON.stringify({
        api_key: API_KEY,
        api_secret_key: API_SECRET,
        request_token: requestToken,
      }),
    })

    const text = await resp.text()
    if (!resp.ok) {
      console.error('[stocker] gettoken failed:', resp.status, text)
      return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(`Token exchange failed (${resp.status})`)}`)
    }

    const data = JSON.parse(text)
    tokens = { ...data, generated_at: new Date().toISOString() }
    saveTokens()
    console.log('[stocker] tokens generated OK; session cached & persisted.')
    res.redirect(`${FRONTEND_URL}/?connected=1`)
  } catch (err) {
    console.error('[stocker] exchange error:', err)
    res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(err.message)}`)
  }
})

// Step 4: the React app reads the cached public_access_token from here.
app.get('/api/token', (req, res) => {
  // Drop an expired session so the UI prompts a fresh login instead of failing later.
  if (tokens && !isValid(tokens)) clearTokens()
  if (!tokens?.public_access_token) return res.status(404).json({ error: 'No token yet. Log in first.' })
  res.json({
    public_access_token: tokens.public_access_token,
    generated_at: tokens.generated_at,
    expires_at: tokenExp(tokens.access_token) ? tokenExp(tokens.access_token) * 1000 : null,
  })
})

// Manual exchange fallback: POST { request_token } if you captured it yourself.
app.post('/api/exchange', async (req, res) => {
  const requestToken = req.body?.request_token || req.body?.requestToken
  if (!requestToken) return res.status(400).json({ error: 'request_token is required' })
  try {
    const resp = await fetch(GETTOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'openapi-client-src': 'sdk' },
      body: JSON.stringify({ api_key: API_KEY, api_secret_key: API_SECRET, request_token: requestToken }),
    })
    const text = await resp.text()
    if (!resp.ok) return res.status(resp.status).json({ error: text })
    tokens = { ...JSON.parse(text), generated_at: new Date().toISOString() }
    saveTokens()
    res.json({ public_access_token: tokens.public_access_token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Clear the cached session (memory + disk).
app.post('/api/logout', (req, res) => {
  clearTokens()
  res.json({ ok: true })
})

// ── Authenticated Paytm REST proxy ───────────────────────────────────────────
// The browser can't call Paytm's data APIs directly (CORS + token handling), so
// the backend proxies them using the cached access_token. Pattern mirrors the
// official SDK apiService.js: x-jwt-token header + openapi-client-src: 'sdk'.
const PAYTM_HOST = 'https://developer.paytmmoney.com'

async function paytmGet(path, query = {}) {
  if (!tokens?.access_token) {
    const e = new Error('Not logged in')
    e.status = 401
    throw e
  }
  const qs = new URLSearchParams(query).toString()
  const url = `${PAYTM_HOST}${path}${qs ? `?${qs}` : ''}`
  const resp = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'openapi-client-src': 'sdk',
      'x-jwt-token': tokens.access_token,
    },
  })
  const text = await resp.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  if (!resp.ok) {
    const e = new Error(typeof body === 'string' ? body : JSON.stringify(body))
    e.status = resp.status
    throw e
  }
  return body
}

// Wrap a proxy handler with consistent 401/error JSON.
const proxy = (fn) => async (req, res) => {
  try {
    res.json(await fn(req))
  } catch (err) {
    const status = err.status || 500
    if (status === 401) return res.status(401).json({ error: 'Not logged in. Please log in to Paytm.' })
    console.error(`[stocker] proxy error (${status}):`, err.message)
    res.status(status).json({ error: err.message })
  }
}

app.get('/api/holdings', proxy(async () => {
  const holdings = await paytmGet('/holdings/v1/get-user-holdings-data')
  const value = await paytmGet('/holdings/v1/get-holdings-value').catch(() => null)
  // Debug: dump the raw shape so we can pin down where the array actually lives.
  console.log('[stocker] holdings raw keys:', Object.keys(holdings || {}))
  console.log('[stocker] holdings preview:', JSON.stringify(holdings).slice(0, 800))
  return { holdings, value }
}))

app.get('/api/orders', proxy(() => paytmGet('/orders/v1/user/orders')))
app.get('/api/positions', proxy(() => paytmGet('/orders/v1/position')))

// Diagnostic dump: returns raw responses from all three "what do I own?" sources
// side-by-side. Lets us pinpoint where a freshly bought stock actually lives.
app.get('/api/debug', proxy(async () => {
  const safe = (p) => paytmGet(p).catch((e) => ({ __error: e.message, __status: e.status }))
  const [holdings, positions, orders] = await Promise.all([
    safe('/holdings/v1/get-user-holdings-data'),
    safe('/orders/v1/position'),
    safe('/orders/v1/user/orders'),
  ])
  return { holdings, positions, orders }
}))
app.get('/api/funds', proxy(() => paytmGet('/accounts/v1/funds/summary', { config: 'false' })))
app.get('/api/profile', proxy(() => paytmGet('/accounts/v1/user/details')))

// Historical candles. Pass through query (security_id/symbol, exchange, interval, from/to).
app.get('/api/price-chart', proxy((req) => paytmGet('/data/v1/price-charts/sym', req.query)))

// Live REST quote. mode=LTP|QUOTE|FULL, pref=EXCH:SECID:TYPE (comma separated).
app.get('/api/quote', proxy((req) => paytmGet('/data/v1/price/live', req.query)))

app.listen(PORT, () => {
  console.log(`\n[stocker] token helper running on http://localhost:${PORT}`)
  console.log(`[stocker] Paytm Return URL should be set to: http://localhost:${PORT}`)
  console.log(`[stocker] Start login at:                    http://localhost:${PORT}/login\n`)
})
