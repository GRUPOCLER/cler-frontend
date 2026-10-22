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


const ESTADO_MOV = {
  explicada:    { txt: 'Explicada por movimientos', cls: 'chip chip-ok' },
  parcial:      { txt: 'Explicada en parte',        cls: 'chip chip-warn' },
  sin_explicar: { txt: 'Sin explicar',              cls: 'chip chip-err' },
}

function ValidacionMovimientos({ id, toast }) {
  const [m, setM] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [ver, setVer] = useState('diferencias')      // diferencias | ovs | traslados | otros
  const [soloPend, setSoloPend] = useState(false)

  const cargar = async () => {
    setCargando(true)
    try { setM(await api.movimientosConteo(id)) } catch (e) { toast(e.message, 'error') }
    setCargando(false)
  }
  const exportar = async () => { try { await api.descargarMovimientosConteoCSV(id) } catch (e) { toast(e.message, 'error') } }

  const rs = m && m.resumen
  const difs = m ? m.diferencias.filter(d => !soloPend || d.estado !== 'explicada') : []
  return (
    <div className="panel" style={{marginTop:14}}>
      <div className="panel-titulo">Validacion contra movimientos de Odoo (OVs surtidas y traslados)</div>
      <div style={{fontSize:12,color:'var(--text3)',marginBottom:10,lineHeight:1.5}}>
        Revisa, solo en lectura, que salio de las ubicaciones del conteo mientras se contaba: OVs surtidas, traslados entre
        ubicaciones, entradas y ajustes. Asi puedes saber si una diferencia se debe a un movimiento y no a un error de inventario.
      </div>
      {!m && <button className="btn-principal" disabled={cargando} onClick={cargar}>{cargando ? 'Consultando Odoo...' : 'Consultar movimientos en Odoo'}</button>}
      {m && (
        <>
          <div style={{fontSize:11,color:'var(--text3)',marginBottom:10}}>
            Ventana revisada: {m.ventana.desde} → {m.ventana.hasta} (UTC)
            {m.ventana.base_existencias ? ` · existencias base tomadas ${m.ventana.base_existencias}` : ''}
          </div>
          <div className="stats" style={{flexWrap:'wrap'}}>
            <Tarjeta titulo="Explicadas" valor={rs.explicada} color="var(--cs)" sub={`de ${rs.diferencias} diferencias`} />
            <Tarjeta titulo="En parte" valor={rs.parcial} color={rs.parcial ? 'var(--amarillo)' : undefined} />
            <Tarjeta titulo="Sin explicar" valor={rs.sin_explicar} color={rs.sin_explicar ? 'var(--rojo)' : undefined} sub="revisar fisicamente" />
            <Tarjeta titulo="OVs surtidas" valor={rs.ovs} sub={`${fmt(rs.unidades_ov)} unidades`} />
            <Tarjeta titulo="Traslados" valor={rs.traslados} sub={`${rs.otros_movimientos} entradas/ajustes`} />
          </div>
          <div className="no-print" style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',margin:'12px 0'}}>
            <div className="cm-toggle">
              {[['diferencias','Diferencias'],['ovs','OVs surtidas'],['traslados','Traslados'],['otros','Entradas / ajustes']].map(([k, l]) => (
                <span key={k} className={'cm-pill' + (ver === k ? ' on' : '')} onClick={() => setVer(k)}>{l}</span>
              ))}
            </div>
            {ver === 'diferencias' && (
              <label style={{fontSize:12}}><input type="checkbox" checked={soloPend} onChange={e => setSoloPend(e.target.checked)} /> Solo las no explicadas del todo</label>
            )}
            <div style={{flex:1}}></div>
            <button className="btn-sec" onClick={cargar} disabled={cargando}>{cargando ? 'Consultando...' : 'Actualizar'}</button>
            <button className="btn-sec" onClick={exportar}>CSV de validacion</button>
          </div>

          {ver === 'diferencias' && (difs.length === 0 ? <div className="vacio">Sin diferencias para mostrar.</div> : (
            <table className="tabla">
              <thead><tr><th>Ubicacion</th><th>Producto</th><th style={{textAlign:'right'}}>Diferencia</th><th style={{textAlign:'right'}}>Mov. Odoo</th><th style={{textAlign:'right'}}>Sin explicar</th><th>Estado y movimientos</th></tr></thead>
              <tbody>
                {difs.slice(0, 500).map((d, i) => (
                  <tr key={d.codigo + d.producto + i}>
                    <td style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:12}}>{d.codigo}</td>
                    <td><b>{d.producto}</b><div style={{fontSize:11,color:'var(--text3)'}}>{d.descripcion}</div></td>
                    <td style={{textAlign:'right',fontWeight:800,color: d.diferencia < 0 ? 'var(--rojo)' : 'var(--amarillo)'}}>{d.diferencia > 0 ? '+' : ''}{fmt(d.diferencia)}</td>
                    <td style={{textAlign:'right'}}>{d.movimiento_neto > 0 ? '+' : ''}{fmt(d.movimiento_neto)}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>{fmt(d.diferencia_sin_explicar)}</td>
                    <td style={{fontSize:11}}>
                      <span className={ESTADO_MOV[d.estado].cls}>{ESTADO_MOV[d.estado].txt}</span>
                      {d.movimientos.map((x, j) => (
                        <div key={j} style={{color:'var(--text3)',marginTop:2}}>
                          {x.tipo === 'OV' ? 'OV ' : x.tipo === 'traslado' ? 'Traslado ' : x.tipo === 'entrada' ? 'Entrada ' : 'Ajuste '}
                          <b>{x.documento}</b> · {x.cantidad > 0 ? '+' : ''}{fmt(x.cantidad)}{x.tipo === 'traslado' ? ` (${x.origen} → ${x.destino})` : ''} · {x.fecha}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

          {ver === 'ovs' && (m.ovs.length === 0 ? <div className="vacio">No se surtieron OVs desde estas ubicaciones durante el conteo.</div> : (
            <table className="tabla">
              <thead><tr><th>OV</th><th>Entrega</th><th>Cliente</th><th>Fecha</th><th>Detalle</th><th style={{textAlign:'right'}}>Uds</th></tr></thead>
              <tbody>
                {m.ovs.map((o, i) => (
                  <tr key={o.picking + i}>
                    <td style={{fontWeight:700}}>{o.ov || '—'}</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:12}}>{o.picking}</td>
                    <td style={{fontSize:12}}>{o.cliente}</td>
                    <td style={{fontSize:11}}>{o.fecha}</td>
                    <td style={{fontSize:11}}>{o.lineas.map((l, j) => <div key={j}><b>{l.producto}</b> × {fmt(l.cantidad)} · <span style={{fontFamily:'var(--mono)'}}>{l.ubicacion}</span></div>)}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>{fmt(o.unidades)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

          {ver === 'traslados' && (m.traslados.length === 0 ? <div className="vacio">No hubo traslados internos durante el conteo.</div> : (
            <table className="tabla">
              <thead><tr><th>Traslado</th><th>Fecha</th><th>Producto</th><th style={{textAlign:'right'}}>Cant.</th><th>Origen → Destino</th></tr></thead>
              <tbody>
                {m.traslados.map((t, i) => (
                  <tr key={i}>
                    <td style={{fontFamily:'var(--mono)',fontSize:12}}>{t.picking}</td><td style={{fontSize:11}}>{t.fecha}</td>
                    <td><b>{t.producto}</b><div style={{fontSize:11,color:'var(--text3)'}}>{t.descripcion}</div></td>
                    <td style={{textAlign:'right',fontWeight:700}}>{fmt(t.cantidad)}</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:12}}>{t.origen} → {t.destino}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

          {ver === 'otros' && (m.otros.length === 0 ? <div className="vacio">Sin entradas ni ajustes durante el conteo.</div> : (
            <table className="tabla">
              <thead><tr><th>Tipo</th><th>Documento</th><th>Fecha</th><th>Producto</th><th style={{textAlign:'right'}}>Cant.</th><th>Origen → Destino</th></tr></thead>
              <tbody>
                {m.otros.map((t, i) => (
                  <tr key={i}><td>{t.tipo}</td><td style={{fontFamily:'var(--mono)',fontSize:12}}>{t.documento}</td><td style={{fontSize:11}}>{t.fecha}</td>
                    <td><b>{t.producto}</b></td><td style={{textAlign:'right'}}>{fmt(t.cantidad)}</td><td style={{fontFamily:'var(--mono)',fontSize:12}}>{t.origen} → {t.destino}</td></tr>
                ))}
              </tbody>
            </table>
          ))}
        </>
      )}
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

      <div className="no-print"><ValidacionMovimientos id={id} toast={toast} /></div>

      <p style={{fontSize:11,color:'var(--text3)',marginTop:14,lineHeight:1.5}}>
        Este reporte no modifica Odoo. Los ajustes de inventario se hacen en Odoo a partir de las diferencias, idealmente despues de revisar las ubicaciones con diferencia.
      </p>
    </div>
  )
}
