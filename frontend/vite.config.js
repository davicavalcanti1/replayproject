import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// All routes proxied to Flask — cookies are forwarded automatically by Vite proxy
const FLASK = 'http://localhost:5000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api':           { target: FLASK, changeOrigin: true },
      '/stream':        { target: FLASK, changeOrigin: true },
      '/snapshot':      { target: FLASK, changeOrigin: true },
      '/health':        { target: FLASK, changeOrigin: true },
      '/generate-clip': { target: FLASK, changeOrigin: true },
      '/clips':         { target: FLASK, changeOrigin: true },
      '/login':         { target: FLASK, changeOrigin: true },
      '/logout':        { target: FLASK, changeOrigin: true },
      '/register':      { target: FLASK, changeOrigin: true },
    }
  }
})
