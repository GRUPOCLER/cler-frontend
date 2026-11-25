// Constantes y formatos compartidos por las pantallas de Control de OV.
import { useEffect, useState } from 'react'

export const ORDEN = ['recibida', 'en_surtido', 'surtida', 'en_preparacion', 'preparada', 'entregada_sap', 'facturada']
export const NOMBRE = {
  recibida: 'Recibida', en_surtido: 'En surtido', surtida: 'Surtida', en_preparacion: 'En preparación',
  preparada: 'Preparada', entregada_sap: 'Entrega generada', facturada: 'Facturada', cancelada: 'Cancelada',
}
export const TONO = {
  recibida: 'neutro', en_surtido: 'activo', surtida: 'neutro', en_preparacion: 'activo',
  preparada: 'neutro', entregada_sap: 'neutro', facturada: 'ok', cancelada: 'mal',
}
export const ES_JEFE = (r) => r === 'admin' || r === 'gerente'
export const PUEDE_CARGAR = (r) => r === 'admin' || r === 'gerente' || r === 'sap'
export const PUEDE_FACTURAR = (r) => r === 'admin' || r === 'gerente' || r === 'facturacion'
export const nf = (n) => new Intl.NumberFormat('es-MX').format(n || 0)

export function dur(seg) {
  if (seg === null || seg === undefined) return '-'
  const m = Math.floor(seg / 60)
  if (m < 1) return seg < 1 ? '0 min' : 'menos de 1 min'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} h ${m % 60} min`
  return `${Math.floor(h / 24)} d ${h % 24} h`
}
export function fechaHora(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map(x => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}
export const fechaCorta = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '-') }
export const tam = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')

export function useAhora(ms = 30000) {
  const [t, setT] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setT(Date.now()), ms); return () => clearInterval(i) }, [ms])
  return t
}
export const segDesde = (iso, ahora) => (iso ? Math.max(0, Math.floor((ahora - Date.parse(iso)) / 1000)) : 0)

// Nombre legible de un correo (usa el mapa que manda el servidor).
export const quien = (nombres, email) => (email ? ((nombres && nombres[String(email).toLowerCase()]) || email) : '')
