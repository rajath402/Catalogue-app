import { useAuth } from '../auth/AuthContext'
import LoginForm from './LoginForm'

// Wraps an entire management section (Add Product, Categories, Attributes,
// System Configuration) and swaps it for an inline login prompt until the
// admin password has been entered. The section itself never mounts while
// logged out, so there's no button-by-button gating to keep in sync.
function AuthGate({ label, children }) {
  const { isAuthenticated, isModalOpen } = useAuth()
  if (isAuthenticated) return children
  // A session can expire while the user is already inside a gated section
  // (e.g. mid-edit) — that path opens the global LoginModal on top of
  // whatever's rendered underneath. Rendering nothing here instead of our
  // own inline form avoids stacking two login prompts at once; once the
  // modal closes, this re-evaluates normally.
  if (isModalOpen) return null

  return (
    <div className="panel auth-gate">
      <h2>Login Required</h2>
      <LoginForm heading={label ? `Log in to manage ${label}.` : 'Log in to access this section.'} />
    </div>
  )
}

export default AuthGate
