import { useState } from 'react'
import { flattenWithDepth, wouldCreateCycle } from '../utils/categoryTree'
import CategoryTreeView from './CategoryTreeView'

// How far left (in px) a category has to be dragged from where the drag
// started before it counts as "pull it out to top level" rather than "drop
// it onto whatever row happens to be underneath the cursor". Only matters
// in the gutter fallback below — hovering an actual row always uses its
// before/after/inside zone instead, since that already implies a parent.
const OUTDENT_THRESHOLD = 40

function CategoryManager({ categories, onAdd, onDelete, onReorder }) {
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [draggingId, setDraggingId] = useState(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dropTargetId, setDropTargetId] = useState(null)
  const [dropZone, setDropZone] = useState(null)
  const [sidewaysDrop, setSidewaysDrop] = useState(false)
  const flatOptions = flattenWithDepth(categories)

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, parentId || null)
    setName('')
    setParentId('')
  }

  function resetDrag() {
    setDraggingId(null)
    setDragStartX(0)
    setDropTargetId(null)
    setDropZone(null)
    setSidewaysDrop(false)
  }

  function handleDragStartNode(id, clientX) {
    setDraggingId(id)
    setDragStartX(clientX)
  }

  // Hovering a specific row always wins over the sideways gutter gesture —
  // the row's own top/bottom/middle zone already says exactly what to do
  // (reorder before/after it, or nest inside it), no horizontal check needed.
  function handleDragOverNode(targetId, zone) {
    if (targetId === draggingId) return
    setSidewaysDrop(false)
    setDropTargetId(targetId)
    setDropZone(zone)
  }

  function handleDropOnNode(targetId) {
    if (draggingId && targetId !== draggingId) {
      const target = categories.find((c) => c.id === targetId)
      if (dropZone === 'inside') {
        if (!wouldCreateCycle(categories, draggingId, targetId)) {
          onReorder(draggingId, targetId)
        }
      } else if (target) {
        // "before"/"after" make the dragged category a SIBLING of the
        // target — same parent, positioned relative to it — rather than
        // nesting inside it.
        const newParentId = target.parentId
        if (!wouldCreateCycle(categories, draggingId, newParentId)) {
          const position = dropZone === 'before' ? { beforeId: targetId } : { afterId: targetId }
          onReorder(draggingId, newParentId, position)
        }
      }
    }
    resetDrag()
  }

  // Dragging far enough left to "outdent" naturally carries the cursor off
  // any row and into the tree's own indentation padding — an area with no
  // row underneath it. Native drag-and-drop only fires `drop` on an element
  // that had `dragover` preventDefault()'d on it, so without a catch-all
  // here, releasing in that gap does nothing at all. Row-level handlers
  // stopPropagation() so this only ever runs for that gap.
  function handleContainerDragOver(e) {
    e.preventDefault()
    if (!draggingId) return
    const sideways = e.clientX - dragStartX < -OUTDENT_THRESHOLD
    setSidewaysDrop(sideways)
    if (sideways) {
      setDropTargetId(null)
      setDropZone(null)
    }
  }

  function handleContainerDrop(e) {
    e.preventDefault()
    if (draggingId && sidewaysDrop) {
      const dragged = categories.find((c) => c.id === draggingId)
      if (dragged?.parentId !== null) onReorder(draggingId, null)
    }
    resetDrag()
  }

  function dragHint() {
    if (!draggingId) {
      return 'Drag a category onto another to reorder or nest it, or drag it sideways to make it top level.'
    }
    if (sidewaysDrop) return 'Release to make this a top-level category.'
    if (dropZone === 'inside') return 'Release to nest inside this category.'
    if (dropZone === 'before' || dropZone === 'after') return 'Release to reorder it here.'
    return 'Drop on the top/bottom edge of a category to reorder it, or the middle to nest inside it.'
  }

  return (
    <div className="panel">
      <h2>Categories</h2>
      <form onSubmit={handleSubmit} className="category-form">
        <input
          type="text"
          placeholder="New category"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">Top level (no parent)</option>
          {flatOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {'—'.repeat(c.depth)} {c.name}
            </option>
          ))}
        </select>
        <button type="submit">Add</button>
      </form>

      <p className="dnd-hint">{dragHint()}</p>

      <div onDragOver={handleContainerDragOver} onDrop={handleContainerDrop}>
        <CategoryTreeView
          categories={categories}
          onDelete={onDelete}
          dnd
          draggingId={draggingId}
          dropTargetId={dropTargetId}
          dropZone={dropZone}
          sidewaysDrop={sidewaysDrop}
          onDragStartNode={handleDragStartNode}
          onDragOverNode={handleDragOverNode}
          onDropNode={handleDropOnNode}
          onDragEndNode={resetDrag}
        />
      </div>
    </div>
  )
}

export default CategoryManager
