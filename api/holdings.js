// GET /api/holdings — current holdings + holdings value.
import { proxy, paytmGet } from './_lib/handler.js'

export default proxy(async () => {
  const holdings = await paytmGet('/holdings/v1/get-user-holdings-data')
  const value = await paytmGet('/holdings/v1/get-holdings-value').catch(() => null)
  return { holdings, value }
})
