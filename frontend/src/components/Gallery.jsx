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

function GalleryCard({ memory, index, onImageClick }) {
  const mediaIsVideo = isVideo(memory.image || '')

  return (
    <article className={`gallery-item ${index % 2 === 0 ? 'image-left' : 'image-right'}`}>
      <div className="gallery-media" onClick={() => onImageClick(index)}>
        {mediaIsVideo ? (
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
          key={`${memory.image}-${index}`}
          memory={memory}
          index={index}
          onImageClick={onImageClick}
        />
      ))}
    </main>
  )
}

export default Gallery
