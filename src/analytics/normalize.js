// Normalizes Paytm's holdings payload (field names vary) into a stable shape the
// UI consumes, enriched with bundled sector data.
import { enrich } from '../data/sectors'

const num = (...vals) => {
  for (const v of vals) {
    if (v == null || v === '') continue
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

const str = (...vals) => {
  for (const v of vals) if (v != null && v !== '') return String(v)
  return null
}

/**
 * @param {object} apiResponse  body of GET /api/holdings ({ holdings, value })
 * @returns {Array<object>} normalized holdings
 */
export function normalizeHoldings(apiResponse) {
  const raw =
    apiResponse?.holdings?.data ||
    apiResponse?.holdings?.holdings ||
    apiResponse?.data ||
    (Array.isArray(apiResponse?.holdings) ? apiResponse.holdings : []) ||
    []

  if (!Array.isArray(raw)) return []

  return raw
    .map((h) => {
      const symbol = str(h.nse_symbol, h.bse_symbol, h.symbol, h.tradingsymbol, h.display_name)
      const quantity = num(h.quantity, h.qty, h.total_qty, h.net_qty) ?? 0
      const avgPrice = num(h.cost_price, h.avg_price, h.average_price, h.buy_avg_price, h.cost) ?? 0
      const lastPrice = num(h.ltp, h.last_price, h.last_traded_price, h.close_price) ?? 0
      const prevClose = num(h.close_price, h.previous_close, h.prev_close, h.pdc)
      const invested = quantity * avgPrice
      const currentValue = quantity * lastPrice
      const pnl = num(h.pnl, h.unrealized_pnl) ?? currentValue - invested
      const pnlPct = invested ? (pnl / invested) * 100 : null

      let dayChangeAbs = null
      let dayChangePct = null
      if (prevClose && lastPrice) {
        dayChangeAbs = (lastPrice - prevClose) * quantity
        dayChangePct = ((lastPrice - prevClose) / prevClose) * 100
      }

      const meta = enrich(symbol)
      return {
        securityId: str(h.security_id, h.securityId, h.token, h.instrument_token),
        symbol: symbol || '—',
        name: str(h.display_name, h.name, h.company_name) || symbol || '—',
        exchange: str(h.exchange, h.exchange_segment, 'NSE'),
        isin: str(h.isin),
        instrument: str(h.instrument, h.product) || 'EQUITY',
        quantity,
        avgPrice,
        lastPrice,
        prevClose,
        invested,
        currentValue,
        pnl,
        pnlPct,
        dayChangeAbs,
        dayChangePct,
        sector: meta.sector,
        industry: meta.industry,
        cap: meta.cap,
      }
    })
    .filter((h) => h.quantity > 0)
}
