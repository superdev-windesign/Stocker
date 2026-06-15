// GET /api/orders — today's orders.
import { proxy, paytmGet } from './_lib/handler.js'

export default proxy(() => paytmGet('/orders/v1/user/orders'))
