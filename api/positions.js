// GET /api/positions — intraday/derivative positions.
import { proxy, paytmGet } from './_lib/handler.js'

export default proxy(() => paytmGet('/orders/v1/position'))
