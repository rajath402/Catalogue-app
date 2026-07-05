import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function SystemConfig({ settings, onUpdate }) {
  const { changePassword } = useAuth()
  const [siteName, setSiteName] = useState(settings.siteName || '')
  const [address, setAddress] = useState(settings.address || '')
  const [phone, setPhone] = useState(settings.phone || '')
  const [logo, setLogo] = useState(settings.logo || '')
  const [isSaving, setIsSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Settings load asynchronously after mount, so the form has to pick up
  // the real values once they arrive instead of being stuck on the
  // initial empty strings.
  useEffect(() => {
    setSiteName(settings.siteName || '')
    setAddress(settings.address || '')
    setPhone(settings.phone || '')
    setLogo(settings.logo || '')
  }, [settings.siteName, settings.address, settings.phone, settings.logo])

  async function handleLogoSelect(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setLogo(await readFileAsDataURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    try {
      await onUpdate({
        siteName: siteName.trim() || 'Product Catalogue',
        address: address.trim(),
        phone: phone.trim(),
        logo,
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }
    setIsChangingPassword(true)
    try {
      await changePassword(currentPassword, newPassword)
      setPasswordSuccess('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="managers">
      <div className="panel">
        <h2>System Configuration</h2>
        <form onSubmit={handleSubmit} className="system-config-form">
          <label>
            <span>App header title</span>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Product Catalogue"
            />
          </label>

          <label>
            <span>Logo</span>
            <input type="file" accept="image/*" onChange={handleLogoSelect} />
          </label>
          {logo && (
            <div className="logo-preview">
              <img src={logo} alt="Logo preview" />
              <button type="button" onClick={() => setLogo('')}>
                Remove logo
              </button>
            </div>
          )}

          <label>
            <span>Address</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Market Street, Springfield"
            />
          </label>

          <label>
            <span>Telephone number</span>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 0100"
            />
          </label>

          <button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <span className="spinner" /> Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Change Admin Password</h2>
        <form onSubmit={handlePasswordSubmit} className="system-config-form">
          <label>
            <span>Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label>
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          {passwordError && <p className="login-form-error">{passwordError}</p>}
          {passwordSuccess && <p className="password-success">{passwordSuccess}</p>}
          <button type="submit" disabled={isChangingPassword}>
            {isChangingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SystemConfig
