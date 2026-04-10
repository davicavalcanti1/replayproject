import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import LoginBackground from '../components/LoginBackground'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Preencha usuário e senha.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/cameras', { replace: true })
    } catch (err) {
      setError(err.message || 'Usuário ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full py-2.5 rounded-xl text-sm font-medium outline-none transition-all"
  const inputStyle = {
    background: 'var(--surface-3)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
  }
  const focusBorder = e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)' }
  const blurBorder  = e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden" style={{ height: '100dvh', maxHeight: '100dvh' }}>
      <LoginBackground />

      {/* Main container — split layout, spread apart on desktop */}
      <div
        className="relative flex flex-col lg:flex-row items-center lg:justify-between w-full max-w-7xl px-4 lg:px-0"
        style={{ zIndex: 2 }}
      >
        {/* Left side — Big R icon + ReFrame wordmark (hidden on small mobile) */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden sm:flex flex-col items-center flex-shrink-0 lg:ml-0"
        >
          <img
            src="/logo-icon.png"
            alt="ReFrame"
            style={{
              width: 300, height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 16px 48px rgba(124,58,237,0.55))',
            }}
            draggable={false}
          />
          <img
            src="/logo-name.png"
            alt="ReFrame — Sistema de Replay"
            style={{ height: 114, width: 'auto', objectFit: 'contain', marginTop: 18 }}
            draggable={false}
          />
        </motion.div>

        {/* Mobile — R pequeno (80px) + wordmark acima do card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex sm:hidden flex-col items-center mb-6"
        >
          <img
            src="/logo-icon.png"
            alt="ReFrame"
            style={{ width: 80, height: 'auto', objectFit: 'contain' }}
            draggable={false}
          />
          <img
            src="/logo-name.png"
            alt="ReFrame"
            style={{ height: 32, width: 'auto', objectFit: 'contain', marginTop: 10 }}
            draggable={false}
          />
        </motion.div>

        {/* Right side — Form card, pushed right */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-sm"
        >

          {/* Card */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'rgba(26,21,53,0.85)',
              border: '1px solid var(--border-2)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <h2 className="text-base font-bold mb-5" style={{ color: 'var(--text)' }}>Entrar na conta</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* Username */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Usuário
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    autoComplete="username"
                    autoFocus
                    className={`${inputCls} pl-9 pr-4`}
                    style={inputStyle}
                    onFocus={focusBorder}
                    onBlur={blurBorder}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Senha
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••"
                    autoComplete="current-password"
                    className={`${inputCls} pl-9 pr-10`}
                    style={inputStyle}
                    onFocus={focusBorder}
                    onBlur={blurBorder}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-100 opacity-50"
                    style={{ color: 'var(--muted)' }}
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-red-400"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <AlertCircle size={13} className="flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white btn-blue mt-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </span>
                ) : 'Entrar'}
              </button>
            </form>

            <p className="text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
              Não tem conta?{' '}
              <Link to="/register" className="font-semibold no-underline" style={{ color: 'var(--blue-bright)' }}
                onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                onMouseLeave={e => e.target.style.textDecoration = 'none'}>
                Cadastre-se
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
