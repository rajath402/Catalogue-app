import { getChildren } from '../utils/categoryTree'

// Renders itself recursively: each node renders a <ul> of its own children,
// which each render a <ul> of THEIR children, and so on until a node has none.
// `onDelete` is only used by the plain management view — the navigation
// trees (CategoryNav, its mobile variant) never pass it, so no delete
// button ever appears where a user is just browsing.
//
// `dnd` opts a tree into drag-and-drop reparenting (only CategoryManager
// does this — the read-only nav trees never pass it). Drag state lives in
// the parent so the whole tree can highlight the current drop target as
// the user drags across sibling/nested rows.
function CategoryTreeView({
  categories,
  parentId = null,
  selectedId,
  onSelect,
  onDelete,
  dnd,
  draggingId,
  dropTargetId,
  dropZone,
  sidewaysDrop,
  onDragStartNode,
  onDragOverNode,
  onDropNode,
  onDragEndNode,
}) {
  const children = getChildren(categories, parentId)
  if (children.length === 0) return null

  function handleDelete(c) {
    if (window.confirm(`Delete "${c.name}"?`)) {
      onDelete(c.id)
    }
  }

  return (
    <ul className="category-tree">
      {children.map((c) => (
        <li key={c.id}>
          <div
            className={
              'category-tree-row' +
              (dnd && draggingId === c.id ? ' dragging' : '') +
              (dnd && draggingId === c.id && sidewaysDrop ? ' outdent' : '') +
              (dnd && dropTargetId === c.id && !sidewaysDrop && dropZone === 'inside' ? ' drop-target' : '') +
              (dnd && dropTargetId === c.id && !sidewaysDrop && dropZone === 'before' ? ' drop-before' : '') +
              (dnd && dropTargetId === c.id && !sidewaysDrop && dropZone === 'after' ? ' drop-after' : '')
            }
            draggable={dnd}
            onDragStart={dnd ? (e) => { e.stopPropagation(); onDragStartNode(c.id, e.clientX) } : undefined}
            onDragOver={
              dnd
                ? (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const rect = e.currentTarget.getBoundingClientRect()
                    const ratio = (e.clientY - rect.top) / rect.height
                    const zone = ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'inside'
                    onDragOverNode(c.id, zone)
                  }
                : undefined
            }
            onDrop={
              dnd
                ? (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDropNode(c.id)
                  }
                : undefined
            }
            onDragEnd={dnd ? onDragEndNode : undefined}
          >
            {dnd && <span className="drag-handle" aria-hidden="true">&#8942;&#8942;</span>}
            {onSelect ? (
              <button
                type="button"
                className={selectedId === c.id ? 'filter-node active' : 'filter-node'}
                onClick={() => onSelect(c.id)}
              >
                {c.name}
              </button>
            ) : (
              <span>{c.name}</span>
            )}
            {onDelete && (
              <button
                type="button"
                className="delete-btn"
                onClick={() => handleDelete(c)}
                aria-label={`Delete ${c.name}`}
              >
                &times;
              </button>
            )}
          </div>
          <CategoryTreeView
            categories={categories}
            parentId={c.id}
            selectedId={selectedId}
            onSelect={onSelect}
            onDelete={onDelete}
            dnd={dnd}
            draggingId={draggingId}
            dropTargetId={dropTargetId}
            dropZone={dropZone}
            sidewaysDrop={sidewaysDrop}
            onDragStartNode={onDragStartNode}
            onDragOverNode={onDragOverNode}
            onDropNode={onDropNode}
            onDragEndNode={onDragEndNode}
          />
        </li>
      ))}
    </ul>
  )
}

export default CategoryTreeView
