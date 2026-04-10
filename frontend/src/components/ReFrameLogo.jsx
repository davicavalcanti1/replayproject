/**
 * ReFrame logo — stylized "R" with purple-to-cyan gradient.
 * Matches the brand identity from the design mockups.
 */

export function LogoIcon({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="rgrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="45%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="rgrad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* Main R body — left vertical + top curve */}
      <path
        d="M16 56V8h16c8.837 0 16 5.373 16 12s-7.163 12-16 12H26l20 24"
        stroke="url(#rgrad)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow accent — diagonal kick */}
      <path
        d="M34 36l14 20"
        stroke="url(#rgrad2)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function LogoFull({ iconSize = 28, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoIcon size={iconSize} />
      <div className="flex flex-col leading-none">
        <span
          className="font-extrabold tracking-tight"
          style={{ fontSize: iconSize * 0.68, color: '#fff' }}
        >
          Re<span style={{ color: '#a78bfa' }}>Frame</span>
        </span>
        <span
          className="font-semibold uppercase tracking-widest"
          style={{ fontSize: iconSize * 0.28, color: 'var(--muted)', marginTop: 1 }}
        >
          Sistema de Replay
        </span>
      </div>
    </div>
  )
}

export function LogoBig({ size = 200, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="rbig1" x1="10%" y1="90%" x2="90%" y2="10%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="40%" stopColor="#6366f1" />
          <stop offset="70%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="rbig2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="50%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <filter id="rglow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Outer glow */}
      <path
        d="M50 170V30h50c27.6 0 50 16.8 50 37.5S127.6 105 100 105H75l55 65"
        stroke="url(#rbig1)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
        filter="url(#rglow)"
      />
      {/* Main R stroke */}
      <path
        d="M50 170V30h50c27.6 0 50 16.8 50 37.5S127.6 105 100 105H75l55 65"
        stroke="url(#rbig1)"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow accent */}
      <path
        d="M100 110l42 60"
        stroke="url(#rbig2)"
        strokeWidth="18"
        strokeLinecap="round"
      />
    </svg>
  )
}
