import { useAuth } from '../auth/AuthContext'
import LoginForm from './LoginForm'

function LoginModal() {
  const { isModalOpen, closeModal } = useAuth()
  if (!isModalOpen) return null

  return (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Login Required</h3>
        <LoginForm heading="Enter the admin password to continue." onSuccess={closeModal} onCancel={closeModal} />
      </div>
    </div>
  )
}

export default LoginModal
