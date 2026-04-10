export default function LoginBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {/* Base dark purple */}
      <div className="absolute inset-0" style={{ background: 'var(--bg)' }} />
      {/* Gradient orbs */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 70% 60% at 15% 85%, rgba(99,50,180,0.35) 0%, transparent 60%)',
            'radial-gradient(ellipse 50% 50% at 75% 15%, rgba(59,130,246,0.18) 0%, transparent 55%)',
            'radial-gradient(ellipse 90% 50% at 50% 110%, rgba(100,40,200,0.28) 0%, transparent 50%)',
            'radial-gradient(ellipse 40% 40% at 30% 30%, rgba(124,58,237,0.15) 0%, transparent 50%)',
          ].join(', '),
        }}
      />
      {/* Subtle wave overlay via CSS */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 120% 30% at 40% 95%, rgba(80,30,180,0.25) 0%, transparent 70%)',
            'radial-gradient(ellipse 80% 20% at 70% 85%, rgba(59,100,246,0.12) 0%, transparent 70%)',
          ].join(', '),
        }}
      />
    </div>
  )
}
