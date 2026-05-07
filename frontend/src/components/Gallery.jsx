import React from 'react'
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
  const visibleItems = isMultiMemory ? batch.items.slice(0, 4) : batch.items
  const coverItem = batch.coverItem || batch.items[0]

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
        <time className="gallery-date">{formatDate(batch.date)}</time>
        {isMultiMemory ? (
          <ul className="gallery-caption-list">
            {batch.items.map((memory) => (
              <li key={`${memory.image}-${memory.flatIndex}`} className="gallery-caption-list-item">
                {memory.caption || 'Memory'}
              </li>
            ))}
          </ul>
        ) : coverItem?.caption ? (
          <p className="gallery-caption">{coverItem.caption}</p>
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
