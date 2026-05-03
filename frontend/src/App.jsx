import { useState, useEffect, useRef } from 'react'
import Gallery from './components/Gallery'
import Lightbox from './components/Lightbox'
import './App.css'

const baseUrl = import.meta.env.BASE_URL || '/'
const memoriesUrl = `${baseUrl}media/memories.json`
const memoriesModuleUrl = `${baseUrl}media/memories.js`
const mediaUrl = (filename) => `${baseUrl}media/${filename}`
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

async function loadMemories() {
  try {
    const module = await import(/* @vite-ignore */ `${memoriesModuleUrl}?t=${Date.now()}`)
    return module.default
  } catch (error) {
    console.warn('Falling back to media/memories.json because media/memories.js failed:', error)
    const response = await fetch(memoriesUrl)
    if (!response.ok) {
      throw new Error(`Failed to load memories: HTTP ${response.status}`)
    }
    return await response.json()
  }
}

function CustomCursor() {
  const cursorRef = useRef(null)
  const visibleRef = useRef(false)
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(pointer: fine)')
    const updateEnabled = () => setEnabled(media.matches)

    updateEnabled()

    if (media.addEventListener) {
      media.addEventListener('change', updateEnabled)
      return () => media.removeEventListener('change', updateEnabled)
    }

    media.addListener(updateEnabled)
    return () => media.removeListener(updateEnabled)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const cursor = cursorRef.current
    if (!cursor) return

    const position = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const target = { ...position }
    let swingPhase = 0
    let frameId = 0

    const setCursorVisible = (nextVisible) => {
      if (visibleRef.current === nextVisible) return
      visibleRef.current = nextVisible
      setVisible(nextVisible)
    }

    const animate = () => {
      position.x += (target.x - position.x) * 0.18
      position.y += (target.y - position.y) * 0.18

      const dx = target.x - position.x
      const dy = target.y - position.y
      const speed = Math.hypot(dx, dy)

      swingPhase += Math.min(speed * 0.05, 0.3)
      const sway = Math.sin(swingPhase) * Math.min(speed * 0.16, 8)
      const tilt = Math.max(-16, Math.min(16, dx * 0.18 + sway))
      const stretch = Math.min(speed * 0.008, 0.12)

      cursor.style.transform = [
        `translate3d(${position.x}px, ${position.y}px, 0)`,
        'translate(-28%, -18%)',
        `rotate(${tilt}deg)`,
        `scaleX(${1 + stretch})`,
        `scaleY(${1 - stretch * 0.55})`
      ].join(' ')

      frameId = window.requestAnimationFrame(animate)
    }

    const handlePointerMove = (event) => {
      target.x = event.clientX
      target.y = event.clientY
      setCursorVisible(true)
    }

    const handlePointerLeave = () => setCursorVisible(false)
    const handlePointerEnter = (event) => {
      target.x = event.clientX
      target.y = event.clientY
      position.x = event.clientX
      position.y = event.clientY
      setCursorVisible(true)
    }

    frameId = window.requestAnimationFrame(animate)
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerleave', handlePointerLeave)
    window.addEventListener('pointerenter', handlePointerEnter)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
      window.removeEventListener('pointerenter', handlePointerEnter)
      visibleRef.current = false
      setVisible(false)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      ref={cursorRef}
      className={`custom-cursor${visible ? ' custom-cursor--visible' : ''}`}
      aria-hidden="true"
    >
      <img src="/usagi-cursor.png" alt="" draggable="false" />
    </div>
  )
}

function App() {
  const [memories, setMemories] = useState([])
  const [config, setConfig] = useState(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const [timeTogether, setTimeTogether] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  useEffect(() => {
    loadMemories()
      .then(data => {
        setConfig(data.config)
        const transformed = data.memories.map(item => ({
          ...item,
          mediaPath: mediaUrl(item.image),
          caption: item.description
        }))
        setMemories(transformed)
      })
      .catch(err => console.error('Failed to load memories:', err))
  }, [])

  // Calculate time together
  useEffect(() => {
    if (!config?.relationshipStart) return

    const calculateTimeTogether = () => {
      const { date, time } = config.relationshipStart
      const [hours, minutes] = time.split(':').map(Number)
      const startDate = new Date(date)
      startDate.setHours(hours, minutes, 0, 0)

      const now = new Date()
      const diff = now - startDate

      if (diff < 0) {
        setTimeTogether({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const seconds = Math.floor((diff / 1000) % 60)
      const mins = Math.floor((diff / (1000 * 60)) % 60)
      const hrs = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))

      setTimeTogether({ days, hours: hrs, minutes: mins, seconds })
    }

    calculateTimeTogether()
    const interval = setInterval(calculateTimeTogether, 1000)

    return () => clearInterval(interval)
  }, [config])

  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollY(window.scrollY)
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const openLightbox = (index) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < memories.length - 1 ? prev + 1 : prev))
  }

  const handleExportVideo = async () => {
    setIsExporting(true)
    setExportError(null)
    try {
      const response = await fetch(`${apiBaseUrl}/export-video`)
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Server error ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('video/mp4')) {
        const message = await response.text().catch(() => '')
        if (contentType.includes('text/html')) {
          throw new Error('Export endpoint returned the website HTML instead of an MP4. /api is not reaching backend.video_server yet.')
        }
        throw new Error(message || 'Export returned an unexpected response instead of an MP4.')
      }

      const blob = await response.blob()
      if (blob.size < 1024) {
        throw new Error('Generated video was empty or incomplete. Please try again.')
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'our-memories.mp4'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err.message || 'Export failed — please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  // Calculate scroll progress for parallax effects
  const scrollProgress = Math.min(scrollY / 1000, 1)

  return (
    <div className="app">
      <CustomCursor />

      {/* Parallax Background */}
      <div className="parallax-bg">
        {/* Light streams */}
        <div className="light-streams">
          <div className="light-stream stream-1" />
          <div className="light-stream stream-2" />
          <div className="light-stream stream-3" />
        </div>

        <div
          className="parallax-layer layer-1"
          style={{ transform: `translateY(${Math.sin(scrollY * 0.002) * 80}px) translateX(${Math.cos(scrollY * 0.001) * 40}px)` }}
        />
        <div
          className="parallax-layer layer-2"
          style={{ transform: `translateY(${Math.sin(scrollY * 0.0015 + 1) * 100}px) rotate(${scrollProgress * 30}deg)` }}
        />
        <div
          className="parallax-layer layer-3"
          style={{ transform: `translateY(${Math.sin(scrollY * 0.0025 + 2) * 70}px) translateX(${Math.sin(scrollY * 0.001) * 50}px)` }}
        />
        <div
          className="parallax-layer layer-4"
          style={{ transform: `translateY(${Math.sin(scrollY * 0.002 + 3) * 90}px) rotate(${-scrollProgress * 20}deg)` }}
        />
        <div
          className="parallax-layer layer-5"
          style={{ transform: `translateY(${Math.sin(scrollY * 0.0018 + 4) * 85}px) translateX(${Math.cos(scrollY * 0.0012) * 45}px)` }}
        />
        <div
          className="parallax-layer layer-6"
          style={{ transform: `translateY(${Math.sin(scrollY * 0.0022 + 5) * 75}px) rotate(${scrollProgress * 25}deg)` }}
        />
        <div
          className="parallax-layer layer-7"
          style={{ transform: `translateY(${Math.sin(scrollY * 0.0012 + 6) * 95}px) translateX(${Math.sin(scrollY * 0.0015) * 35}px)` }}
        />
        <div
          className="parallax-layer layer-8"
          style={{ transform: `translateY(${Math.sin(scrollY * 0.002 + 7) * 80}px) rotate(${-scrollProgress * 15}deg)` }}
        />
        <div
          className="gradient-overlay"
          style={{
            background: `linear-gradient(
              ${135 + scrollProgress * 45}deg,
              hsla(${340 + scrollProgress * 30}, 80%, 85%, 0.4) 0%,
              hsla(${280 + scrollProgress * 40}, 70%, 88%, 0.4) 50%,
              hsla(${220 + scrollProgress * 30}, 75%, 90%, 0.4) 100%
            )`
          }}
        />
      </div>

      {/* Content */}
      <div className="content">
        <header className="hero">
          <div className="export-btn-wrapper">
            <button
              className={`export-btn${isExporting ? ' export-btn--loading' : ''}`}
              onClick={handleExportVideo}
              disabled={isExporting}
              title="Export all memories as a video"
            >
              {isExporting ? (
                <>
                  <span className="export-spinner" />
                  Generating…
                </>
              ) : (
                <>
                  <svg className="export-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M2 6a2 2 0 012-2h6l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    <path d="M10 12a1 1 0 01-.707-.293l-2-2a1 1 0 011.414-1.414L10 9.586l1.293-1.293a1 1 0 011.414 1.414l-2 2A1 1 0 0110 12z" />
                  </svg>
                  Export as Video
                </>
              )}
            </button>
            {exportError && (
              <p className="export-error">{exportError}</p>
            )}
          </div>

          <div className="hero-content">
            <h1>{config?.title || 'Our Love Story'}</h1>
            <p className="hero-subtitle">{config?.subtitle || ''}</p>

            {/* Time Together Counter */}
            <div className="time-counter">
              <p className="time-counter-label">Together for</p>
              <div className="time-counter-values">
                <div className="time-unit">
                  <span className="time-value">{timeTogether.days}</span>
                  <span className="time-label">days</span>
                </div>
                <div className="time-unit">
                  <span className="time-value">{String(timeTogether.hours).padStart(2, '0')}</span>
                  <span className="time-label">hours</span>
                </div>
                <div className="time-unit">
                  <span className="time-value">{String(timeTogether.minutes).padStart(2, '0')}</span>
                  <span className="time-label">minutes</span>
                </div>
                <div className="time-unit">
                  <span className="time-value">{String(timeTogether.seconds).padStart(2, '0')}</span>
                  <span className="time-label">seconds</span>
                </div>
              </div>
            </div>
          </div>
          <div className="scroll-hint">
            <span>Scroll to explore</span>
            <div className="scroll-arrow" />
          </div>
        </header>

        <Gallery memories={memories} onImageClick={openLightbox} />

        {/* Footer note */}
        <footer className="footer-note">
          <p dangerouslySetInnerHTML={{ __html: config?.footnote || '' }} />
        </footer>
      </div>

      <Lightbox
        isOpen={lightboxOpen}
        memories={memories}
        currentIndex={currentIndex}
        onClose={closeLightbox}
        onPrevious={goToPrevious}
        onNext={goToNext}
      />
    </div>
  )
}

export default App
