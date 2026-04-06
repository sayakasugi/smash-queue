"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"

type User = { id: string; name: string; xUsername: string } | null

const AuthContext = createContext<{
  user: User
  loading: boolean
  login: (xUsername: string, name?: string) => Promise<boolean>
  logout: () => Promise<void>
}>({ user: null, loading: true, login: async () => false, logout: async () => {} })

export function useAuth() {
  return useContext(AuthContext)
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => {
        if (r.ok) return r.json()
        return { user: null }
      })
      .then((data) => { if (data.user) setUser(data.user) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (xUsername: string, name?: string) => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xUsername, name }),
    })
    if (res.ok) {
      const data = await res.json()
      setUser(data.user)
      return true
    }
    return false
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/auth", { method: "DELETE" })
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
