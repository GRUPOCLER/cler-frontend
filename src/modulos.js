import { tieneModulo } from './api.js'
// Modulos del sistema (espejo de services/permisos.py en el backend).
// El backend es quien decide el acceso; esto solo ordena la interfaz.
export const MODULOS = [
  { id: 'embarques',   nombre: 'Embarques',                ruta: '/embarques', disponible: true,
    desc: 'Entregas, tarimas, cargas sueltas, listas de empaque y análisis.',
    roles: ['operador', 'gerente'] },
  { id: 'inventario',  nombre: 'Inventario y Operaciones', ruta: '/inventario', disponible: false,
    desc: 'Layout de ubicaciones y conteos de inventario.',
    roles: ['operador', 'gerente'] },
  { id: 'refacciones', nombre: 'Refacciones',              ruta: '/ov', disponible: true,
    desc: 'Control de OV: surtido, preparación, entrega SAP, factura y etiquetas.',
    roles: ['operador', 'gerente', 'sap', 'facturacion'] },
]

export const ROLES = {
  operador:    { nombre: 'Operador',      desc: 'Opera el módulo; sin reimpresión, reapertura ni cancelación' },
  gerente:     { nombre: 'Gerente',       desc: 'Jefatura del módulo: autoriza, reabre, reimprime y registra operadores' },
  sap:         { nombre: 'Encargado SAP', desc: 'Carga las OV y registra la entrega en SAP' },
  facturacion: { nombre: 'Facturación',   desc: 'Registra la factura' },
  admin:       { nombre: 'Administrador', desc: 'Acceso total a todos los módulos y a la administración' },
}

export const nombreRol = (r) => (ROLES[r] && ROLES[r].nombre) || r
export const moduloPorId = (id) => MODULOS.find(m => m.id === id)

// Modulo al que pertenece una ruta
export function moduloDeRuta(pathname) {
  if (pathname === '/' ) return 'hub'
  if (pathname.startsWith('/ov')) return 'refacciones'
  if (pathname.startsWith('/catalogo')) {
    // El catalogo es compartido: quien solo tiene Refacciones lo ve dentro de ese modulo
    const refac = tieneModulo('refacciones') && (!tieneModulo('embarques') || /linea=refacciones/.test(window.location.search))
    return refac ? 'refacciones' : 'embarques'
  }
  if (pathname.startsWith('/inventario')) return 'inventario'
  if (pathname.startsWith('/admin')) return 'admin'
  return 'embarques'
}
