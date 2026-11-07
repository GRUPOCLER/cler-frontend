// ============================================================
//  GRAFICAS CLER - SVG/HTML sin dependencias, con los tokens de cler-ui.css
//  Reglas: un color por trabajo (ranking = 1 tono; 2 series = chart-1 y chart-2),
//  texto siempre en tinta (nunca del color de la serie), tooltip al pasar el cursor,
//  y toda tarjeta puede verse como tabla.
// ============================================================
import { useState } from 'react'

export const nf = (n, dec = 0) =>
  (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec })
export const fechaCorta = (iso) => { const [, m, d] = (iso || '').split('-'); return d && m ? `${d}/${m}` : '' }

// ── Tarjeta de grafica: titulo = el hallazgo, subtitulo = que se mide; boton Ver tabla ──
export function TarjetaGrafica({ titulo, sub, children, tabla, ancho }) {
  const [verTabla, setVerTabla] = useState(false)
  return (
    <section className={'an-card' + (ancho ? ' an-card--' + ancho : '')}>
      <header className="an-card-head">
        <div>
          <h3 className="an-card-titulo">{titulo}</h3>
          {sub && <div className="an-card-sub">{sub}</div>}
        </div>
        {tabla && (
          <button className="btn-mini an-ver-tabla" onClick={() => setVerTabla(v => !v)} aria-pressed={verTabla}>
            {verTabla ? 'Ver gráfica' : 'Ver tabla'}
          </button>
        )}
      </header>
      {verTabla && tabla ? (
        <div className="an-tabla-wrap">
          <table className="an-tabla">
            <thead><tr>{tabla.cols.map((c, i) => <th key={i} className={i ? 'num' : ''}>{c}</th>)}</tr></thead>
            <tbody>{tabla.filas.map((f, i) => <tr key={i}>{f.map((v, j) => <td key={j} className={j ? 'num' : ''}>{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : children}
    </section>
  )
}

// ── Cifra con contexto: valor, cambio contra el periodo anterior y nota ──
export function Kpi({ titulo, valor, unidad, delta, bueno = 'sube', nota, heroe }) {
  let chip = null
  if (delta !== null && delta !== undefined) {
    const sube = delta > 0, igual = delta === 0
    const bien = igual ? null : (bueno === 'sube' ? sube : !sube)
    chip = (
      <span className={'an-delta' + (bien === null ? '' : bien ? ' an-delta--bien' : ' an-delta--mal')}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          {igual ? <path d="M2 6h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            : <path d={sube ? 'M6 10V2M2.5 5.5 6 2l3.5 3.5' : 'M6 2v8M2.5 6.5 6 10l3.5-3.5'} stroke="currentColor" strokeWidth="1.75" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        {sube ? '+' : ''}{nf(delta, 1)}%
        <span className="an-delta-vs"> vs periodo anterior</span>
      </span>
    )
  }
  return (
    <div className={'an-kpi' + (heroe ? ' an-kpi--heroe' : '')}>
      <div className="an-kpi-titulo">{titulo}</div>
      <div className="an-kpi-valor">{valor}{unidad && <span className="an-kpi-unidad"> {unidad}</span>}</div>
      {chip}
      {nota && <div className="an-kpi-nota">{nota}</div>}
    </div>
  )
}

// ── Columnas (serie en el tiempo o categorias ordenadas) con tooltip ──
//  datos: [{ etq, valor, extra? }]  resaltar: indice(s) en color de enfasis (el resto, tono base)
export function Columnas({ datos, alto = 200, formato = nf, resaltar = [], media = null, etiquetaX, unidad = '' }) {
  const [sel, setSel] = useState(null)
  const W = 640, H = alto, mI = 38, mD = 8, mS = 10, mB = 24
  const iw = W - mI - mD, ih = H - mS - mB
  const max = Math.max(1, ...datos.map(d => d.valor), ...(media || []).map(v => v || 0))
  const techo = nice(max)
  const paso = iw / Math.max(1, datos.length), bw = Math.max(2, Math.min(34, paso * 0.72))
  const y = v => mS + ih - (v / techo) * ih
  const marcasY = [0, 0.5, 1].map(f => f * techo)
  const cadaX = datos.length > 16 ? Math.ceil(datos.length / 8) : 1
  const rs = new Set(Array.isArray(resaltar) ? resaltar : [resaltar])
  const hayResalte = rs.size > 0
  const puntosMedia = media ? media.map((v, i) => v == null ? null : [mI + paso * i + paso / 2, y(v)]) : null
  return (
    <div className="an-chart" onMouseLeave={() => setSel(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfica de columnas" preserveAspectRatio="none" style={{ width: '100%', height: H }}>
        {marcasY.map((v, i) => (
          <g key={i}>
            <line x1={mI} x2={W - mD} y1={y(v)} y2={y(v)} className={i === 0 ? 'an-eje' : 'an-grid'} />
            <text x={mI - 6} y={y(v) + 3.5} textAnchor="end" className="an-txt">{nf(v)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const x = mI + paso * i + (paso - bw) / 2, h = Math.max(d.valor > 0 ? 2 : 0, (d.valor / techo) * ih)
          const fill = hayResalte ? (rs.has(i) ? 'var(--chart-2)' : 'var(--chart-1)') : 'var(--chart-1)'
          return (
            <g key={i}>
              {d.valor > 0 && <path d={`M${x},${y(0)} v${-(h - 3)} q0,-3 3,-3 h${bw - 6} q3,0 3,3 v${h - 3} z`} fill={fill} opacity={sel !== null && sel !== i ? 0.45 : 1} />}
              <rect x={mI + paso * i} y={mS} width={paso} height={ih + mB} fill="transparent" onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)} tabIndex={0} aria-label={`${d.etq}: ${formato(d.valor)} ${unidad}`} />
              {i % cadaX === 0 && <text x={mI + paso * i + paso / 2} y={H - 7} textAnchor="middle" className="an-txt">{etiquetaX ? etiquetaX(d, i) : d.etq}</text>}
            </g>
          )
        })}
        {puntosMedia && (
          <polyline fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
            points={puntosMedia.filter(Boolean).map(p => p.join(',')).join(' ')} />
        )}
        {sel !== null && <line x1={mI + paso * sel + paso / 2} x2={mI + paso * sel + paso / 2} y1={mS} y2={y(0)} className="an-cruz" />}
      </svg>
      {sel !== null && (
        <div className="an-tip" style={{ left: `${Math.min(86, Math.max(10, ((mI + paso * sel + paso / 2) / W) * 100))}%` }}>
          <b>{datos[sel].etq}</b>
          <div>{formato(datos[sel].valor)} {unidad}</div>
          {datos[sel].extra && <div className="an-tip-extra">{datos[sel].extra}</div>}
          {media && media[sel] != null && <div className="an-tip-extra">Promedio 7 días: {nf(media[sel], 1)}</div>}
        </div>
      )}
    </div>
  )
}
function nice(v) {
  const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e
}

// ── Ranking horizontal: una barra por categoria, la mas grande primero, un solo tono ──
//  filas: [{ nombre, valor, nota? }]  enfasis: cuantas filas van en color de enfasis (default 1)
export function Ranking({ filas, formato = nf, unidad = '', enfasis = 1, onClick, total }) {
  const max = Math.max(1, ...filas.map(f => f.valor))
  const suma = total ?? filas.reduce((a, f) => a + f.valor, 0)
  return (
    <ol className="an-rank">
      {filas.map((f, i) => (
        <li key={f.nombre + i} className={'an-rank-fila' + (onClick ? ' an-clic' : '')} onClick={onClick ? () => onClick(f) : undefined}
          title={`${f.nombre}: ${formato(f.valor)} ${unidad}${suma ? ` (${nf((100 * f.valor) / suma, 1)}%)` : ''}`}>
          <span className="an-rank-nombre">{f.nombre}</span>
          <span className="an-rank-pista"><span className="an-rank-barra" style={{ width: `${(f.valor / max) * 100}%`, background: i < enfasis ? 'var(--chart-1)' : 'var(--border-strong)' }} /></span>
          <span className="an-rank-valor">{formato(f.valor)}{unidad && <span className="an-rank-u"> {unidad}</span>}</span>
          {f.nota && <span className="an-rank-nota">{f.nota}</span>}
        </li>
      ))}
    </ol>
  )
}

// ── Barras apiladas horizontales de 2 partes (ej. tomadas vs sin tomar) ──
//  filas: [{ nombre, a, b }]   nombreA / nombreB: leyenda (A = chart-1, B = chart-2)
export function ApiladaDuo({ filas, nombreA, nombreB, formato = nf }) {
  const max = Math.max(1, ...filas.map(f => f.a + f.b))
  return (
    <div>
      <div className="an-leyenda">
        <span><i style={{ background: 'var(--chart-1)' }} />{nombreA}</span>
        <span><i style={{ background: 'var(--chart-2)' }} />{nombreB}</span>
      </div>
      <ol className="an-rank">
        {filas.map((f, i) => (
          <li key={f.nombre + i} className="an-rank-fila" title={`${f.nombre}: ${formato(f.a)} ${nombreA.toLowerCase()}, ${formato(f.b)} ${nombreB.toLowerCase()}`}>
            <span className="an-rank-nombre">{f.nombre}</span>
            <span className="an-rank-pista">
              <span className="an-apilada" style={{ width: `${((f.a + f.b) / max) * 100}%` }}>
                <span style={{ flex: f.a, background: 'var(--chart-1)' }} />
                <span style={{ flex: f.b, background: 'var(--chart-2)' }} />
              </span>
            </span>
            <span className="an-rank-valor">{formato(f.a)} / {formato(f.b)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ── Medidor: un avance contra un limite ──
export function Medidor({ pct, etiqueta, enfasis }) {
  const p = Math.max(0, Math.min(100, pct || 0))
  return (
    <div className="an-medidor" role="img" aria-label={`${etiqueta}: ${nf(p, 1)}%`}>
      <div className="an-medidor-top"><span>{etiqueta}</span><b>{nf(p, 1)}%</b></div>
      <div className="an-medidor-pista"><div className="an-medidor-barra" style={{ width: `${p}%`, background: enfasis ? 'var(--chart-2)' : 'var(--chart-1)' }} /></div>
    </div>
  )
}

// ── Mapa de calor dia x hora (secuencial de un solo tono: mas oscuro = mas bultos) ──
export function MapaCalor({ celdas, horaIni = 6, horaFin = 21 }) {
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const mapa = {}; let max = 0
  celdas.forEach(c => { mapa[`${c.dia}-${c.hora}`] = c.bultos; max = Math.max(max, c.bultos) })
  const horas = []; for (let h = horaIni; h <= horaFin; h++) horas.push(h)
  const [sel, setSel] = useState(null)
  return (
    <div className="an-calor" onMouseLeave={() => setSel(null)}>
      <div className="an-calor-grid" style={{ gridTemplateColumns: `34px repeat(${horas.length}, 1fr)` }}>
        <span />
        {horas.map(h => <span key={h} className="an-calor-h">{h % 2 === 0 ? h : ''}</span>)}
        {dias.map((d, di) => (
          <div key={d} style={{ display: 'contents' }}>
            <span className="an-calor-d">{d}</span>
            {horas.map(h => {
              const v = mapa[`${di}-${h}`] || 0
              return <span key={h} className="an-calor-c" tabIndex={0} aria-label={`${d} ${h}:00, ${v} bultos`}
                onMouseEnter={() => setSel({ d, h, v })} onFocus={() => setSel({ d, h, v })}
                style={{ background: v ? 'var(--chart-1)' : 'var(--surface-sunken)', opacity: v ? 0.18 + 0.82 * (v / max) : 1 }} />
            })}
          </div>
        ))}
      </div>
      <div className="an-calor-pie">
        {sel ? <b>{sel.d} {sel.h}:00 a {sel.h}:59 - {nf(sel.v)} bultos cerrados</b> : <span>Pasa el cursor sobre una celda. Más oscuro = más bultos cerrados. Horas locales (hora de México).</span>}
      </div>
    </div>
  )
}

// ── Barra segmentada (un todo en partes, con la leyenda de nombres) ──
export function Segmentada({ partes, formato = nf }) {
  const total = partes.reduce((a, p) => a + p.valor, 0) || 1
  const tonos = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-5)']
  return (
    <div>
      <div className="an-seg" role="img" aria-label={partes.map(p => `${p.nombre} ${nf((100 * p.valor) / total, 0)}%`).join(', ')}>
        {partes.map((p, i) => (
          <span key={p.nombre} title={`${p.nombre}: ${formato(p.valor)} (${nf((100 * p.valor) / total, 1)}%)`} style={{ flex: p.valor, background: tonos[i % 3] }}>
            {p.valor / total > 0.1 && <b>{nf((100 * p.valor) / total, 0)}%</b>}
          </span>
        ))}
      </div>
      <div className="an-leyenda">
        {partes.map((p, i) => <span key={p.nombre}><i style={{ background: tonos[i % 3] }} />{p.nombre}: {formato(p.valor)}</span>)}
      </div>
    </div>
  )
}

export function Estado({ cargando, error, vacio, reintentar, children }) {
  if (cargando) return <div className="an-estado"><div className="an-carga" /> Calculando el reporte...</div>
  if (error) return <div className="an-estado an-estado--error">{error} {reintentar && <button className="btn-mini" onClick={reintentar}>Reintentar</button>}</div>
  if (vacio) return <div className="an-estado">No hay datos en este periodo. Amplía el rango de fechas o quita los filtros.</div>
  return children
}
