import { useState } from 'react'
import './Gallery.css'

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function isVideo(filename) {
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg']
  return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext))
}

function GalleryMedia({ memory, onImageClick, stacked = false, zIndex }) {
  const mediaIsVideo = isVideo(memory.image || '')

  return (
    <button
      type="button"
      className={`gallery-media-button${stacked ? ' is-stacked' : ''}`}
      onClick={() => onImageClick(memory.flatIndex)}
      style={zIndex ? { zIndex } : undefined}
      aria-label={`Open memory from ${formatDate(memory.date)}`}
    >
      <div className={`gallery-media-frame${stacked ? ' gallery-media-frame--stacked' : ''}`}>
        {mediaIsVideo && stacked ? (
          <div className="gallery-video-preview">
            <span className="gallery-video-preview-icon" aria-hidden="true">▶</span>
            <span className="gallery-video-preview-text">Video memory</span>
          </div>
        ) : mediaIsVideo ? (
          <video
            src={memory.mediaPath}
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img
            src={memory.mediaPath}
            alt={memory.caption || 'Memory'}
            loading="lazy"
          />
        )}
      </div>
    </button>
  )
}

function GalleryCard({ batch, onImageClick }) {
  const isMultiMemory = batch.items.length > 1
  const [activeIndex, setActiveIndex] = useState(0)
  const rotatedItems = isMultiMemory
    ? [
        batch.items[activeIndex],
        ...batch.items.slice(activeIndex + 1),
        ...batch.items.slice(0, activeIndex)
      ]
    : batch.items
  const visibleItems = isMultiMemory ? rotatedItems.slice(0, 4) : batch.items
  const coverItem = batch.coverItem || batch.items[0]
  const activeMemory = isMultiMemory ? batch.items[activeIndex] : coverItem

  const showPreviousMemory = () => {
    setActiveIndex((currentIndex) => (
      currentIndex === 0 ? batch.items.length - 1 : currentIndex - 1
    ))
  }

  const showNextMemory = () => {
    setActiveIndex((currentIndex) => (
      currentIndex === batch.items.length - 1 ? 0 : currentIndex + 1
    ))
  }

  return (
    <article className={`gallery-item ${batch.layoutVariant} ${isMultiMemory ? 'gallery-item--batched' : ''}`}>
      <div className={`gallery-media ${isMultiMemory ? 'gallery-media--stacked' : ''}`}>
        {isMultiMemory ? (
          <div
            className="gallery-media-stack"
            role="group"
            aria-label={`${batch.items.length} memories from ${formatDate(batch.date)}`}
          >
            {visibleItems.map((item, stackIndex) => (
              <GalleryMedia
                key={`${item.image}-${item.flatIndex}`}
                memory={item}
                onImageClick={onImageClick}
                stacked
                zIndex={visibleItems.length - stackIndex}
              />
            ))}
            {batch.items.length > visibleItems.length && (
              <div className="gallery-stack-count">
                +{batch.items.length - visibleItems.length}
              </div>
            )}
          </div>
        ) : (
          <GalleryMedia
            memory={coverItem}
            onImageClick={onImageClick}
          />
        )}
      </div>
      <div className="gallery-content">
        <div className="gallery-meta-row">
          <time className="gallery-date">{formatDate(batch.date)}</time>
          {isMultiMemory && (
            <div className="gallery-batch-nav" aria-label={`Browse ${batch.items.length} memories from ${formatDate(batch.date)}`}>
              <button
                type="button"
                className="gallery-batch-arrow"
                onClick={showPreviousMemory}
                aria-label="Show previous memory from this date"
              >
                &lsaquo;
              </button>
              <span className="gallery-batch-count">
                {activeIndex + 1}/{batch.items.length}
              </span>
              <button
                type="button"
                className="gallery-batch-arrow"
                onClick={showNextMemory}
                aria-label="Show next memory from this date"
              >
                &rsaquo;
              </button>
            </div>
          )}
        </div>
        {activeMemory?.caption ? (
          <p className="gallery-caption">{activeMemory.caption}</p>
        ) : null}
      </div>
    </article>
  )
}

function Gallery({ memoryBatches, onImageClick }) {
  return (
    <main className="gallery">
      {memoryBatches.map((batch, index) => (
        <GalleryCard
          key={`${batch.date}-${index}`}
          batch={batch}
          onImageClick={onImageClick}
        />
      ))}
    </main>
  )
}

export default Gallery
