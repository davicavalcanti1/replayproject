import { useRef, useCallback, useState } from 'react'
import { motion } from 'framer-motion'

function snap(offset, fps) {
  if (!fps) return offset
  const fi = 1 / fps
  return Math.round(offset / fi) * fi
}

function fmt(s) {
  const a = Math.abs(s)
  if (a < 0.05) return 'AO VIVO'
  return `-${a.toFixed(1)}s`
}

export default function Timeline({ currentOffset, totalDuration, fps, onScrub, bufferedRatio }) {
  const trackRef = useRef(null)
  const dragging = useRef(false)
  const [hover, setHover] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  const duration = totalDuration || 10

  const xToOffset = useCallback((clientX) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return snap(-(1 - ratio) * duration, fps)
  }, [duration, fps])

  const onDown  = useCallback((e) => {
    dragging.current = true
    setIsDragging(true)
    trackRef.current?.setPointerCapture(e.pointerId)
    onScrub(xToOffset(e.clientX))
  }, [xToOffset, onScrub])

  const onMove  = useCallback((e) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (rect) {
      const r = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setHover(-(1 - r) * duration)
    }
    if (dragging.current) onScrub(xToOffset(e.clientX))
  }, [xToOffset, onScrub, duration])

  const onUp    = useCallback(() => { dragging.current = false; setIsDragging(false) }, [])
  const onLeave = useCallback(() => setHover(null), [])

  const playPct  = Math.max(0, Math.min(100, ((duration + currentOffset) / duration) * 100))
  const hoverPct = hover !== null ? Math.max(0, Math.min(100, ((duration + hover) / duration) * 100)) : null

  // Markers every ~2s
  const step = Math.max(1, Math.round(duration / 8))
  const markers = []
  for (let s = 0; s <= Math.floor(duration); s += step) {
    markers.push({ t: -(duration - s), pct: (s / duration) * 100 })
  }
  // Só adicionar marker final se não duplicar o último
  if (!markers.length || markers[markers.length - 1].t !== 0) {
    markers.push({ t: 0, pct: 100 })
  }

  return (
    <div className="flex flex-col gap-3 w-full select-none">
      {/* Markers row */}
      <div className="relative h-4">
        {markers.map(({ t, pct }) => (
          <span key={pct}
            className="absolute -translate-x-1/2 text-[9px] font-mono"
            style={{ left: `${pct}%`, color: 'var(--muted)' }}>
            {fmt(t)}
          </span>
        ))}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className={`relative w-full rounded-full ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
        style={{ height: 20, background: 'var(--surface-3)' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onLeave}
      >
        {/* Buffered fill */}
        <div className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${(bufferedRatio ?? 1) * 100}%`,
            background: 'rgba(59,130,246,0.12)',
          }} />

        {/* Played region */}
        <div className="absolute top-0 left-0 h-full rounded-full transition-none"
          style={{
            width: `${playPct}%`,
            background: 'linear-gradient(90deg, rgba(29,78,216,0.5), rgba(59,130,246,0.6))',
          }} />

        {/* Tick marks */}
        {Array.from({ length: Math.floor(duration) }, (_, i) => (
          <div key={i}
            className="absolute top-1/2 -translate-y-1/2 w-px pointer-events-none"
            style={{
              left: `${(i / duration) * 100}%`,
              height: i % 5 === 0 ? '55%' : '25%',
              background: 'rgba(96,165,250,0.15)',
            }} />
        ))}

        {/* Hover line */}
        {hoverPct !== null && !isDragging && (
          <div className="absolute top-0 w-px h-full pointer-events-none"
            style={{ left: `${hoverPct}%`, background: 'rgba(255,255,255,0.2)' }} />
        )}

        {/* Hover tooltip */}
        {hover !== null && (
          <div className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-mono text-white pointer-events-none z-10"
            style={{
              left: `${hoverPct ?? 0}%`,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-2)',
            }}>
            {fmt(hover)}
          </div>
        )}

        {/* Playhead */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-20"
          style={{ left: `${playPct}%` }}
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 50 }}
        >
          {/* Needle */}
          <div className="absolute left-1/2 -translate-x-1/2 w-0.5 rounded-full"
            style={{
              top: -8, height: 36,
              background: 'var(--blue)',
              boxShadow: '0 0 8px rgba(59,130,246,0.8)',
            }} />
          {/* Dot */}
          <div className="w-4 h-4 rounded-full border-2 border-white"
            style={{
              background: 'var(--blue)',
              boxShadow: '0 0 10px rgba(59,130,246,0.7)',
            }} />
        </motion.div>

        {/* Live edge dot */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full live-dot"
          style={{ background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.7)' }} />
      </div>

      {/* Keyboard hints */}
      <div className="flex gap-4 text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
        {[
          ['←  →', 'frame a frame'],
          ['Espaço', 'play/pause'],
          ['L', 'ir ao vivo'],
        ].map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded text-[9px]"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              {k}
            </kbd>
            {v}
          </span>
        ))}
      </div>
    </div>
  )
}
