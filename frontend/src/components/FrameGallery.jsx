import { useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

const API = ''

function formatOffset(offset) {
  if (Math.abs(offset) < 0.1) return 'LIVE'
  return `-${Math.abs(offset).toFixed(1)}s`
}

function FrameThumb({ frame, isActive, onClick, camId }) {
  const src = Math.abs(frame.offset) < 0.1
    ? `/snapshot/${camId}?t=${Date.now()}`
    : `/api/frame/${camId}?offset=${frame.offset}`

  return (
    <motion.button
      onClick={() => onClick(frame.offset)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className={`flex-shrink-0 relative rounded-lg overflow-hidden cursor-pointer border transition-all duration-150
        ${isActive
          ? 'border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/20'
          : 'border-white/[0.06] hover:border-white/[0.15]'}`}
      style={{ width: 96, height: 60 }}
    >
      <img
        src={src}
        alt={`Frame ${frame.offset}`}
        className="w-full h-full object-cover"
        loading="lazy"
        draggable={false}
      />

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

      {/* Timestamp label */}
      <span className={`absolute bottom-1 left-0 right-0 text-center text-[9px] font-mono font-bold
        ${isActive ? 'text-indigo-300' : 'text-gray-300'}`}>
        {formatOffset(frame.offset)}
      </span>

      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-indigo-400"
          style={{ boxShadow: '0 0 4px rgba(99,102,241,0.8)' }} />
      )}

      {/* Live badge */}
      {Math.abs(frame.offset) < 0.1 && (
        <div className="absolute top-1 right-1 flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold text-white"
          style={{ background: 'rgba(239,68,68,0.85)' }}>
          <span className="w-1 h-1 rounded-full bg-white live-dot" />
          LIVE
        </div>
      )}
    </motion.button>
  )
}

function SkeletonThumb() {
  return (
    <div className="flex-shrink-0 rounded-lg overflow-hidden shimmer border border-white/[0.04]"
      style={{ width: 96, height: 60 }} />
  )
}

export default function FrameGallery({ camId, bufferInfo, currentOffset, onSelectFrame }) {
  const scrollRef = useRef(null)

  // Build evenly-spaced frame samples from the buffer
  const frames = []
  if (bufferInfo) {
    const duration = bufferInfo.duration_s || 10
    const count = Math.min(20, Math.floor(duration * 2)) // ~2 per second, max 20
    for (let i = 0; i <= count; i++) {
      const offset = -(duration * (1 - i / count))
      frames.push({ offset: parseFloat(offset.toFixed(2)), idx: i })
    }
    // Always include live (0)
    frames[frames.length - 1].offset = 0
  }

  // Auto-scroll to keep active frame visible
  useEffect(() => {
    if (!scrollRef.current || frames.length === 0) return
    const activeIdx = frames.findIndex(f => Math.abs(f.offset - currentOffset) < 0.3)
    if (activeIdx < 0) return
    const container = scrollRef.current
    const child = container.children[activeIdx]
    if (child) {
      child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [currentOffset])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Frame Strip</span>
        {bufferInfo && (
          <span className="text-[10px] font-mono text-gray-600">
            {bufferInfo.frames} frames · {bufferInfo.fps?.toFixed(1)} fps
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {!camId || !bufferInfo ? (
          Array.from({ length: 8 }, (_, i) => <SkeletonThumb key={i} />)
        ) : (
          frames.map((frame) => (
            <FrameThumb
              key={frame.idx}
              frame={frame}
              isActive={Math.abs(frame.offset - currentOffset) < 0.3}
              onClick={onSelectFrame}
              camId={camId}
            />
          ))
        )}
      </div>
    </div>
  )
}
