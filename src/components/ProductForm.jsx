import { useState, useEffect } from 'react'
import { flattenWithDepth } from '../utils/categoryTree'

const emptyRow = () => ({ id: crypto.randomUUID(), attributeId: '', value: '' })

function attributeType(attributes, attributeId) {
  return attributes.find((a) => a.id === attributeId)?.type
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Product.attributes is a flat list of {attributeId, value} pairs — an
// image attribute simply appears multiple times, once per image. Group
// those back into one row per attribute so editing shows one gallery
// instead of five duplicate rows.
function buildRowsFromProduct(product, attributes) {
  const grouped = new Map()
  for (const pa of product.attributes) {
    if (!grouped.has(pa.attributeId)) grouped.set(pa.attributeId, [])
    grouped.get(pa.attributeId).push(pa.value)
  }

  const rows = Array.from(grouped.entries()).map(([attributeId, values]) => ({
    id: crypto.randomUUID(),
    attributeId,
    value: attributeType(attributes, attributeId) === 'image' ? values : values[0],
  }))

  return rows.length > 0 ? rows : [emptyRow()]
}

function flattenRowsToAttributes(rows) {
  return rows.flatMap((row) => {
    if (!row.attributeId) return []
    if (Array.isArray(row.value)) {
      return row.value.map((value) => ({ attributeId: row.attributeId, value }))
    }
    return row.value.trim() ? [{ attributeId: row.attributeId, value: row.value.trim() }] : []
  })
}

function ProductForm({ categories, attributes, editingProduct, onAdd, onUpdate, onCancelEdit }) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [attributeRows, setAttributeRows] = useState([emptyRow()])
  const [isSaving, setIsSaving] = useState(false)
  const categoryOptions = flattenWithDepth(categories)
  const isEditing = Boolean(editingProduct)
  const everyAttributeUsed =
    attributes.length > 0 && attributes.every((a) => attributeRows.some((r) => r.attributeId === a.id))

  // Re-populate the form whenever we're handed a different product to
  // edit, and reset back to a blank form when editing ends.
  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name)
      setCategoryId(editingProduct.categoryId)
      setAttributeRows(buildRowsFromProduct(editingProduct, attributes))
    } else {
      setName('')
      setCategoryId('')
      setAttributeRows([emptyRow()])
    }
  }, [editingProduct, attributes])

  function updateRow(id, field, value) {
    setAttributeRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    )
  }

  function handleAttributeChange(id, attributeId) {
    const type = attributeType(attributes, attributeId)
    let defaultValue = ''
    if (type === 'image') defaultValue = []
    else if (type === 'boolean') defaultValue = 'true'
    setAttributeRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, attributeId, value: defaultValue } : row))
    )
  }

  async function handleImageSelect(id, fileList) {
    const dataUrls = await Promise.all(Array.from(fileList).map(readFileAsDataURL))
    setAttributeRows((rows) =>
      rows.map((row) =>
        row.id === id
          ? { ...row, value: [...(Array.isArray(row.value) ? row.value : []), ...dataUrls] }
          : row
      )
    )
  }

  function removeImage(id, index) {
    setAttributeRows((rows) =>
      rows.map((row) =>
        row.id === id ? { ...row, value: row.value.filter((_, i) => i !== index) } : row
      )
    )
  }

  // The thumbnail is always whichever image is first (see getThumbnail in
  // utils/productAttributes.js) — choosing a thumbnail just means moving
  // that image to the front of the array, not a separate flag to track.
  function setThumbnail(id, index) {
    setAttributeRows((rows) =>
      rows.map((row) => {
        if (row.id !== id || index === 0) return row
        const values = [...row.value]
        const [chosen] = values.splice(index, 1)
        values.unshift(chosen)
        return { ...row, value: values }
      })
    )
  }

  function addRow() {
    setAttributeRows((rows) => [...rows, emptyRow()])
  }

  function removeRow(id) {
    setAttributeRows((rows) => rows.filter((row) => row.id !== id))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !categoryId || isSaving) return

    const productPayload = {
      id: isEditing ? editingProduct.id : crypto.randomUUID(),
      name: name.trim(),
      categoryId,
      attributes: flattenRowsToAttributes(attributeRows),
    }

    setIsSaving(true)
    try {
      if (isEditing) {
        await onUpdate(productPayload)
      } else {
        await onAdd(productPayload)
        setName('')
        setCategoryId('')
        setAttributeRows([emptyRow()])
      }
    } catch (err) {
      console.error('Failed to save product:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="panel">
      <h2>{isEditing ? `Edit "${editingProduct.name}"` : 'Add Product'}</h2>
      <form onSubmit={handleSubmit} className="product-form">
        <input
          type="text"
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Select category</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {'—'.repeat(c.depth)} {c.name}
            </option>
          ))}
        </select>

        <div className="attribute-rows">
          <label>Attributes</label>
          {attributeRows.map((row) => {
            const type = attributeType(attributes, row.attributeId)
            // An attribute picked in another row is hidden here — picking
            // the same one twice used to silently store two values under
            // one attribute (e.g. two "Color"s), which every place that
            // reads a product's attributes assumes can't happen. The
            // row's own current pick stays in its list so it still shows
            // as selected.
            const usedElsewhere = new Set(
              attributeRows.filter((r) => r.id !== row.id && r.attributeId).map((r) => r.attributeId)
            )
            const availableAttributes = attributes.filter(
              (a) => a.id === row.attributeId || !usedElsewhere.has(a.id)
            )
            return (
              <div className="attribute-row" key={row.id}>
                <select
                  value={row.attributeId}
                  onChange={(e) => handleAttributeChange(row.id, e.target.value)}
                >
                  <option value="">Select attribute</option>
                  {availableAttributes.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>

                {type === 'image' ? (
                  <div className="image-attribute-input">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        handleImageSelect(row.id, e.target.files)
                        e.target.value = ''
                      }}
                    />
                    <p className="image-hint">Click the star on a photo to make it the thumbnail.</p>
                    {Array.isArray(row.value) && row.value.length > 0 && (
                      <div className="image-thumb-list">
                        {row.value.map((src, i) => (
                          <div className={i === 0 ? 'image-thumb is-thumbnail' : 'image-thumb'} key={i}>
                            {i === 0 ? (
                              <span className="thumbnail-tag">Thumbnail</span>
                            ) : (
                              <button
                                type="button"
                                className="set-thumbnail-btn"
                                onClick={() => setThumbnail(row.id, i)}
                                title="Set as thumbnail"
                                aria-label="Set as thumbnail"
                              >
                                &#9733;
                              </button>
                            )}
                            <img src={src} alt="" />
                            <button type="button" className="remove-image-btn" onClick={() => removeImage(row.id, i)}>
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : type === 'boolean' ? (
                  <label className="boolean-attribute-input">
                    <input
                      type="checkbox"
                      checked={row.value === 'true'}
                      onChange={(e) => updateRow(row.id, 'value', e.target.checked ? 'true' : 'false')}
                    />
                    {row.value === 'true' ? 'Yes' : 'No'}
                  </label>
                ) : (
                  <input
                    type="text"
                    placeholder="Value"
                    value={row.value}
                    onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                  />
                )}

                <button
                  type="button"
                  className="remove-row"
                  onClick={() => removeRow(row.id)}
                  disabled={attributeRows.length === 1}
                >
                  &times;
                </button>
              </div>
            )
          })}
          <button type="button" onClick={addRow} className="add-row" disabled={everyAttributeUsed}>
            + Add attribute
          </button>
        </div>

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={isSaving}>
            {isSaving ? (
              <>
                <span className="spinner" /> Saving...
              </>
            ) : isEditing ? (
              'Save Changes'
            ) : (
              'Add Product'
            )}
          </button>
          {isEditing && (
            <button type="button" className="cancel-edit-btn" onClick={onCancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default ProductForm
