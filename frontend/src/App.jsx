import { useState, useEffect } from 'react'
import Gallery from './components/Gallery'
import Lightbox from './components/Lightbox'
import './App.css'

const baseUrl = import.meta.env.BASE_URL || '/'
const memoriesUrl = `${baseUrl}media/memories.json`
const mediaUrl = (filename) => `${baseUrl}media/${filename}`

function App() {
  const [memories, setMemories] = useState([])
  const [config, setConfig] = useState(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const [timeTogether, setTimeTogether] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    fetch(memoriesUrl)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to load memories: HTTP ${res.status}`)
        }
        return res.json()
      })
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

  // Calculate scroll progress for parallax effects
  const scrollProgress = Math.min(scrollY / 1000, 1)

  return (
    <div className="app">
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
