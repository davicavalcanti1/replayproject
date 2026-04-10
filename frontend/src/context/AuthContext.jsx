import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Check if there's an active Flask session
  const checkSession = async () => {
    try {
      const res = await fetch('/api/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data)
        return data
      }
      setUser(null)
      return null
    } catch {
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { checkSession() }, [])

  /**
   * POST credentials to Flask /login (which sets the session cookie),
   * then verify the session via /api/me.
   * Throws if credentials are wrong.
   */
  const login = async (username, password) => {
    // Step 1 — let Flask authenticate and set the session cookie
    await fetch('/login', {
      method:   'POST',
      headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:     new URLSearchParams({ username, password }),
      redirect: 'manual',   // don't follow the 302 redirect; cookie IS stored
    })

    // Step 2 — confirm the session is active
    const u = await checkSession()
    if (!u) throw new Error('Usuário ou senha incorretos.')
    return u
  }

  const logout = async () => {
    await fetch('/logout', { redirect: 'manual' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
