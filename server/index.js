import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  initStore,
  readTable,
  appendRow,
  deleteRows,
  deleteById,
  updateRow,
  writeTable,
  getSettings,
  updateSettings,
} from './csvStore.js'
import {
  initAuth,
  checkPassword,
  changePassword,
  createSession,
  requireAuth,
  isLoginRateLimited,
  recordFailedLogin,
} from './auth.js'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(rootDir, '..', 'dist')

const app = express()
// No CORS needed: in dev the Vite proxy makes /api requests same-origin
// before they ever reach the browser, and in production this same server
// serves the built frontend, so every request is same-origin by
// construction. A cross-origin client was never a supported use case.
// Image attribute values are base64 data URLs stored inline, so requests
// can be much larger than Express's 100kb JSON default.
app.use(express.json({ limit: '25mb' }))

initStore()
initAuth()

app.get('/api/catalogue', (req, res) => {
  const categories = readTable('categories').map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId || null,
  }))
  // Images have no meaningful "filter by value" — force it off regardless
  // of what's stored, so old data (saved before this field existed) and
  // any bad input both land on the right answer. Show Price is a pure
  // control flag (hidden from the PDP/PLP itself), so filtering by it
  // would expose an attribute the shopper never sees the value of.
  const attributes = readTable('attributes').map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    filterable: a.type === 'image' || a.system === 'showPrice' ? false : a.filterable !== 'false',
    system: a.system || null,
  }))
  const productAttributes = readTable('productAttributes')

  const products = readTable('products').map((p) => ({
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    attributes: productAttributes
      .filter((pa) => pa.productId === p.id)
      .map((pa) => ({ attributeId: pa.attributeId, value: pa.value })),
  }))

  res.json({ categories, attributes, products, settings: getSettings() })
})

app.post('/api/auth/login', (req, res) => {
  if (isLoginRateLimited(req.ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' })
  }
  const { password } = req.body || {}
  // Reject non-string values before they ever reach scrypt — it throws a
  // TypeError for anything else, and this route runs before requireAuth,
  // so a synchronous throw here would be a pre-auth crash reachable by
  // anyone.
  if (typeof password !== 'string' || !checkPassword(password)) {
    recordFailedLogin(req.ip)
    return res.status(401).json({ error: 'Incorrect password.' })
  }
  res.json({ token: createSession() })
})

app.put('/api/auth/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Passwords must be provided as text.' })
  }
  const result = changePassword(currentPassword, newPassword)
  if (!result.ok) {
    return res.status(400).json({ error: result.error })
  }
  res.status(204).end()
})

app.put('/api/settings', requireAuth, (req, res) => {
  res.json(updateSettings(req.body || {}))
})

app.post('/api/categories', requireAuth, (req, res) => {
  const { id, name, parentId } = req.body
  appendRow('categories', { id, name, parentId: parentId || '' })
  res.status(201).json({ id, name, parentId: parentId || null })
})

app.post('/api/attributes', requireAuth, (req, res) => {
  const { id, name, type, filterable } = req.body
  const trimmedName = (name || '').trim()

  const duplicate = readTable('attributes').some(
    (a) => a.name.toLowerCase() === trimmedName.toLowerCase()
  )
  if (duplicate) {
    return res.status(409).json({ error: `An attribute named "${trimmedName}" already exists.` })
  }

  const safeType = ['number', 'image', 'boolean'].includes(type) ? type : 'text'
  const safeFilterable = safeType === 'image' ? false : filterable !== false
  // `system` is never client-settable — it's only ever assigned internally
  // by ensureSystemAttributes(), so a freshly created attribute is always
  // a regular, deletable one.
  appendRow('attributes', {
    id,
    name: trimmedName,
    type: safeType,
    filterable: String(safeFilterable),
    system: '',
  })
  res.status(201).json({ id, name: trimmedName, type: safeType, filterable: safeFilterable, system: null })
})

app.put('/api/attributes/:id', requireAuth, (req, res) => {
  const { id } = req.params
  const { name, filterable } = req.body
  const trimmedName = (name || '').trim()

  const attributes = readTable('attributes')
  const existing = attributes.find((a) => a.id === id)
  if (!existing) {
    return res.status(404).json({ error: 'Attribute not found.' })
  }
  if (!trimmedName) {
    return res.status(400).json({ error: 'Name cannot be empty.' })
  }

  const duplicate = attributes.some(
    (a) => a.id !== id && a.name.toLowerCase() === trimmedName.toLowerCase()
  )
  if (duplicate) {
    return res.status(409).json({ error: `An attribute named "${trimmedName}" already exists.` })
  }

  // Type is intentionally not editable here — changing it after products
  // already hold values for this attribute would leave old values (e.g.
  // free text) inconsistent with the new type (e.g. images).
  const safeFilterable =
    existing.type === 'image' || existing.system === 'showPrice' ? false : filterable !== false
  updateRow('attributes', id, { name: trimmedName, filterable: String(safeFilterable) })
  res.json({
    id,
    name: trimmedName,
    type: existing.type,
    filterable: safeFilterable,
    system: existing.system || null,
  })
})

app.post('/api/products', requireAuth, (req, res) => {
  const { id, name, categoryId, attributes } = req.body

  appendRow('products', { id, name, categoryId })

  for (const attr of attributes) {
    appendRow('productAttributes', {
      productId: id,
      attributeId: attr.attributeId,
      value: attr.value,
    })
  }

  res.status(201).json({ id, name, categoryId, attributes })
})

app.put('/api/products/:id', requireAuth, (req, res) => {
  const { id } = req.params
  const { name, categoryId, attributes } = req.body

  const updated = updateRow('products', id, { name, categoryId })
  if (!updated) {
    return res.status(404).json({ error: 'Product not found.' })
  }

  // Replace-all is simpler and just as correct as diffing at this scale:
  // wipe every existing value for this product, then write the new set.
  deleteRows('productAttributes', (row) => row.productId === id)
  for (const attr of attributes) {
    appendRow('productAttributes', {
      productId: id,
      attributeId: attr.attributeId,
      value: attr.value,
    })
  }

  res.json({ id, name, categoryId, attributes })
})

app.delete('/api/products/:id', requireAuth, (req, res) => {
  const { id } = req.params
  deleteById('products', id)
  // Product attribute values belong exclusively to this product, so they
  // cascade — nothing else references a row in productAttributes.
  deleteRows('productAttributes', (row) => row.productId === id)
  res.status(204).end()
})

app.delete('/api/attributes/:id', requireAuth, (req, res) => {
  const { id } = req.params

  const existing = readTable('attributes').find((a) => a.id === id)
  if (existing?.system) {
    return res.status(409).json({ error: 'This is a system attribute and cannot be deleted.' })
  }

  deleteById('attributes', id)
  // Cascade: a value stored against a now-deleted attribute is orphaned
  // data, so it goes with it. This does not touch the products themselves.
  deleteRows('productAttributes', (row) => row.attributeId === id)
  res.status(204).end()
})

app.put('/api/categories/:id', requireAuth, (req, res) => {
  const { id } = req.params
  const { parentId, beforeId, afterId } = req.body
  const newParentId = parentId || null

  const categories = readTable('categories')
  const existing = categories.find((c) => c.id === id)
  if (!existing) {
    return res.status(404).json({ error: 'Category not found.' })
  }
  if (newParentId && !categories.some((c) => c.id === newParentId)) {
    return res.status(404).json({ error: 'Target parent category not found.' })
  }

  // A category can't become its own ancestor — dropping it onto itself or
  // onto one of its current descendants would make the tree unreachable.
  const descendantIds = new Set([id])
  let frontier = [id]
  while (frontier.length > 0) {
    frontier = categories.filter((c) => frontier.includes(c.parentId)).map((c) => c.id)
    frontier.forEach((cid) => descendantIds.add(cid))
  }
  if (newParentId && descendantIds.has(newParentId)) {
    return res.status(409).json({ error: 'Cannot move a category into itself or its own subcategory.' })
  }

  // Display order is just row order in the file, so reordering means
  // physically moving the row — pull it out, then reinsert it next to
  // `beforeId`/`afterId` if given, or at the end (e.g. when it's simply
  // being nested into a new parent with no specific position requested).
  const withoutDragged = categories.filter((c) => c.id !== id)
  const updated = { ...existing, parentId: newParentId || '' }

  let insertAt = withoutDragged.length
  if (beforeId) {
    const idx = withoutDragged.findIndex((c) => c.id === beforeId)
    if (idx !== -1) insertAt = idx
  } else if (afterId) {
    const idx = withoutDragged.findIndex((c) => c.id === afterId)
    if (idx !== -1) insertAt = idx + 1
  }
  withoutDragged.splice(insertAt, 0, updated)

  writeTable('categories', withoutDragged)
  res.json({ id, name: existing.name, parentId: newParentId })
})

app.delete('/api/categories/:id', requireAuth, (req, res) => {
  const { id } = req.params
  const hasChildren = readTable('categories').some((c) => c.parentId === id)
  if (hasChildren) {
    return res.status(409).json({
      error: 'This category has subcategories. Delete those first.',
    })
  }
  const hasProducts = readTable('products').some((p) => p.categoryId === id)
  if (hasProducts) {
    return res.status(409).json({
      error: 'This category is still assigned to one or more products. Delete or reassign those products first.',
    })
  }
  deleteById('categories', id)
  res.status(204).end()
})

// Serves the built frontend (npm run build -> dist/) so this one server
// covers the whole app in production — no separate static host, no CORS,
// no dev proxy. Only kicks in when a build actually exists, so running the
// API alone in local dev (against the Vite dev server on a different
// port) behaves exactly as before.
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distDir, 'index.html'), (err) => {
      if (err) next(err)
    })
  })
}

// Safety net: Express catches synchronous throws from any route handler
// above and routes them here instead of crashing the process. Without
// this, its default handler renders a full stack trace (internal file
// paths, module layout) straight into the response body for any uncaught
// exception — including from routes reachable before login.
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong.' })
})

const port = process.env.PORT || 4000

app.listen(port, () => {
  console.log(`Catalogue API listening on http://localhost:${port}`)
})
