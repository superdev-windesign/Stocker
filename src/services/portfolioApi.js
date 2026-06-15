// Thin fetch wrappers around the backend /api/* proxy endpoints.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

async function get(path, params) {
  const qs = params ? `?${new URLSearchParams(params)}` : ''
  const res = await fetch(`${BACKEND_URL}${path}${qs}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return body
}

export const fetchHoldings = () => get('/api/holdings')
export const fetchOrders = () => get('/api/orders')
export const fetchPositions = () => get('/api/positions')
export const fetchFunds = () => get('/api/funds')
export const fetchProfile = () => get('/api/profile')
export const fetchPriceChart = (params) => get('/api/price-chart', params)
export const fetchQuote = (params) => get('/api/quote', params)
