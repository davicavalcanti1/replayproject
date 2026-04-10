import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users as UsersIcon, Shield, Plus, Minus, Search } from 'lucide-react'

function Avatar({ name }) {
  const initials = name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
      style={{ background: 'linear-gradient(135deg,#1d4ed8,#60a5fa)' }}>
      {initials}
    </div>
  )
}

export default function Users() {
  const [users, setUsers] = useState({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (_) {}
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const adjustCredits = async (username, delta) => {
    try {
      await fetch(`/api/users/${username}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      })
      fetchUsers()
    } catch (_) {}
  }

  const filtered = Object.entries(users).filter(([uname, u]) => {
    const q = search.toLowerCase()
    return !q || uname.includes(q) || u.name?.toLowerCase().includes(q) || u.phone?.includes(q)
  })

  const totalUsers  = Object.values(users).filter(u => !u.is_admin).length
  const totalAdmins = Object.values(users).filter(u => u.is_admin).length

  return (
    <div className="flex-1 flex flex-col p-5 gap-5 max-w-[900px] w-full mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid var(--border-2)' }}>
            <UsersIcon size={16} style={{ color: 'var(--blue-bright)' }} />
          </div>
          <div>
            <h1 className="text-base font-black" style={{ color: 'var(--text)' }}>Usuários</h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {totalUsers} usuários · {totalAdmins} admin{totalAdmins !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-2 rounded-xl text-sm outline-none w-48"
            style={{
              background: 'var(--surface-3)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>

        {/* Table header */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 py-3 text-[11px] font-bold uppercase tracking-wider"
          style={{ background: 'var(--surface-2)', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
          <span>Avatar</span>
          <span>Usuário</span>
          <span className="text-center">Tipo</span>
          <span className="text-center">Créditos</span>
          <span className="text-center">Ações</span>
        </div>

        {/* Rows */}
        {loading ? (
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="w-8 h-8 rounded-full shimmer" />
              <div className="flex-1 h-4 rounded shimmer" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Nenhum usuário encontrado.</p>
          </div>
        ) : (
          filtered.map(([username, u], i) => (
            <motion.div
              key={username}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
              style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              {/* Avatar */}
              <Avatar name={u.name} />

              {/* Info */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{u.name}</p>
                </div>
                <p className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
                  {username} · {u.phone} · desde {u.created_at?.split(' ')[0] || '--'}
                </p>
              </div>

              {/* Type badge */}
              <div className="flex justify-center">
                {u.is_admin ? (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold"
                    style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--blue-bright)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <Shield size={9} /> Admin
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full text-[9px] font-bold"
                    style={{ background: 'var(--surface-3)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                    Usuário
                  </span>
                )}
              </div>

              {/* Credits */}
              <div className="flex justify-center">
                <span className="text-sm font-bold font-mono" style={{ color: u.credits > 0 ? '#34d399' : 'var(--muted)' }}>
                  {u.credits ?? '∞'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 justify-center">
                <button onClick={() => adjustCredits(username, -1)}
                  disabled={u.is_admin || (u.credits ?? 0) <= 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/20 disabled:opacity-30"
                  style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>
                  <Minus size={11} />
                </button>
                <button onClick={() => adjustCredits(username, 5)}
                  disabled={u.is_admin}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-emerald-500/20 disabled:opacity-30"
                  style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>
                  <Plus size={11} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
