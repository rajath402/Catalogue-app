import { useState } from 'react'

function ImageSlider({ images }) {
  const [index, setIndex] = useState(0)

  if (images.length === 0) {
    return <div className="pdp-image-placeholder">No images</div>
  }

  function prev() {
    setIndex((i) => (i - 1 + images.length) % images.length)
  }

  function next() {
    setIndex((i) => (i + 1) % images.length)
  }

  return (
    <div className="image-slider">
      <div className="image-slider-main">
        {images.length > 1 && (
          <button type="button" className="slider-arrow slider-prev" onClick={prev} aria-label="Previous image">
            &#8249;
          </button>
        )}
        <img src={images[index]} alt="" />
        {images.length > 1 && (
          <button type="button" className="slider-arrow slider-next" onClick={next} aria-label="Next image">
            &#8250;
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div className="slider-thumbs">
          {images.map((src, i) => (
            <button
              type="button"
              key={i}
              className={i === index ? 'slider-thumb active' : 'slider-thumb'}
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageSlider
