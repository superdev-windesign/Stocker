# 📈 Stocker

A **Paytm Money** portfolio analytics dashboard + live market-data app, built with
React + React Router + Tailwind + Recharts + lightweight-charts (TradingView).

Two views (top nav):
- **Portfolio** (`/`) — full analytics dashboard: summary cards, holdings table (search/sort/
  paginate/CSV export), sector & market-cap allocation, performance vs Nifty/Sensex, advanced
  analytics + insights, an investment-journey timeline, and a per-stock detail page (`/stock/:id`)
  with a price chart (avg-buy line + buy/sell markers), ATH/ATL, CAGR/volatility/drawdown.
- **Live** (`/live`) — 5 Nifty 50 stocks streamed over the WebSocket (RELIANCE, TCS, HDFCBANK,
  INFY, ICICIBANK).

Dark + light theme (toggle in the header).

### Data scope (API-only)
The Paytm Open API provides **current holdings, today's orders, live prices, and historical price
candles** — but **not** lifetime trade history. So realized P&L, multi-year trade history, and the
full buy/sell timeline show honest "import tradebook" empty states. Sector / market-cap / Nifty /
Sensex come from a small **bundled static dataset** (`src/data/`). Everything else is real Paytm data.

## How it works

The browser connects directly to Paytm's broadcast WebSocket:

```
wss://developer-ws.paytmmoney.com/broadcast/user/v1/data?x_jwt_token=<PUBLIC_ACCESS_TOKEN>
```

It subscribes with a JSON preference array (`actionType: ADD`, `modeType: LTP`, `scripType: EQUITY`,
`exchangeType: NSE`, per scrip), then decodes the binary tick packets and updates the cards + chart.

> **Important — about the token:** the WebSocket authenticates with a **public access token**, not the
> raw API key/secret. That token is minted through Paytm's interactive login flow and is valid only until
> midnight IST, so you generate it fresh each day. The API key/secret cannot stream on their own and must
> never be shipped in browser code — that's why this app takes the token, not the secret.

## Token generation (the login flow)

Paytm's token exchange (`request_token` → `access_token`) **cannot** run in the browser: the
`gettoken` endpoint blocks cross-origin calls, and your `api_secret` must stay server-side. So a
backend holds the secret and does the exchange. **The same backend logic runs two ways**, sharing
one code path (`api/_lib/paytm.js`) and one Turso DB:

- **Locally** as an Express server (`server/index.js`, port **5174**).
- **In production** as Vercel serverless functions (`api/*.js`), same-origin under `/api/*`.

Paytm's **Return URL points at the app root**, so after login Paytm redirects to
`<app>/?requestToken=...`. The React app picks that up and POSTs it to `/api/exchange`:

```
[browser]  /api/login ─▶ Paytm login page ─▶ (Return URL) <app>/?requestToken=...
                                                │
[React]    POST /api/exchange { request_token } ─▶ backend exchanges with api_key + api_secret
                                                │
                                  stores token set in Turso, returns public_access_token
[React]    auto-connects the websocket; GET /api/token re-reads it on refresh
```

**One-time Paytm Developer Portal setup:** set your app's **Return URL** to your deployed root
(e.g. `https://stocker-beige.vercel.app/`). For local-only flows you can instead point it at
`http://localhost:5174`.

## Setup

```bash
npm install
cp .env.example .env       # then fill in PAYTM_API_KEY and PAYTM_API_SECRET
npm start                  # runs the backend (:5174) AND the React app (:5173) together
```

Open http://localhost:5173, click **🔑 Login with Paytm & generate token**, sign in, and you'll land
back in the app already connected. (Already have a token? Paste it manually instead.) Live ticks flow
only during NSE market hours; outside them the app connects but shows no price movement.

### Session persistence
After you log in, the backend stores the session in **Turso** (libSQL), so restarts — and the
stateless serverless functions — never force a re-login. Because local dev and the deployed site
share the same Turso DB, a login on either is instantly usable on the other (the TokenGate's
**"Copy stored token from DB"** button pulls it via `/api/token/retrieve`). Paytm tokens expire at
midnight IST — once expired, the saved session is auto-discarded and you log in again. `Logout`
clears the stored session.

## Deploy to Vercel

The frontend (Vite → `dist/`) and the backend (`api/*.js` serverless functions) deploy together as
one Vercel project. `vercel.json` rewrites all non-`/api/` paths to `index.html` for the SPA router.

1. Import the repo in Vercel (framework preset: **Vite**).
2. Set **Environment Variables**: `PAYTM_API_KEY`, `PAYTM_API_SECRET`, `TURSO_URL`,
   `TURSO_AUTH_TOKEN`. **Do not set `VITE_BACKEND_URL`** — leaving it unset makes the frontend call
   the same-origin `/api/*`.
3. In the Paytm Developer Portal set the **Return URL** to your deployed root (e.g.
   `https://stocker-beige.vercel.app/`).

## Scripts

- `npm start` — run backend + frontend together (use this)
- `npm run server` — token-helper backend only (port 5174)
- `npm run dev` — Vite frontend only (port 5173)
- `npm run build` — production build into `dist/`
- `npm run preview` — preview the production build

## Project layout

```
api/
  _lib/paytm.js             # shared Turso + Paytm logic (used by api/* AND server/)
  login/exchange/token/…    # auth+session serverless functions (production /api/*)
  [resource].js             # one dynamic proxy for all Paytm REST data endpoints
                            # (keeps us under Vercel Hobby's 12-function limit)
server/index.js             # local Express dev server (imports api/_lib/paytm.js)
src/
  config/stocks.js          # the 5 scrips + subscription preferences + id lookup
  services/parseBinary.js   # browser decoder for Paytm binary tick packets
  services/paytmSocket.js   # WebSocket connect / subscribe / reconnect
  hooks/useLiveQuotes.js    # owns the socket; exposes { status, error, quotes, history }
  components/               # TokenGate, ConnectionBadge, StockCard, PriceChart
  App.jsx                   # token gate → dashboard
```

## Extending

Add or change stocks in [`src/config/stocks.js`](src/config/stocks.js) — each entry needs `symbol`,
`name`, and the NSE `scripId` (security id). To show OHLC / depth, switch `modeType` to `QUOTE` or `FULL`
in the preferences; the decoder already handles those packet types.
