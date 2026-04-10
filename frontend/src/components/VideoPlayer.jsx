import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, Maximize2, Clock, Radio } from 'lucide-react'

function formatOffset(offset) {
  if (Math.abs(offset) < 0.1) return 'AO VIVO'
  return `-${Math.abs(offset).toFixed(1)}s`
}

function formatTS(ts) {
  if (!ts) return '--:--:--'
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour12: false })
}

export default function VideoPlayer({
  camId,
  currentOffset,
  totalDuration,
  frameTimestamp,
  isPlaying,
  onPlayPause,
  onStepFrame,
  onReplay,
  isLive,
  replayMode,       // true = playing back from buffer start
}) {
  const [ctrlVisible, setCtrlVisible] = useState(true)
  const containerRef = useRef(null)
  const idleRef = useRef(null)

  const showCtrl = useCallback(() => {
    setCtrlVisible(true)
    clearTimeout(idleRef.current)
    idleRef.current = setTimeout(() => setCtrlVisible(false), 3000)
  }, [])

  useEffect(() => { showCtrl(); return () => clearTimeout(idleRef.current) }, [])

  const atLive = Math.abs(currentOffset) < 0.1

  // Decide image source
  const streamSrc = camId ? `/stream/${camId}` : null
  const replaySrc = camId ? `/api/replay_stream/${camId}` : null
  const frameSrc  = camId && !atLive ? `/api/frame/${camId}?offset=${currentOffset}` : null

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden select-none"
      style={{ background: '#010610', aspectRatio: '16/9' }}
      onMouseMove={showCtrl}
      onMouseEnter={showCtrl}
    >
      {/* ── Video content ── */}
      {!camId ? (
        /* No camera */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--surface-3)' }}>
            <Camera className="w-6 h-6" style={{ color: 'var(--muted)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
            Selecione uma câmera
          </p>
        </div>
      ) : replayMode ? (
        /* Replay stream: frames played from buffer start */
        <img
          key={`replay-${camId}`}
          src={replaySrc}
          alt="Replay"
          className="w-full h-full object-cover"
        />
      ) : atLive ? (
        /* Live MJPEG stream */
        <img
          key={`live-${camId}`}
          src={streamSrc}
          alt="Live"
          className="w-full h-full object-cover"
        />
      ) : (
        /* Scrubbed frame */
        <img
          key={`frame-${camId}-${currentOffset}`}
          src={frameSrc}
          alt={`Frame ${currentOffset}`}
          className="w-full h-full object-cover"
        />
      )}

      {/* Scan lines */}
      <div className="absolute inset-0 pointer-events-none scanlines" />

      {/* ── Badges ── */}
      {/* LIVE */}
      <AnimatePresence>
        {atLive && !replayMode && isLive && (
          <motion.div
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-black text-white"
            style={{ background: 'rgba(239,68,68,0.9)', backdropFilter: 'blur(8px)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white live-dot" />
            AO VIVO
          </motion.div>
        )}
      </AnimatePresence>

      {/* REPLAY badge */}
      <AnimatePresence>
        {replayMode && (
          <motion.div
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-black text-white"
            style={{ background: 'rgba(59,130,246,0.9)', backdropFilter: 'blur(8px)' }}
          >
            <Radio size={10} className="animate-pulse" /> REPLAY
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timestamp */}
      {camId && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'var(--muted)', backdropFilter: 'blur(8px)' }}>
          <Clock size={9} />
          {atLive ? formatTS(frameTimestamp) : formatOffset(currentOffset)}
        </div>
      )}

      {/* Scrub position banner */}
      <AnimatePresence>
        {!atLive && !replayMode && camId && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-14 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ background: 'rgba(59,130,246,0.8)', backdropFilter: 'blur(8px)' }}
          >
            Revisando {formatOffset(currentOffset)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Controls overlay ── */}
      <AnimatePresence>
        {ctrlVisible && camId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: .15 }}
            className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center gap-2"
            style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.75))' }}
          >
            {/* Step back */}
            <button onClick={() => onStepFrame(-1)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/70 hover:text-white"
              title="Frame anterior (←)">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
              </svg>
            </button>

            {/* Play/Pause */}
            <button onClick={onPlayPause}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-all shadow-lg"
              style={{ background: 'var(--blue)' }}
              title="Play/Pause (Espaço)">
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="translate-x-0.5" />}
            </button>

            {/* Step forward */}
            <button onClick={() => onStepFrame(1)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/70 hover:text-white"
              title="Próximo frame (→)">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zm2.5-6L14 8v8z M16 6h2v12h-2z"/>
              </svg>
            </button>

            {/* Replay from start */}
            <button onClick={onReplay}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/70 hover:text-white"
              title="Replay do início do buffer">
              <RotateCcw size={14} />
            </button>

            {/* Time */}
            <div className="flex-1 text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
              {replayMode
                ? <span style={{ color: 'var(--blue-bright)' }}>◉ Reproduzindo gravação...</span>
                : atLive
                  ? <span className="text-red-400 font-bold">● AO VIVO</span>
                  : <span>{formatOffset(currentOffset)} / {totalDuration?.toFixed(1)}s</span>}
            </div>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-white/50 hover:text-white transition-all">
              <Maximize2 size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shimmer when no cam selected */}
      {!camId && <div className="absolute inset-0 shimmer" />}
    </div>
  )
}
