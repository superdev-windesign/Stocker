import { createContext, useContext, useEffect, useState } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

const AuthContext = createContext(null)

/**
 * Tracks the Paytm session. "Logged in" == the token-helper backend has a cached
 * public_access_token (returned by GET /api/token). Portfolio /api/* calls use the
 * backend's server-side access_token, so the frontend only needs this token for the
 * live websocket and as a login signal.
 */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [authError, setAuthError] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error')) {
      setAuthError(decodeURIComponent(params.get('error')))
      window.history.replaceState({}, '', window.location.pathname)
    }
    // Always probe the backend so a page refresh stays logged in.
    fetch(`${BACKEND_URL}/api/token`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.public_access_token && setToken(d.public_access_token))
      .catch(() => {})
      .finally(() => {
        setChecking(false)
        if (params.get('connected')) window.history.replaceState({}, '', window.location.pathname)
      })
  }, [])

  const logout = () => {
    setToken(null)
    fetch(`${BACKEND_URL}/api/logout`, { method: 'POST' }).catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ token, setToken, authError, setAuthError, checking, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
