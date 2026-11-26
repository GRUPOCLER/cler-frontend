import { useMemo } from 'react'
import { nf } from './util'

// Las fechas del modulo ya vienen en hora de Mexico como yyyy-MM-dd HH:mm
export const fh = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}${s.length > 10 ? ' ' + s.slice(11, 16) : ''}` : '-')
export const dinero = (n) => '$' + new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
export const baja = (nombre, mime, texto) => { const u = URL.createObjectURL(new Blob([texto], { type: mime })); const a = document.createElement('a'); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000) }

export const ESTADO_TXT = {
  fuera: 'Fuera del conteo', pendiente: 'Pendiente', asignada: 'Asignada', reconteo: 'En reconteo', contada: 'Contada',
  con: 'Con existencia', vacia: 'Vacia', ok: 'Sin diferencia', dif: 'Con diferencia', explicada: 'Explicada por movimientos',
}

export function MapaSvg({ items, claseDe, onClick, sel }) {
  const caja = useMemo(() => {
    const v = items.filter(i => i.w > 0 && i.h > 0)
    if (!v.length) return { x: 0, y: 0, w: 100, h: 50 }
    const x0 = Math.min(...v.map(i => i.x)), y0 = Math.min(...v.map(i => i.y))
    const x1 = Math.max(...v.map(i => i.x + i.w)), y1 = Math.max(...v.map(i => i.y + i.h))
    return { x: x0 - 1, y: y0 - 1, w: x1 - x0 + 2, h: y1 - y0 + 2 }
  }, [items])
  return (
    <div className="inv-mapa-wrap">
      <svg className="inv-mapa" viewBox={`${caja.x} ${caja.y} ${caja.w} ${caja.h}`} role="img" aria-label="Mapa del almacen">
        {items.filter(i => i.w > 0 && i.h > 0).map(i => (
          <rect key={i.c} x={i.x} y={i.y} width={i.w} height={i.h}
            className={'inv-ub ' + claseDe(i) + (sel === i.c ? ' inv-ub--sel' : '') + (i.t && i.t !== 'rack' ? ' inv-ub--' + i.t : '')}
            onClick={() => onClick && onClick(i)}>
            <title>{i.c}</title>
          </rect>
        ))}
      </svg>
    </div>
  )
}

export function Leyenda({ cuenta, claves }) {
  return (
    <div className="inv-leyenda">
      {claves.map(k => (
        <span key={k} className="inv-ley"><span className={'inv-sw inv-e-' + k} />{ESTADO_TXT[k] || k}{cuenta && cuenta[k] !== undefined ? ` (${nf(cuenta[k])})` : ''}</span>
      ))}
    </div>
  )
}

