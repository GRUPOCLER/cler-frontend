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
export const actualizarEntrega= (id, body)    => req('/api/entregas/' + id, { method: 'PATCH', body: JSON.stringify(body) })
export const completarEntrega = (id)          => req('/api/entregas/' + id + '/completar', { method: 'POST' })
export const getDashboard     = ()            => req('/api/dashboard/')

// ── TARIMAS ───────────────────────────────────────────────
export const crearTarima = (idEntrega, pesoPaletKg = 0, idsEntregasFusionadas = null) =>
  req(`/api/entregas/${idEntrega}/tarimas`, {
    method: 'POST',
    body: JSON.stringify({ peso_palet_kg: pesoPaletKg, ids_entregas_fusionadas: idsEntregasFusionadas })
  })

// asignaciones: [{ id_producto, cantidad }, ...]
export const asignarProductos = (idEntrega, idTarima, asignaciones) =>
  req(`/api/entregas/${idEntrega}/tarimas/${idTarima}/asignar`, {
    method: 'POST',
    body: JSON.stringify({ asignaciones })
  })

export const quitarDetalle = (idEntrega, idDetalle) =>
  req(`/api/entregas/${idEntrega}/detalle/${idDetalle}`, { method: 'DELETE' })

export const eliminarTarima = (idEntrega, idTarima) =>
  req(`/api/entregas/${idEntrega}/tarimas/${idTarima}`, { method: 'DELETE' })

export const cerrarTarima = (idEntrega, idTarima, dims = {}) =>
  req(`/api/entregas/${idEntrega}/tarimas/${idTarima}/cerrar`, {
    method: 'POST',
    body: JSON.stringify({
      largo_cm: dims.largo_cm || 0,
      ancho_cm: dims.ancho_cm || 0,
      alto_cm:  dims.alto_cm  || 0
    })
  })

export const reabrirTarima = (idEntrega, idTarima) =>
  req(`/api/entregas/${idEntrega}/tarimas/${idTarima}/reabrir`, { method: 'POST' })

export const actualizarDimensiones = (idEntrega, idTarima, dims) =>
  req(`/api/entregas/${idEntrega}/tarimas/${idTarima}/dimensiones`, {
    method: 'PATCH',
    body: JSON.stringify(dims)
  })

export const agregarExtension = (idEntrega, idProducto, cantidad) =>
  req(`/api/entregas/${idEntrega}/productos/${idProducto}/extension`, {
    method: 'POST',
    body: JSON.stringify({ cantidad })
  })

export const obtenerEtiquetasSueltas = (idEntrega) =>
  req(`/api/entregas/${idEntrega}/etiquetas-sueltas`)

// ── FUSION DE ENTREGAS Y LISTA DE EMPAQUE ────────────────
export const candidatasFusion = () => req('/api/entregas/candidatas-fusion')

export const fusionDetalle = (idsEntregas) =>
  req('/api/entregas/fusion/detalle', { method: 'POST', body: JSON.stringify({ ids_entregas: idsEntregas }) })

export const obtenerPacking = (idEntrega) => req(`/api/entregas/${idEntrega}/packing`)

// ── CONTROL DE IMPRESION Y REAPERTURA ────────────────────
export const marcarImpresaTarima = (idEntrega, idTarima) =>
  req(`/api/entregas/${idEntrega}/tarimas/${idTarima}/marcar-impresa`, { method: 'POST' })

export const marcarImpresaSueltas = (idEntrega) =>
  req(`/api/entregas/${idEntrega}/etiquetas-sueltas/marcar-impresa`, { method: 'POST' })

export const marcarImpresoPacking = (idEntrega) =>
  req(`/api/entregas/${idEntrega}/packing/marcar-impreso`, { method: 'POST' })

export const reabrirEntrega = (idEntrega) =>
  req(`/api/entregas/${idEntrega}/reabrir`, { method: 'POST' })

// ── ADMINISTRACION (usuarios y logs) ─────────────────────
export const listarUsuarios = () => req('/api/admin/usuarios')

export const crearUsuario = (body) =>
  req('/api/admin/usuarios', { method: 'POST', body: JSON.stringify(body) })

export const editarUsuario = (usuario, body) =>
  req(`/api/admin/usuarios/${usuario}`, { method: 'PATCH', body: JSON.stringify(body) })

export const verLogs = () => req('/api/admin/logs')

export const obtenerEtiqueta = (idEntrega, idTarima) =>
  req(`/api/entregas/${idEntrega}/tarimas/${idTarima}/etiqueta`)

export const obtenerTodasEtiquetas = (idEntrega) =>
  req(`/api/entregas/${idEntrega}/etiquetas`)

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
  return { activa: true, usuario: 'Sistema' }
}

export const odooListarOVs = () => req('/api/odoo/ovs')

export const odooCargarEntrega = (pickingIds) =>
  req('/api/odoo/entrega', { method: 'POST', body: JSON.stringify(pickingIds) })
