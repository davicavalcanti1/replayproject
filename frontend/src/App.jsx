import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import TopBar from './components/TopBar'
import Login from './pages/Login'
import Register from './pages/Register'
import Cameras from './pages/Cameras'
import CameraDetail from './pages/CameraDetail'
import Settings from './pages/Settings'
import Users from './pages/Users'
import Admin from './pages/Admin'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 reframe-bg">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg,#5b21b6,#7c3aed)' }}>
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
        </svg>
      </div>
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--purple)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !user.is_admin) return <Navigate to="/cameras" replace />
  return children
}

function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col reframe-bg">
      <TopBar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/cameras" element={
            <ProtectedRoute>
              <Layout><Cameras /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/camera/:id" element={
            <ProtectedRoute>
              <Layout><CameraDetail /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <Layout><Settings /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/users" element={
            <ProtectedRoute adminOnly>
              <Layout><Users /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute adminOnly>
              <Layout><Admin /></Layout>
            </ProtectedRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/cameras" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
