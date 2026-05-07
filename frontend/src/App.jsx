import { useState, useEffect } from 'react'
import Gallery from './components/Gallery'
import Lightbox from './components/Lightbox'
import FootstepTrail from './components/FootstepTrail'
import './App.css'

const baseUrl = import.meta.env.BASE_URL || '/'
const memoriesUrl = `${baseUrl}media/memories.json`
const memoriesModuleUrl = `${baseUrl}media/memories.js`
const cursorSettingsUrl = `${baseUrl}cursors/cursor-settings.json`
const mediaUrl = (filename) => `${baseUrl}media/${filename}`
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const cursorThemeCookieName = 'babeilove_cursor_theme'

const fallbackCursorSettings = {
  defaultTheme: 'usagi',
  themes: [
    {
      id: 'usagi',
      label: 'Happy Usagi',
      default: {
        image: '/cursors/cursor-usagi-default.png',
        hotspot: [4, 4]
      },
      hover: {
        image: '/cursors/cursor-usagi-hover.png',
        hotspot: [6, 2]
      }
    },
    {
      id: 'kurimanju',
      label: 'Kurimanju',
      default: {
        image: '/cursors/kawaii-chiikawa-kurimanju-cursor.png',
        hotspot: [4, 4]
      },
      hover: {
        image: '/cursors/kawaii-chiikawa-kurimanju-pointer.png',
        hotspot: [6, 2]
      }
    },
    {
      id: 'turtle-usagi-dolphin',
      label: 'Turtle Usagi Dolphin',
      default: {
        image: '/cursors/chiikawa-turtle-usagi-dolphin-cursor.png',
        hotspot: [4, 4]
      },
      hover: {
        image: '/cursors/chiikawa-turtle-usagi-dolphin-pointer.png',
        hotspot: [6, 2]
      }
    }
  ]
}

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

async function loadCursorSettings() {
  const response = await fetch(cursorSettingsUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load cursor settings: HTTP ${response.status}`)
  }
  return await response.json()
}

function readCookie(name) {
  const value = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`))

  return value ? decodeURIComponent(value.split('=').slice(1).join('=')) : null
}

function writeCookie(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=31536000; path=/; SameSite=Lax`
}

function resolveAssetUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  return `${baseUrl}${path.replace(/^\/+/, '')}`
}

function buildCursorValue(cursor, fallback) {
  if (!cursor?.image) return fallback

  const [hotspotX = 0, hotspotY = 0] = Array.isArray(cursor.hotspot) ? cursor.hotspot : []
  return `url("${resolveAssetUrl(cursor.image)}") ${hotspotX} ${hotspotY}, ${fallback}`
}

function applyCursorTheme(theme) {
  if (!theme) return

  const root = document.documentElement
  root.style.setProperty('--app-cursor-default', buildCursorValue(theme.default, 'auto'))
  root.style.setProperty('--app-cursor-hover', buildCursorValue(theme.hover, 'pointer'))
}

function findThemeById(themes, themeId) {
  return themes.find((theme) => theme.id === themeId) || null
}

function groupMemoriesByDate(memories) {
  const batches = []
  let currentBatch = null

  memories.forEach((memory, flatIndex) => {
    if (!currentBatch || currentBatch.date !== memory.date) {
      currentBatch = {
        date: memory.date,
        items: [],
        coverItem: null
      }
      batches.push(currentBatch)
    }

    const batchItem = {
      ...memory,
      flatIndex
    }

    currentBatch.items.push(batchItem)
    if (!currentBatch.coverItem) {
      currentBatch.coverItem = batchItem
    }
  })

  return batches.map((batch, index) => ({
    ...batch,
    layoutVariant: index % 2 === 0 ? 'image-left' : 'image-right'
  }))
}

function App() {
  const [flatMemories, setFlatMemories] = useState([])
  const [config, setConfig] = useState(null)
  const [cursorThemes, setCursorThemes] = useState(fallbackCursorSettings.themes)
  const [activeCursorThemeId, setActiveCursorThemeId] = useState(() => readCookie(cursorThemeCookieName) || fallbackCursorSettings.defaultTheme)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const [maxScrollYReached, setMaxScrollYReached] = useState(0)
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
        setFlatMemories(transformed)
      })
      .catch(err => console.error('Failed to load memories:', err))
  }, [])

  useEffect(() => {
    let cancelled = false

    loadCursorSettings()
      .then((data) => {
        const themes = Array.isArray(data?.themes) && data.themes.length > 0
          ? data.themes
          : fallbackCursorSettings.themes
        const storedThemeId = readCookie(cursorThemeCookieName)
        const defaultThemeId = data?.defaultTheme || fallbackCursorSettings.defaultTheme
        const nextThemeId = findThemeById(themes, storedThemeId)
          ? storedThemeId
          : findThemeById(themes, defaultThemeId)?.id || themes[0].id

        if (cancelled) return

        setCursorThemes(themes)
        setActiveCursorThemeId(nextThemeId)
      })
      .catch((error) => {
        console.warn('Falling back to built-in cursor settings:', error)

        if (cancelled) return

        const storedThemeId = readCookie(cursorThemeCookieName)
        const nextThemeId = findThemeById(fallbackCursorSettings.themes, storedThemeId)
          ? storedThemeId
          : fallbackCursorSettings.defaultTheme

        setCursorThemes(fallbackCursorSettings.themes)
        setActiveCursorThemeId(nextThemeId)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const activeCursorTheme = findThemeById(cursorThemes, activeCursorThemeId) || cursorThemes[0] || null

  useEffect(() => {
    if (!activeCursorTheme) return

    applyCursorTheme(activeCursorTheme)
    writeCookie(cursorThemeCookieName, activeCursorTheme.id)
  }, [activeCursorTheme])

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
          const nextScrollY = window.scrollY
          setScrollY(nextScrollY)
          setMaxScrollYReached((previousScrollY) => Math.max(previousScrollY, nextScrollY))
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
    setCurrentIndex((prev) => (prev < flatMemories.length - 1 ? prev + 1 : prev))
  }

  const handleCursorThemeToggle = () => {
    if (cursorThemes.length < 2) return

    const currentIndex = cursorThemes.findIndex((theme) => theme.id === activeCursorThemeId)
    const nextTheme = cursorThemes[(currentIndex + 1 + cursorThemes.length) % cursorThemes.length] || cursorThemes[0]
    setActiveCursorThemeId(nextTheme.id)
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
  const memoryBatches = groupMemoriesByDate(flatMemories)

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

      <FootstepTrail
        maxScrollY={maxScrollYReached}
        contentKey={flatMemories.length}
      />

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
            <h1 className="hero-title-heading">
              <button
                type="button"
                className="hero-title-button"
                onClick={handleCursorThemeToggle}
                title={`Toggle cursor theme. Current: ${activeCursorTheme?.label || 'Happy Usagi'}`}
                aria-label={`Toggle cursor theme. Current: ${activeCursorTheme?.label || 'Happy Usagi'}`}
              >
                <span className="hero-title-text">{config?.title || 'Our Love Story'}</span>
              </button>
            </h1>
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

        <Gallery memoryBatches={memoryBatches} onImageClick={openLightbox} />

        {/* Footer note */}
        <footer className="footer-note">
          <p dangerouslySetInnerHTML={{ __html: config?.footnote || '' }} />
        </footer>
      </div>

      <Lightbox
        isOpen={lightboxOpen}
        memories={flatMemories}
        currentIndex={currentIndex}
        onClose={closeLightbox}
        onPrevious={goToPrevious}
        onNext={goToNext}
      />
    </div>
  )
}

export default App
