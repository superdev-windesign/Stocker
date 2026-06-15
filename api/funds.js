// GET /api/funds — funds summary.
import { proxy, paytmGet } from './_lib/handler.js'

export default proxy(() => paytmGet('/accounts/v1/funds/summary', { config: 'false' }))
