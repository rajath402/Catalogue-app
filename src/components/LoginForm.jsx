import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

function LoginForm({ heading, onSuccess, onCancel }) {
  const { login } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password || isSubmitting) return
    setIsSubmitting(true)
    setError('')
    try {
      await login(password)
      setPassword('')
      onSuccess?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      {heading && <p className="login-form-heading">{heading}</p>}
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoFocus
      />
      {error && <p className="login-form-error">{error}</p>}
      <div className="login-form-actions">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Checking...' : 'Log in'}
        </button>
        {onCancel && (
          <button type="button" className="login-form-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export default LoginForm
