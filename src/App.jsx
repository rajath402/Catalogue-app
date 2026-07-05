import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import AuthGate from './components/AuthGate'
import LoginModal from './components/LoginModal'
import CategoryManager from './components/CategoryManager'
import AttributeManager from './components/AttributeManager'
import Sidebar from './components/Sidebar'
import ProductForm from './components/ProductForm'
import ProductList from './components/ProductList'
import SystemConfig from './components/SystemConfig'
import './App.css'

const TABS = ['Products', 'Add Product', 'Categories', 'Attributes', 'System Configuration']

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function failure(res) {
  const body = await res.json().catch(() => ({}))
  const err = new Error(body.error || `Request failed: ${res.status}`)
  err.status = res.status
  return err
}

async function postJSON(url, body, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await failure(res)
  return res.json()
}

async function putJSON(url, body, token) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await failure(res)
  return res.json()
}

async function deleteJSON(url, token) {
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders(token) })
  if (!res.ok) throw await failure(res)
}

function AppContent() {
  const { token, handleUnauthorized } = useAuth()
  const [activeTab, setActiveTab] = useState(TABS[0])
  const [transitionKey, setTransitionKey] = useState(0)
  const [categories, setCategories] = useState([])
  const [attributes, setAttributes] = useState([])
  const [products, setProducts] = useState([])
  const [settings, setSettings] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)

  // Runs once, right after the first render, to hydrate state from the
  // database instead of starting from empty arrays every time.
  useEffect(() => {
    fetch('/api/catalogue')
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories)
        setAttributes(data.attributes)
        setProducts(data.products)
        setSettings(data.settings || {})
      })
      .catch((err) => console.error('Failed to load catalogue:', err))
      .finally(() => setIsLoading(false))
  }, [])

  // Keep the browser tab in sync with the same name shown in the header —
  // it's the same "what is this app called" setting, just a different
  // place it's displayed.
  useEffect(() => {
    document.title = settings.siteName || 'Product Catalogue'
  }, [settings.siteName])

  function selectTab(tab) {
    if (tab === activeTab) return
    setActiveTab(tab)
    setTransitionKey((k) => k + 1)
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // A 401 here means the session expired (or the server restarted) between
  // the AuthGate letting the user into a section and them submitting an
  // action — drop them back to the login prompt instead of just showing a
  // generic error toast for what looks like a normal failure.
  function reportError(err) {
    if (err.status === 401) {
      handleUnauthorized()
    } else {
      showToast(err.message, 'error')
    }
  }

  async function addCategory(name, parentId) {
    const category = { id: crypto.randomUUID(), name, parentId }
    try {
      await postJSON('/api/categories', category, token)
      setCategories((prev) => [...prev, category])
    } catch (err) {
      reportError(err)
    }
  }

  async function addAttribute(name, type, filterable) {
    const attribute = { id: crypto.randomUUID(), name, type, filterable }
    try {
      await postJSON('/api/attributes', attribute, token)
      setAttributes((prev) => [...prev, attribute])
    } catch (err) {
      reportError(err)
    }
  }

  async function addProduct(product) {
    try {
      await postJSON('/api/products', product, token)
      setProducts((prev) => [...prev, product])
    } catch (err) {
      reportError(err)
      throw err
    }
  }

  function startEditProduct(product) {
    setEditingProduct(product)
    selectTab('Add Product')
  }

  function cancelEditProduct() {
    setEditingProduct(null)
  }

  async function updateProduct(product) {
    try {
      await putJSON(`/api/products/${product.id}`, product, token)
      setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)))
      setEditingProduct(null)
      showToast('Product updated.')
      selectTab('Products')
    } catch (err) {
      reportError(err)
      throw err
    }
  }

  async function reorderCategory(id, newParentId, position) {
    try {
      await putJSON(`/api/categories/${id}`, { parentId: newParentId, ...position }, token)
      // Category order is the row order returned by the API, not something
      // derivable by patching one field in place — refetch to pick up
      // wherever the category actually landed among its new siblings.
      const data = await fetch('/api/catalogue').then((res) => res.json())
      setCategories(data.categories)
      showToast('Category moved.')
    } catch (err) {
      reportError(err)
    }
  }

  async function deleteCategory(id) {
    try {
      await deleteJSON(`/api/categories/${id}`, token)
      setCategories((prev) => prev.filter((c) => c.id !== id))
      showToast('Category deleted.')
    } catch (err) {
      reportError(err)
    }
  }

  async function updateAttribute(id, updates) {
    try {
      const updated = await putJSON(`/api/attributes/${id}`, updates, token)
      setAttributes((prev) => prev.map((a) => (a.id === id ? updated : a)))
      showToast('Attribute updated.')
    } catch (err) {
      reportError(err)
    }
  }

  async function deleteAttribute(id) {
    try {
      await deleteJSON(`/api/attributes/${id}`, token)
      setAttributes((prev) => prev.filter((a) => a.id !== id))
      // The backend cascades the attribute's values out of every product;
      // mirror that here so the UI doesn't show a stale value until reload.
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          attributes: p.attributes.filter((pa) => pa.attributeId !== id),
        }))
      )
      showToast('Attribute deleted.')
    } catch (err) {
      reportError(err)
    }
  }

  async function updateAppSettings(updates) {
    try {
      const updated = await putJSON('/api/settings', updates, token)
      setSettings(updated)
      showToast('Settings updated.')
    } catch (err) {
      reportError(err)
    }
  }

  async function deleteProduct(id) {
    try {
      await deleteJSON(`/api/products/${id}`, token)
      setProducts((prev) => prev.filter((p) => p.id !== id))
      if (editingProduct?.id === id) setEditingProduct(null)
      showToast('Product deleted.')
    } catch (err) {
      reportError(err)
    }
  }

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="spinner spinner-lg" />
        <p>Loading catalogue...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="top-loader" key={transitionKey} />

      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
      <LoginModal />

      <header className="app-header">
        <Sidebar tabs={TABS} activeTab={activeTab} onSelect={selectTab} />
        {settings.logo && <img src={settings.logo} alt="" className="app-logo" />}
        <div className="app-header-text">
          <h1>{settings.siteName || 'Product Catalogue'}</h1>
          {(settings.address || settings.phone) && (
            <p className="app-header-meta">
              {[settings.address, settings.phone].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </header>

      <div className="tab-content">
        <div className="tab-panel" key={activeTab}>
          {activeTab === 'Products' && (
            <ProductList
              products={products}
              categories={categories}
              attributes={attributes}
              onDeleteProduct={deleteProduct}
              onEditProduct={startEditProduct}
            />
          )}

          {activeTab === 'Add Product' && (
            <AuthGate label="products">
              <ProductForm
                categories={categories}
                attributes={attributes}
                editingProduct={editingProduct}
                onAdd={addProduct}
                onUpdate={updateProduct}
                onCancelEdit={cancelEditProduct}
              />
            </AuthGate>
          )}

          {activeTab === 'Categories' && (
            <div className="managers">
              <AuthGate label="categories">
                <CategoryManager
                  categories={categories}
                  onAdd={addCategory}
                  onDelete={deleteCategory}
                  onReorder={reorderCategory}
                />
              </AuthGate>
            </div>
          )}

          {activeTab === 'Attributes' && (
            <AuthGate label="attributes">
              <AttributeManager
                items={attributes}
                onAdd={addAttribute}
                onUpdate={updateAttribute}
                onDelete={deleteAttribute}
              />
            </AuthGate>
          )}

          {activeTab === 'System Configuration' && (
            <AuthGate label="system configuration">
              <SystemConfig settings={settings} onUpdate={updateAppSettings} />
            </AuthGate>
          )}
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
