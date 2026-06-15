// GET /api/debug — diagnostic dump of all three "what do I own?" sources side by
// side, so we can pinpoint where a freshly bought stock actually lives.
import { proxy, paytmGet } from './_lib/handler.js'

export default proxy(async () => {
  const safe = (p) => paytmGet(p).catch((e) => ({ __error: e.message, __status: e.status }))
  const [holdings, positions, orders] = await Promise.all([
    safe('/holdings/v1/get-user-holdings-data'),
    safe('/orders/v1/position'),
    safe('/orders/v1/user/orders'),
  ])
  return { holdings, positions, orders }
})
