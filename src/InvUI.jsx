import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { nf } from './util'

// Las fechas del modulo ya vienen en hora de Mexico como yyyy-MM-dd HH:mm
export const fh = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}${s.length > 10 ? ' ' + s.slice(11, 16) : ''}` : '-')
export const dinero = (n) => '$' + new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
export const baja = (nombre, mime, texto) => { const u = URL.createObjectURL(new Blob([texto], { type: mime })); const a = document.createElement('a'); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000) }

export const ESTADO_TXT = {
  fuera: 'Fuera del conteo', pendiente: 'Pendiente', asignada: 'Asignada', reconteo: 'En reconteo', contada: 'Contada',
  con: 'Con existencia', vacia: 'Vacia', ok: 'Sin diferencia', dif: 'Con diferencia', explicada: 'Explicada por movimientos',
}

const norm = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const cajaDe = (v) => {
  if (!v.length) return { x: 0, y: 0, w: 100, h: 50 }
  const x0 = Math.min(...v.map(i => i.x)), y0 = Math.min(...v.map(i => i.y))
  const x1 = Math.max(...v.map(i => i.x + i.w)), y1 = Math.max(...v.map(i => i.y + i.h))
  return { x: x0, y: y0, w: Math.max(x1 - x0, 1), h: Math.max(y1 - y0, 1) }
}

// Mapa interactivo: zoom con rueda / pellizco, arrastrar para moverse, botones, filtros (bodega, zona, estado),
// busqueda de ubicacion con zoom, etiquetas al acercarse, pantalla completa y teclado.
//  items: [{c,b,z,x,y,w,h,t,...}]   estadoDe(i) -> clave de estado (o null si no aplica)   claseDe(i) -> clases de color
//  leyenda: claves de estado a mostrar (interactiva)   resaltar: Set de codigos a destacar (p. ej. donde esta un producto)
export function MapaSvg({ items, claseDe, estadoDe, leyenda, onClick, sel, resaltar, tituloDe }) {
  const dib = useMemo(() => items.filter(i => i.w > 0 && i.h > 0), [items])
  const bodegas = useMemo(() => [...new Set(dib.map(i => i.b).filter(Boolean))].sort(), [dib])
  const [bod, setBod] = useState('')
  const [zona, setZona] = useState('')
  const [ocultos, setOcultos] = useState({})
  const [q, setQ] = useState('')
  const [full, setFull] = useState(false)
  const [vb, setVb] = useState(null)
  const ref = useRef(null)
  const ptrs = useRef(new Map())
  const mov = useRef(false)
  const zonas = useMemo(() => [...new Set(dib.filter(i => !bod || i.b === bod).map(i => i.z).filter(Boolean))].sort(), [dib, bod])
  const esAlm = (i) => !i.t || i.t === 'rack'
  const est = useCallback((i) => (estadoDe ? estadoDe(i) : null), [estadoDe])
  const cuenta = useMemo(() => { const c = {}; if (estadoDe) dib.forEach(i => { if (esAlm(i)) { const k = estadoDe(i); if (k) c[k] = (c[k] || 0) + 1 } }); return c }, [dib, estadoDe])
  const nq = norm(q)
  const aciertos = useMemo(() => (nq.length >= 2 ? dib.filter(i => esAlm(i) && norm(i.c).includes(nq)) : []), [dib, nq])
  const hayRes = resaltar && resaltar.size > 0
  const visible = useCallback((i) => {
    if (!esAlm(i)) return true
    if (bod && i.b !== bod) return false
    if (zona && i.z !== zona) return false
    const k = est(i); if (k && ocultos[k]) return false
    return true
  }, [bod, zona, ocultos, est])
  const filtrados = useMemo(() => dib.filter(i => esAlm(i) && visible(i)), [dib, visible])
  const caja = useMemo(() => cajaDe(dib), [dib])

  const tamano = () => { const e = ref.current; const r = e ? e.getBoundingClientRect() : null; return r && r.width > 0 ? { w: r.width, h: r.height } : { w: 900, h: 560 } }
  const ajusta = useCallback((c, pad = 0.04) => {
    const t = tamano(); const asp = t.h / t.w
    let w = c.w * (1 + pad * 2), h = w * asp
    if (h < c.h * (1 + pad * 2)) { h = c.h * (1 + pad * 2); w = h / asp }
    setVb({ x: c.x + c.w / 2 - w / 2, y: c.y + c.h / 2 - h / 2, w, h })
  }, [])
  const todo = useCallback(() => ajusta(caja), [ajusta, caja])
  useEffect(() => { todo() }, [todo, full])
  // Al cambiar bodega o zona, encuadra lo que queda visible
  useEffect(() => { if (bod || zona) { const f = filtrados; if (f.length) ajusta(cajaDe(f), 0.06) } }, [bod, zona]) // eslint-disable-line

  const zoomEn = useCallback((fx, fy, factor) => setVb(v => {
    if (!v) return v
    const t = tamano(); const asp = t.h / t.w
    const min = caja.w / 40, max = caja.w * 2
    const w = Math.max(min, Math.min(max, v.w / factor)); const k = w / v.w
    const px = v.x + fx * v.w, py = v.y + fy * v.h
    const h = w * asp
    return { x: px - fx * w, y: py - fy * h, w, h }
  }), [caja.w])
  const botonZoom = (f) => zoomEn(0.5, 0.5, f)
  const onWheel = (e) => {
    const r = ref.current.getBoundingClientRect()
    zoomEn((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, Math.exp(-Math.max(-300, Math.min(300, e.deltaY)) * 0.0022))
  }
  useEffect(() => { // wheel no pasivo para poder evitar el scroll de la pagina
    const e = ref.current; if (!e) return
    const h = (ev) => { ev.preventDefault(); onWheel(ev) }
    e.addEventListener('wheel', h, { passive: false }); return () => e.removeEventListener('wheel', h)
  })
  const down = (e) => { ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); mov.current = false }
  const move = (e) => {
    const p = ptrs.current.get(e.pointerId); if (!p) return
    const r = ref.current.getBoundingClientRect()
    if (ptrs.current.size === 1) {
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      if (Math.abs(dx) + Math.abs(dy) > 3) mov.current = true
      if (mov.current) setVb(v => v && ({ ...v, x: v.x - dx / r.width * v.w, y: v.y - dy / r.height * v.h }))
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    } else if (ptrs.current.size === 2) {
      const o = [...ptrs.current.entries()].find(([id]) => id !== e.pointerId)[1]
      const d0 = Math.hypot(p.x - o.x, p.y - o.y), d1 = Math.hypot(e.clientX - o.x, e.clientY - o.y)
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); mov.current = true
      if (d0 > 0 && d1 > 0) zoomEn(((e.clientX + o.x) / 2 - r.left) / r.width, ((e.clientY + o.y) / 2 - r.top) / r.height, d1 / d0)
    }
  }
  const up = (e) => { ptrs.current.delete(e.pointerId) }
  const teclas = (e) => {
    const m = vb ? vb.w * 0.1 : 0
    if (e.key === '+' || e.key === '=') botonZoom(1.3)
    else if (e.key === '-') botonZoom(0.77)
    else if (e.key === '0') todo()
    else if (e.key === 'ArrowLeft') setVb(v => ({ ...v, x: v.x - m }))
    else if (e.key === 'ArrowRight') setVb(v => ({ ...v, x: v.x + m }))
    else if (e.key === 'ArrowUp') setVb(v => ({ ...v, y: v.y - m }))
    else if (e.key === 'ArrowDown') setVb(v => ({ ...v, y: v.y + m }))
    else return
    e.preventDefault()
  }
  useEffect(() => { if (!full) return; const h = (e) => { if (e.key === 'Escape') setFull(false) }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [full])

  const ir = () => {
    if (!aciertos.length) return
    ajusta(cajaDe(aciertos.length === 1 ? aciertos : aciertos), aciertos.length === 1 ? 6 : 0.15)
    if (aciertos.length === 1 && onClick) onClick(aciertos[0])
  }
  const enfocaProducto = useCallback(() => { if (hayRes) { const l = dib.filter(i => resaltar.has(i.c)); if (l.length) ajusta(cajaDe(l), l.length === 1 ? 6 : 0.12) } }, [hayRes, resaltar, dib, ajusta])
  useEffect(() => { enfocaProducto() }, [resaltar]) // eslint-disable-line
  const hitSet = useMemo(() => new Set(aciertos.map(i => i.c)), [aciertos])
  const hayHit = hitSet.size > 0

  const rects = useMemo(() => dib.map(i => {
    const vis = visible(i)
    const hit = hayRes ? resaltar.has(i.c) : hitSet.has(i.c)
    const apagada = esAlm(i) && (!vis || ((hayRes || hayHit) && !hit))
    return (
      <rect key={i.c} x={i.x} y={i.y} width={i.w} height={i.h}
        className={'inv-ub ' + claseDe(i) + (sel === i.c ? ' inv-ub--sel' : '') + (i.t && i.t !== 'rack' ? ' inv-ub--' + i.t : '') + (apagada ? ' inv-ub--off' : '') + (hit && esAlm(i) ? ' inv-ub--hit' : '')}
        onClick={() => { if (!mov.current && !apagada && onClick) onClick(i) }}>
        <title>{tituloDe ? tituloDe(i) : i.c}</title>
      </rect>
    )
  }), [dib, visible, claseDe, sel, hitSet, hayHit, hayRes, resaltar, onClick, tituloDe])

  // Etiquetas: solo al acercarse y solo lo que cae en pantalla
  const etiquetas = useMemo(() => {
    if (!vb) return null
    const t = tamano(); const px = t.w / vb.w
    const out = []
    for (const i of filtrados) {
      if (out.length >= 450) break
      if (i.x + i.w < vb.x || i.x > vb.x + vb.w || i.y + i.h < vb.y || i.y > vb.y + vb.h) continue
      const vert = i.h > i.w * 1.8
      const largo = vert ? i.h : i.w, corto = vert ? i.w : i.h
      if (largo * px < 28 || corto * px < 10) continue
      const tx = String(i.c).slice(-7)
      const fs = Math.min(corto * 0.6, (largo * 0.9) / (tx.length * 0.58))
      const cx = i.x + i.w / 2, cy = i.y + i.h / 2
      out.push(<text key={'t' + i.c} x={cx} y={cy} fontSize={fs} className="inv-etq" textAnchor="middle" dominantBaseline="central" transform={vert ? `rotate(-90 ${cx} ${cy})` : undefined}>{tx}</text>)
    }
    return out
  }, [vb, filtrados])

  const escala = vb ? Math.round(caja.w / vb.w * 100) : 100
  const limpia = bod || zona || q || Object.values(ocultos).some(Boolean)
  return (
    <div className={'inv-mapa-caja' + (full ? ' inv-mapa-full' : '')}>
      <div className="inv-mapa-barra">
        <input className="inp inv-mapa-bus" placeholder="Buscar ubicacion (ej. R12B)" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ir() } }} aria-label="Buscar ubicacion" />
        {bodegas.length > 1 && <select className="inp inv-mapa-sel" value={bod} onChange={e => { setBod(e.target.value); setZona('') }} aria-label="Bodega"><option value="">Todas las bodegas</option>{bodegas.map(b => <option key={b} value={b}>{b}</option>)}</select>}
        {zonas.length > 1 && <select className="inp inv-mapa-sel" value={zona} onChange={e => setZona(e.target.value)} aria-label="Zona"><option value="">Todas las zonas</option>{zonas.map(z => <option key={z} value={z}>Zona {z}</option>)}</select>}
        {limpia && <button type="button" className="btn-sec" onClick={() => { setBod(''); setZona(''); setQ(''); setOcultos({}); todo() }}>Quitar filtros</button>}
      </div>
      {nq.length >= 2 && <div className="sub-pag" style={{ margin: '6px 0 0' }}>{aciertos.length ? `${aciertos.length} ubicacion(es). Enter para ir.` : 'Sin coincidencias.'}</div>}
      {leyenda && (
        <div className="inv-leyenda" role="group" aria-label="Filtrar por estado">
          {leyenda.map(k => (
            <button type="button" key={k} className={'inv-ley inv-ley-btn' + (ocultos[k] ? ' inv-ley-off' : '')} aria-pressed={!ocultos[k]} onClick={() => setOcultos(o => ({ ...o, [k]: !o[k] }))}>
              <span className={'inv-sw inv-e-' + k} />{ESTADO_TXT[k] || k} ({nf(cuenta[k] || 0)})
            </button>
          ))}
        </div>
      )}
      <div className="inv-mapa-wrap">
        <div className="inv-mapa-ctl">
          <button type="button" className="inv-mapa-b" onClick={() => botonZoom(1.4)} aria-label="Acercar">+</button>
          <button type="button" className="inv-mapa-b" onClick={() => botonZoom(0.71)} aria-label="Alejar">-</button>
          <button type="button" className="inv-mapa-b inv-mapa-b--t" onClick={todo} aria-label="Ver todo el almacen">Todo</button>
          <button type="button" className="inv-mapa-b inv-mapa-b--t" onClick={() => setFull(f => !f)} aria-label="Pantalla completa">{full ? 'Cerrar' : 'Ampliar'}</button>
          <span className="inv-mapa-esc">{escala}%</span>
        </div>
        <svg ref={ref} className="inv-mapa" tabIndex={0} viewBox={vb ? `${vb.x} ${vb.y} ${vb.w} ${vb.h}` : `${caja.x} ${caja.y} ${caja.w} ${caja.h}`} role="application" aria-label="Mapa del almacen. Flechas para moverse, mas y menos para acercar."
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} onKeyDown={teclas}>
          {rects}
          {etiquetas}
        </svg>
        <div className="inv-mapa-ayuda">Rueda o pellizco para acercar. Arrastra para moverte.</div>
      </div>
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

