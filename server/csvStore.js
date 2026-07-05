import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')

// The full set of "tables" this app persists, and their column order.
// This is the CSV equivalent of the CREATE TABLE statements we used to
// have in db.js — it's still a schema, just enforced by convention
// instead of the database engine. Brand is deliberately absent: it's now
// just another attribute value, stored in productAttributes like Color
// or Price.
const TABLES = {
  categories: ['id', 'name', 'parentId'],
  attributes: ['id', 'name', 'type', 'filterable', 'system'],
  products: ['id', 'name', 'categoryId'],
  productAttributes: ['productId', 'attributeId', 'value'],
  settings: ['key', 'value'],
}

// App-wide configuration, as opposed to product data. Keyed by a stable
// `key` (not a generated id) since there's only ever one row per setting.
const DEFAULT_SETTINGS = {
  siteName: 'Product Catalogue',
  address: '',
  phone: '',
  logo: '',
}

// The three attributes that get a fixed, designated spot in the PDP layout
// instead of flowing into the generic spec list. Identified by this `system`
// key rather than by name, so renaming "Brand" to "Manufacturer" doesn't
// break its placement or its delete protection.
const SYSTEM_ATTRIBUTES = [
  { key: 'brand', name: 'Brand', type: 'text', filterable: true },
  { key: 'price', name: 'Price', type: 'number', filterable: true },
  { key: 'photos', name: 'Photos', type: 'image', filterable: false },
  // Purely a control flag: never shown on the PDP or PLP itself, and only
  // ever consulted to decide whether the Price block should render.
  { key: 'showPrice', name: 'Show Price', type: 'boolean', filterable: false },
]

function filePath(table) {
  return path.join(DATA_DIR, `${table}.csv`)
}

// One-time migration for installs created before Brand was folded into
// the generic attribute system. If data/brands.csv is still on disk, this
// creates a "Brand" attribute, copies each product's brand name into
// productAttributes, drops the brandId column from products.csv, and
// deletes brands.csv so this never runs again.
function migrateBrandsToAttributes() {
  const brandsPath = path.join(DATA_DIR, 'brands.csv')
  if (!fs.existsSync(brandsPath)) return

  const brands = parse(fs.readFileSync(brandsPath, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
  })
  const products = readTable('products')

  let attributes = readTable('attributes')
  let brandAttribute = attributes.find((a) => a.name === 'Brand')
  if (!brandAttribute) {
    brandAttribute = { id: crypto.randomUUID(), name: 'Brand', type: 'text', filterable: 'true' }
    appendRow('attributes', brandAttribute)
  }

  for (const product of products) {
    const brand = brands.find((b) => b.id === product.brandId)
    if (brand) {
      appendRow('productAttributes', {
        productId: product.id,
        attributeId: brandAttribute.id,
        value: brand.name,
      })
    }
  }

  const cleanedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
  }))
  fs.writeFileSync(
    filePath('products'),
    stringify(cleanedProducts, { header: true, columns: TABLES.products })
  )

  fs.unlinkSync(brandsPath)
}

// Tags the existing Brand/Price/Photos attributes as system attributes (by
// matching name + type, once) or creates them if they don't exist at all.
// Idempotent: once an attribute carries a given `system` key, it's skipped
// on every future run, so renaming it later doesn't cause a duplicate to
// be created.
function ensureSystemAttributes() {
  const attributes = readTable('attributes')

  for (const spec of SYSTEM_ATTRIBUTES) {
    if (attributes.some((a) => a.system === spec.key)) continue

    const existing = attributes.find(
      (a) => a.name === spec.name && a.type === spec.type && !a.system
    )

    if (existing) {
      updateRow('attributes', existing.id, { system: spec.key })
    } else {
      appendRow('attributes', {
        id: crypto.randomUUID(),
        name: spec.name,
        type: spec.type,
        filterable: String(spec.filterable),
        system: spec.key,
      })
    }
  }
}

// Seeds any setting that's never been saved before. Idempotent: once a key
// exists (even with a value the user changed), it's left alone.
function ensureDefaultSettings() {
  const settings = readTable('settings')
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!settings.some((s) => s.key === key)) {
      appendRow('settings', { key, value })
    }
  }
}

// Creates data/ and one empty (header-only) CSV per table if they don't
// exist yet. Safe to call on every server start.
export function initStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  migrateBrandsToAttributes()
  for (const [table, columns] of Object.entries(TABLES)) {
    if (!fs.existsSync(filePath(table))) {
      fs.writeFileSync(filePath(table), stringify([], { header: true, columns }))
    }
  }
  ensureSystemAttributes()
  ensureDefaultSettings()
}

export function readTable(table) {
  const raw = fs.readFileSync(filePath(table), 'utf-8')
  return parse(raw, { columns: true, skip_empty_lines: true })
}

// Rewrites the whole file with the new row appended. For a catalogue this
// small, reading + rewriting the entire CSV per write is simpler than
// true appending and avoids ever getting the header out of sync.
export function appendRow(table, row) {
  const rows = readTable(table)
  rows.push(row)
  fs.writeFileSync(filePath(table), stringify(rows, { header: true, columns: TABLES[table] }))
}

// Removes every row matching `predicate` and rewrites the file.
export function deleteRows(table, predicate) {
  const rows = readTable(table)
  const remaining = rows.filter((row) => !predicate(row))
  fs.writeFileSync(filePath(table), stringify(remaining, { header: true, columns: TABLES[table] }))
  return rows.length - remaining.length
}

// Convenience wrapper for the common case of deleting a single row by id.
export function deleteById(table, id) {
  return deleteRows(table, (row) => row.id === id)
}

// Merges `updates` into the row matching `id` and rewrites the file.
export function updateRow(table, id, updates) {
  const rows = readTable(table)
  const index = rows.findIndex((row) => row.id === id)
  if (index === -1) return false
  rows[index] = { ...rows[index], ...updates }
  fs.writeFileSync(filePath(table), stringify(rows, { header: true, columns: TABLES[table] }))
  return true
}

// Replaces the entire table with `rows`, in exactly the order given. Used
// where row ORDER itself is meaningful data (category display order is
// just its row order in the file) and a plain field update isn't enough —
// the row has to move, not just change.
export function writeTable(table, rows) {
  fs.writeFileSync(filePath(table), stringify(rows, { header: true, columns: TABLES[table] }))
}

export function getSettings() {
  return Object.fromEntries(readTable('settings').map((s) => [s.key, s.value]))
}

// Settings are keyed by `key` rather than a generated `id`, so this can't
// reuse updateRow — it upserts each key instead of requiring it to already
// exist as a row.
export function updateSettings(updates) {
  const rows = readTable('settings')
  for (const [key, value] of Object.entries(updates)) {
    const index = rows.findIndex((row) => row.key === key)
    if (index === -1) rows.push({ key, value })
    else rows[index] = { key, value }
  }
  fs.writeFileSync(filePath('settings'), stringify(rows, { header: true, columns: TABLES.settings }))
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}
