import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as api from './api.js'

const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })
const pct = (n) => (n === null || n === undefined) ? '—' : `${n}%`
const colorExactitud = (n) => n === null || n === undefined ? 'var(--text3)' : n >= 98 ? 'var(--cs)' : n >= 90 ? 'var(--amarillo)' : 'var(--rojo)'

function Tarjeta({ titulo, valor, sub, color }) {
  return (
    <div className="stat" style={{minWidth:150}}>
      <div className="stat-num" style={color ? { color } : undefined}>{valor}</div>
      <div className="stat-label">{titulo}</div>
      {sub && <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>{sub}</div>}
    </div>
  )
}

function Barras({ filas }) {
  return filas.length === 0 ? <div className="vacio" style={{fontSize:12}}>Sin datos.</div> : (
    <div>
      {filas.map(f => (
        <div key={f.nombre} style={{marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
            <span><b>{f.nombre}</b> <span style={{color:'var(--text3)'}}>· {f.contadas} contadas, {f.con_diferencia} con diferencia</span></span>
            <b style={{color:colorExactitud(f.exactitud)}}>{pct(f.exactitud)}</b>
          </div>
          <div style={{height:7,background:'var(--bg3)',borderRadius:4,overflow:'hidden'}}>
            <div style={{width:`${f.exactitud || 0}%`,height:'100%',background:colorExactitud(f.exactitud)}}></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ConteoReporte({ toast }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [r, setR] = useState(null)
  const [tipo, setTipo] = useState('todas')       // todas | faltantes | sobrantes | inesperados
  const [texto, setTexto] = useState('')

  useEffect(() => { api.reporteConteo(id).then(setR).catch(e => { toast(e.message, 'error'); navigate('/almacen/conteo') }) }, [id])

  const exportar = async (todas) => {
    try { await api.descargarReporteConteoCSV(id, todas) } catch (e) { toast(e.message, 'error') }
  }

  if (!r) return <div className="cargando">Generando reporte...</div>
  const s = r.resumen, c = r.conteo
  const t = texto.trim().toLowerCase()
  const difs = r.diferencias.filter(d =>
    (tipo === 'todas' || (tipo === 'faltantes' && d.diferencia < 0) || (tipo === 'sobrantes' && d.diferencia > 0) || (tipo === 'inesperados' && d.inesperado)) &&
    (!t || d.codigo.toLowerCase().includes(t) || (d.producto || '').toLowerCase().includes(t) || (d.descripcion || '').toLowerCase().includes(t))
  )
  const maxTop = Math.max(1, ...r.top_productos.map(x => x.abs))

  return (
    <div className="contenedor">
      <div className="no-print" style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:12}}>
        <button className="btn-sec" onClick={() => navigate('/almacen/conteo')}>← Conteos</button>
        <div style={{flex:1}}></div>
        {c.estatus === 'abierto' && <button className="btn-sec" onClick={() => navigate(`/almacen/conteo/${id}`)}>Seguir contando</button>}
        <button className="btn-sec" onClick={() => exportar(false)}>CSV de diferencias</button>
        <button className="btn-sec" onClick={() => exportar(true)}>CSV completo</button>
        <button className="btn-principal" onClick={() => window.print()}>Imprimir reporte</button>
      </div>

      <div className="titulo-pag">Reporte de conteo — {c.nombre}</div>
      <div className="sub-pag">
        {c.id} · {c.alcance} · creado {api.formatearFecha(c.fecha)} por {c.creado_por}
        {c.estatus === 'cerrado' ? ` · cerrado ${api.formatearFecha(c.fecha_cierre)}` : ' · conteo abierto'}
        {c.ciego ? ' · a ciegas' : ''}
      </div>

      {s.pendientes > 0 && (
        <div className="panel" style={{marginBottom:14,borderLeft:'3px solid var(--amarillo)',fontSize:12}}>
          Conteo parcial: <b>{s.pendientes}</b> de {s.ubicaciones} ubicaciones siguen pendientes y no entran en estas cifras.
        </div>
      )}

      <div className="stats" style={{flexWrap:'wrap'}}>
        <Tarjeta titulo="Avance" valor={pct(s.avance_pct)} sub={`${s.contadas} de ${s.ubicaciones} ubicaciones`} />
        <Tarjeta titulo="Exactitud por ubicacion" valor={pct(s.exactitud_ubicacion_pct)} color={colorExactitud(s.exactitud_ubicacion_pct)}
          sub="ubicaciones sin ninguna diferencia" />
        <Tarjeta titulo="Exactitud por pieza" valor={pct(s.exactitud_pieza_pct)} color={colorExactitud(s.exactitud_pieza_pct)}
          sub="1 − (faltantes + sobrantes) / sistema" />
        <Tarjeta titulo="Faltantes" valor={fmt(s.faltante_unidades)} color={s.faltante_unidades ? 'var(--rojo)' : undefined} sub="unidades menos que el sistema" />
        <Tarjeta titulo="Sobrantes" valor={fmt(s.sobrante_unidades)} color={s.sobrante_unidades ? 'var(--amarillo)' : undefined} sub="unidades mas que el sistema" />
        <Tarjeta titulo="Ubicaciones con diferencia" valor={s.ubicaciones_con_diferencia} sub={`${s.lineas_con_diferencia} renglones · ${s.productos_inesperados} no esperados`} />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:14,marginTop:14}}>
        <div className="panel">
          <div className="panel-titulo">Exactitud por zona</div>
          <Barras filas={r.por_zona} />
        </div>
        <div className="panel">
          <div className="panel-titulo">Exactitud por bodega</div>
          <Barras filas={r.por_bodega} />
        </div>
        <div className="panel">
          <div className="panel-titulo">Productos con mas diferencia</div>
          {r.top_productos.length === 0 ? <div className="vacio" style={{fontSize:12}}>Sin diferencias.</div> : r.top_productos.map(p => (
            <div key={p.producto} style={{marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                <span><b>{p.producto}</b> <span style={{color:'var(--text3)'}}>{p.descripcion}</span></span>
                <b style={{color: p.neto < 0 ? 'var(--rojo)' : 'var(--amarillo)'}}>{p.neto > 0 ? '+' : ''}{fmt(p.neto)}</b>
              </div>
              <div style={{height:6,background:'var(--bg3)',borderRadius:4,overflow:'hidden'}}>
                <div style={{width:`${p.abs * 100 / maxTop}%`,height:'100%',background:'var(--rojo)'}}></div>
              </div>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-titulo">Ubicaciones contadas por persona</div>
          {r.por_contador.length === 0 ? <div className="vacio" style={{fontSize:12}}>Aun sin capturas.</div> : (
            <table className="tabla"><tbody>
              {r.por_contador.map(x => <tr key={x.usuario}><td>{x.usuario}</td><td style={{textAlign:'right',fontWeight:700}}>{x.ubicaciones}</td></tr>)}
            </tbody></table>
          )}
        </div>
      </div>

      <div className="panel" style={{marginTop:14}}>
        <div className="panel-titulo">Diferencias detectadas <span className="chip chip-ok">{difs.length}</span></div>
        <div className="no-print" style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:12}}>
          <input className="inp" style={{flex:1,minWidth:200}} placeholder="Filtrar por ubicacion o producto..." value={texto} onChange={e => setTexto(e.target.value)} />
          <div className="cm-toggle">
            {[['todas','Todas'],['faltantes','Faltantes'],['sobrantes','Sobrantes'],['inesperados','No esperados']].map(([k, l]) => (
              <span key={k} className={'cm-pill' + (tipo === k ? ' on' : '')} onClick={() => setTipo(k)}>{l}</span>
            ))}
          </div>
        </div>
        {difs.length === 0 ? <div className="vacio">{r.diferencias.length === 0 ? 'No hay diferencias en lo contado.' : 'Sin resultados con ese filtro.'}</div> : (
          <table className="tabla">
            <thead><tr><th>Ubicacion</th><th>Producto</th><th style={{textAlign:'right'}}>Sistema</th><th style={{textAlign:'right'}}>Contado</th><th style={{textAlign:'right'}}>Diferencia</th><th>Contó</th></tr></thead>
            <tbody>
              {difs.slice(0, 500).map((d, i) => (
                <tr key={d.codigo + d.producto + i}>
                  <td style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:12}}>{d.codigo}</td>
                  <td>
                    <b>{d.producto}</b> {d.inesperado && <span className="chip chip-warn">no esperado</span>}
                    <div style={{fontSize:11,color:'var(--text3)'}}>{d.descripcion}</div>
                  </td>
                  <td style={{textAlign:'right'}}>{fmt(d.esperado)}</td>
                  <td style={{textAlign:'right'}}>{fmt(d.contado)}</td>
                  <td style={{textAlign:'right',fontWeight:800,color: d.diferencia < 0 ? 'var(--rojo)' : 'var(--amarillo)'}}>
                    {d.diferencia > 0 ? '+' : ''}{fmt(d.diferencia)}{d.pct !== null && <span style={{fontSize:10,color:'var(--text3)'}}> ({d.pct}%)</span>}
                  </td>
                  <td style={{fontSize:11}}>{d.contado_por}{d.veces > 1 ? ` · ${d.veces} veces` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {difs.length > 500 && <div style={{fontSize:12,color:'var(--text3)',marginTop:8}}>Mostrando 500 de {difs.length}; el CSV trae todas.</div>}
      </div>

      <p style={{fontSize:11,color:'var(--text3)',marginTop:14,lineHeight:1.5}}>
        Este reporte no modifica Odoo. Los ajustes de inventario se hacen en Odoo a partir de las diferencias, idealmente despues de revisar las ubicaciones con diferencia.
      </p>
    </div>
  )
}
