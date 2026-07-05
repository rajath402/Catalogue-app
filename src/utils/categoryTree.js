export function getChildren(categories, parentId = null) {
  return categories.filter((c) => c.parentId === parentId)
}

// Flattens the tree into a list with a `depth` field, for rendering an
// indented <select> of every category regardless of nesting level.
export function flattenWithDepth(categories, parentId = null, depth = 0) {
  const result = []
  getChildren(categories, parentId).forEach((c) => {
    result.push({ ...c, depth })
    result.push(...flattenWithDepth(categories, c.id, depth + 1))
  })
  return result
}

// A category "matches" a filter if it IS the selected category or is
// nested anywhere underneath it, so filtering by "Electronics" also
// surfaces products filed under "Electronics > Headphones > Wireless".
export function getDescendantIds(categories, rootId) {
  const ids = [rootId]
  getChildren(categories, rootId).forEach((child) => {
    ids.push(...getDescendantIds(categories, child.id))
  })
  return ids
}

// A drag-and-drop move is only invalid when it would make a category its
// own ancestor — dropping it onto itself or onto one of its current
// descendants. Every other move (including "no-op, same parent") is fine.
export function wouldCreateCycle(categories, sourceId, newParentId) {
  if (newParentId === null) return false
  return getDescendantIds(categories, sourceId).includes(newParentId)
}
