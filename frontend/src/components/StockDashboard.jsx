import { useState, useEffect, useCallback, useRef } from 'react'
import './StockDashboard.css'

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY
const POLL_MS = 30_000
const LS_KEY = 'babeilove_stocks'

const STOCKS = [
  { symbol: 'AVGO', name: 'Broadcom' },
  { symbol: 'CYD',  name: 'China Yuchai' },
  { symbol: 'BABA', name: 'Alibaba' },
  { symbol: 'NDRA', name: 'Endra Life Sciences' },
]

function loadCached() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCache(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch {}
}

async function fetchQuote(symbol) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`
  const resp = await fetch(url, { cache: 'no-store' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

function formatPrice(value) {
  if (value == null || value === 0) return '—'
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatChange(value) {
  if (value == null) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

function formatPct(value) {
  if (value == null) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function formatTime(ts) {
  if (!ts) return null
  return new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function StockCard({ stock }) {
  const hasData = stock.price != null && stock.price !== 0
  const isUp = stock.change != null && stock.change >= 0
  const dir = hasData ? (isUp ? 'up' : 'down') : 'neutral'

  return (
    <div className={`stock-card ${dir}`}>
      <div className="stock-header">
        <span className="stock-symbol">{stock.symbol}</span>
        <span className="stock-name">{stock.name}</span>
      </div>
      <div className="stock-price">
        {hasData ? `$${formatPrice(stock.price)}` : '—'}
      </div>
      <div className="stock-change">
        <span className="change-amount">{formatChange(stock.change)}</span>
        <span className="change-pct">{formatPct(stock.change_pct)}</span>
      </div>
      <div className="stock-details">
        <div className="detail-row">
          <span className="detail-label">Open</span>
          <span className="detail-value">${formatPrice(stock.open)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">High</span>
          <span className="detail-value">${formatPrice(stock.high)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Low</span>
          <span className="detail-value">${formatPrice(stock.low)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Prev Close</span>
          <span className="detail-value">${formatPrice(stock.prev_close)}</span>
        </div>
      </div>
      {stock.timestamp && (
        <div className="stock-time">as of {formatTime(stock.timestamp)}</div>
      )}
    </div>
  )
}

export default function StockDashboard() {
  const [stockMap, setStockMap] = useState(() => loadCached())
  const [lastUpdated, setLastUpdated] = useState(null)
  const [errors, setErrors] = useState({})
  const [countdown, setCountdown] = useState(POLL_MS / 1000)
  const countdownRef = useRef(POLL_MS / 1000)

  const fetchAll = useCallback(async () => {
    const results = await Promise.allSettled(
      STOCKS.map(({ symbol }) => fetchQuote(symbol).then((q) => ({ symbol, q })))
    )

    setStockMap((prev) => {
      const next = { ...prev }
      const newErrors = {}

      results.forEach((r, i) => {
        const { symbol, name } = STOCKS[i]
        if (r.status === 'fulfilled') {
          const q = r.value.q
          next[symbol] = {
            symbol,
            name,
            price: q.c,
            change: q.d,
            change_pct: q.dp,
            high: q.h,
            low: q.l,
            open: q.o,
            prev_close: q.pc,
            timestamp: q.t,
          }
        } else {
          newErrors[symbol] = r.reason?.message || 'error'
        }
      })

      saveCache(next)
      setErrors(newErrors)
      setLastUpdated(new Date())
      countdownRef.current = POLL_MS / 1000
      setCountdown(POLL_MS / 1000)
      return next
    })
  }, [])

  useEffect(() => {
    if (API_KEY) {
      fetchAll()
      const id = setInterval(fetchAll, POLL_MS)
      return () => clearInterval(id)
    }
  }, [fetchAll])

  useEffect(() => {
    const id = setInterval(() => {
      countdownRef.current = Math.max(0, countdownRef.current - 1)
      setCountdown(countdownRef.current)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const stocks = STOCKS.map(({ symbol, name }) => stockMap[symbol] || { symbol, name })
  const hasAnyError = Object.keys(errors).length > 0

  return (
    <div className="stock-dashboard">
      <div className="stock-dashboard-header">
        <h2 className="stock-dashboard-title">Live Stock Prices</h2>
        <div className="stock-meta">
          {lastUpdated && (
            <span className="last-updated">
              Updated {lastUpdated.toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </span>
          )}
          {API_KEY && <span className="next-refresh">Refreshing in {countdown}s</span>}
        </div>
      </div>

      {!API_KEY && (
        <p className="stock-error">VITE_FINNHUB_API_KEY is not set.</p>
      )}
      {hasAnyError && (
        <p className="stock-error">
          Some quotes failed to load. Showing cached data where available.
        </p>
      )}

      <div className="stock-grid">
        {stocks.map((stock) => (
          <StockCard key={stock.symbol} stock={stock} />
        ))}
      </div>

      <p className="stock-disclaimer">
        Prices via Finnhub · ~30s delay · Not financial advice
      </p>
    </div>
  )
}
