export function nameFor(list, id) {
  return list.find((item) => item.id === id)?.name ?? 'Unknown'
}

// product.attributes is a flat {attributeId, value} list — an image
// attribute appears once per image, in upload order. Group by attributeId
// so a product renders one section per attribute instead of one line (or
// one image) per row, and so multi-value order is preserved.
export function groupAttributesForDisplay(productAttributes, attributeDefs) {
  const grouped = new Map()
  for (const pa of productAttributes) {
    if (!grouped.has(pa.attributeId)) grouped.set(pa.attributeId, [])
    grouped.get(pa.attributeId).push(pa.value)
  }

  return Array.from(grouped.entries()).map(([attributeId, values]) => ({
    attributeId,
    name: nameFor(attributeDefs, attributeId),
    type: attributeDefs.find((a) => a.id === attributeId)?.type,
    values,
  }))
}

// The thumbnail is simply the first value of the first image-type
// attribute, in the order it was uploaded — no separate "is thumbnail"
// flag needed.
export function getThumbnail(product, attributeDefs) {
  for (const pa of product.attributes) {
    const type = attributeDefs.find((a) => a.id === pa.attributeId)?.type
    if (type === 'image') return pa.value
  }
  return null
}

export function getAllImages(product, attributeDefs) {
  return groupAttributesForDisplay(product.attributes, attributeDefs)
    .filter((g) => g.type === 'image')
    .flatMap((g) => g.values)
}

// Finds the display group for a system attribute (e.g. 'brand', 'price') by
// its stable `system` key rather than by name, so a rename never breaks a
// PDP's designated layout slot.
export function findSystemGroup(groups, attributeDefs, systemKey) {
  const attr = attributeDefs.find((a) => a.system === systemKey)
  if (!attr) return null
  return groups.find((g) => g.attributeId === attr.id) ?? null
}

// No value set at all defaults to showing the price — the "Show Price"
// attribute only needs to be added to a product when you want to hide it.
// Shared by the PDP and the PLP tiles so both respect the same rule.
export function isPriceVisible(groups, attributeDefs) {
  const showPriceGroup = findSystemGroup(groups, attributeDefs, 'showPrice')
  return showPriceGroup ? showPriceGroup.values[0] === 'true' : true
}

// Returns the price string to display for a product, or null if there's no
// price set or it's been explicitly hidden.
export function getVisiblePrice(product, attributeDefs) {
  const groups = groupAttributesForDisplay(product.attributes, attributeDefs)
  const priceGroup = findSystemGroup(groups, attributeDefs, 'price')
  if (!priceGroup) return null
  return isPriceVisible(groups, attributeDefs) ? priceGroup.values.join(', ') : null
}
