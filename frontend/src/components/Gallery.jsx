import { useState, useRef } from 'react'
import './Gallery.css'

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function GalleryCard({ memory, index, onImageClick }) {
  const cardRef = useRef(null)
  const [transform, setTransform] = useState('')
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 })

  const handleMouseMove = (e) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const rotateX = (y - centerY) / 20
    const rotateY = (centerX - x) / 20

    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`)
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.15
    })
  }

  const handleMouseLeave = () => {
    setTransform('')
    setGlare({ x: 50, y: 50, opacity: 0 })
  }

  return (
    <article
      ref={cardRef}
      className={`gallery-item ${index % 2 === 0 ? 'image-left' : 'image-right'}`}
      style={{ transform }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="gallery-media" onClick={() => onImageClick(index)}>
        <img
          src={memory.mediaPath}
          alt={memory.caption || 'Memory'}
          loading="lazy"
        />
        <div
          className="gallery-glare"
          style={{
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity}) 0%, transparent 60%)`
          }}
        />
      </div>
      <div className="gallery-content">
        <time className="gallery-date">{formatDate(memory.date)}</time>
        {memory.caption && (
          <p className="gallery-caption">{memory.caption}</p>
        )}
      </div>
    </article>
  )
}

function Gallery({ memories, onImageClick }) {
  return (
    <main className="gallery">
      {memories.map((memory, index) => (
        <GalleryCard
          key={memory.id}
          memory={memory}
          index={index}
          onImageClick={onImageClick}
        />
      ))}
    </main>
  )
}

export default Gallery
