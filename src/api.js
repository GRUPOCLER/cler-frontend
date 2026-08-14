// ============================================================
//  API CLIENT — Sistema CLER
//  Backend: FastAPI en Railway
// ============================================================

const API_URL = import.meta.env.VITE_API_URL || 'https://cler-backend-production.up.railway.app'

let _token = localStorage.getItem('cler_token') || ''
let _user  = JSON.parse(localStorage.getItem('cler_user') || 'null')

export function getUser()  { return _user }
export function getToken() { return _token }

export function logout() {
  _token = ''; _user = null
  localStorage.removeItem('cler_token')
  localStorage.removeItem('cler_user')
}

async function req(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (_token) headers['Authorization'] = 'Bearer ' + _token
  const res = await fetch(API_URL + path, { ...options, headers })
  if (res.status === 401) { logout(); window.location.reload(); return }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error ' + res.status)
  }
  return res.json()
}

export async function login(usuario, password) {
  const data = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usuario, password })
  })
  _token = data.token
  _user  = { usuario: data.usuario, nombre: data.nombre, rol: data.rol }
  localStorage.setItem('cler_token', _token)
  localStorage.setItem('cler_user', JSON.stringify(_user))
  return data
}

export const listarEntregas   = (params = '') => req('/api/entregas/' + (params ? '?' + params : ''))
export const detalleEntrega   = (id)          => req('/api/entregas/' + id)
export const crearEntrega     = (body)        => req('/api/entregas/', { method: 'POST', body: JSON.stringify(body) })
export const completarEntrega = (id)          => req('/api/entregas/' + id + '/completar', { method: 'POST' })
export const getDashboard     = ()            => req('/api/dashboard/')

export async function subirPDF(archivo, sistema, comercializador) {
  const fd = new FormData()
  fd.append('archivo', archivo)
  const headers = {}
  if (_token) headers['Authorization'] = 'Bearer ' + _token
  const res = await fetch(
    API_URL + '/api/entregas/pdf?sistema=' + sistema + '&comercializador=' + encodeURIComponent(comercializador),
    { method: 'POST', headers, body: fd }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error al procesar PDF')
  }
  return res.json()
}

// ── ODOO (via backend, sin CORS) ─────────────────────────
export async function odooSesion() {
  // El backend ya resuelve la conexion; siempre "activa" desde la perspectiva del frontend
  return { activa: true, usuario: 'Sistema' }
}

export const odooListarOVs = () => req('/api/odoo/ovs')

export const odooCargarEntrega = (pickingIds) =>
  req('/api/odoo/entrega', { method: 'POST', body: JSON.stringify(pickingIds) })