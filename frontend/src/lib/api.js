/*
 * Config central de API.
 *
 * Em dev: não precisa de VITE_API_URL — o proxy do Vite redireciona os paths
 * relativos (ex: "/api/me") pro Flask rodando em localhost:5000.
 *
 * Em prod (frontend hospedado no EasyPanel, backend via Cloudflare Tunnel):
 *   VITE_API_URL=https://api.seudominio.com
 * O fetch é interceptado globalmente: todo path que começa com "/" vira
 * VITE_API_URL + path, e `credentials: 'include'` é default (cookies cross-site).
 *
 * Isso evita refatorar centenas de fetch() espalhados pelo app.
 */

export const API_BASE = import.meta.env.VITE_API_URL || ''

export function apiUrl(path) {
  if (!path) return API_BASE
  if (/^https?:\/\//.test(path)) return path
  return API_BASE + path
}

// Monkey-patch fetch global: prefixa API_BASE em paths relativos e
// força credentials:'include' quando não especificado.
if (API_BASE && typeof window !== 'undefined' && !window.__apiFetchPatched) {
  const originalFetch = window.fetch.bind(window)
  window.fetch = (input, init = {}) => {
    let url = input
    if (typeof input === 'string' && input.startsWith('/')) {
      url = API_BASE + input
    } else if (input instanceof Request && input.url.startsWith('/')) {
      url = new Request(API_BASE + input.url, input)
    }
    return originalFetch(url, {
      credentials: init.credentials || 'include',
      ...init,
    })
  }
  window.__apiFetchPatched = true
  // eslint-disable-next-line no-console
  console.info(`[api] Remote backend: ${API_BASE}`)
}

// Helper pra montar URL de <img>, <video>, <source> (não passam pelo fetch patch)
export function mediaUrl(path) {
  if (!path) return ''
  return apiUrl(path)
}
