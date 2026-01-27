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
    const handleKeyDown = (e) => {
      if (!isOpen) return

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
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      if (videoRef.current) {
        videoRef.current.pause()
      }
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!memory) return null

  const isVideo = isVideoFile(memory.image || '')
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < memories.length - 1

  return (
    <div className={`lightbox ${isOpen ? 'open' : ''}`}>
      <div className="lightbox-backdrop" onClick={onClose} />

      <button className="lightbox-close" onClick={onClose}>
        &times;
      </button>

      {hasPrevious && (
        <button className="lightbox-nav lightbox-prev" onClick={onPrevious}>
          &lsaquo;
        </button>
      )}

      {hasNext && (
        <button className="lightbox-nav lightbox-next" onClick={onNext}>
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
