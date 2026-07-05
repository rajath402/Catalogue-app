import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const AuthContext = createContext(null)

const TOKEN_STORAGE_KEY = 'catalogue.authToken'

async function loginRequest(password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Login failed.')
  }
  return res.json()
}

async function changePasswordRequest(token, currentPassword, newPassword) {
  const res = await fetch('/api/auth/password', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Could not change password.')
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_STORAGE_KEY))
  const [isModalOpen, setIsModalOpen] = useState(false)
  // Holds whatever action was interrupted by a login prompt, so it runs
  // immediately after a successful login instead of making the user repeat
  // the click that triggered it (e.g. "Delete" on a product tile).
  const pendingActionRef = useRef(null)

  const isAuthenticated = Boolean(token)

  const logout = useCallback(() => {
    setToken(null)
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  }, [])

  const login = useCallback(async (password) => {
    const { token: newToken } = await loginRequest(password)
    setToken(newToken)
    sessionStorage.setItem(TOKEN_STORAGE_KEY, newToken)
    const pending = pendingActionRef.current
    pendingActionRef.current = null
    setIsModalOpen(false)
    if (pending) pending()
  }, [])

  // Call with no argument to just open the prompt (used by the inline
  // AuthGate), or with a callback to run automatically once login succeeds
  // (used by individual protected buttons like Edit/Delete on a product).
  const requireAuth = useCallback(
    (action) => {
      if (isAuthenticated) {
        action?.()
        return true
      }
      pendingActionRef.current = action || null
      setIsModalOpen(true)
      return false
    },
    [isAuthenticated]
  )

  const closeModal = useCallback(() => {
    pendingActionRef.current = null
    setIsModalOpen(false)
  }, [])

  const changePassword = useCallback(
    (currentPassword, newPassword) => changePasswordRequest(token, currentPassword, newPassword),
    [token]
  )

  // A 401 means the server no longer honors this token (it restarted, or
  // the session expired) — drop it and prompt again instead of leaving the
  // UI stuck thinking it's still logged in.
  const handleUnauthorized = useCallback(() => {
    logout()
    setIsModalOpen(true)
  }, [logout])

  const value = useMemo(
    () => ({
      token,
      isAuthenticated,
      isModalOpen,
      login,
      logout,
      requireAuth,
      closeModal,
      changePassword,
      handleUnauthorized,
    }),
    [
      token,
      isAuthenticated,
      isModalOpen,
      login,
      logout,
      requireAuth,
      closeModal,
      changePassword,
      handleUnauthorized,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
