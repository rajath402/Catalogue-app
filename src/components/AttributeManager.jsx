import { useState } from 'react'

function attributeTypeLabel(type) {
  if (type === 'number') return 'range'
  if (type === 'image') return 'gallery'
  if (type === 'boolean') return 'toggle'
  return 'select'
}

function AttributeManager({ items, onAdd, onUpdate, onDelete }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('text')
  const [filterable, setFilterable] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editFilterable, setEditFilterable] = useState(true)

  function handleTypeChange(newType) {
    setType(newType)
    // Filtering by raw image data makes no sense, so the checkbox is
    // disabled and forced off for image attributes.
    setFilterable(newType !== 'image')
  }

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, type, filterable)
    setName('')
    setType('text')
    setFilterable(true)
  }

  function handleDelete(item) {
    if (window.confirm(`Delete "${item.name}"? Any value stored against it on existing products will also be removed.`)) {
      onDelete(item.id)
    }
  }

  function startEdit(item) {
    setEditingId(item.id)
    setEditName(item.name)
    setEditFilterable(item.filterable)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function saveEdit(item) {
    const trimmed = editName.trim()
    if (!trimmed) return
    onUpdate(item.id, { name: trimmed, filterable: editFilterable })
    setEditingId(null)
  }

  return (
    <div className="panel">
      <h2>Attributes</h2>
      <form onSubmit={handleSubmit} className="attribute-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New attribute"
        />
        <select value={type} onChange={(e) => handleTypeChange(e.target.value)}>
          <option value="text">Text (filter by value)</option>
          <option value="number">Number (filter by range)</option>
          <option value="image">Image (multiple, not filterable)</option>
          <option value="boolean">Boolean (yes/no toggle)</option>
        </select>
        <label className="filterable-checkbox">
          <input
            type="checkbox"
            checked={filterable}
            disabled={type === 'image'}
            onChange={(e) => setFilterable(e.target.checked)}
          />
          Filterable
        </label>
        <button type="submit">Add</button>
      </form>
      <ul className="tag-list">
        {items.map((item) =>
          editingId === item.id ? (
            <li key={item.id} className="attribute-edit-row">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
              <label className="filterable-checkbox">
                <input
                  type="checkbox"
                  checked={editFilterable}
                  disabled={item.type === 'image' || item.system === 'showPrice'}
                  onChange={(e) => setEditFilterable(e.target.checked)}
                />
                Filterable
              </label>
              <button type="button" className="save-edit-btn" onClick={() => saveEdit(item)}>
                Save
              </button>
              <button type="button" className="cancel-edit-btn" onClick={cancelEdit}>
                Cancel
              </button>
            </li>
          ) : (
            <li key={item.id}>
              <span>
                {item.name} <span className="badge">{attributeTypeLabel(item.type)}</span>{' '}
                <span className={item.filterable ? 'badge badge-green' : 'badge badge-muted'}>
                  {item.filterable ? 'Filterable' : 'Not filterable'}
                </span>
                {item.system && <span className="badge badge-system">System</span>}
              </span>
              <span className="tag-list-actions">
                <button type="button" className="edit-btn" onClick={() => startEdit(item)}>
                  Edit
                </button>
                {/* Always rendered (just hidden for system attributes) so
                    every row reserves the same width here — otherwise the
                    Edit button lands in a different column depending on
                    whether a delete button follows it. */}
                <button
                  type="button"
                  className={item.system ? 'delete-btn is-hidden' : 'delete-btn'}
                  onClick={() => handleDelete(item)}
                  aria-label={`Delete ${item.name}`}
                  tabIndex={item.system ? -1 : 0}
                >
                  &times;
                </button>
              </span>
            </li>
          )
        )}
      </ul>
    </div>
  )
}

export default AttributeManager
