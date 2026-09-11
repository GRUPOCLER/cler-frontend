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
export const buscarEntregas   = (termino) => req('/api/entregas/?buscar=' + encodeURIComponent(termino) + '&limite=15')
export const detalleEntrega   = (id)          => req('/api/entregas/' + id)
export const crearEntrega     = (body)        => req('/api/entregas/', { method: 'POST', body: JSON.stringify(body) })
export const eliminarEntrega  = (idEntrega, motivo) => req(`/api/entregas/${idEntrega}`, { method: 'DELETE', body: JSON.stringify({ motivo }) })
export const actualizarEntrega= (id, body)    => req('/api/entregas/' + id, { method: 'PATCH', body: JSON.stringify(body) })
export const completarEntrega = (id)          => req('/api/entregas/' + id + '/completar', { method: 'POST' })
export const getDashboard     = ()            => req('/api/dashboard/')

// ── TARIMAS ───────────────────────────────────────────────
export const crearTarima = (idEntrega, pesoPaletKg = 0, idsEntregasFusionadas = null, tipoBulto = 'tarima') =>
  req(`/api/entregas/${idEntrega}/tarimas`, {
    method: 'POST',
    body: JSON.stringify({ peso_palet_kg: pesoPaletKg, tipo_bulto: tipoBulto, ids_entregas_fusionadas: idsEntregasFusionadas })
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

export const obtenerEtiquetasSueltas = (idEntrega, skusMaster = [], idsSolo = [], motivo = '') => {
  const params = new URLSearchParams()
  if (skusMaster.length) params.set('master', skusMaster.join(','))
  if (idsSolo.length) params.set('solo', idsSolo.join(','))
  if (motivo) params.set('motivo', motivo)
  const qs = params.toString()
  return req(`/api/entregas/${idEntrega}/etiquetas-sueltas` + (qs ? `?${qs}` : ''))
}

// ── FUSION DE ENTREGAS Y LISTA DE EMPAQUE ────────────────
export const candidatasFusion = () => req('/api/entregas/candidatas-fusion')

export const fusionDetalle = (idsEntregas) =>
  req('/api/entregas/fusion/detalle', { method: 'POST', body: JSON.stringify({ ids_entregas: idsEntregas }) })

export const obtenerPacking = (idEntrega) => req(`/api/entregas/${idEntrega}/packing`)

// ── CONTROL DE IMPRESION Y REAPERTURA ────────────────────
export const marcarImpresaTarima = (idEntrega, idTarima, motivo = null) =>
  req(`/api/entregas/${idEntrega}/tarimas/${idTarima}/marcar-impresa`, {
    method: 'POST', body: JSON.stringify({ motivo })
  })

export const marcarImpresaSueltas = (idEntrega, motivo = null) =>
  req(`/api/entregas/${idEntrega}/etiquetas-sueltas/marcar-impresa`, {
    method: 'POST', body: JSON.stringify({ motivo })
  })

export const marcarImpresoPacking = (idEntrega, motivo = null) =>
  req(`/api/entregas/${idEntrega}/packing/marcar-impreso`, {
    method: 'POST', body: JSON.stringify({ motivo })
  })

export const reabrirEntrega = (idEntrega) =>
  req(`/api/entregas/${idEntrega}/reabrir`, { method: 'POST' })

// ── ADMINISTRACION (usuarios y logs) ─────────────────────
export const listarUsuarios = () => req('/api/admin/usuarios')

export const crearUsuario = (body) =>
  req('/api/admin/usuarios', { method: 'POST', body: JSON.stringify(body) })

export const editarUsuario = (usuario, body) =>
  req(`/api/admin/usuarios/${usuario}`, { method: 'PATCH', body: JSON.stringify(body) })

export const verLogs = () => req('/api/admin/logs')

// ── SOLICITUDES DE REIMPRESION ───────────────────────────
export const listarSolicitudes = (estatus = null) =>
  req('/api/reimpresiones/' + (estatus ? '?estatus=' + estatus : ''))

export const misSolicitudes = () => req('/api/reimpresiones/mias')

export const aprobarSolicitud = (id, comentario = null) =>
  req(`/api/reimpresiones/${id}/aprobar`, { method: 'POST', body: JSON.stringify({ comentario }) })

export const rechazarSolicitud = (id, comentario = null) =>
  req(`/api/reimpresiones/${id}/rechazar`, { method: 'POST', body: JSON.stringify({ comentario }) })

export const contarPendientes = () => req('/api/reimpresiones/pendientes-count')

// ── CAMBIO DE SISTEMA (correccion TAR/CS/MIX) ────────────
export const solicitarCambioSistema = (idEntrega, sistemaNuevo, motivo) =>
  req(`/api/entregas/${idEntrega}/solicitar-cambio-sistema`, {
    method: 'POST', body: JSON.stringify({ sistema_nuevo: sistemaNuevo, motivo })
  })

export const contarPendientesCambios = () => req('/api/reimpresiones/cambios-sistema/pendientes-count')

export const listarCambiosSistema = () => req('/api/reimpresiones/cambios-sistema')

export const aprobarCambioSistema = (id, comentario = null) =>
  req(`/api/reimpresiones/cambios-sistema/${id}/aprobar`, { method: 'POST', body: JSON.stringify({ comentario }) })

export const rechazarCambioSistema = (id, comentario = null) =>
  req(`/api/reimpresiones/cambios-sistema/${id}/rechazar`, { method: 'POST', body: JSON.stringify({ comentario }) })

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

// ── TRASPASOS INTERNOS (CEDIS, FULL MELI, Eventos y Expo) ──
export const odooListarTraspasos = () => req('/api/odoo/traspasos')

export const odooCargarTraspaso = (pickingId) =>
  req('/api/odoo/traspaso?picking_id=' + pickingId, { method: 'POST' })

// ── ADMINISTRACION DE ALMACENES DE TRASPASO (solo Admin) ───
export const buscarAlmacenesOdoo = (nombre) =>
  req('/api/odoo/almacenes-disponibles?nombre=' + encodeURIComponent(nombre || ''))

export const listarAlmacenesConfigurados = () => req('/api/odoo/almacenes-traspaso')

export const agregarAlmacen = (almacen) =>
  req('/api/odoo/almacenes-traspaso', { method: 'POST', body: JSON.stringify(almacen) })

export const editarAlmacen = (id, body) =>
  req(`/api/odoo/almacenes-traspaso/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const quitarAlmacen = (id) =>
  req(`/api/odoo/almacenes-traspaso/${id}`, { method: 'DELETE' })

// ── ALMACENES AUTORIZADOS POR USUARIO (visibilidad OVs) ─────
export const listarAlmacenesUsuario = (usuario) => req(`/api/odoo/usuarios-almacenes/${usuario}`)

export const agregarAlmacenUsuario = (usuario, almacen) =>
  req(`/api/odoo/usuarios-almacenes/${usuario}`, { method: 'POST', body: JSON.stringify(almacen) })

export const quitarAlmacenUsuario = (idAsignacion) =>
  req(`/api/odoo/usuarios-almacenes/${idAsignacion}`, { method: 'DELETE' })

// ── FORMATO DE FECHAS — convierte UTC (como llega de la BD) a la hora
// real de Veracruz/Mexico (America/Mexico_City), en vez de mostrar la
// hora del servidor sin convertir.
export function formatearFecha(fechaStr, conHora = true) {
  if (!fechaStr) return ''
  let iso = fechaStr.trim()
  if (iso && !iso.endsWith('Z') && !iso.includes('+')) {
    iso = iso.replace(' ', 'T') + 'Z'  // Postgres manda sin zona -> asumimos UTC
  }
  const fecha = new Date(iso)
  if (isNaN(fecha.getTime())) return fechaStr.substring(0, conHora ? 16 : 10)

  const opciones = conHora
    ? { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
    : { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }
  const partes = new Intl.DateTimeFormat('es-MX', opciones).formatToParts(fecha)
  const obtener = (tipo) => partes.find(p => p.type === tipo)?.value || ''
  return conHora
    ? `${obtener('year')}-${obtener('month')}-${obtener('day')} ${obtener('hour')}:${obtener('minute')}`
    : `${obtener('year')}-${obtener('month')}-${obtener('day')}`
}
