// GET /api/profile — user account details.
import { proxy, paytmGet } from './_lib/handler.js'

export default proxy(() => paytmGet('/accounts/v1/user/details'))
