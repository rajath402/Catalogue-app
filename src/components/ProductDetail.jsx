import {
  nameFor,
  groupAttributesForDisplay,
  getAllImages,
  findSystemGroup,
  isPriceVisible,
} from '../utils/productAttributes'
import { useAuth } from '../auth/AuthContext'
import ImageSlider from './ImageSlider'

function ProductDetail({ product, categories, attributes, onBack, onEdit, onDelete }) {
  const { requireAuth } = useAuth()
  const images = getAllImages(product, attributes)
  const groups = groupAttributesForDisplay(product.attributes, attributes)

  const brandGroup = findSystemGroup(groups, attributes, 'brand')
  const priceGroup = findSystemGroup(groups, attributes, 'price')
  const showPrice = isPriceVisible(groups, attributes)

  // Every system attribute (brand/price/photos/showPrice, and any added
  // later) has a designated slot or is intentionally hidden, so it's
  // excluded here by that flag rather than by name — anything else,
  // present or future, flows into the generic spec list automatically.
  const specs = groups.filter((g) => {
    if (g.type === 'image') return false
    const attr = attributes.find((a) => a.id === g.attributeId)
    return !attr?.system
  })

  function handleDelete() {
    requireAuth(() => {
      if (window.confirm(`Delete "${product.name}"?`)) {
        onDelete(product.id)
        onBack()
      }
    })
  }

  return (
    <div className="panel pdp">
      <button type="button" className="pdp-back" onClick={onBack}>
        &larr; Back to Products
      </button>

      <div className="pdp-layout">
        <div className="pdp-gallery">
          <ImageSlider images={images} />
        </div>

        <div className="pdp-info">
          <span className="badge">{nameFor(categories, product.categoryId)}</span>
          <h2 className="pdp-title">{product.name}</h2>

          {brandGroup && <p className="pdp-brand">by {brandGroup.values.join(', ')}</p>}

          {priceGroup && showPrice && (
            <div className="pdp-price-block">
              <span className="pdp-price-label">{priceGroup.name}</span>
              <span className="pdp-price-value">{priceGroup.values.join(', ')}</span>
            </div>
          )}

          {specs.length > 0 && (
            <dl className="pdp-specs">
              {specs.map((s) => (
                <div className="pdp-spec-row" key={s.attributeId}>
                  <dt>{s.name}</dt>
                  <dd>{s.values.join(', ')}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="pdp-actions">
            <button
              type="button"
              className="edit-btn pdp-edit-btn"
              onClick={() => requireAuth(() => onEdit(product))}
            >
              Edit Product
            </button>
            <button type="button" className="pdp-delete-btn" onClick={handleDelete}>
              Delete Product
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetail
