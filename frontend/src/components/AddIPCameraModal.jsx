import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wifi, Loader, Check, AlertTriangle, Camera } from 'lucide-react'

export default function AddIPCameraModal({ onClose, onCameraAdded }) {
  const [ip, setIp]           = useState('')
  const [channel, setChannel] = useState('1')
  const [name, setName]       = useState('')
  const [phase, setPhase]     = useState('idle')   // idle | connecting | success | error
  const [error, setError]     = useState('')
  const [result, setResult]   = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!ip.trim()) return

    setPhase('connecting')
    setError('')

    try {
      const res = await fetch('/api/add-ip-camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: ip.trim(),
          channel: parseInt(channel) || 1,
          name: name.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `Erro HTTP ${res.status}`)
        setPhase('error')
        return
      }

      setResult(data)
      setPhase('success')
      onCameraAdded?.()
    } catch (err) {
      setError(err.message || 'Erro de conexão com o servidor')
      setPhase('error')
    }
  }

  const reset = () => {
    setIp('')
    setChannel('1')
    setName('')
    setPhase('idle')
    setError('')
    setResult(null)
  }

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
            <Wifi size={16} style={{ color: 'var(--blue-bright)' }} />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Adicionar Câmera IP</h2>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
              {phase === 'idle'       && 'Digite o IP da câmera Intelbras na rede'}
              {phase === 'connecting' && 'Conectando via RTSP...'}
              {phase === 'success'    && 'Câmera adicionada com sucesso!'}
              {phase === 'error'      && 'Falha na conexão'}
            </p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
            style={{ color: 'var(--muted)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {phase === 'idle' || phase === 'error' ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* IP field */}
              <div>
                <label className="text-[11px] font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>
                  Endereço IP *
                </label>
                <input
                  type="text"
                  value={ip}
                  onChange={e => setIp(e.target.value)}
                  placeholder="Ex: 10.20.100.126"
                  autoFocus
                  required
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-2)',
                    color: 'var(--text)',
                  }}
                />
              </div>

              {/* Channel + Name row */}
              <div className="flex gap-3">
                <div className="w-24">
                  <label className="text-[11px] font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>
                    Canal
                  </label>
                  <input
                    type="number"
                    value={channel}
                    onChange={e => setChannel(e.target.value)}
                    min="1"
                    max="64"
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-2)',
                      color: 'var(--text)',
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>
                    Nome (opcional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Entrada principal"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-2)',
                      color: 'var(--text)',
                    }}
                  />
                </div>
              </div>

              {/* Hint */}
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                O sistema conecta via RTSP usando as credenciais configuradas no servidor.
                O mesmo IP que você usa no navegador para acessar a câmera.
              </p>

              {/* Error message */}
              {phase === 'error' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-400"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle size={13} /> {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold btn-ghost">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white btn-blue flex items-center justify-center gap-2">
                  <Wifi size={14} /> Conectar
                </button>
              </div>
            </form>
          ) : phase === 'connecting' ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
                  <Loader size={28} className="animate-spin" style={{ color: 'var(--blue-bright)' }} />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Conectando...</p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  Acessando {ip} via RTSP
                </p>
              </div>
            </div>
          ) : phase === 'success' ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.3)' }}>
                <Check size={28} style={{ color: '#34d399' }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: '#34d399' }}>
                  Câmera conectada!
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  {result?.name} ({result?.ip}) — ID {result?.cam_id}
                </p>
              </div>
              <div className="flex gap-2 w-full pt-2">
                <button onClick={reset}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold btn-ghost flex items-center justify-center gap-2">
                  <Camera size={13} /> Adicionar outra
                </button>
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white btn-blue">
                  Ver câmeras
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  )
}
