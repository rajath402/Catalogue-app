import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

function Sidebar({ tabs, activeTab, onSelect }) {
  const { isAuthenticated, logout } = useAuth()
  const [open, setOpen] = useState(false)

  function handleSelect(tab) {
    onSelect(tab)
    setOpen(false)
  }

  function handleLogout() {
    logout()
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
      >
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
      </button>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <nav className={open ? 'sidebar open' : 'sidebar'}>
        <div className="sidebar-header">
          <span>Menu</span>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            &times;
          </button>
        </div>
        <ul className="sidebar-nav-list">
          {tabs.map((tab) => (
            <li key={tab}>
              <button
                type="button"
                className={tab === activeTab ? 'sidebar-link active' : 'sidebar-link'}
                onClick={() => handleSelect(tab)}
              >
                {tab}
              </button>
            </li>
          ))}
        </ul>

        {isAuthenticated && (
          <div className="sidebar-footer">
            <button type="button" className="sidebar-logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </nav>
    </>
  )
}

export default Sidebar
