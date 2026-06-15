// GET /api/quote — live REST quote. mode=LTP|QUOTE|FULL, pref=EXCH:SECID:TYPE (csv).
import { proxy, paytmGet } from './_lib/handler.js'

export default proxy((req) => paytmGet('/data/v1/price/live', req.query))
