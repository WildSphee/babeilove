import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import letter from '../letter'
import './Letter.css'

function Letter() {
  const dialogRef = useRef(null)
  const triggerRef = useRef(null)
  const paperRef = useRef(null)
  const [unfolded, setUnfolded] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    const unlockScroll = () => {
      if (!dialog.open) document.body.style.overflow = previousOverflow
    }
    dialog.addEventListener('close', unlockScroll)
    dialog.showModal()
    document.body.style.overflow = 'hidden'

    return () => {
      dialog.removeEventListener('close', unlockScroll)
      dialog.close()
      unlockScroll()
    }
  }, [])

  useLayoutEffect(() => {
    if (!unfolded) return

    const paper = paperRef.current
    const writing = paper.querySelector('.letter-writing')
    const position = paper.parentElement
    let cancelled = false
    let frame = 0

    const shrinkToFit = () => {
      if (cancelled) return
      const style = getComputedStyle(paper)
      const availableHeight = position.clientHeight
        - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
        - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth)
      const size = parseFloat(getComputedStyle(writing).fontSize)

      // Keep the preferred size whenever it fits; reduce only as much as needed.
      if (writing.scrollHeight > availableHeight && size > 12) {
        writing.style.fontSize = `${Math.max(12, size - 0.5)}px`
        frame = requestAnimationFrame(shrinkToFit)
      }
    }

    const fitLetter = () => {
      if (cancelled) return
      cancelAnimationFrame(frame)
      writing.style.removeProperty('font-size')
      frame = requestAnimationFrame(shrinkToFit)
    }

    fitLetter()
    paper.focus({ preventScroll: true })
    const observer = new ResizeObserver(fitLetter)
    observer.observe(position)
    document.fonts.ready.then(fitLetter)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [unfolded])

  const closeLetter = () => {
    dialogRef.current.close()
    triggerRef.current.focus({ preventScroll: true })
  }

  const openLetter = () => {
    setUnfolded(false)
    dialogRef.current.showModal()
    document.body.style.overflow = 'hidden'
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="letter-trigger" onClick={openLetter} aria-haspopup="dialog" aria-label="Open letter">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 6 9 7 9-7" />
        </svg>
      </button>

      <dialog ref={dialogRef} className={`letter-dialog${unfolded ? ' is-unfolded' : ''}`} aria-label="A letter for Audrey" onCancel={(event) => { event.preventDefault(); closeLetter() }}>
        <button type="button" className="letter-close" onClick={closeLetter} aria-label="Close letter">×</button>
        <div className="letter-stage">
          <button type="button" className="letter-envelope" onClick={() => setUnfolded(true)} aria-label="Open letter" disabled={unfolded}>
            <span className="letter-envelope-back" />
            <span className="letter-envelope-insert" />
            <span className="letter-envelope-front" />
            <span className="letter-envelope-flap" />
            <span className="letter-envelope-seal" aria-hidden="true">♡</span>
            <span className="letter-envelope-label">For Audrey</span>
          </button>

          {unfolded && (
            <div className="letter-paper-position">
              <div className="letter-paper" ref={paperRef} role="button" tabIndex={0} onClick={closeLetter} onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  closeLetter()
                }
              }}>
                <div className="letter-writing">
                  <p className="letter-greeting">{letter.greeting}</p>
                  {letter.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                  <p className="letter-signoff">{letter.signoff}<br />{letter.signature}</p>
                </div>
                <div className="letter-folds" aria-hidden="true">
                  <span className="letter-fold letter-fold-top" />
                  <span className="letter-fold letter-fold-bottom" />
                </div>
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  )
}

export default Letter
