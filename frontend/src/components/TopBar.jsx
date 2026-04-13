import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, Camera, Search, Settings, LogOut, Shield, Menu, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/cameras',  label: 'Menu',     icon: LayoutGrid },
  { to: '/cameras',  label: 'Câmeras',  icon: Camera,  exact: true },
  { to: '/search',   label: 'Busca',    icon: Search },
]

export default function TopBar() {
  const { user, logout } = useAuth()
  const location  = useLocation()
  const navigate  = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  const isActive = (to, exact) => {
    if (exact) return location.pathname === to || location.pathname.startsWith('/camera/')
    return location.pathname.startsWith(to)
  }

  return (
    <header
      className="sticky top-0 z-50 flex items-center px-5 h-20 border-b"
      style={{
        background: 'rgba(12,10,29,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo */}
      <Link
        to="/cameras"
        className="flex items-center gap-2 mr-4 no-underline flex-shrink-0"
      >
        <img
          src="/logo-icon.png"
          alt=""
          style={{ height: 44, width: 'auto', objectFit: 'contain' }}
          draggable={false}
        />
        <img
          src="/logo-name.png"
          alt="ReFrame"
          className="hidden sm:block"
          style={{ height: 38, width: 'auto', objectFit: 'contain' }}
          draggable={false}
        />
      </Link>

      {/* Nav pills — center */}
      <nav className="flex items-center gap-1 flex-1 justify-center">
        {NAV.map(({ to, label, icon: Icon, exact }) => {
          const active = isActive(to, exact)
          return (
            <Link
              key={label}
              to={to}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide no-underline transition-all duration-150"
              style={{
                color: active ? '#fff' : 'var(--muted)',
                background: active ? 'var(--surface-3)' : 'transparent',
                border: active ? '1px solid var(--border-2)' : '1px solid transparent',
              }}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Right side — settings + avatar + menu */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Settings gear */}
        <Link
          to="/settings"
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{
            color: location.pathname === '/settings' ? '#fff' : 'var(--muted)',
            background: location.pathname === '/settings' ? 'var(--surface-3)' : 'transparent',
          }}
        >
          <Settings size={16} />
        </Link>

        {/* User avatar */}
        {user && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--purple), var(--blue))',
              border: '2px solid var(--border-2)',
            }}
          >
            <User size={14} style={{ color: '#fff' }} />
          </div>
        )}

        {/* Hamburger menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{
              color: 'var(--muted)',
              background: menuOpen ? 'var(--surface-3)' : 'transparent',
            }}
          >
            <Menu size={18} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0,  scale: 1 }}
                  exit={  { opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full right-0 mt-2 w-52 rounded-xl overflow-hidden shadow-2xl z-50"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}
                >
                  {/* User info */}
                  {user && (
                    <div
                      className="flex items-center gap-3 px-4 py-3 border-b"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, var(--purple), var(--blue))' }}
                      >
                        <User size={16} style={{ color: '#fff' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>
                          {user.name}
                        </p>
                        <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                          {user.is_admin ? (
                            <><Shield size={8} style={{ color: 'var(--purple-bright)' }} /> Administrador</>
                          ) : (
                            `${user.credits ?? 0} créditos`
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Nav links */}
                  {user?.is_admin && (
                    <>
                      <Link
                        to="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold no-underline transition-colors"
                        style={{ color: 'var(--text)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Shield size={12} style={{ color: 'var(--purple-bright)' }} /> Admin · Câmeras & Sistema
                      </Link>
                      <Link
                        to="/users"
                        onClick={() => setMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold no-underline transition-colors"
                        style={{ color: 'var(--text)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Shield size={12} style={{ color: 'var(--purple-bright)' }} /> Usuários
                      </Link>
                    </>
                  )}

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <LogOut size={12} /> Sair da conta
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
