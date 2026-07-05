import { useState } from 'react'
import { getDescendantIds } from '../utils/categoryTree'
import { nameFor, getThumbnail, getVisiblePrice } from '../utils/productAttributes'
import { useAuth } from '../auth/AuthContext'
import CategoryNav from './CategoryNav'
import ProductFilters from './ProductFilters'
import ProductDetail from './ProductDetail'

function ProductList({ products, categories, attributes, onDeleteProduct, onEditProduct }) {
  const { requireAuth } = useAuth()
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  // Keyed by attribute id: a Set of accepted values for text attributes,
  // or a { min, max } object for number attributes.
  const [attributeFilters, setAttributeFilters] = useState({})
  const [viewingProduct, setViewingProduct] = useState(null)

  function toggleAttributeValue(attributeId, value) {
    setAttributeFilters((prev) => {
      const current = prev[attributeId] instanceof Set ? prev[attributeId] : new Set()
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...prev, [attributeId]: next }
    })
  }

  function changeAttributeRange(attributeId, bound, rawValue) {
    setAttributeFilters((prev) => {
      const current =
        prev[attributeId] && !(prev[attributeId] instanceof Set)
          ? prev[attributeId]
          : { min: '', max: '' }
      return { ...prev, [attributeId]: { ...current, [bound]: rawValue } }
    })
  }

  // null = no category filter applied, so every product passes.
  // Otherwise, a product matches if its category is the selected one
  // OR any category nested underneath it.
  const allowedCategoryIds = selectedCategoryId
    ? getDescendantIds(categories, selectedCategoryId)
    : null

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      !allowedCategoryIds || allowedCategoryIds.includes(product.categoryId)

    const matchesAttributes = attributes.every((attr) => {
      const filter = attributeFilters[attr.id]
      if (!filter) return true

      const productAttr = product.attributes.find((a) => a.attributeId === attr.id)

      if (attr.type === 'number') {
        const { min, max } = filter
        if (min === '' && max === '') return true
        if (!productAttr) return false
        const numericValue = parseFloat(productAttr.value)
        if (min !== '' && numericValue < parseFloat(min)) return false
        if (max !== '' && numericValue > parseFloat(max)) return false
        return true
      }

      if (filter.size === 0) return true
      return productAttr ? filter.has(productAttr.value) : false
    })

    return matchesCategory && matchesAttributes
  })

  function handleDeleteProduct(e, product) {
    e.stopPropagation()
    requireAuth(() => {
      if (window.confirm(`Delete "${product.name}"?`)) {
        onDeleteProduct(product.id)
      }
    })
  }

  function handleEditProduct(e, product) {
    e.stopPropagation()
    requireAuth(() => onEditProduct(product))
  }

  if (viewingProduct) {
    // The list's own product objects are the freshest copy — look it up
    // again instead of trusting the (possibly stale) captured reference.
    const current = products.find((p) => p.id === viewingProduct.id)
    if (!current) {
      setViewingProduct(null)
    } else {
      return (
        <ProductDetail
          product={current}
          categories={categories}
          attributes={attributes}
          onBack={() => setViewingProduct(null)}
          onEdit={onEditProduct}
          onDelete={onDeleteProduct}
        />
      )
    }
  }

  return (
    <div className="catalogue-view">
      <CategoryNav
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
      />

      <div className="catalogue-body">
        <ProductFilters
          attributes={attributes}
          products={products}
          attributeFilters={attributeFilters}
          onToggleAttributeValue={toggleAttributeValue}
          onChangeAttributeRange={changeAttributeRange}
        />

        <div className="panel product-list-panel">
          <h2>Products</h2>
          {filteredProducts.length === 0 && (
            <p className="empty">No products match this filter.</p>
          )}
          <ul className="product-grid">
            {filteredProducts.map((product) => {
              const thumbnail = getThumbnail(product, attributes)
              const price = getVisiblePrice(product, attributes)
              return (
                <li
                  key={product.id}
                  className="product-tile"
                  onClick={() => setViewingProduct(product)}
                >
                  <div className="product-tile-image">
                    {thumbnail ? (
                      <img src={thumbnail} alt={product.name} />
                    ) : (
                      <div className="product-tile-placeholder">No image</div>
                    )}
                  </div>
                  <div className="product-tile-body">
                    <span className="badge">{nameFor(categories, product.categoryId)}</span>
                    <strong className="product-tile-name">{product.name}</strong>
                    {price && <span className="product-tile-price">{price}</span>}
                  </div>
                  <div className="product-tile-actions">
                    <button
                      type="button"
                      className="edit-btn"
                      onClick={(e) => handleEditProduct(e, product)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="delete-btn product-delete-btn"
                      onClick={(e) => handleDeleteProduct(e, product)}
                      aria-label={`Delete ${product.name}`}
                    >
                      &times;
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ProductList
