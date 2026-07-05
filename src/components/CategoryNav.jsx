import { useState } from 'react'
import { getChildren } from '../utils/categoryTree'
import CategoryTreeView from './CategoryTreeView'

function CategoryDropdown({ categories, parentId, selectedId, onSelect }) {
  const children = getChildren(categories, parentId)
  if (children.length === 0) return null

  return (
    <ul className="nav-flyout-list">
      {children.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            className={selectedId === c.id ? 'dropdown-link active' : 'dropdown-link'}
            onClick={() => onSelect(c.id)}
          >
            {c.name}
          </button>
          <CategoryDropdown
            categories={categories}
            parentId={c.id}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  )
}

function CategoryNav({ categories, selectedCategoryId, onSelectCategory }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const topCategories = getChildren(categories, null)

  function selectCategory(id) {
    // No "All" option any more, so clicking the already-active category
    // is the only way back to an unfiltered view.
    onSelectCategory(selectedCategoryId === id ? null : id)
    setMobileOpen(false)
  }

  return (
    <nav className="catalogue-nav">
      <button
        type="button"
        className="mobile-nav-toggle"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
      >
        <span>Browse categories</span>
        <span className={mobileOpen ? 'chevron open' : 'chevron'}>&#9662;</span>
      </button>

      <div className={mobileOpen ? 'catalogue-nav-body open' : 'catalogue-nav-body'}>
        <div className="nav-group">
          {/* Desktop: horizontal pills, subcategories reveal in a hover flyout */}
          <ul className="nav-pills nav-pills-desktop">
            {topCategories.map((c) => {
              const hasChildren = getChildren(categories, c.id).length > 0
              return (
                <li key={c.id} className="nav-pill-wrapper">
                  <button
                    type="button"
                    className={selectedCategoryId === c.id ? 'nav-pill active' : 'nav-pill'}
                    onClick={() => selectCategory(c.id)}
                  >
                    {c.name}
                  </button>
                  {hasChildren && (
                    <div className="nav-flyout">
                      <CategoryDropdown
                        categories={categories}
                        parentId={c.id}
                        selectedId={selectedCategoryId}
                        onSelect={selectCategory}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {/* Mobile: hover doesn't exist on touch, so show the full tree instead */}
          <div className="nav-tree-mobile">
            <CategoryTreeView
              categories={categories}
              selectedId={selectedCategoryId}
              onSelect={selectCategory}
            />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default CategoryNav
