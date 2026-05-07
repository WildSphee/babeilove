import { useEffect, useRef } from 'react'
import './Lightbox.css'

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function isVideoFile(filename) {
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg']
  return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext))
}

function Lightbox({ isOpen, memories, currentIndex, onClose, onPrevious, onNext }) {
  const videoRef = useRef(null)
  const memory = memories[currentIndex]

  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          onPrevious()
          break
        case 'ArrowRight':
          onNext()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onPrevious, onNext])

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    const videoElement = videoRef.current
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
      if (videoElement) {
        videoElement.pause()
      }
    }
  }, [isOpen])

  if (!isOpen || !memory) return null

  const isVideo = isVideoFile(memory.image || '')
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < memories.length - 1

  return (
    <div className="lightbox">
      <div className="lightbox-backdrop" onClick={onClose} />

      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close memory viewer">
        &times;
      </button>

      {hasPrevious && (
        <button type="button" className="lightbox-nav lightbox-prev" onClick={onPrevious} aria-label="View previous memory">
          &lsaquo;
        </button>
      )}

      {hasNext && (
        <button type="button" className="lightbox-nav lightbox-next" onClick={onNext} aria-label="View next memory">
          &rsaquo;
        </button>
      )}

      <div className="lightbox-content">
        {isVideo ? (
          <video
            ref={videoRef}
            className="lightbox-video"
            src={memory.mediaPath}
            controls
            autoPlay
            loop
            playsInline
          />
        ) : (
          <img
            className="lightbox-image"
            src={memory.mediaPath}
            alt={memory.caption || 'Memory'}
          />
        )}
      </div>

      <div className="lightbox-info">
        <p className="lightbox-date">{formatDate(memory.date)}</p>
        {memory.caption && (
          <p className="lightbox-caption">{memory.caption}</p>
        )}
      </div>
    </div>
  )
}

export default Lightbox
