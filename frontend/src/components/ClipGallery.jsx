import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Download, Play, X, Clock, Loader } from 'lucide-react'
import { generateClip } from '../hooks/useReplayBuffer'

function ClipModal({ clip, camId, onClose }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: .95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: .95, opacity: 0 }}
          className="relative w-full max-w-2xl rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                Clipe — {clip.timestamp}
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                {clip.duration_s?.toFixed(1)}s · por {clip.user_name}
              </p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: 'var(--muted)' }}>
              <X size={15} />
            </button>
          </div>

          <video
            src={`/clips/${camId}/${clip.filename}`}
            controls
            autoPlay
            className="w-full"
            style={{ background: '#000', maxHeight: '60vh' }}
          />

          <div className="p-4 flex justify-end">
            <a
              href={`/clips/${camId}/${clip.filename}`}
              download={`replay_${clip.timestamp?.replace(/[/:]/g, '-')}.mp4`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white btn-blue"
              style={{ textDecoration: 'none' }}
            >
              <Download size={14} /> Baixar
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function ClipCard({ clip, camId, onPlay }) {
  const thumbSrc = `/clips/${camId}/${clip.thumb}`

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: .12 }}
      className="flex-shrink-0 rounded-xl overflow-hidden cursor-pointer transition-all"
      style={{
        width: 140,
        background: 'var(--surface-3)',
        border: '1px solid var(--border)',
      }}
      onClick={() => onPlay(clip)}
    >
      {/* Thumb */}
      <div className="relative" style={{ aspectRatio: '16/9', background: '#000' }}>
        <img src={thumbSrc} alt="" className="w-full h-full object-cover"
          onError={e => { e.target.style.display = 'none' }} />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--blue)' }}>
            <Play size={13} className="text-white translate-x-0.5" />
          </div>
        </div>
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
          style={{ background: 'rgba(0,0,0,0.7)' }}>
          {clip.duration_s?.toFixed(0)}s
        </div>
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-[10px] font-semibold truncate" style={{ color: 'var(--text)' }}>
          {clip.timestamp?.split(' ')[1] || clip.timestamp}
        </p>
        <p className="text-[9px]" style={{ color: 'var(--muted)' }}>{clip.user_name}</p>
      </div>
    </motion.div>
  )
}

export default function ClipGallery({ camId }) {
  const [clips, setClips] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [activeClip, setActiveClip] = useState(null)
  const [genStatus, setGenStatus] = useState(null) // null | 'ok' | 'error'

  const fetchClips = useCallback(async () => {
    if (!camId) return
    try {
      const res = await fetch(`/api/clips/${camId}`)
      if (res.ok) {
        const data = await res.json()
        setClips(data.clips || [])
      }
    } catch (_) {}
  }, [camId])

  useEffect(() => {
    setLoading(true)
    fetchClips().finally(() => setLoading(false))
  }, [camId, fetchClips])

  const handleGenerate = async () => {
    if (!camId || generating) return
    setGenerating(true)
    setGenStatus(null)
    try {
      const result = await generateClip(camId)
      if (result.download_url) {
        const a = document.createElement('a')
        a.href = result.download_url
        a.download = result.download_name || 'replay_clip.mp4'
        a.click()
      }
      setGenStatus('ok')
      await fetchClips()
    } catch (e) {
      console.error(e)
      setGenStatus('error')
    } finally {
      setGenerating(false)
      setTimeout(() => setGenStatus(null), 3000)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film size={14} style={{ color: 'var(--blue-bright)' }} />
          <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
            Clipes gravados
          </span>
          {clips.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
              style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--blue-bright)' }}>
              {clips.length}
            </span>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={!camId || generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold btn-blue"
        >
          {generating
            ? <><Loader size={12} className="animate-spin" /> Gerando...</>
            : genStatus === 'ok'
              ? <><Film size={12} /> Gerado!</>
              : <><Film size={12} /> Gerar clipe</>}
        </button>
      </div>

      {/* Clips strip */}
      {loading ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex-shrink-0 rounded-xl shimmer" style={{ width: 140, height: 98 }} />
          ))}
        </div>
      ) : clips.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 rounded-xl"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
          <Film size={20} style={{ color: 'var(--muted)' }} className="opacity-30" />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Nenhum clipe ainda. Clique em "Gerar clipe" para salvar os últimos segundos.
          </p>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          {clips.map(clip => (
            <ClipCard
              key={clip.id}
              clip={clip}
              camId={camId}
              onPlay={setActiveClip}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {activeClip && (
        <ClipModal clip={activeClip} camId={camId} onClose={() => setActiveClip(null)} />
      )}
    </div>
  )
}
