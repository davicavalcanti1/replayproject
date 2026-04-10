import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Film, Image, Check, Loader, AlertCircle, ChevronDown } from 'lucide-react'
import { downloadFrame, generateClip } from '../hooks/useReplayBuffer'

function Select({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const current = options.find(o => o.value === value)

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-gray-200 border border-white/[0.08] hover:border-white/[0.15] transition-all"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          {current?.label}
          <ChevronDown size={13} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.1 }}
              className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden border border-white/[0.08] z-20"
              style={{ background: '#13131f', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            >
              {options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-white/[0.05] transition-colors
                    ${value === opt.value ? 'text-indigo-400' : 'text-gray-300'}`}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StatusBanner({ status }) {
  if (!status) return null
  const configs = {
    downloading: { icon: <Loader size={13} className="animate-spin" />, text: 'Preparing frame...', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
    success: { icon: <Check size={13} />, text: 'Downloaded!', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    clip_gen: { icon: <Loader size={13} className="animate-spin" />, text: 'Generating clip...', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
    clip_ok: { icon: <Check size={13} />, text: 'Clip ready — downloading!', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    error: { icon: <AlertCircle size={13} />, text: 'Error — try again', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  }
  const c = configs[status]
  if (!c) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${c.color} ${c.bg}`}
    >
      {c.icon}
      {c.text}
    </motion.div>
  )
}

export default function DownloadPanel({ camId, currentOffset, bufferInfo }) {
  const [format, setFormat] = useState('jpeg')
  const [resolution, setResolution] = useState('original')
  const [status, setStatus] = useState(null)

  const atLive = Math.abs(currentOffset) < 0.1

  const handleDownload = async () => {
    if (!camId) return
    setStatus('downloading')
    try {
      await downloadFrame(camId, currentOffset, format, resolution)
      setStatus('success')
      setTimeout(() => setStatus(null), 3000)
    } catch (e) {
      console.error(e)
      setStatus('error')
      setTimeout(() => setStatus(null), 3000)
    }
  }

  const handleClip = async () => {
    if (!camId) return
    setStatus('clip_gen')
    try {
      const result = await generateClip(camId)
      if (result.download_url) {
        const a = document.createElement('a')
        a.href = result.download_url
        a.download = result.download_name || 'replay_clip.mp4'
        a.click()
      }
      setStatus('clip_ok')
      setTimeout(() => setStatus(null), 3000)
    } catch (e) {
      console.error(e)
      setStatus('error')
      setTimeout(() => setStatus(null), 3000)
    }
  }

  const formatOptions = [
    { value: 'jpeg', label: 'JPEG (smaller)' },
    { value: 'png', label: 'PNG (lossless)' },
  ]

  const resolutionOptions = [
    { value: 'original', label: 'Original' },
    { value: 'hd', label: '1280×720' },
    { value: 'fhd', label: '1920×1080' },
    { value: 'thumb', label: '640×360' },
  ]

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-indigo-600/20 flex items-center justify-center">
          <Download size={12} className="text-indigo-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">Export</h3>
      </div>

      {/* Current frame info */}
      <div className="p-3 rounded-xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Selected Frame</span>
          {atLive && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 live-dot" />
              LIVE
            </span>
          )}
        </div>
        <p className="text-lg font-mono font-bold text-white">
          {atLive ? '00:00' : `-${Math.abs(currentOffset).toFixed(2)}s`}
        </p>
        {bufferInfo && (
          <p className="text-[10px] text-gray-600 mt-0.5 font-mono">
            Buffer: {bufferInfo.duration_s?.toFixed(1)}s · {bufferInfo.fps?.toFixed(1)} fps
          </p>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-col gap-3">
        <Select
          label="Format"
          value={format}
          onChange={setFormat}
          options={formatOptions}
        />
        <Select
          label="Resolution"
          value={resolution}
          onChange={setResolution}
          options={resolutionOptions}
        />
      </div>

      {/* Status */}
      <AnimatePresence>
        {status && <StatusBanner status={status} />}
      </AnimatePresence>

      {/* CTAs */}
      <div className="flex flex-col gap-2 mt-auto">
        {/* Primary: Download Frame */}
        <motion.button
          onClick={handleDownload}
          disabled={!camId || status === 'downloading'}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold
            transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed
            ${status === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}`}
        >
          {status === 'downloading' ? (
            <><Loader size={15} className="animate-spin" /> Preparing...</>
          ) : status === 'success' ? (
            <><Check size={15} /> Downloaded!</>
          ) : (
            <><Image size={15} /> Download Frame</>
          )}
        </motion.button>

        {/* Secondary: Create Clip */}
        <motion.button
          onClick={handleClip}
          disabled={!camId || status === 'clip_gen'}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold
            text-gray-300 border border-white/[0.08] hover:border-indigo-500/40 hover:text-white hover:bg-indigo-600/10
            transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === 'clip_gen' ? (
            <><Loader size={15} className="animate-spin" /> Generating...</>
          ) : (
            <><Film size={15} /> Create Clip ({bufferInfo?.duration_s?.toFixed(0) || '?'}s)</>
          )}
        </motion.button>
      </div>

      {/* Hint */}
      <p className="text-[10px] text-gray-600 text-center leading-relaxed">
        Clip exports the full buffer. Frame download saves the selected moment.
      </p>
    </div>
  )
}
