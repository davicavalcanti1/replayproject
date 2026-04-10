import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react'
import VideoPlayer from '../components/VideoPlayer'
import Timeline from '../components/Timeline'
import ClipGallery from '../components/ClipGallery'
import { useReplayBuffer, useHealth } from '../hooks/useReplayBuffer'
import { useKeyboard } from '../hooks/useKeyboard'

const LOCATION_NAMES = {
  '0': 'Quadra A — Principal',
  '1': 'Quadra B — Coberta',
  '2': 'Quadra C — Society',
  '3': 'Quadra D — Beach Tennis',
}
const getLoc = id => LOCATION_NAMES[id] || `Câmera ${id}`

export default function CameraDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { health } = useHealth()
  const { bufferInfo } = useReplayBuffer(id)

  const [currentOffset, setCurrentOffset] = useState(0)   // 0 = live
  const [isPlaying, setIsPlaying]         = useState(false) // false = watching live
  const [replayMode, setReplayMode]       = useState(false) // true = replay stream from start
  const playRef = useRef(null)

  const camInfo  = health[id]
  const isLive   = camInfo?.active === true
  const duration = bufferInfo?.duration_s || 10
  const fps      = bufferInfo?.fps || 20
  const fi       = 1 / fps

  // Playback loop: advance offset toward 0
  useEffect(() => {
    if (!isPlaying || currentOffset >= 0 || replayMode) {
      clearInterval(playRef.current)
      return
    }
    playRef.current = setInterval(() => {
      setCurrentOffset(prev => {
        const next = prev + fi
        if (next >= 0) { setIsPlaying(false); return 0 }
        return next
      })
    }, 1000 / fps)
    return () => clearInterval(playRef.current)
  }, [isPlaying, currentOffset, fps, fi, replayMode])

  // Replay mode: let the backend MJPEG do the work; auto-cancel after buffer duration
  useEffect(() => {
    if (!replayMode) return
    const timer = setTimeout(() => {
      setReplayMode(false)
      setCurrentOffset(0)
    }, (duration + 1) * 1000)
    return () => clearTimeout(timer)
  }, [replayMode, duration])

  const handleScrub = useCallback((offset) => {
    setCurrentOffset(offset)
    setIsPlaying(false)
    setReplayMode(false)
  }, [])

  const handlePlayPause = useCallback(() => {
    if (replayMode) { setReplayMode(false); return }
    setIsPlaying(v => !v)
  }, [replayMode])

  const handleStep = useCallback((dir) => {
    setIsPlaying(false)
    setReplayMode(false)
    setCurrentOffset(prev => Math.max(-duration, Math.min(0, prev + dir * fi)))
  }, [duration, fi])

  const handleReplay = useCallback(() => {
    setReplayMode(true)
    setIsPlaying(false)
    setCurrentOffset(-duration)
  }, [duration])

  useKeyboard({
    ' ':         handlePlayPause,
    'ArrowLeft': () => handleStep(-1),
    'ArrowRight':() => handleStep(1),
    'l':         () => { setCurrentOffset(0); setIsPlaying(false); setReplayMode(false) },
    'r':         handleReplay,
    'Escape':    () => navigate('/cameras'),
  })

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-4 gap-3 sm:gap-4 max-w-[1400px] w-full mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/cameras')}
          className="flex items-center gap-1.5 text-xs font-semibold transition-colors hover:opacity-100 opacity-60"
          style={{ color: 'var(--text)' }}>
          <ArrowLeft size={14} /> Câmeras
        </button>
        <span style={{ color: 'var(--muted)' }}>/</span>
        <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{getLoc(id)}</span>

        {/* Status */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ml-1 ${
          isLive ? 'text-emerald-400' : 'text-gray-500'
        }`} style={{
          background: isLive ? 'rgba(52,211,153,0.08)' : 'var(--surface-3)',
          border: `1px solid ${isLive ? 'rgba(52,211,153,0.2)' : 'var(--border)'}`,
        }}>
          {isLive ? <><Wifi size={9} /> Online</> : <><WifiOff size={9} /> Offline</>}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

        {/* Left column */}
        <div className="flex flex-col gap-4 flex-1 min-w-0">

          {/* Video */}
          <VideoPlayer
            camId={id}
            currentOffset={currentOffset}
            totalDuration={duration}
            frameTimestamp={bufferInfo?.latest_ts}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onStepFrame={handleStep}
            onReplay={handleReplay}
            isLive={isLive}
            replayMode={replayMode}
          />

          {/* Timeline */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Linha do tempo
              </span>
              {bufferInfo && (
                <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
                  Buffer: {duration.toFixed(1)}s · {fps.toFixed(1)} fps
                </span>
              )}
            </div>
            <Timeline
              currentOffset={currentOffset}
              totalDuration={duration}
              fps={fps}
              onScrub={handleScrub}
              bufferedRatio={bufferInfo ? Math.min(1, bufferInfo.frames / (duration * fps)) : 0}
            />
          </div>

          {/* Clips */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <ClipGallery camId={id} />
          </div>
        </div>

        {/* Right info panel — horizontal on mobile, sidebar on desktop */}
        <div className="w-full lg:w-60 flex-shrink-0 flex flex-col gap-3">

          {/* Camera info card */}
          <div className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Info da câmera
            </h3>
            {[
              ['ID', id],
              ['Localização', getLoc(id)],
              ['Status', isLive ? 'Online' : 'Offline'],
              ['Buffer', bufferInfo ? `${duration.toFixed(1)}s` : '--'],
              ['FPS', bufferInfo ? `${fps.toFixed(1)}` : '--'],
              ['Frames', bufferInfo?.frames ?? '--'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{k}</span>
                <span className="text-[11px] font-semibold font-mono" style={{ color: 'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Keyboard shortcuts — hidden on mobile */}
          <div className="hidden lg:flex rounded-xl p-4 flex-col gap-2"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
              Atalhos
            </h3>
            {[
              ['Espaço', 'Play/Pause'],
              ['← →', 'Frame a frame'],
              ['L', 'Ir ao vivo'],
              ['R', 'Replay do início'],
              ['Esc', 'Voltar'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  {k}
                </kbd>
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
