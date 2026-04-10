import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Wifi, WifiOff, ChevronRight, ScanLine, PlusCircle, Globe, Search } from 'lucide-react'
import { useHealth } from '../hooks/useReplayBuffer'
import ScanCamerasModal from '../components/ScanCamerasModal'
import AddIPCameraModal from '../components/AddIPCameraModal'

const LOCATION_NAMES = {
  '0': 'Quadra 01 - Frontal',
  '1': 'Quadra 01 - Lateral',
  '2': 'Quadra 02 - Frontal',
  '3': 'Quadra 02 - Lateral',
  '4': 'Quadra 03 - Frontal',
  '5': 'Quadra 03 - Lateral',
}
const getLoc = id => LOCATION_NAMES[id] || `Câmera ${id}`

// Snapshot image with auto-refresh
function SnapshotImg({ camId, alt }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 250)
    return () => clearInterval(id)
  }, [])

  return (
    <img
      src={`/snapshot/${camId}?t=${tick}`}
      alt={alt}
      className="w-full h-full object-cover"
    />
  )
}

// Camera card — matches ReFrame design
function CameraCard({ id, info, index, isNew }) {
  const navigate  = useNavigate()
  const isActive  = info?.active === true

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => navigate(`/camera/${id}`)}
      className="group rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isNew ? 'rgba(52,211,153,0.4)' : 'var(--border-2)'}`,
        boxShadow: isNew
          ? '0 0 24px rgba(52,211,153,0.12)'
          : '0 4px 24px rgba(0,0,0,0.2)',
        transition: 'border-color .2s, box-shadow .2s, transform .2s',
      }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Feed preview */}
      <div className="relative" style={{ aspectRatio: '16/9', background: '#0a0820' }}>
        {isActive ? (
          <SnapshotImg camId={id} alt={getLoc(id)} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <WifiOff size={20} style={{ color: 'var(--muted)' }} className="opacity-40" />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Câmera offline</span>
          </div>
        )}


        {/* Red recording dot — top right */}
        {isActive && (
          <div className="absolute top-3 right-3 flex items-center justify-center">
            <span
              className="w-3 h-3 rounded-full live-dot"
              style={{
                background: '#ef4444',
                boxShadow: '0 0 8px rgba(239,68,68,0.6)',
              }}
            />
          </div>
        )}

        {/* NEW badge */}
        {isNew && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black text-white"
            style={{ background: 'rgba(52,211,153,0.9)' }}
          >
            NOVA
          </motion.div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-white"
            style={{ background: 'rgba(59,130,246,0.9)', backdropFilter: 'blur(8px)' }}>
            Abrir câmera <ChevronRight size={14} />
          </div>
        </div>

        {/* IP badge */}
        {info?.is_ip && (
          <div className="absolute top-3 left-3 px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] font-bold"
            style={{ background: 'rgba(124,58,237,0.7)', color: '#fff' }}>
            <Globe size={8} /> IP
          </div>
        )}
      </div>

      {/* Bottom strip — light/white bar with camera name */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(255,255,255,0.95)',
        }}
      >
        <p
          className="text-xs font-bold uppercase tracking-wide truncate"
          style={{ color: '#1a1535' }}
        >
          {getLoc(id)}
        </p>
        {info?.is_ip && (
          <span className="text-[9px] font-mono" style={{ color: '#6b5f8a' }}>
            {info.ip}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// Empty state
function EmptyState({ onScan }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 py-16">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-2)' }}>
          <Camera size={32} style={{ color: 'var(--muted)' }} className="opacity-40" />
        </div>
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="absolute inset-0 rounded-2xl"
          style={{ border: '1px solid rgba(124,58,237,0.3)' }}
        />
      </div>

      <div className="text-center">
        <p className="text-base font-bold" style={{ color: 'var(--text)' }}>Nenhuma câmera ativa</p>
        <p className="text-xs mt-1.5 leading-relaxed max-w-xs" style={{ color: 'var(--muted)' }}>
          Verifique se o backend está rodando.<br />
          Se quiser adicionar uma nova câmera, conecte-a e clique em "Detectar câmeras".
        </p>
      </div>

      <button
        onClick={onScan}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white btn-blue"
      >
        <ScanLine size={15} /> Detectar câmeras
      </button>
    </div>
  )
}

// Page
export default function Cameras() {
  const { health, cameras } = useHealth()
  const [showScan, setShowScan]   = useState(false)
  const [showAddIP, setShowAddIP] = useState(false)
  const [newIds, setNewIds]       = useState(new Set())

  const activeCount = cameras.filter(id => health[id]?.active).length

  const handleCamerasAdded = useCallback(() => {
    setNewIds(new Set(['__highlight_next__']))
    setTimeout(() => setNewIds(new Set()), 8000)
  }, [])

  const isNew = useCallback((id) => {
    return newIds.has('__highlight_next__') && !Object.keys(health).includes(id)
      || newIds.has(id)
  }, [newIds, health])

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-5 gap-3 sm:gap-5 max-w-[1400px] w-full mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-black tracking-tight" style={{ color: 'var(--text)' }}>
            Câmeras
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {cameras.length === 0
              ? 'Nenhuma câmera detectada'
              : `${activeCount} de ${cameras.length} câmera${cameras.length !== 1 ? 's' : ''} ativa${activeCount !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {cameras.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: activeCount > 0 ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${activeCount > 0 ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)'}`,
                color: activeCount > 0 ? '#34d399' : '#f87171',
              }}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeCount > 0 ? 'bg-emerald-400 live-dot' : 'bg-red-400'}`} />
              {activeCount > 0 ? `${activeCount} online` : 'Todas offline'}
            </div>
          )}

          <motion.button
            onClick={() => setShowAddIP(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold"
            style={{
              background: 'rgba(124,58,237,0.1)',
              border: '1px solid rgba(124,58,237,0.3)',
              color: 'var(--purple-bright)',
            }}
          >
            <Globe size={15} />
            <span className="hidden sm:inline">Câmera IP</span>
          </motion.button>

          <motion.button
            onClick={() => setShowScan(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white btn-blue"
          >
            <PlusCircle size={15} />
            <span className="hidden sm:inline">Detectar câmeras</span>
          </motion.button>
        </div>
      </div>

      {/* Grid or empty state */}
      {cameras.length === 0 ? (
        <EmptyState onScan={() => setShowScan(true)} />
      ) : (
        <div className="grid gap-4 sm:gap-5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
          {cameras.map((id, i) => (
            <CameraCard
              key={id}
              id={id}
              info={health[id]}
              index={i}
              isNew={isNew(id)}
            />
          ))}
        </div>
      )}

      {/* Scan modal */}
      <AnimatePresence>
        {showScan && (
          <ScanCamerasModal
            onClose={() => setShowScan(false)}
            onCamerasAdded={handleCamerasAdded}
          />
        )}
      </AnimatePresence>

      {/* Add IP Camera modal */}
      <AnimatePresence>
        {showAddIP && (
          <AddIPCameraModal
            onClose={() => setShowAddIP(false)}
            onCameraAdded={handleCamerasAdded}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
