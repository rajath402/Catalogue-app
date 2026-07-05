import { useState } from 'react'

function ProductFilters({
  attributes,
  products,
  attributeFilters,
  onToggleAttributeValue,
  onChangeAttributeRange,
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="panel filters-panel">
      <button
        type="button"
        className="mobile-nav-toggle"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
      >
        <span>Filters</span>
        <span className={mobileOpen ? 'chevron open' : 'chevron'}>&#9662;</span>
      </button>

      <h2 className="filters-heading">Filters</h2>

      <div className={mobileOpen ? 'filters-body open' : 'filters-body'}>
        {attributes.map((attr) => {
          if (!attr.filterable) return null

          if (attr.type === 'number') {
            const range = attributeFilters[attr.id] || { min: '', max: '' }
            return (
              <div className="filter-group" key={attr.id}>
                <span className="filter-group-label">{attr.name}</span>
                <div className="filter-range">
                  <input
                    type="number"
                    placeholder="Min"
                    value={range.min}
                    onChange={(e) => onChangeAttributeRange(attr.id, 'min', e.target.value)}
                  />
                  <span>&ndash;</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={range.max}
                    onChange={(e) => onChangeAttributeRange(attr.id, 'max', e.target.value)}
                  />
                </div>
              </div>
            )
          }

          const usedValues = [
            ...new Set(
              products
                .flatMap((p) => p.attributes)
                .filter((a) => a.attributeId === attr.id)
                .map((a) => a.value)
            ),
          ]

          if (usedValues.length === 0) return null

          const selectedValues = attributeFilters[attr.id] || new Set()

          return (
            <div className="filter-group" key={attr.id}>
              <span className="filter-group-label">{attr.name}</span>
              <div className="filter-options">
                {usedValues.map((value) => (
                  <label key={value} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedValues.has(value)}
                      onChange={() => onToggleAttributeValue(attr.id, value)}
                    />
                    {value}
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ProductFilters
