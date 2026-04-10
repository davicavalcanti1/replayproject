import { useState, useEffect, useCallback, useRef } from 'react'

export function useReplayBuffer(camId) {
  const [bufferInfo, setBufferInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  const fetchBuffer = useCallback(async () => {
    if (!camId) return
    try {
      const res = await fetch(`/api/buffer/${camId}`)
      if (!res.ok) return
      const data = await res.json()
      setBufferInfo(data)
    } catch (_) {}
    finally { setLoading(false) }
  }, [camId])

  useEffect(() => {
    if (!camId) { setLoading(false); return }
    setLoading(true)
    fetchBuffer()
    pollRef.current = setInterval(fetchBuffer, 2000)
    return () => clearInterval(pollRef.current)
  }, [camId, fetchBuffer])

  return { bufferInfo, loading }
}

export function useHealth() {
  const [health, setHealth] = useState({})
  const [cameras, setCameras] = useState([])

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/health')
        if (!res.ok) return
        const data = await res.json()
        setHealth(data)
        setCameras(Object.keys(data))
      } catch (_) {}
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [])

  return { health, cameras }
}

export async function generateClip(camId) {
  const res = await fetch(`/generate-clip/${camId}`, { method: 'POST' })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body
}
