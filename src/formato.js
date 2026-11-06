// Utilidades de formato compartidas por las vistas imprimibles.

// Peso en kg: separador de miles, hasta 2 decimales, sin ceros sobrantes.
export function fmtKg(v) {
  const n = Number(v)
  if (!isFinite(n) || n <= 0) return '-'
  return n.toLocaleString('es-MX', { maximumFractionDigits: 2 }) + ' kg'
}

// Junta renglones repetidos del mismo SKU (misma clave) sumando cantidades.
export function unirPorClave(productos, campoCant) {
  const mapa = new Map()
  for (const p of productos || []) {
    const k = p.clave
    const prev = mapa.get(k)
    if (prev) {
      prev[campoCant] = (Number(prev[campoCant]) || 0) + (Number(p[campoCant]) || 0)
      if (p.peso_kg != null) prev.peso_kg = Math.round(((Number(prev.peso_kg) || 0) + (Number(p.peso_kg) || 0)) * 100) / 100
    } else mapa.set(k, { ...p })
  }
  return [...mapa.values()]
}
