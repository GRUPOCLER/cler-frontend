import { useState, useEffect, useRef } from 'react'
import * as api from './api.js'
import { Modal } from './App.jsx'

// ── MODAL: ASIGNAR PRODUCTO A UNA UBICACION ───────────────
function ModalAsignar({ ubicacion, onClose, onGuardado, toast }) {
  const [buscar, setBuscar] = useState('')
  const [resultados, setResultados] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [seleccionado, setSeleccionado] = useState(
    ubicacion.producto ? { clave: ubicacion.producto, nombre: ubicacion.producto_desc || '' } : null
  )
  const [stock, setStock] = useState(ubicacion.stock || 0)
  const [notas, setNotas] = useState(ubicacion.notas || '')
  const [guardando, setGuardando] = useState(false)
  const debounceRef = useRef()

  useEffect(() => {
    if (!buscar.trim()) { setResultados(null); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try { setResultados(await api.buscarProductosOdoo(buscar)) }
      catch (e) { toast(e.message, 'error') }
      finally { setBuscando(false) }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [buscar])

  const guardar = async () => {
    setGuardando(true)
    try {
      await api.asignarProductoUbicacion(ubicacion.codigo, {
        producto: seleccionado?.clave || '',
        producto_desc: seleccionado?.nombre || '',
        stock: parseInt(stock) || 0,
        notas
      })
      toast('Ubicacion actualizada', 'ok')
      onGuardado()
    } catch (e) { toast(e.message, 'error') }
    finally { setGuardando(false) }
  }

  const quitarAsignacion = async () => {
    setGuardando(true)
    try {
      await api.asignarProductoUbicacion(ubicacion.codigo, { producto: '', producto_desc: '', stock: 0, notas: '' })
      toast('Ubicacion liberada', 'ok')
      onGuardado()
    } catch (e) { toast(e.message, 'error') }
    finally { setGuardando(false) }
  }

  return (
    <Modal titulo={`Ubicacion ${ubicacion.codigo}`}
      sub={`${ubicacion.bodega || ''} · Rack ${ubicacion.rack || '-'} · Lado ${ubicacion.lado || '-'} · Tramo ${ubicacion.tramo ?? '-'} · Nivel ${ubicacion.nivel ?? '-'}`}
      onClose={onClose}
      footer={<>
        {ubicacion.producto && (
          <button className="btn-sec" style={{color:'var(--rojo)'}} onClick={quitarAsignacion} disabled={guardando}>Liberar ubicacion</button>
        )}
        <button className="btn-sec" onClick={onClose} disabled={guardando}>Cancelar</button>
        <button className="btn-principal" onClick={guardar} disabled={guardando || (!seleccionado && stock > 0)}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </>}>

      <label className="dim-label">Producto (buscar en Odoo)</label>
      {seleccionado ? (
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'var(--bg3)',borderRadius:8,marginBottom:12}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13}}>{seleccionado.clave}</div>
            <div style={{fontSize:12,color:'var(--text3)'}}>{seleccionado.nombre}</div>
          </div>
          <button className="btn-mini" onClick={() => { setSeleccionado(null); setBuscar('') }}>Cambiar</button>
        </div>
      ) : (
        <>
          <input className="inp" type="text" placeholder="Buscar por clave o nombre..."
            value={buscar} onChange={e => setBuscar(e.target.value)} style={{marginBottom:8}} autoFocus />
          {buscando && <div className="cargando" style={{fontSize:12}}>Buscando...</div>}
          {resultados && (
            resultados.length === 0 ? <div className="vacio" style={{fontSize:12}}>Sin resultados en Odoo.</div> : (
              <div className="lista-scroll" style={{maxHeight:180,marginBottom:12}}>
                {resultados.map(p => (
                  <div key={p.clave} className="fila-ov" onClick={() => { setSeleccionado(p); setResultados(null) }}>
                    <span className="ov-num">{p.clave}</span>
                    <span className="ov-cliente">{p.nombre}</span>
                    <span style={{fontSize:11,color:'var(--text3)'}}>Odoo: {p.existencia_odoo}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      <label className="dim-label">Existencia en esta ubicacion</label>
      <input className="inp" type="number" min="0" value={stock}
        onChange={e => setStock(e.target.value)} style={{marginBottom:12}} />

      <label className="dim-label">Notas (opcional)</label>
      <textarea className="inp" rows={2} value={notas} onChange={e => setNotas(e.target.value)} />
    </Modal>
  )
}

// ── PANEL PRINCIPAL ────────────────────────────────────────
export default function AlmacenPanel({ toast }) {
  const [conteo, setConteo] = useState(null)
  const [ubicaciones, setUbicaciones] = useState(null)
  const [buscar, setBuscar] = useState('')
  const [filtro, setFiltro] = useState('todas') // todas | libres | ocupadas
  const [modalUbicacion, setModalUbicacion] = useState(null)
  const debounceRef = useRef()

  const cargarConteo = () => api.contarUbicaciones().then(setConteo).catch(() => {})

  const cargarUbicaciones = () => {
    api.listarUbicaciones({
      buscar,
      soloLibres: filtro === 'libres',
      soloOcupadas: filtro === 'ocupadas'
    }).then(setUbicaciones).catch(e => toast(e.message, 'error'))
  }

  useEffect(() => { cargarConteo() }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(cargarUbicaciones, 300)
    return () => clearTimeout(debounceRef.current)
  }, [buscar, filtro])

  const cerrarModalYRecargar = () => {
    setModalUbicacion(null)
    cargarUbicaciones()
    cargarConteo()
  }

  return (
    <div className="contenedor">
      <div className="titulo-pag">Almacen</div>
      <div className="sub-pag">Ubicaciones del CEDIS Paso del Toro — asigna productos y su existencia por posicion</div>

      <div className="panel" style={{display:'flex',gap:20,marginBottom:16}}>
        <div>
          <div style={{fontSize:22,fontWeight:800}}>{conteo ? conteo.total : '…'}</div>
          <div style={{fontSize:12,color:'var(--text3)'}}>Ubicaciones totales</div>
        </div>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:'var(--rojo)'}}>{conteo ? conteo.ocupadas : '…'}</div>
          <div style={{fontSize:12,color:'var(--text3)'}}>Ocupadas</div>
        </div>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:'var(--cs)'}}>{conteo ? conteo.total - conteo.ocupadas : '…'}</div>
          <div style={{fontSize:12,color:'var(--text3)'}}>Libres</div>
        </div>
      </div>

      <div className="panel">
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
          <input className="inp" type="text" placeholder="Buscar por codigo, producto o bodega..."
            value={buscar} onChange={e => setBuscar(e.target.value)} style={{flex:1,minWidth:220}} />
          <div className="cm-toggle">
            <span className={'cm-pill' + (filtro === 'todas' ? ' on' : '')} onClick={() => setFiltro('todas')}>Todas</span>
            <span className={'cm-pill' + (filtro === 'libres' ? ' on' : '')} onClick={() => setFiltro('libres')}>Libres</span>
            <span className={'cm-pill' + (filtro === 'ocupadas' ? ' on' : '')} onClick={() => setFiltro('ocupadas')}>Ocupadas</span>
          </div>
        </div>

        {!ubicaciones ? <div className="cargando">Cargando...</div>
          : ubicaciones.length === 0 ? <div className="vacio">Sin resultados.</div> : (
          <table className="tabla">
            <thead><tr><th>Codigo</th><th>Bodega</th><th>Producto</th><th>Existencia</th><th>Zona</th><th></th></tr></thead>
            <tbody>
              {ubicaciones.map(u => (
                <tr key={u.codigo} style={{cursor:'pointer'}} onClick={() => setModalUbicacion(u)}>
                  <td style={{fontWeight:700,fontFamily:'var(--mono)',fontSize:12}}>{u.codigo}</td>
                  <td>{u.bodega}</td>
                  <td>
                    {u.producto ? (
                      <div>
                        <div style={{fontWeight:700}}>{u.producto}</div>
                        <div style={{fontSize:11,color:'var(--text3)'}}>{u.producto_desc}</div>
                      </div>
                    ) : <span style={{color:'var(--text3)'}}>Libre</span>}
                  </td>
                  <td>{u.producto ? u.stock : '—'}</td>
                  <td><span className="chip chip-warn">{u.zona}</span></td>
                  <td><button className="btn-mini">{u.producto ? 'Editar' : 'Asignar'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {ubicaciones && ubicaciones.length === 200 && (
          <div style={{fontSize:12,color:'var(--text3)',marginTop:10}}>Mostrando los primeros 200 — afina la busqueda para ver mas resultados especificos.</div>
        )}
      </div>

      {modalUbicacion && (
        <ModalAsignar ubicacion={modalUbicacion} toast={toast}
          onClose={() => setModalUbicacion(null)} onGuardado={cerrarModalYRecargar} />
      )}
    </div>
  )
}
