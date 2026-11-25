// ============================================================
//  API CLIENT — Sistema CLER
//  Backend: FastAPI en Railway
// ============================================================

const API_URL = import.meta.env.VITE_API_URL || 'https://cler-backend-production.up.railway.app'

let _token = localStorage.getItem('cler_token') || ''
let _user  = JSON.parse(localStorage.getItem('cler_user') || 'null')

export function getUser()  { return _user }
export const esAdmin = () => !!_user?.es_admin
// Rol del usuario EN un modulo ('admin' si es administrador, null si no tiene acceso)
export function rolEn(modulo) {
  if (!_user) return null
  if (_user.es_admin) return 'admin'
  return (_user.modulos || {})[modulo] || null
}
export const tieneModulo = (m) => !!rolEn(m)
export const esJefeEn = (m) => ['admin', 'gerente'].includes(rolEn(m))
// Gerente de algun modulo (puede registrar operadores)
export const esGerenteAlguno = () => Object.values(_user?.modulos || {}).includes('gerente')

function guardarUsuario(d) {
  _user = { usuario: d.usuario, nombre: d.nombre, es_admin: !!d.es_admin, modulos: d.modulos || {} }
  localStorage.setItem('cler_user', JSON.stringify(_user))
}
// Pide al servidor los accesos actuales (por si el admin los cambio)
export async function refrescarUsuario() {
  const d = await req('/api/auth/yo')
  if (d) guardarUsuario(d)
  return _user
}
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
  localStorage.setItem('cler_token', _token)
  guardarUsuario(data)
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
export const solicitarReaperturaTarima = (idEntrega, idTarima, motivo) =>
  req(`/api/entregas/${idEntrega}/tarimas/${idTarima}/solicitar-reapertura`, { method: 'POST', body: JSON.stringify({ motivo }) })

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
export const marcarImpresaLote = (idEntrega, idsTarimas, motivo = null) =>
  req(`/api/entregas/${idEntrega}/tarimas/marcar-impresa-lote`, {
    method: 'POST', body: JSON.stringify({ ids_tarimas: idsTarimas, motivo })
  })
export const marcarImpresaTarima = (idEntrega, idTarima, motivo = null) =>
  req(`/api/entregas/${idEntrega}/tarimas/${idTarima}/marcar-impresa`, {
    method: 'POST', body: JSON.stringify({ motivo })
  })

export const marcarImpresaSueltas = (idEntrega, motivo = null) =>
  req(`/api/entregas/${idEntrega}/etiquetas-sueltas/marcar-impresa`, {
    method: 'POST', body: JSON.stringify({ motivo })
  })

// ── CONTROL DE OV (refacciones) ──
async function reqForm(path, fd) {
  const headers = {}
  if (_token) headers['Authorization'] = 'Bearer ' + _token
  const res = await fetch(API_URL + path, { method: 'POST', headers, body: fd })
  if (res.status === 401) { logout(); window.location.reload(); return }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error ' + res.status)
  }
  return res.json()
}
const post = (path, body) => req(path, { method: 'POST', body: JSON.stringify(body || {}) })
export const ovListar = (ver = 'activas', q = '') => req(`/api/ov?ver=${encodeURIComponent(ver)}&q=${encodeURIComponent(q)}`)
export const ovDetalle = (id) => req(`/api/ov/${id}`)
export const ovLeer = (archivo) => { const fd = new FormData(); fd.append('archivo', archivo); return reqForm('/api/ov/leer', fd) }
export const ovCrear = (ov) => post('/api/ov', { ov })
export const ovSurtirEscanear = (id, codigo, cantidad = 1) => post(`/api/ov/${id}/surtido/escanear`, { codigo, cantidad })
export const ovSurtirLinea = (id, lid, cantidad) => post(`/api/ov/${id}/surtido/linea/${lid}`, { cantidad })
export const ovSurtidoTerminar = (id, motivo) => post(`/api/ov/${id}/surtido/terminar`, { cantidad: 0, motivo })
export const ovPrepIniciar = (id) => post(`/api/ov/${id}/preparacion/iniciar`)
export const ovCajaNueva = (id) => post(`/api/ov/${id}/preparacion/cajas`)
export const ovCajaEscanear = (id, cid, codigo, cantidad = 1) => post(`/api/ov/${id}/preparacion/cajas/${cid}/escanear`, { codigo, cantidad })
export const ovCajaQuitar = (id, cid, linea_id, cantidad = 1) => post(`/api/ov/${id}/preparacion/cajas/${cid}/quitar?linea_id=${linea_id}&cantidad=${cantidad}`)
export const ovCajaCerrar = (id, cid, peso_kg) => post(`/api/ov/${id}/preparacion/cajas/${cid}/cerrar`, { peso_kg: peso_kg || null })
export const ovCajaReabrir = (id, cid) => post(`/api/ov/${id}/preparacion/cajas/${cid}/reabrir`)
export const ovPrepTerminar = (id, motivo) => post(`/api/ov/${id}/preparacion/terminar`, { cantidad: 0, motivo })
export const ovEtiquetas = (id, cajaId) => req(`/api/ov/${id}/etiquetas${cajaId ? '?caja_id=' + cajaId : ''}`)
export const ovMarcarImpresas = (id, caja_ids) => post(`/api/ov/${id}/impresion`, { caja_ids })
export const ovEntregaValidar = (id, archivo) => { const fd = new FormData(); fd.append('archivo', archivo); return reqForm(`/api/ov/${id}/entrega/validar`, fd) }
export const ovEntregaRegistrar = (id, { folio, archivo, confirmar }) => {
  const fd = new FormData(); fd.append('folio', folio || ''); fd.append('confirmar_diferencias', confirmar ? 'true' : 'false')
  if (archivo) fd.append('archivo', archivo)
  return reqForm(`/api/ov/${id}/entrega`, fd)
}
export const ovFacturaRegistrar = (id, { folio, archivo, xml, confirmar }) => {
  const fd = new FormData(); fd.append('folio', folio || ''); fd.append('confirmar', confirmar ? 'true' : 'false')
  if (archivo) fd.append('archivo', archivo)
  if (xml) fd.append('xml', xml)
  return reqForm(`/api/ov/${id}/factura`, fd)
}
export const leerCFDI = async (archivo) => (await import('./cfdi')).parsearCFDI(await archivo.text())

// -- asignacion de responsables y tiempos --
export const ovAsignar = (id, etapa, usuario) => post(`/api/ov/${id}/asignar`, { etapa, usuario: usuario || '' })
export const asigTablero = () => req('/api/ov/asignacion/tablero')
export const asigConfig = (exigir) => post('/api/ov/asignacion/config', { exigir: !!exigir })
export const kpiTiempos = (desde, hasta) => req(`/api/ov/kpi/tiempos?desde=${encodeURIComponent(desde || '')}&hasta=${encodeURIComponent(hasta || '')}`)

// -- adjuntos (PDF / XML guardados en la base) --
const MAX_ADJ = 9 * 1024 * 1024
export const adjListar = (ovId) => req(`/api/ov/${ovId}/adjuntos`)
export const adjSubir = (ovId, tipo, archivo) => {
  if (archivo.size > MAX_ADJ) return Promise.reject(new Error('El archivo pesa más de 9 MB.'))
  const fd = new FormData(); fd.append('tipo', tipo); fd.append('archivo', archivo)
  return reqForm(`/api/ov/${ovId}/adjuntos`, fd)
}
export const adjBorrar = (id) => req(`/api/ov/adjuntos/${id}`, { method: 'DELETE' })
export const adjLeer = async (adj) => {
  const id = typeof adj === 'object' ? adj.id : adj
  const res = await fetch(API_URL + `/api/ov/adjuntos/${id}/contenido`, { headers: _token ? { Authorization: 'Bearer ' + _token } : {} })
  if (res.status === 401) { logout(); window.location.reload(); return }
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Error ' + res.status) }
  return { bytes: new Uint8Array(await res.arrayBuffer()) }
}
export function descargar(nombre, mime, bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
export const ovCancelar = (id, motivo) => post(`/api/ov/${id}/cancelar`, { cantidad: 0, motivo })
export const ovCatalogoEstado = () => req('/api/ov/catalogo/estado')
export const ovCatalogoImportar = (archivo) => { const fd = new FormData(); fd.append('archivo', archivo); return reqForm('/api/ov/catalogo/importar', fd) }

// ── ANALISIS (reporteria, solo lectura) ──
export const obtenerAnalisis = ({ desde, hasta, empresa, sistema }) => {
  const q = new URLSearchParams()
  if (desde) q.set('desde', desde)
  if (hasta) q.set('hasta', hasta)
  if (empresa) q.set('empresa', empresa)
  if (sistema) q.set('sistema', sistema)
  return req(`/api/analisis/resumen?${q.toString()}`)
}
export const obtenerAnalisisOdoo = () => req('/api/analisis/odoo')

// ── LISTA DE EMPAQUE PARCIAL (requiere autorizacion de un Gerente) ──
export const solicitarPackingParcial = (idEntrega, body) =>
  req(`/api/entregas/${idEntrega}/packing/parcial/solicitar`, { method: 'POST', body: JSON.stringify(body) })
export const listarPackingParciales = (idEntrega) => req(`/api/entregas/${idEntrega}/packing/parciales`)
export const obtenerPackingParcial = (idEntrega, idSol) => req(`/api/entregas/${idEntrega}/packing/parcial/${idSol}`)
export const marcarImpresoPackingParcial = (idEntrega, idSol) =>
  req(`/api/entregas/${idEntrega}/packing/parcial/${idSol}/marcar-impreso`, { method: 'POST' })

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

export async function subirPDF(archivo, sistema, comercializador, forzar = false) {
  const fd = new FormData()
  fd.append('archivo', archivo)
  const headers = {}
  if (_token) headers['Authorization'] = 'Bearer ' + _token
  const res = await fetch(
    API_URL + '/api/entregas/pdf?sistema=' + sistema + '&comercializador=' + encodeURIComponent(comercializador) + '&forzar=' + forzar,
    { method: 'POST', headers, body: fd }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const error = new Error(err.detail || 'Error al procesar PDF')
    error.status = res.status
    throw error
  }
  return res.json()
}

// ── ODOO (via backend, sin CORS) ─────────────────────────
export async function odooSesion() {
  return { activa: true, usuario: 'Sistema' }
}

export const odooListarOVs = () => req('/api/odoo/ovs')
export const odooBuscarOVs = (q) => req('/api/odoo/ovs/buscar?q=' + encodeURIComponent(q))

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

// ── ALMACEN (mapa de ubicaciones, surtido/inventario) ─────
export const contarUbicaciones = () => req('/api/almacen/contar')

export const listarUbicaciones = (params = {}) => {
  const q = new URLSearchParams()
  if (params.buscar) q.set('buscar', params.buscar)
  if (params.bodega) q.set('bodega', params.bodega)
  if (params.zona) q.set('zona', params.zona)
  if (params.soloLibres) q.set('solo_libres', 'true')
  if (params.soloOcupadas) q.set('solo_ocupadas', 'true')
  if (params.soloConStock) q.set('solo_con_stock', 'true')
  const qs = q.toString()
  return req('/api/almacen/ubicaciones' + (qs ? `?${qs}` : ''))
}

export const mapaAlmacen = () => req('/api/almacen/mapa')

export const buscarProductosOdoo = (buscar) =>
  req('/api/almacen/productos-odoo?buscar=' + encodeURIComponent(buscar || ''))

export const asignarProductoUbicacion = (codigo, body) =>
  req(`/api/almacen/ubicaciones/${codigo}/asignar`, { method: 'POST', body: JSON.stringify(body) })

export async function exportarUbicacionesCSV(params = {}) {
  const q = new URLSearchParams()
  if (params.bodega) q.set('bodega', params.bodega)
  if (params.zona) q.set('zona', params.zona)
  const qs = q.toString()
  const headers = {}
  if (_token) headers['Authorization'] = 'Bearer ' + _token
  const res = await fetch(API_URL + '/api/almacen/exportar-csv' + (qs ? `?${qs}` : ''), { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error al exportar CSV')
  }
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ubicaciones_almacen.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

// -- gestion del catalogo de productos --
export const catGestionListar = ({ buscar = '', filtro = 'todos', pagina = 0 } = {}) =>
  req(`/api/catalogo/gestion?buscar=${encodeURIComponent(buscar)}&filtro=${filtro}&pagina=${pagina}`)
export const catGestionDetalle = (sku) => req(`/api/catalogo/gestion/${encodeURIComponent(sku)}`)
export const catGestionEditar = (sku, campos, motivo) => req(`/api/catalogo/gestion/${encodeURIComponent(sku)}`, { method: 'PUT', body: JSON.stringify({ campos, motivo }) })
export const catGestionAlta = (body) => req('/api/catalogo/gestion', { method: 'POST', body: JSON.stringify(body) })
export const catGestionLiberar = (sku, campos) => req(`/api/catalogo/gestion/${encodeURIComponent(sku)}/liberar`, { method: 'POST', body: JSON.stringify({ campos }) })
export const catAdicionalCrear = (sku, body) => req(`/api/catalogo/gestion/${encodeURIComponent(sku)}/adicionales`, { method: 'POST', body: JSON.stringify(body) })
export const catAdicionalEditar = (id, body) => req(`/api/catalogo/gestion/adicionales/${id}`, { method: 'PUT', body: JSON.stringify(body) })
