// GET /api/price-chart — historical candles. Pass through query
// (security_id/symbol, exchange, interval, from/to).
import { proxy, paytmGet } from './_lib/handler.js'

export default proxy((req) => paytmGet('/data/v1/price-charts/sym', req.query))
