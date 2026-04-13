import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Camera, Cpu, HardDrive, Pause, Play, Power, RefreshCw,
  Server, Trash2, Plus, AlertTriangle, CheckCircle2, Activity,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────────────────────
const fmtUptime = (s) => {
  if (!s || s <= 0) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

async function jsonPost(url, body = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

async function jsonGet(url) {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ────────────────────────────────────────────────────────────────────────────
//  Dashboard cards
// ────────────────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, hint, color = 'blue' }) {
  return (
    <div className="flex-1 min-w-[140px] rounded-xl p-3 flex flex-col gap-1"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
        <Icon size={13} style={{ color: `var(--${color}-bright, #3b82f6)` }} />
        <span className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--muted)' }}>{label}</span>
      </div>
      <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>{value}</div>
      {hint && <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{hint}</div>}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  Camera Row
// ────────────────────────────────────────────────────────────────────────────
function CameraRow({ cam, onAction }) {
  const [busy, setBusy] = useState(false)

  const doAction = async (action) => {
    if (busy) return
    setBusy(true)
    try {
      if (action === 'pause') {
        await jsonPost(`/api/admin/cameras/${cam.cam_id}/pause`)
      } else if (action === 'resume') {
        await jsonPost(`/api/admin/cameras/${cam.cam_id}/resume`)
      } else if (action === 'remove') {
        // diálogo em 2 etapas: confirmar + escolher se apaga clipes
        const name = cam.name || cam.label || cam.cam_id
        if (!confirm(`Remover a câmera "${name}"?\n\nVai parar a captura e sumir com ela do painel. Pra voltar, você precisa adicioná-la manualmente.`)) {
          setBusy(false); return
        }
        const alsoDelete = confirm(
          `Apagar TAMBÉM os clipes gravados dessa câmera no disco?\n\n` +
          `[OK]      — remove câmera + apaga os .mp4 (IRREVERSÍVEL)\n` +
          `[Cancel]  — remove só a câmera, mantém os clipes no disco`
        )
        const qs = alsoDelete ? '?delete_clips=1' : ''
        const r = await fetch(`/api/admin/cameras/${cam.cam_id}${qs}`, {
          method: 'DELETE',
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
        if (alsoDelete && j.files_deleted != null) {
          alert(`Câmera removida. ${j.files_deleted} arquivo(s) apagado(s) do disco.`)
        }
      }
      onAction()
    } catch (e) {
      alert(`Erro: ${e.message || e}`)
    } finally {
      setBusy(false)
    }
  }

  const statusColor = cam.active
    ? '#22c55e'
    : cam.paused
      ? '#eab308'
      : cam.error
        ? '#ef4444'
        : '#6b7280'

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      {/* Status dot */}
      <div className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>
            {cam.name || cam.label}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
            style={{
              background: cam.type === 'ip' ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)',
              color:      cam.type === 'ip' ? '#c084fc' : '#60a5fa'
            }}>
            {cam.type}
          </span>
        </div>
        <div className="text-[10px] flex gap-3" style={{ color: 'var(--muted)' }}>
          <span>id: {cam.cam_id}</span>
          {cam.ip && <span>{cam.ip}:554 ch{cam.channel}</span>}
          {cam.index !== undefined && cam.index !== null && !cam.ip && <span>USB idx {cam.index}</span>}
          <span>{cam.frames} frames · {cam.duration_s}s</span>
          {cam.error && <span style={{ color: '#ef4444' }}>⚠ {cam.error}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1">
        {cam.active ? (
          <button onClick={() => doAction('pause')} disabled={busy}
            title="Pausar captura"
            className="p-1.5 rounded hover:bg-white/10 transition-colors">
            <Pause size={14} style={{ color: '#eab308' }} />
          </button>
        ) : (
          <button onClick={() => doAction('resume')} disabled={busy}
            title="Retomar captura"
            className="p-1.5 rounded hover:bg-white/10 transition-colors">
            <Play size={14} style={{ color: '#22c55e' }} />
          </button>
        )}
        <button onClick={() => doAction('remove')} disabled={busy}
          title="Remover câmera"
          className="p-1.5 rounded hover:bg-white/10 transition-colors">
          <Trash2 size={14} style={{ color: '#ef4444' }} />
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  Add IP Camera form
// ────────────────────────────────────────────────────────────────────────────
function AddIpCameraForm({ onAdded }) {
  const [ip, setIp]         = useState('')
  const [channel, setCh]    = useState(1)
  const [name, setName]     = useState('')
  const [busy, setBusy]     = useState(false)
  const [open, setOpen]     = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!ip || busy) return
    setBusy(true)
    try {
      await jsonPost('/api/add-ip-camera', { ip, channel: Number(channel), name })
      setIp(''); setCh(1); setName(''); setOpen(false)
      onAdded()
    } catch (err) {
      alert(`Falha ao adicionar: ${err.message || err}`)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold btn-blue">
      <Plus size={13} /> Adicionar câmera IP
    </button>
  )

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 items-center p-3 rounded-lg"
      style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-2)' }}>
      <input value={ip} onChange={e => setIp(e.target.value)}
        placeholder="IP (ex: 192.168.1.108)" required
        className="px-2 py-1.5 text-xs rounded flex-1 min-w-[160px]"
        style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
      <input value={channel} onChange={e => setCh(e.target.value)} type="number" min="1" max="16"
        className="px-2 py-1.5 text-xs rounded w-16"
        style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
      <input value={name} onChange={e => setName(e.target.value)}
        placeholder="Nome (ex: Quadra A)"
        className="px-2 py-1.5 text-xs rounded flex-1 min-w-[140px]"
        style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
      <button type="submit" disabled={busy}
        className="px-3 py-1.5 rounded text-xs font-bold btn-blue">
        {busy ? '...' : 'Adicionar'}
      </button>
      <button type="button" onClick={() => setOpen(false)}
        className="px-3 py-1.5 rounded text-xs"
        style={{ background: 'var(--surface-3)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
        Cancelar
      </button>
    </form>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  Danger zone (system control)
// ────────────────────────────────────────────────────────────────────────────
function DangerButton({ label, icon: Icon, onClick, color = '#ef4444' }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all"
      style={{
        background: 'transparent', color,
        border: `1px solid ${color}`,
      }}>
      <Icon size={14} /> {label}
    </button>
  )
}

function SystemControl({ onlineStatus }) {
  const confirmAndDo = async (url, label) => {
    const phrase = `DESLIGAR`
    const input = prompt(
      `${label}\n\nPra confirmar, digite ${phrase}:`
    )
    if (input !== phrase) return
    try {
      const data = await jsonPost(url, { confirm: 'yes' })
      alert(`Ação '${data.action}' agendada. O PC vai ${label.toLowerCase()} em ~${data.eta_s}s.`)
    } catch (e) {
      alert(`Erro: ${e.message || e}`)
    }
  }

  const cancelShutdown = async () => {
    try {
      await jsonPost('/api/admin/system/cancel-shutdown', {})
      alert('Comando cancelado (se ainda estava no delay).')
    } catch (e) {
      alert(`Erro: ${e.message || e}`)
    }
  }

  const restartBackend = async () => {
    if (!confirm('Reiniciar o processo do backend? Só funciona se tiver supervisor (Docker/systemd).'))
      return
    try {
      await jsonPost('/api/admin/system/restart-backend', {})
      alert('Backend sinalizado pra reiniciar. Aguarde ~5s e recarregue a página.')
    } catch (e) {
      alert(`Erro: ${e.message || e}`)
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl"
      style={{ background: 'var(--surface-2)', border: '1px solid rgba(239,68,68,0.3)' }}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} style={{ color: '#ef4444' }} />
        <span className="text-xs font-bold uppercase tracking-wider"
          style={{ color: '#ef4444' }}>Zona perigosa</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <DangerButton label="Reiniciar backend" icon={RefreshCw}
          color="#3b82f6"
          onClick={restartBackend} />
        <DangerButton label="Reboot do PC" icon={RefreshCw}
          color="#f59e0b"
          onClick={() => confirmAndDo('/api/admin/system/reboot', 'REINICIAR')} />
        <DangerButton label="Desligar PC" icon={Power}
          color="#ef4444"
          onClick={() => confirmAndDo('/api/admin/system/shutdown', 'DESLIGAR')} />
        <DangerButton label="Cancelar desligamento" icon={CheckCircle2}
          color="#22c55e"
          onClick={cancelShutdown} />
      </div>

      <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
        Os comandos têm {5}s de delay pra resposta chegar no navegador. Se agendar por engano,
        clique em "Cancelar desligamento" em até 5s.
      </p>

      {!onlineStatus && (
        <div className="flex items-center gap-2 p-2 rounded text-[11px]"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          <AlertTriangle size={12} />
          Edge (PC local) está offline. Verifique o Cloudflare Tunnel.
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  Admin Page
// ────────────────────────────────────────────────────────────────────────────
export default function Admin() {
  const [cameras, setCameras] = useState([])
  const [sysInfo, setSysInfo] = useState(null)
  const [online, setOnline]   = useState(true)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        jsonGet('/api/admin/cameras'),
        jsonGet('/api/admin/system'),
      ])
      setCameras(c.cameras || [])
      setSysInfo(s)
      setOnline(true)
    } catch (e) {
      console.error('[admin] refresh failed:', e)
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [refresh])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto w-full p-4 flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Administração
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Controle de câmeras e sistema · PC edge {online
              ? <span style={{ color: '#22c55e' }}>● online</span>
              : <span style={{ color: '#ef4444' }}>● offline</span>}
          </p>
        </div>
        <button onClick={refresh}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* System stats */}
      {sysInfo && (
        <div className="flex flex-wrap gap-3">
          <StatCard icon={Cpu}      label="CPU"        value={`${sysInfo.cpu_percent ?? '—'}%`}
            hint={sysInfo.platform}  />
          <StatCard icon={HardDrive} label="RAM"       value={`${sysInfo.ram_percent ?? '—'}%`}
            hint={sysInfo.ram_used_mb ? `${sysInfo.ram_used_mb}/${sysInfo.ram_total_mb} MB` : ''} />
          <StatCard icon={Camera}    label="Câmeras"    value={`${sysInfo.cameras_active}/${sysInfo.cameras_total}`}
            hint="ativas / total" />
          <StatCard icon={Activity}  label="Clips"      value={sysInfo.clips_total ?? '—'}
            hint={`Buffer ${sysInfo.buffer_seconds}s @ ${sysInfo.capture_fps}fps`} />
          <StatCard icon={Server}    label="Uptime"     value={fmtUptime(sysInfo.process_uptime)}
            hint={sysInfo.node} />
        </div>
      )}

      {/* Cameras */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}>Câmeras ({cameras.length})</h2>
          <AddIpCameraForm onAdded={refresh} />
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="h-14 rounded-lg shimmer" />
            ))}
          </div>
        ) : cameras.length === 0 ? (
          <div className="text-center py-8 rounded-xl"
            style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-2)' }}>
            <Camera size={24} className="mx-auto opacity-30 mb-2"
              style={{ color: 'var(--muted)' }} />
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Nenhuma câmera registrada. Adicione uma câmera IP acima.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {cameras.map(cam => (
              <CameraRow key={cam.cam_id} cam={cam} onAction={refresh} />
            ))}
          </div>
        )}
      </section>

      {/* System danger zone */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider"
          style={{ color: 'var(--muted)' }}>Sistema</h2>
        <SystemControl onlineStatus={online} />
      </section>
    </motion.div>
  )
}
