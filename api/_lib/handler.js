// Shared helpers for Vercel serverless route handlers.
import { paytmGet } from './paytm.js'

// Wrap a Paytm proxy call with consistent 401/error JSON, matching the local
// Express server's behaviour so the frontend sees one contract in both envs.
export function proxy(fn) {
  return async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
    try {
      res.json(await fn(req))
    } catch (err) {
      const status = err.status || 500
      if (status === 401) return res.status(401).json({ error: 'Not logged in. Please log in to Paytm.' })
      console.error(`[stocker] proxy error (${status}):`, err.message)
      res.status(status).json({ error: err.message })
    }
  }
}

export { paytmGet }
