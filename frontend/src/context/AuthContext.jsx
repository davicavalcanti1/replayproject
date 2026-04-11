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
    const res = await fetch('/api/login', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ username, password }),
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Usuário ou senha incorretos.')
    setUser(data)
    return data
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
