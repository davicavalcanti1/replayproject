import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Phone, Calendar, AlertCircle, Check } from 'lucide-react'

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  background: 'var(--surface-3)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
}

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', phone: '', sex: '', dob: '', terms: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone || !form.sex || !form.dob) {
      setError('Preencha todos os campos.'); return
    }
    if (!form.terms) { setError('Aceite os termos de uso.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          name: form.name, phone: form.phone,
          sex: form.sex, dob: form.dob, terms: '1',
        }),
        redirect: 'manual',
      })
      navigate('/cameras')
    } catch {
      navigate('/cameras')
    } finally {
      setLoading(false)
    }
  }

  const baseInput = "w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition-all"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(29,78,216,0.18), transparent)' }}>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 mb-8"
      >
        <img
          src="/logo-icon.png"
          alt="Reframe"
          style={{
            width: 64, height: 64, objectFit: 'contain',
            filter: 'drop-shadow(0 6px 18px rgba(99,102,241,0.45))',
          }}
        />
        <img
          src="/logo-full.png"
          alt="Reframe | Sistema de Replay"
          style={{ height: 36, width: 'auto', objectFit: 'contain' }}
        />
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }}
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}
      >
        <h2 className="text-base font-bold mb-5" style={{ color: 'var(--text)' }}>Criar conta</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Nome completo">
            <div className="relative">
              <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input type="text" placeholder="Seu nome" value={form.name}
                onChange={e => set('name', e.target.value)}
                className={`${baseInput} pl-9`} style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          </Field>

          <Field label="Telefone (será seu usuário)">
            <div className="relative">
              <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input type="tel" placeholder="(00) 00000-0000" value={form.phone}
                onChange={e => set('phone', e.target.value)}
                className={`${baseInput} pl-9`} style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sexo">
              <select value={form.sex} onChange={e => set('sex', e.target.value)}
                className={`${baseInput} appearance-none`} style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}>
                <option value="">Selecione</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="O">Outro</option>
              </select>
            </Field>

            <Field label="Data de nascimento">
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
                <input type="date" value={form.dob} onChange={e => set('dob', e.target.value)}
                  className={`${baseInput} pl-9`} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'} />
              </div>
            </Field>
          </div>

          {/* Terms */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div
              onClick={() => set('terms', !form.terms)}
              className="mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
              style={{
                background: form.terms ? 'var(--blue)' : 'var(--surface-3)',
                border: `1px solid ${form.terms ? 'var(--blue)' : 'var(--border)'}`,
              }}
            >
              {form.terms && <Check size={10} className="text-white" strokeWidth={3} />}
            </div>
            <span className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              Aceito os termos de uso e a política de privacidade do sistema.
            </span>
          </label>

          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={13} /> {error}
            </motion.div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white btn-blue mt-1">
            {loading ? 'Cadastrando...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold no-underline hover:underline"
            style={{ color: 'var(--blue-bright)' }}>
            Entrar
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
