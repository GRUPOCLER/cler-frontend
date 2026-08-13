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

// ── ODOO (browser-side, misma sesion del navegador) ─────────
const ODOO_URL = 'https://ecor-b2b-35977843.dev.odoo.com'
const ODOO_PARTNERS = { 11088: 'Raiker', 12449: 'Korei' }

async function odooRpc(model, method, args, kwargs) {
  const res = await fetch(ODOO_URL + '/web/dataset/call_kw', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call', id: Date.now(),
      params: { model, method, args: args || [], kwargs: kwargs || {} }
    })
  })
  if (!res.ok) throw new Error('Sin conexion con Odoo — inicia sesion en otra pestana')
  const d = await res.json()
  if (d.error) throw new Error(d.error.data?.message || d.error.message)
  return d.result
}

export async function odooSesion() {
  try {
    const res = await fetch(ODOO_URL + '/web/session/get_session_info', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {} })
    })
    const d = await res.json()
    const uid = d?.result?.uid
    return { activa: !!uid, usuario: uid ? (d.result.name || '') : '' }
  } catch { return { activa: false, usuario: '' } }
}

export async function odooListarOVs() {
  const ovs = await odooRpc('sale.order', 'search_read',
    [[['partner_id', 'in', [11088, 12449]], ['picking_ids', '!=', false], ['state', 'in', ['sale', 'done']]]],
    { fields: ['name', 'partner_id', 'state', 'picking_ids', 'date_order'], order: 'id desc', limit: 30 }
  )
  return ovs.map(ov => ({
    num_ov: ov.name,
    cliente: ov.partner_id[1],
    comercializador: ODOO_PARTNERS[ov.partner_id[0]] || '',
    fecha: (ov.date_order || '').substring(0, 10),
    picking_ids: ov.picking_ids
  }))
}

export async function odooCargarEntrega(pickingIds) {
  const picks = await odooRpc('stock.picking', 'search_read',
    [[['id', 'in', pickingIds]]],
    { fields: ['name', 'partner_id', 'sale_id', 'move_ids'] })
  if (!picks.length) throw new Error('La OV no tiene entregas')
  const p = picks[0]
  const moves = await odooRpc('stock.move', 'search_read',
    [[['id', 'in', p.move_ids]]],
    { fields: ['product_id', 'product_uom_qty', 'name'] })
  return {
    num_entrega: p.name,
    orden: p.sale_id ? p.sale_id[1] : '',
    nombre_cliente: p.partner_id ? p.partner_id[1] : '',
    direccion: p.partner_id ? p.partner_id[1] : '',
    comercializador: ODOO_PARTNERS[p.partner_id?.[0]] || '',
    fuente: 'odoo',
    productos: moves.filter(m => m.product_uom_qty > 0).map(m => {
      const nombre = m.product_id ? m.product_id[1] : m.name
      const mSKU = nombre.match(/^\[([^\]]+)\]/)
      return {
        clave: mSKU ? mSKU[1].trim() : nombre.split(' ')[0],
        descripcion: mSKU ? nombre.replace(mSKU[0], '').trim() : nombre,
        cantidad_total: Math.round(m.product_uom_qty),
        unidad: 'PZA'
      }
    })
  }
}
