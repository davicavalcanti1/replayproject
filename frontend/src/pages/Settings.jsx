import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, Save, RefreshCw, Info } from 'lucide-react'

function Section({ title, children }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{title}</h2>
      {children}
    </div>
  )
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5 flex-1">
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
        {description && <span className="text-xs" style={{ color: 'var(--muted)' }}>{description}</span>}
      </div>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, min, max, step = 1 }) {
  const baseStyle = {
    background: 'var(--surface-3)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    width: 80,
  }
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      min={min} max={max} step={step}
      className="px-3 py-1.5 rounded-lg text-sm font-mono text-right outline-none"
      style={baseStyle}
      onFocus={e => e.target.style.borderColor = 'var(--blue)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'}
    />
  )
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-all"
      style={{ background: value ? 'var(--blue)' : 'var(--surface-3)' }}
    >
      <motion.div
        animate={{ x: value ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
      />
    </button>
  )
}

export default function Settings() {
  const [config, setConfig] = useState({
    buffer_seconds: 10,
    capture_fps: 20,
    scan_interval: 15,
    show_scanlines: true,
    auto_replay: false,
  })
  const [saved, setSaved] = useState(false)
  const [sysInfo, setSysInfo] = useState(null)

  useEffect(() => {
    // Load current config from Flask (best-effort)
    fetch('/api/config').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setConfig(prev => ({ ...prev, ...d }))
    }).catch(() => {})

    // System info
    fetch('/health').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setSysInfo(d)
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
    } catch (_) {}
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const set = (k, v) => setConfig(prev => ({ ...prev, [k]: v }))

  return (
    <div className="flex-1 flex flex-col p-5 gap-5 max-w-[800px] w-full mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid var(--border-2)' }}>
            <SettingsIcon size={16} style={{ color: 'var(--blue-bright)' }} />
          </div>
          <div>
            <h1 className="text-base font-black" style={{ color: 'var(--text)' }}>Configurações</h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Parâmetros do sistema de replay</p>
          </div>
        </div>
        <button onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white btn-blue">
          {saved ? <><RefreshCw size={13} /> Salvo!</> : <><Save size={13} /> Salvar</>}
        </button>
      </div>

      {/* Buffer */}
      <Section title="Buffer de vídeo">
        <SettingRow label="Segundos de buffer" description="Quantos segundos o sistema mantém em memória para replay">
          <NumInput value={config.buffer_seconds} onChange={v => set('buffer_seconds', v)} min={3} max={120} />
        </SettingRow>
        <SettingRow label="FPS de captura" description="Frames por segundo capturados de cada câmera">
          <NumInput value={config.capture_fps} onChange={v => set('capture_fps', v)} min={5} max={60} />
        </SettingRow>
      </Section>

      {/* Scanner */}
      <Section title="Scanner de câmeras">
        <SettingRow label="Intervalo de scan (s)" description="A cada quantos segundos o sistema verifica novas câmeras">
          <NumInput value={config.scan_interval} onChange={v => set('scan_interval', v)} min={5} max={300} />
        </SettingRow>
      </Section>

      {/* Interface */}
      <Section title="Interface">
        <SettingRow label="Linhas de scan" description="Efeito visual de câmera de segurança nos vídeos">
          <Toggle value={config.show_scanlines} onChange={v => set('show_scanlines', v)} />
        </SettingRow>
        <SettingRow label="Auto-replay ao abrir câmera" description="Inicia o replay do buffer automaticamente ao entrar em uma câmera">
          <Toggle value={config.auto_replay} onChange={v => set('auto_replay', v)} />
        </SettingRow>
      </Section>

      {/* System status */}
      {sysInfo && (
        <Section title="Status do sistema">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(sysInfo).map(([camId, info]) => (
              <div key={camId} className="p-3 rounded-lg flex flex-col gap-1"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${info.active ? 'bg-emerald-400 live-dot' : 'bg-gray-500'}`} />
                  <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>Câmera {camId}</span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
                  {info.frames} frames · {info.duration_s?.toFixed(1)}s
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Info note */}
      <div className="flex items-start gap-3 p-4 rounded-xl"
        style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <Info size={14} style={{ color: 'var(--blue-bright)', marginTop: 1 }} className="flex-shrink-0" />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
          Alterações no buffer e FPS requerem reiniciar o backend para ter efeito.
          Salvar aqui persiste as preferências de interface imediatamente.
        </p>
      </div>
    </div>
  )
}
