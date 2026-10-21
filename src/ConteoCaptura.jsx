import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as api from './api.js'
import { Modal } from './App.jsx'

const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })

export default function ConteoCaptura({ toast }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const rol = api.getUser()?.rol
  const gestor = rol === 'admin' || rol === 'gerente'

  const [conteo, setConteo] = useState(null)
  const [codigo, setCodigo] = useState('')
  const [ubic, setUbic] = useState(null)          // ubicacion cargada
  const [filas, setFilas] = useState([])          // [{producto, descripcion, esperado, valor, inesperado}]
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [siguiente, setSiguiente] = useState(null)
  const [verPendientes, setVerPendientes] = useState(false)
  const [pendientes, setPendientes] = useState(null)
  const [modalProducto, setModalProducto] = useState(false)
  const [modalCerrar, setModalCerrar] = useState(false)
  const scanRef = useRef()
  const inputsRef = useRef([])

  const cargarConteo = () => api.detalleConteo(id).then(setConteo).catch(e => { toast(e.message, 'error'); navigate('/almacen/conteo') })
  const cargarSiguiente = () => api.ubicacionesConteo(id, { estado: 'pendiente', limite: 1 })
    .then(r => setSiguiente(r[0]?.codigo || null)).catch(() => {})

  useEffect(() => { cargarConteo(); cargarSiguiente() }, [id])
  useEffect(() => { if (!ubic) scanRef.current?.focus() }, [ubic])

  const abrirUbicacion = async (cod) => {
    const limpio = (cod || '').trim().toUpperCase()
    if (!limpio) return
    try {
      const u = await api.verUbicacionConteo(id, limpio)
      setUbic(u)
      setNota(u.nota || '')
      setFilas(u.lineas.map(l => ({
        producto: l.producto, descripcion: l.descripcion, esperado: l.esperado, inesperado: l.inesperado,
        valor: l.contado === null || l.contado === undefined ? '' : String(l.contado)
      })))
      setCodigo('')
      setVerPendientes(false)
      setTimeout(() => inputsRef.current[0]?.focus(), 50)
    } catch (e) {
      toast(e.message, 'error')
      setCodigo('')
      scanRef.current?.focus()
    }
  }

  const setValor = (i, v) => setFilas(fs => fs.map((f, k) => k === i ? { ...f, valor: v } : f))
  const quitarFila = (i) => setFilas(fs => fs.filter((_, k) => k !== i))
  const ubicacionVacia = () => setFilas(fs => fs.filter(f => !f.inesperado).map(f => ({ ...f, valor: '0' })))

  const agregarProducto = (p) => {
    if (filas.some(f => f.producto === p.clave)) { toast('Ese producto ya esta en la lista', 'error'); return }
    setFilas(fs => [...fs, { producto: p.clave, descripcion: p.nombre, esperado: null, inesperado: true, valor: '' }])
    setModalProducto(false)
    setTimeout(() => inputsRef.current[filas.length]?.focus(), 80)
  }

  const guardar = async () => {
    if (guardando) return
    const sinValor = filas.filter(f => f.valor === '' || isNaN(Number(f.valor)))
    if (sinValor.length) { toast('Captura la cantidad de: ' + sinValor.map(f => f.producto).join(', ') + ' (0 si no hay)', 'error'); return }
    if (filas.some(f => Number(f.valor) < 0)) { toast('Las cantidades no pueden ser negativas', 'error'); return }
    setGuardando(true)
    try {
      const r = await api.capturarUbicacionConteo(id, ubic.codigo, {
        lineas: filas.map(f => ({ producto: f.producto, descripcion: f.descripcion, contado: Number(f.valor) })),
        nota
      })
      toast(`Ubicacion ${ubic.codigo} guardada — ${r.progreso.contadas}/${r.progreso.ubicaciones}`, 'ok')
      setConteo(c => ({ ...c, progreso: r.progreso }))
      setUbic(null); setFilas([]); setNota('')
      cargarSiguiente()
    } catch (e) { toast(e.message, 'error') }
    finally { setGuardando(false) }
  }

  const onEnterFila = (e, i) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (i < filas.length - 1) inputsRef.current[i + 1]?.focus()
    else guardar()
  }

  const togglePendientes = async () => {
    const nuevo = !verPendientes
    setVerPendientes(nuevo)
    if (nuevo) {
      try { setPendientes(await api.ubicacionesConteo(id, { estado: 'pendiente', limite: 100 })) }
      catch (e) { toast(e.message, 'error') }
    }
  }

  const cerrar = async () => {
    try { await api.cerrarConteo(id); toast('Conteo cerrado', 'ok'); navigate(`/almacen/conteo/${id}/reporte`) }
    catch (e) { toast(e.message, 'error') }
  }

  if (!conteo) return <div className="cargando">Cargando conteo...</div>
  const p = conteo.progreso
  const cerrado = conteo.estatus === 'cerrado'

  return (
    <div className="contenedor">
      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:12}}>
        <button className="btn-sec" onClick={() => navigate('/almacen/conteo')}>← Conteos</button>
        <div style={{flex:1,minWidth:200}}>
          <div className="titulo-pag" style={{marginBottom:0}}>{conteo.nombre}</div>
          <div className="sub-pag">{conteo.alcance}{conteo.ciego ? ' · conteo a ciegas' : ''}</div>
        </div>
        {gestor && <button className="btn-sec" onClick={() => navigate(`/almacen/conteo/${id}/reporte`)}>Reporte</button>}
        {gestor && !cerrado && <button className="btn-sec" style={{color:'var(--rojo)'}} onClick={() => setModalCerrar(true)}>Cerrar conteo</button>}
      </div>

      <div className="panel" style={{marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6}}>
          <span><b>{p.contadas}</b> de <b>{p.ubicaciones}</b> ubicaciones contadas</span>
          <span style={{color:'var(--text3)'}}>{p.pct}% · faltan {p.pendientes}</span>
        </div>
        <div style={{height:8,background:'var(--bg3)',borderRadius:5,overflow:'hidden'}}>
          <div style={{width:`${p.pct}%`,height:'100%',background:'var(--cs)'}}></div>
        </div>
      </div>

      {cerrado ? (
        <div className="panel vacio">Este conteo esta cerrado. {gestor ? 'Consulta el reporte.' : ''}</div>
      ) : !ubic ? (
        <div className="panel">
          <label className="dim-label">Escanea o escribe la ubicacion</label>
          <div style={{display:'flex',gap:8,marginBottom:10}}>
            <input ref={scanRef} className="inp" style={{flex:1,fontSize:18,fontFamily:'var(--mono)'}} type="text"
              autoCapitalize="characters" autoComplete="off" placeholder="Ej. ADISR1AC01N01"
              value={codigo} onChange={e => setCodigo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') abrirUbicacion(codigo) }} />
            <button className="btn-principal" onClick={() => abrirUbicacion(codigo)} disabled={!codigo.trim()}>Abrir</button>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            {siguiente && <button className="btn-sec" onClick={() => abrirUbicacion(siguiente)}>Siguiente pendiente: <b style={{fontFamily:'var(--mono)'}}>{siguiente}</b></button>}
            <button className="btn-mini" onClick={togglePendientes}>{verPendientes ? 'Ocultar pendientes' : 'Ver pendientes'}</button>
          </div>
          {verPendientes && (
            <div className="lista-scroll" style={{marginTop:12,maxHeight:260}}>
              {!pendientes ? <div className="cargando">Cargando...</div>
                : pendientes.length === 0 ? <div className="vacio">No quedan ubicaciones pendientes.</div>
                : pendientes.map(u => (
                  <div key={u.codigo} className="fila-ov" onClick={() => abrirUbicacion(u.codigo)}>
                    <span className="ov-num" style={{fontFamily:'var(--mono)'}}>{u.codigo}</span>
                    <span className="ov-cliente">{u.bodega} · {u.zona}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="panel">
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:10}}>
            <div style={{fontFamily:'var(--mono)',fontWeight:800,fontSize:20}}>{ubic.codigo}</div>
            <span className="chip chip-warn">{ubic.bodega} · {ubic.zona}</span>
            {ubic.estado === 'contada' && <span className="chip chip-ok">Ya contada — se esta recontando</span>}
            <div style={{flex:1}}></div>
            <button className="btn-mini" onClick={() => { setUbic(null); setFilas([]) }}>Cancelar</button>
          </div>

          {filas.length === 0 && (
            <div className="vacio" style={{marginBottom:10}}>
              El sistema no tiene producto en esta ubicacion. Si encuentras algo, agregalo; si esta vacia, guarda sin productos.
            </div>
          )}

          {filas.length > 0 && (
            <table className="tabla" style={{marginBottom:10}}>
              <thead><tr>
                <th>Producto</th>
                {!ubic.ciego && <th style={{textAlign:'right'}}>Sistema</th>}
                <th style={{textAlign:'right',width:130}}>Contado</th><th></th>
              </tr></thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={f.producto}>
                    <td>
                      <div style={{fontWeight:700}}>{f.producto} {f.inesperado && <span className="chip chip-warn" style={{marginLeft:4}}>no esperado</span>}</div>
                      <div style={{fontSize:11,color:'var(--text3)'}}>{f.descripcion}</div>
                    </td>
                    {!ubic.ciego && <td style={{textAlign:'right'}}>{f.esperado === null ? '—' : fmt(f.esperado)}</td>}
                    <td style={{textAlign:'right'}}>
                      <input ref={el => inputsRef.current[i] = el} className="inp" type="number" inputMode="decimal" min="0" step="1"
                        style={{width:110,textAlign:'right',fontSize:16}} value={f.valor}
                        onChange={e => setValor(i, e.target.value)} onKeyDown={e => onEnterFila(e, i)} />
                    </td>
                    <td>{f.inesperado && <button className="btn-quitar-mini" onClick={() => quitarFila(i)}>✕</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
            <button className="btn-sec" onClick={() => setModalProducto(true)}>+ Producto que no estaba en el sistema</button>
            {filas.some(f => !f.inesperado) && <button className="btn-sec" onClick={ubicacionVacia}>Ubicacion vacia (todo en 0)</button>}
          </div>
          <input className="inp" style={{marginBottom:12}} placeholder="Nota de esta ubicacion (opcional) — ej. producto danado, caja abierta"
            value={nota} onChange={e => setNota(e.target.value)} />
          <button className="btn-principal" style={{width:'100%',padding:'14px 0',fontSize:16}} onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar ubicacion'}
          </button>
        </div>
      )}

      {modalProducto && <ModalBuscarProducto toast={toast} onClose={() => setModalProducto(false)} onElegir={agregarProducto} />}
      {modalCerrar && (
        <Modal titulo="Cerrar conteo" sub={`${p.pendientes} ubicacion(es) siguen pendientes`} onClose={() => setModalCerrar(false)}
          footer={<>
            <button className="btn-sec" onClick={() => setModalCerrar(false)}>Cancelar</button>
            <button className="btn-principal" style={{background:'var(--rojo)',color:'#fff'}} onClick={cerrar}>Cerrar conteo</button>
          </>}>
          <p style={{fontSize:13,lineHeight:1.5,color:'var(--text2)'}}>
            Al cerrarlo ya no se podra capturar. Las ubicaciones pendientes no entran en el reporte de diferencias.
          </p>
        </Modal>
      )}
    </div>
  )
}

function ModalBuscarProducto({ toast, onClose, onElegir }) {
  const [texto, setTexto] = useState('')
  const [res, setRes] = useState(null)
  const [buscando, setBuscando] = useState(false)
  useEffect(() => {
    if (texto.trim().length < 2) { setRes(null); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      try { setRes(await api.buscarProductosOdoo(texto.trim())) }
      catch (e) { toast(e.message, 'error') }
      finally { setBuscando(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [texto])
  return (
    <Modal titulo="Agregar producto" sub="Busca en Odoo el producto que encontraste en esta ubicacion" onClose={onClose}
      footer={<button className="btn-sec" onClick={onClose}>Cancelar</button>}>
      <input className="inp" autoFocus placeholder="Clave o nombre..." value={texto} onChange={e => setTexto(e.target.value)} />
      {buscando && <div className="cargando" style={{fontSize:12,padding:'8px 0'}}>Buscando...</div>}
      {res && (res.length === 0
        ? <div className="vacio" style={{fontSize:12,paddingTop:10}}>Sin resultados.</div>
        : <div className="lista-scroll" style={{marginTop:10,maxHeight:240}}>
            {res.map(p => (
              <div key={p.clave} className="fila-ov" onClick={() => onElegir(p)}>
                <span className="ov-num">{p.clave}</span><span className="ov-cliente">{p.nombre}</span>
              </div>
            ))}
          </div>)}
    </Modal>
  )
}
