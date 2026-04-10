import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Camera, Check, AlertTriangle, Loader, Wifi, SkipForward } from 'lucide-react'

// ── Status icon per index entry ──────────────────────────────────────────────
function StatusIcon({ status }) {
  if (status === 'pending')  return <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'var(--muted-2)' }} />
  if (status === 'checking') return <Loader size={15} className="animate-spin" style={{ color: 'var(--blue-bright)' }} />
  if (status === 'found')    return <Check  size={15} style={{ color: '#34d399' }} />
  if (status === 'skipped')  return <SkipForward size={14} style={{ color: 'var(--muted)' }} />
  /* error */                return <AlertTriangle size={14} style={{ color: '#6b7fa8' }} />
}

function IndexRow({ entry }) {
  const labels = {
    pending:  'Aguardando...',
    checking: 'Verificando...',
    found:    'Câmera encontrada!',
    skipped:  entry.reason || 'Já ativa',
    error:    entry.reason || 'Não encontrada',
  }

  const barColors = {
    pending:  'var(--surface-3)',
    checking: 'var(--blue)',
    found:    '#059669',
    skipped:  'var(--muted-2)',
    error:    'var(--surface-3)',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all"
      style={{
        background: entry.status === 'found'
          ? 'rgba(5,150,105,0.08)'
          : entry.status === 'checking'
            ? 'rgba(59,130,246,0.06)'
            : 'var(--surface-3)',
        border: `1px solid ${entry.status === 'found'
          ? 'rgba(5,150,105,0.2)'
          : entry.status === 'checking'
            ? 'rgba(59,130,246,0.2)'
            : 'var(--border)'}`,
      }}
    >
      {/* Index badge */}
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono flex-shrink-0"
        style={{
          background: entry.status === 'found' ? 'rgba(5,150,105,0.2)' : 'var(--surface-2)',
          color: entry.status === 'found' ? '#34d399' : 'var(--muted)',
        }}>
        {entry.index}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{
          color: entry.status === 'found' ? '#34d399'
               : entry.status === 'checking' ? 'var(--blue-bright)'
               : 'var(--muted)',
        }}>
          {entry.status === 'found' && entry.cam_id
            ? `Câmera ${entry.cam_id} — adicionada`
            : labels[entry.status]}
        </p>

        {/* Progress bar for checking */}
        {entry.status === 'checking' && (
          <div className="mt-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--blue)' }}
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}
      </div>

      <StatusIcon status={entry.status} />
    </motion.div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function ScanCamerasModal({ onClose, onCamerasAdded }) {
  const [phase, setPhase] = useState('idle')   // idle | scanning | done
  const [indices, setIndices] = useState([])
  const [added, setAdded]     = useState([])
  const [error, setError]     = useState('')
  const pollRef = useRef(null)

  const stopPolling = () => clearInterval(pollRef.current)

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/scan-status')
      if (!res.ok) return
      const data = await res.json()
      setIndices(data.indices || [])
      setAdded(data.added   || [])
      if (!data.running) {
        stopPolling()
        setPhase('done')
        if (data.added?.length > 0) {
          onCamerasAdded?.()
        }
      }
    } catch (_) {}
  }, [onCamerasAdded])

  const startScan = async () => {
    setPhase('scanning')
    setError('')
    setIndices([])
    setAdded([])
    try {
      const res = await fetch('/api/scan-cameras', { method: 'POST' })
      if (res.status === 409) {
        setError('Já existe um scan em andamento. Aguarde.')
        setPhase('idle')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Start polling
      pollRef.current = setInterval(pollStatus, 400)
    } catch (e) {
      setError(e.message)
      setPhase('idle')
    }
  }

  useEffect(() => () => stopPolling(), [])

  const foundCount   = indices.filter(e => e.status === 'found').length
  const checkedCount = indices.filter(e => e.status !== 'pending').length
  const totalCount   = indices.length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-2)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.2)' }}>
            {phase === 'scanning'
              ? <Search size={16} style={{ color: 'var(--blue-bright)' }} className="animate-pulse" />
              : <Camera size={16} style={{ color: 'var(--blue-bright)' }} />}
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Detectar câmeras</h2>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
              {phase === 'idle'    && 'Conecte a câmera ao computador antes de iniciar.'}
              {phase === 'scanning' && `Verificando índices 0–9 em paralelo…`}
              {phase === 'done'    && (foundCount > 0
                ? `${foundCount} câmera${foundCount > 1 ? 's' : ''} adicionada${foundCount > 1 ? 's' : ''}!`
                : 'Nenhuma câmera nova encontrada.')}
            </p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
            style={{ color: 'var(--muted)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Progress bar overall */}
        {phase === 'scanning' && totalCount > 0 && (
          <div className="px-5 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
                {checkedCount}/{totalCount} verificados
              </span>
              {foundCount > 0 && (
                <span className="text-[10px] font-bold" style={{ color: '#34d399' }}>
                  {foundCount} encontrada{foundCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, var(--blue-dim), var(--blue-bright))' }}
                animate={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Index grid */}
        <div className="px-5 py-4 flex flex-col gap-2 max-h-72 overflow-y-auto">
          {phase === 'idle' && (
            <div className="flex flex-col items-center gap-3 py-6">
              {/* Illustration */}
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px dashed rgba(59,130,246,0.3)' }}>
                  <Camera size={28} style={{ color: 'var(--blue)' }} />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-2xl"
                  style={{ border: '1px solid rgba(59,130,246,0.4)' }}
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  Pronto para escanear
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
                  O sistema vai testar os índices 0–9 em busca<br />de câmeras ainda não cadastradas.
                </p>
              </div>
            </div>
          )}

          {(phase === 'scanning' || phase === 'done') && indices.map((entry) => (
            <IndexRow key={entry.index} entry={entry} />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-400"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        {/* Result summary when done */}
        {phase === 'done' && foundCount > 0 && (
          <div className="mx-5 mb-3 p-3 rounded-xl"
            style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#34d399' }}>
              Câmeras adicionadas ao sistema:
            </p>
            {added.map(cam => (
              <div key={cam.id} className="flex items-center gap-2">
                <Wifi size={11} style={{ color: '#34d399' }} />
                <span className="text-xs" style={{ color: 'var(--text)' }}>
                  {cam.name} <span style={{ color: 'var(--muted)' }}>— índice {cam.index} ({cam.backend})</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {phase === 'done' && foundCount === 0 && (
          <div className="mx-5 mb-3 p-3 rounded-xl text-center"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Nenhuma câmera nova detectada. Verifique se a câmera está conectada e ligada.
            </p>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex gap-2 px-5 pb-5">
          {phase === 'idle' && (
            <>
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold btn-ghost">
                Cancelar
              </button>
              <button onClick={startScan}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white btn-blue flex items-center justify-center gap-2">
                <Search size={14} /> Iniciar scan
              </button>
            </>
          )}

          {phase === 'scanning' && (
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold btn-ghost">
              Fechar (scan continua em background)
            </button>
          )}

          {phase === 'done' && (
            <>
              <button onClick={() => { setPhase('idle'); setIndices([]); setAdded([]) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold btn-ghost flex items-center justify-center gap-2">
                <Search size={13} /> Escanear novamente
              </button>
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white btn-blue">
                {foundCount > 0 ? 'Ver câmeras' : 'Fechar'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
