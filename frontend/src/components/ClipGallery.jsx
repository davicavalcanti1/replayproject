import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Download, Play, X, Loader } from 'lucide-react'
import { generateClip } from '../hooks/useReplayBuffer'
import { mediaUrl } from '../lib/api'

const DURATION_PRESETS = [
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '1min', value: 60 },
]

const FULL_CLIP_SECONDS = 60

/**
 * Timeline com bloco arrastável estilo CapCut.
 *  - totalSec: duração total do clipe (60s)
 *  - windowSec: largura do trecho a cortar (10 ou 30)
 *  - start: início atual do trecho em segundos
 *  - onChange(newStart): usuário arrastou; atualize o preview
 */
function TimelineTrimmer({ totalSec, windowSec, start, onChange }) {
  const railRef = useRef(null)
  const dragState = useRef(null)

  const clamp = (v) => Math.max(0, Math.min(totalSec - windowSec, v))

  const pickStartFromClientX = (clientX) => {
    const rail = railRef.current
    if (!rail) return start
    const rect = rail.getBoundingClientRect()
    const pct  = (clientX - rect.left) / rect.width
    // clientX aponta pro centro do bloco arrastado
    const centerSec = pct * totalSec
    return clamp(centerSec - windowSec / 2)
  }

  const onPointerDown = (e) => {
    e.preventDefault()
    const rail = railRef.current
    if (!rail) return
    const rect = rail.getBoundingClientRect()
    const pct  = (e.clientX - rect.left) / rect.width
    const clickedSec = pct * totalSec
    // se clicou fora do bloco atual, teleporta o bloco; caso contrário, só inicia drag mantendo offset
    const blockLeft = start
    const blockRight = start + windowSec
    let offsetFromBlockStart
    if (clickedSec < blockLeft || clickedSec > blockRight) {
      // teleport para centralizar no clique
      const newStart = clamp(clickedSec - windowSec / 2)
      onChange(newStart)
      offsetFromBlockStart = clickedSec - newStart
    } else {
      offsetFromBlockStart = clickedSec - start
    }
    dragState.current = { offsetSec: offsetFromBlockStart }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup',   onPointerUp)
  }

  const onPointerMove = (e) => {
    if (!dragState.current) return
    const rail = railRef.current
    if (!rail) return
    const rect = rail.getBoundingClientRect()
    const pct  = (e.clientX - rect.left) / rect.width
    const curSec = pct * totalSec
    const newStart = clamp(curSec - dragState.current.offsetSec)
    onChange(newStart)
  }

  const onPointerUp = () => {
    dragState.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup',   onPointerUp)
  }

  const leftPct  = (start / totalSec) * 100
  const widthPct = (windowSec / totalSec) * 100

  const fmt = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[10px]"
           style={{ color: 'var(--muted)' }}>
        <span>Arraste para selecionar {windowSec}s dos {totalSec}s</span>
        <span style={{ color: 'var(--text)' }}>
          {fmt(start)} → {fmt(start + windowSec)}
        </span>
      </div>

      <div
        ref={railRef}
        onPointerDown={onPointerDown}
        className="relative select-none"
        style={{
          height: 44,
          background: 'var(--surface-3)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          cursor: 'pointer',
          touchAction: 'none',
        }}
      >
        {/* Marcações a cada 10s */}
        {Array.from({ length: totalSec / 10 + 1 }, (_, i) => (
          <div key={i}
            className="absolute top-0 bottom-0"
            style={{
              left: `${(i * 10 / totalSec) * 100}%`,
              width: 1,
              background: 'rgba(255,255,255,0.08)',
            }}
          />
        ))}

        {/* Bloco selecionado (draggable) */}
        <motion.div
          className="absolute top-0 bottom-0 flex items-center justify-center"
          style={{
            left:   `${leftPct}%`,
            width:  `${widthPct}%`,
            minWidth: 30,
            background: 'linear-gradient(180deg, rgba(59,130,246,0.35), rgba(59,130,246,0.15))',
            border: '2px solid var(--blue-bright, #3b82f6)',
            borderRadius: 6,
            cursor: 'grab',
          }}
          whileTap={{ cursor: 'grabbing' }}
        >
          <div className="text-[10px] font-bold" style={{ color: 'white' }}>
            {windowSec}s
          </div>
          {/* Alças laterais (decorativas) */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l"
               style={{ background: 'var(--blue-bright, #3b82f6)' }} />
          <div className="absolute right-0 top-0 bottom-0 w-1.5 rounded-r"
               style={{ background: 'var(--blue-bright, #3b82f6)' }} />
        </motion.div>
      </div>

      <div className="flex justify-between text-[9px]" style={{ color: 'var(--muted)' }}>
        <span>0:00</span>
        <span>{fmt(totalSec)}</span>
      </div>
    </div>
  )
}

function ClipModal({ clip, camId, onClose }) {
  const videoRef = useRef(null)
  const totalSec = Math.max(
    Math.round(clip.duration_s ?? clip.duration ?? FULL_CLIP_SECONDS),
    10
  )

  const [selDuration, setSelDuration] = useState(totalSec) // 10, 30 ou totalSec
  const [start,       setStart]       = useState(0)
  const [downloading, setDownloading] = useState(false)

  const isTrim = selDuration < totalSec

  // Quando muda a duração, se o intervalo extrapolar, re-encaixa
  useEffect(() => {
    if (start + selDuration > totalSec) setStart(Math.max(0, totalSec - selDuration))
  }, [selDuration, totalSec])  // eslint-disable-line

  // Mantém o preview do vídeo sincronizado com a janela selecionada
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTimeUpdate = () => {
      if (!isTrim) return
      if (v.currentTime < start || v.currentTime >= start + selDuration) {
        v.currentTime = start
      }
    }
    v.addEventListener('timeupdate', onTimeUpdate)
    return () => v.removeEventListener('timeupdate', onTimeUpdate)
  }, [start, selDuration, isTrim])

  // Ao arrastar, pula o preview imediatamente pra começo do novo trecho
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (isTrim && Math.abs(v.currentTime - start) > 0.3) v.currentTime = start
  }, [start, isTrim])

  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      // Sempre passa pelo endpoint /trim — se duração cobre o clipe inteiro,
      // o backend entrega o original sem reprocessar. Evita problema de
      // @login_required em /clips/<cam>/<file> quando o cookie de sessão
      // não é enviado pelo fetch no dev proxy.
      const params = isTrim
        ? `?start=${start.toFixed(2)}&duration=${selDuration}`
        : ''
      const url = `/api/clips/${camId}/${clip.id}/trim${params}`

      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        let detail = ''
        try {
          const j = await res.json()
          detail = j.error || j.detail || ''
        } catch (_) {}
        throw new Error(`HTTP ${res.status}${detail ? ' · ' + detail : ''}`)
      }
      const blob = await res.blob()
      if (blob.size === 0) throw new Error('arquivo_vazio')
      // Confere que é de fato MP4 (defesa contra HTML de login page)
      const ctype = res.headers.get('content-type') || ''
      if (!ctype.includes('video') && !ctype.includes('octet-stream')) {
        throw new Error(`tipo_inesperado: ${ctype}`)
      }
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const ext = isTrim
        ? `_${Math.floor(start)}s_${selDuration}s.mp4`
        : '_full.mp4'
      a.download = `replay_${clip.timestamp?.replace(/[\/:\s]/g, '-') || 'clip'}${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch (e) {
      console.error('download failed:', e)
      alert(`Falha ao baixar o clipe: ${e.message || e}`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: .95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: .95, opacity: 0 }}
          className="relative w-full max-w-2xl rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 flex items-center justify-between border-b"
               style={{ borderColor: 'var(--border)' }}>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                Clipe — {clip.timestamp}
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                {totalSec}s · por {clip.user_name}
              </p>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              style={{ color: 'var(--muted)' }}>
              <X size={15} />
            </button>
          </div>

          <video
            ref={videoRef}
            src={mediaUrl(`/clips/${camId}/${clip.filename}`)}
            controls
            autoPlay
            className="w-full"
            style={{ background: '#000', maxHeight: '50vh' }}
          />

          <div className="p-4 flex flex-col gap-4">
            {/* Seletor de duração */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--muted)' }}>
                Duração
              </span>
              <div className="flex gap-1">
                {DURATION_PRESETS.map(p => {
                  const v = p.value === 60 ? totalSec : p.value
                  const active = selDuration === v
                  const disabled = v > totalSec
                  return (
                    <button key={p.label}
                      disabled={disabled}
                      onClick={() => setSelDuration(v)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{
                        background: active
                          ? 'var(--blue, #3b82f6)'
                          : 'var(--surface-3)',
                        color: active ? 'white' : 'var(--text)',
                        border: `1px solid ${active ? 'var(--blue, #3b82f6)' : 'var(--border)'}`,
                        opacity: disabled ? 0.4 : 1,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}>
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Trimmer (só quando seleção < total) */}
            {isTrim && (
              <TimelineTrimmer
                totalSec={totalSec}
                windowSec={selDuration}
                start={start}
                onChange={setStart}
              />
            )}

            {/* Botão baixar */}
            <div className="flex justify-end">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white btn-blue"
                style={{ opacity: downloading ? 0.6 : 1 }}
              >
                {downloading
                  ? <><Loader size={14} className="animate-spin" /> Processando...</>
                  : <><Download size={14} /> Baixar {selDuration}s</>}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function ClipCard({ clip, camId, onPlay }) {
  const thumbSrc = mediaUrl(`/clips/${camId}/${clip.thumb}`)

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
  const [genStatus, setGenStatus] = useState(null)

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
    const interval = setInterval(fetchClips, 5000)
    return () => clearInterval(interval)
  }, [camId, fetchClips])

  const handleGenerate = async () => {
    if (!camId || generating) return
    setGenerating(true)
    setGenStatus(null)
    try {
      const result = await generateClip(camId)
      // Em vez de baixar direto (agora sempre 60s), abre o modal de trim
      if (result.clip) setActiveClip(result.clip)
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
              : <><Film size={12} /> Gerar clipe (1min)</>}
        </button>
      </div>

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
            Nenhum clipe ainda. Clique em "Gerar clipe" para salvar o último minuto.
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

      {activeClip && (
        <ClipModal clip={activeClip} camId={camId} onClose={() => setActiveClip(null)} />
      )}
    </div>
  )
}
