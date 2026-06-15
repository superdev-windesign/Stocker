// GET /api/<resource> — single dynamic proxy for all Paytm REST endpoints, so we
// stay under Vercel's Hobby-plan limit of 12 serverless functions. Explicit routes
// (login, exchange, token, token/retrieve, logout) take priority over this dynamic
// one, which handles the single-segment data resources below.
import { paytmGet } from './_lib/paytm.js'

const handlers = {
  holdings: async () => {
    const holdings = await paytmGet('/holdings/v1/get-user-holdings-data')
    const value = await paytmGet('/holdings/v1/get-holdings-value').catch(() => null)
    return { holdings, value }
  },
  orders: () => paytmGet('/orders/v1/user/orders'),
  positions: () => paytmGet('/orders/v1/position'),
  funds: () => paytmGet('/accounts/v1/funds/summary', { config: 'false' }),
  profile: () => paytmGet('/accounts/v1/user/details'),
  'price-chart': (q) => paytmGet('/data/v1/price-charts/sym', q),
  quote: (q) => paytmGet('/data/v1/price/live', q),
  // Diagnostic dump of all three "what do I own?" sources side by side.
  debug: async () => {
    const safe = (p) => paytmGet(p).catch((e) => ({ __error: e.message, __status: e.status }))
    const [holdings, positions, orders] = await Promise.all([
      safe('/holdings/v1/get-user-holdings-data'),
      safe('/orders/v1/position'),
      safe('/orders/v1/user/orders'),
    ])
    return { holdings, positions, orders }
  },
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  // The dynamic segment arrives as req.query.resource; everything else is passthrough.
  const { resource, ...query } = req.query
  const fn = handlers[resource]
  if (!fn) return res.status(404).json({ error: `Unknown resource: ${resource}` })
  try {
    res.json(await fn(query))
  } catch (err) {
    const status = err.status || 500
    if (status === 401) return res.status(401).json({ error: 'Not logged in. Please log in to Paytm.' })
    console.error(`[stocker] proxy error (${status}):`, err.message)
    res.status(status).json({ error: err.message })
  }
}
