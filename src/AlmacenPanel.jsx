import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from './api.js'
import { Modal } from './App.jsx'

const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })

// ── MODAL: DETALLE DE UNA UBICACION (solo lectura — se administra en Odoo) ──
export function ModalUbicacion({ ubicacion, onClose }) {
  const prods = ubicacion.productos || []
  return (
    <Modal titulo={`Ubicacion ${ubicacion.codigo}`}
      sub={`${ubicacion.bodega || ''} · Zona ${ubicacion.zona || '-'} · Rack ${ubicacion.rack || '-'} · Lado ${ubicacion.lado || '-'} · Tramo ${ubicacion.tramo ?? '-'} · Nivel ${ubicacion.nivel ?? '-'}`}
      onClose={onClose}
      footer={<button className="btn-sec" onClick={onClose}>Cerrar</button>}>
      {prods.length === 0 ? (
        <div className="vacio">Sin existencia en esta ubicacion.</div>
      ) : (
        <table className="tabla">
          <thead><tr><th>Producto</th><th style={{textAlign:'right'}}>Existencia</th><th style={{textAlign:'right'}}>Reservado</th></tr></thead>
          <tbody>
            {prods.map(p => (
              <tr key={p.clave}>
                <td><div style={{fontWeight:700}}>{p.clave}</div><div style={{fontSize:11,color:'var(--text3)'}}>{p.descripcion}</div></td>
                <td style={{textAlign:'right'}}>{fmt(p.cantidad)}</td>
                <td style={{textAlign:'right'}}>{fmt(p.reservado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{fontSize:11,color:'var(--text3)',marginTop:12,lineHeight:1.5}}>
        Las ubicaciones y existencias se administran en Odoo; aqui solo se consultan.
      </p>
    </Modal>
  )
}

// ── BUSCADOR DE PRODUCTO: donde esta y como esta distribuido ──
export function BuscadorProducto({ toast, seleccionado, onSeleccionar, onVerMapa, onFiltrar, filtrando }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const debounceRef = useRef()

  useEffect(() => {
    if (texto.trim().length < 2) { setResultados(null); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try { setResultados(await api.buscarProductoAlmacen(texto.trim())) }
      catch (e) { toast(e.message, 'error') }
      finally { setBuscando(false) }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [texto])

  const elegir = (p) => { onSeleccionar(p); setResultados(null); setTexto('') }

  return (
    <div className="panel" style={{marginBottom:16}}>
      <div className="panel-titulo">Buscar equipo o producto</div>
      <input className="inp" type="text" placeholder="Clave o nombre — ej. tractor, 5 pulgadas, TR-100..."
        value={texto} onChange={e => setTexto(e.target.value)} />
      {buscando && <div className="cargando" style={{fontSize:12,padding:'8px 0'}}>Buscando...</div>}
      {resultados && (
        resultados.length === 0
          ? <div className="vacio" style={{fontSize:12,padding:'10px 0 0'}}>Sin existencias con ese nombre o clave.</div>
          : (
            <div className="lista-scroll" style={{marginTop:10,maxHeight:220}}>
              {resultados.map(p => (
                <div key={p.clave} className="fila-ov" onClick={() => elegir(p)}>
                  <span className="ov-num">{p.clave}</span>
                  <span className="ov-cliente">{p.descripcion}</span>
                  <span className="chip chip-ok">{fmt(p.total)} pzas · {p.ubicaciones} ubic.</span>
                </div>
              ))}
            </div>
          )
      )}

      {seleccionado && (
        <div style={{marginTop:14,padding:12,background:'var(--bg3)',borderRadius:10}}>
          <div style={{display:'flex',gap:10,alignItems:'flex-start',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:200}}>
              <div style={{fontWeight:800,fontSize:14}}>{seleccionado.clave}</div>
              <div style={{fontSize:12,color:'var(--text3)'}}>{seleccionado.descripcion}</div>
              <div style={{fontSize:13,marginTop:6}}>
                <b>{fmt(seleccionado.total)}</b> en total · <b>{seleccionado.ubicaciones}</b> ubicacion(es)
              </div>
            </div>
            {onVerMapa && <button className="btn-principal" onClick={() => onVerMapa(seleccionado)}>Ver en el mapa</button>}
            {onFiltrar && (
              <button className="btn-sec" onClick={() => onFiltrar(seleccionado)}>
                {filtrando ? 'Filtrando el listado' : 'Filtrar el listado'}
              </button>
            )}
            <button className="btn-mini" onClick={() => onSeleccionar(null)}>Quitar</button>
          </div>
          <table className="tabla" style={{marginTop:10}}>
            <thead><tr><th>Ubicacion</th><th>Bodega</th><th>Zona</th><th style={{textAlign:'right'}}>Existencia</th></tr></thead>
            <tbody>
              {seleccionado.distribucion.map(d => (
                <tr key={d.codigo}>
                  <td style={{fontWeight:700,fontFamily:'var(--mono)',fontSize:12}}>
                    {d.codigo}{!d.en_mapa && <span title="Esta ubicacion existe en Odoo pero no esta dibujada en el mapa" style={{color:'var(--rojo)'}}> ⚠</span>}
                  </td>
                  <td>{d.bodega || '—'}</td>
                  <td>{d.zona || '—'}</td>
                  <td style={{textAlign:'right',fontWeight:700}}>{fmt(d.cantidad)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── IMPORTAR LAYOUT (solo admin) ───────────────────────────
function ImportarLayout({ toast, onListo }) {
  const [archivo, setArchivo] = useState(null)
  const [info, setInfo] = useState(null)       // { elementos, version, nombre }
  const [reemplazar, setReemplazar] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [abierto, setAbierto] = useState(false)

  const elegir = async (f) => {
    setArchivo(null); setInfo(null)
    if (!f) return
    try {
      const data = JSON.parse(await f.text())
      const n = Array.isArray(data.elements) ? data.elements.length : 0
      if (!n) { toast('El archivo no trae "elements": no parece un layout valido', 'error'); return }
      setArchivo(f)
      setInfo({ elementos: n, version: data.version || '', nombre: data.sheet_name || f.name })
    } catch { toast('El archivo no es un JSON valido', 'error') }
  }

  const importar = async () => {
    const aviso = reemplazar
      ? `Se importaran ${info.elementos} ubicaciones y SE BORRARAN las que ya existen y no vienen en este archivo. ¿Continuar?`
      : `Se importaran ${info.elementos} ubicaciones (se agregan las nuevas y se actualizan las existentes). ¿Continuar?`
    if (!window.confirm(aviso)) return
    setSubiendo(true)
    try {
      const r = await api.importarLayoutAlmacen(archivo, reemplazar)
      toast(`Layout importado: ${r.insertados} nuevas, ${r.actualizados} actualizadas, ${r.eliminados} eliminadas`, 'ok')
      setArchivo(null); setInfo(null); setReemplazar(false)
      onListo()
    } catch (e) { toast(e.message, 'error') }
    finally { setSubiendo(false) }
  }

  return (
    <div className="panel" style={{marginBottom:16}}>
      <div style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={() => setAbierto(a => !a)}>
        <div style={{fontWeight:700}}>Importar mapa / layout</div>
        <div style={{fontSize:12,color:'var(--text3)'}}>Solo administrador · {abierto ? 'ocultar' : 'mostrar'}</div>
      </div>
      {abierto && (
        <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:10,fontSize:13}}>
          <div style={{fontSize:12,color:'var(--text3)',lineHeight:1.5}}>
            Sube el archivo JSON del mapa (ej. <b>layout_cedis_v2.json</b>). Despues presiona
            "Actualizar existencias desde Odoo" para ver el stock en las ubicaciones nuevas.
          </div>
          <input type="file" accept=".json,application/json" onChange={e => elegir(e.target.files[0])} />
          {info && (
            <div style={{fontSize:12}}>
              <b>{info.nombre}</b>{info.version ? ` · ${info.version}` : ''} · {info.elementos} elementos
            </div>
          )}
          <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12}}>
            <input type="checkbox" checked={reemplazar} onChange={e => setReemplazar(e.target.checked)} />
            Reemplazar: borrar las ubicaciones que no vengan en este archivo
          </label>
          <div>
            <button className="btn-principal" onClick={importar} disabled={!archivo || subiendo}>
              {subiendo ? 'Importando...' : 'Importar layout'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PANEL PRINCIPAL ────────────────────────────────────────
export default function AlmacenPanel({ toast }) {
  const navigate = useNavigate()
  const rol = api.getUser()?.rol
  const puedeSincronizar = rol === 'admin' || rol === 'gerente'
  const esAdmin = rol === 'admin'
  const [conteo, setConteo] = useState(null)
  const [sync, setSync] = useState(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [ubicaciones, setUbicaciones] = useState(null)
  const [buscar, setBuscar] = useState('')
  const [filtro, setFiltro] = useState('todas') // todas | libres | ocupadas
  const [bodega, setBodega] = useState('')
  const [zona, setZona] = useState('')
  const [producto, setProducto] = useState(null)       // producto elegido en el buscador
  const [filtrarPorProducto, setFiltrarPorProducto] = useState(false)
  const [modalUbicacion, setModalUbicacion] = useState(null)
  const [exportando, setExportando] = useState(false)
  const debounceRef = useRef()

  const cargarConteo = () => api.contarUbicaciones().then(setConteo).catch(() => {})
  const cargarSync = () => api.estadoSyncAlmacen().then(setSync).catch(() => {})

  const sincronizar = async () => {
    setSincronizando(true)
    try {
      const r = await api.sincronizarAlmacen()
      toast(`Existencias actualizadas desde Odoo: ${r.productos} productos en ${r.ubicaciones} ubicaciones`, 'ok')
      cargarSync(); cargarConteo(); cargarUbicaciones()
      if (producto) api.buscarProductoAlmacen(producto.clave).then(rs => setProducto(rs.find(x => x.clave === producto.clave) || null)).catch(() => {})
    } catch (e) { toast(e.message, 'error') }
    finally { setSincronizando(false) }
  }

  const exportarCSV = async () => {
    setExportando(true)
    try { await api.exportarUbicacionesCSV({ bodega, zona, producto: filtrarPorProducto && producto ? producto.clave : '' }) }
    catch (e) { toast(e.message, 'error') }
    finally { setExportando(false) }
  }

  const cargarUbicaciones = () => {
    api.listarUbicaciones({
      buscar, bodega, zona,
      producto: filtrarPorProducto && producto ? producto.clave : '',
      soloLibres: filtro === 'libres',
      soloOcupadas: filtro === 'ocupadas'
    }).then(setUbicaciones).catch(e => toast(e.message, 'error'))
  }

  useEffect(() => { cargarConteo(); cargarSync() }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(cargarUbicaciones, 300)
    return () => clearTimeout(debounceRef.current)
  }, [buscar, filtro, bodega, zona, producto, filtrarPorProducto])

  const elegirProducto = (p) => { setProducto(p); if (!p) setFiltrarPorProducto(false) }
  const hayFiltros = bodega || zona || buscar || filtro !== 'todas' || filtrarPorProducto

  return (
    <div className="contenedor">
      <div className="titulo-pag">Almacen</div>
      <div className="sub-pag">Ubicaciones y existencias del CEDIS Paso del Toro — la informacion viene de Odoo</div>

      <div className="panel" style={{display:'flex',gap:20,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:22,fontWeight:800}}>{conteo ? conteo.total : '…'}</div>
          <div style={{fontSize:12,color:'var(--text3)'}}>Ubicaciones totales</div>
        </div>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:'var(--rojo)'}}>{conteo ? conteo.ocupadas : '…'}</div>
          <div style={{fontSize:12,color:'var(--text3)'}}>Con existencia</div>
        </div>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:'var(--cs)'}}>{conteo ? conteo.total - conteo.ocupadas : '…'}</div>
          <div style={{fontSize:12,color:'var(--text3)'}}>Libres</div>
        </div>
        <div style={{marginLeft:'auto',textAlign:'right'}}>
          <div style={{fontSize:12,color:'var(--text3)',marginBottom:6}}>
            {sync?.sincronizado ? `Existencias al ${api.formatearFecha(sync.fecha)} · ${sync.productos} productos` : 'Aun no se han traido las existencias de Odoo'}
          </div>
          {puedeSincronizar && (
            <button className="btn-principal" onClick={sincronizar} disabled={sincronizando}>
              {sincronizando ? 'Actualizando desde Odoo...' : 'Actualizar existencias desde Odoo'}
            </button>
          )}
        </div>
      </div>

      {esAdmin && <ImportarLayout toast={toast} onListo={() => { cargarConteo(); cargarSync(); cargarUbicaciones() }} />}

      {sync?.sincronizado && sync.sin_mapa > 0 && (
        <div className="panel" style={{marginBottom:16,borderLeft:'3px solid var(--rojo)',fontSize:12,lineHeight:1.5}}>
          <b>{sync.sin_mapa}</b> ubicacion(es) de Odoo con existencia no estan dibujadas en el mapa. Ejemplos: {sync.ejemplos_sin_mapa}
        </div>
      )}

      <BuscadorProducto toast={toast} seleccionado={producto} onSeleccionar={elegirProducto}
        filtrando={filtrarPorProducto}
        onVerMapa={(p) => navigate('/almacen/mapa?producto=' + encodeURIComponent(p.clave))}
        onFiltrar={() => setFiltrarPorProducto(f => !f)} />

      <div className="panel">
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
          <input className="inp" type="text" placeholder="Buscar por codigo de ubicacion o producto..."
            value={buscar} onChange={e => setBuscar(e.target.value)} style={{flex:1,minWidth:200}} />
          <select className="inp" value={bodega} onChange={e => setBodega(e.target.value)} style={{width:150}}>
            <option value="">Todas las bodegas</option>
            <option value="Bodega 01">Bodega 01 (ADIS)</option>
            <option value="Embarques">Embarques</option>
            <option value="Bodega 02">Bodega 02</option>
            <option value="Bodega 03">Bodega 03</option>
            <option value="Bodega 04">Bodega 04</option>
            <option value="Patio">Patio</option>
          </select>
          <select className="inp" value={zona} onChange={e => setZona(e.target.value)} style={{width:130}}>
            <option value="">Todas las zonas</option>
            <option value="ORO">Zona Oro</option>
            <option value="PLATA">Zona Plata</option>
            <option value="BRONCE">Zona Bronce</option>
          </select>
          <button className="btn-sec" onClick={() => navigate('/almacen/mapa')}>Ver mapa completo →</button>
          <button className="btn-sec" onClick={() => navigate('/almacen/conteo')}>Conteo de inventario →</button>
          <button className="btn-sec" onClick={exportarCSV} disabled={exportando}>
            {exportando ? 'Exportando...' : 'Exportar CSV'}
          </button>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
          <div className="cm-toggle">
            <span className={'cm-pill' + (filtro === 'todas' ? ' on' : '')} onClick={() => setFiltro('todas')}>Todas</span>
            <span className={'cm-pill' + (filtro === 'ocupadas' ? ' on' : '')} onClick={() => setFiltro('ocupadas')}>Con existencia</span>
            <span className={'cm-pill' + (filtro === 'libres' ? ' on' : '')} onClick={() => setFiltro('libres')}>Libres</span>
          </div>
          {filtrarPorProducto && producto && <span className="chip chip-ok">Solo donde hay {producto.clave}</span>}
          {hayFiltros && (
            <button className="btn-mini" onClick={() => { setBuscar(''); setBodega(''); setZona(''); setFiltro('todas'); setFiltrarPorProducto(false) }}>
              Limpiar filtros
            </button>
          )}
        </div>

        {!ubicaciones ? <div className="cargando">Cargando...</div>
          : ubicaciones.length === 0 ? <div className="vacio">Sin resultados.</div> : (
          <table className="tabla">
            <thead><tr><th>Ubicacion</th><th>Bodega</th><th>Producto(s)</th><th style={{textAlign:'right'}}>Existencia</th><th>Zona</th></tr></thead>
            <tbody>
              {ubicaciones.map(u => (
                <tr key={u.codigo} style={{cursor:'pointer'}} onClick={() => setModalUbicacion(u)}>
                  <td style={{fontWeight:700,fontFamily:'var(--mono)',fontSize:12}}>{u.codigo}</td>
                  <td>{u.bodega}</td>
                  <td>
                    {u.productos.length ? u.productos.map(p => (
                      <div key={p.clave} style={{marginBottom:2}}>
                        <span style={{fontWeight:700}}>{p.clave}</span>{' '}
                        <span style={{fontSize:11,color:'var(--text3)'}}>{p.descripcion}</span>
                      </div>
                    )) : <span style={{color:'var(--text3)'}}>Libre</span>}
                  </td>
                  <td style={{textAlign:'right'}}>{u.productos.length ? fmt(u.stock) : '—'}</td>
                  <td><span className="chip chip-warn">{u.zona}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {ubicaciones && ubicaciones.length === 300 && (
          <div style={{fontSize:12,color:'var(--text3)',marginTop:10}}>Mostrando los primeros 300 — afina la busqueda o el filtro para ver otros.</div>
        )}
      </div>

      {modalUbicacion && <ModalUbicacion ubicacion={modalUbicacion} onClose={() => setModalUbicacion(null)} />}
    </div>
  )
}