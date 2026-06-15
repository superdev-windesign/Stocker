import { useState } from 'react'

const ENV_TOKEN = import.meta.env.VITE_PAYTM_PUBLIC_ACCESS_TOKEN || ''
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

export default function TokenGate({ onConnect, error }) {
  const [token, setToken] = useState(ENV_TOKEN)

  const submit = (e) => {
    e.preventDefault()
    const t = token.trim()
    if (t) onConnect(t)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12161c] p-8 shadow-xl"
      >
        <h1 className="text-2xl font-bold tracking-tight">📈 Stocker</h1>
        <p className="mt-1 text-sm text-gray-400">Live Nifty 50 market data via Paytm Money</p>

        {error && (
          <div className="mt-4 rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
            {error}
          </div>
        )}

        {/* Recommended path: one-click login that generates the token server-side. */}
        <a
          href={`${BACKEND_URL}/login`}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition hover:bg-indigo-500"
        >
          🔑 Login with Paytm &amp; generate token
        </a>
        <p className="mt-2 text-xs text-gray-500">
          Opens the Paytm login. After you sign in, the token helper exchanges your request token and
          brings you back here connected. Requires the backend running (<code>npm run server</code>).
        </p>

        <div className="my-6 flex items-center gap-3 text-xs text-gray-600">
          <span className="h-px flex-1 bg-white/10" /> or paste manually <span className="h-px flex-1 bg-white/10" />
        </div>

        <label className="block text-sm font-medium text-gray-300">
          Public access token
        </label>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          rows={3}
          placeholder="Paste your Paytm Money public access token…"
          className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-[#0b0e11] p-3 font-mono text-sm text-gray-100 outline-none focus:border-indigo-500"
        />
        <p className="mt-2 text-xs text-gray-500">
          This is the daily token minted after the Paytm login flow (valid until midnight IST).
          You can also set <code className="text-gray-400">VITE_PAYTM_PUBLIC_ACCESS_TOKEN</code> in{' '}
          <code className="text-gray-400">.env</code> to pre-fill it.
        </p>

        <button
          type="submit"
          disabled={!token.trim()}
          className="mt-5 w-full rounded-lg border border-white/15 py-2.5 font-semibold text-gray-200 transition hover:border-white/35 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Connect with pasted token
        </button>
      </form>
    </div>
  )
}
