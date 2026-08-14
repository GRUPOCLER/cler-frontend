import { useState, useEffect, useRef } from 'react'
import * as api from './api.js'
import Etiquetas from './Etiquetas.jsx'

// ── TOAST ────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState(null)
  const show = (texto, tipo = 'ok') => {
    setMsg({ texto, tipo })
    setTimeout(() => setMsg(null), 3200)
  }
  const Toast = () => msg
    ? <div className={'toast ' + msg.tipo}>{msg.texto}</div>
    : null
  return [show, Toast]
}

// ── LOGIN ────────────────────────────────────────────────
function Login({ onOk }) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const entrar = async (e) => {
    e.preventDefault()
    setError(''); setCargando(true)
    try {
      await api.login(usuario, password)
      onOk()
    } catch (err) {
      setError(err.message)
    } finally { setCargando(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-marca">GRUPO<span>CLER</span></div>
        <div className="login-sub">Sistema operativo de almacen</div>
        <form className="login-form" onSubmit={entrar}>
          <input className="inp" placeholder="Usuario" value={usuario}
            onChange={e => setUsuario(e.target.value)} autoFocus />
          <input className="inp" type="password" placeholder="Contrasena"
            value={password} onChange={e => setPassword(e.target.value)} />
          {error && <div className="login-error">{error}</div>}
          <button className="btn-principal" disabled={cargando || !usuario || !password}>
            {cargando ? 'Verificando...' : 'Iniciar sesion'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── DASHBOARD ────────────────────────────────────────────
function Dashboard({ irDetalle }) {
  const [stats, setStats] = useState(null)
  const [entregas, setEntregas] = useState(null)

  useEffect(() => {
    api.getDashboard().then(setStats).catch(() => setStats({}))
    api.listarEntregas('limite=25').then(setEntregas).catch(() => setEntregas([]))
  }, [])

  return (
    <div className="contenedor">
      <div className="titulo-pag">Pulso del almacen</div>
      <div className="sub-pag">Actividad y entregas recientes</div>

      <div className="stats">
        <div className="stat">
          <div className="stat-num">{stats ? stats.total_entregas ?? 0 : '—'}</div>
          <div className="stat-label">Entregas totales</div>
        </div>
        <div className="stat">
          <div className="stat-num">{stats ? stats.total_piezas ?? 0 : '—'}</div>
          <div className="stat-label">Piezas procesadas</div>
        </div>
        <div className="stat">
          <div className="stat-num">{stats ? stats.entregas_mes ?? 0 : '—'}</div>
          <div className="stat-label">Entregas este mes</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-titulo">Entregas recientes</div>
        {!entregas ? <div className="cargando">Cargando...</div>
          : entregas.length === 0 ? <div className="vacio">Sin entregas todavia. Crea la primera desde Nueva entrega.</div>
          : (
          <table className="tabla">
            <thead><tr>
              <th>Folio</th><th>Sistema</th><th>Cliente</th><th>Fecha</th><th>Estatus</th>
            </tr></thead>
            <tbody>
              {entregas.map(e => (
                <tr key={e.id_entrega} onClick={() => irDetalle(e.id_entrega)}>
                  <td style={{fontFamily:'var(--mono)',fontWeight:700}}>{e.num_entrega}</td>
                  <td><span className={'badge-sistema badge-' + e.sistema}>{e.sistema}</span></td>
                  <td>{e.nombre_cliente || '—'}</td>
                  <td style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--text3)'}}>
                    {(e.fecha_creacion || '').substring(0, 10)}</td>
                  <td><span className={'badge-estatus badge-' + e.estatus}>{e.estatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── NUEVA ENTREGA (unificada TAR / CS / MIX) ─────────────
const SISTEMAS = [
  { cod: 'TAR', nombre: 'Tarimas',      desc: 'Embarque en tarimas completas con cierre por categoria.',        color: 'var(--tar)' },
  { cod: 'CS',  nombre: 'Carga suelta', desc: 'Piezas individuales o cajas master con etiquetado unitario.',    color: 'var(--cs)' },
  { cod: 'MIX', nombre: 'OV mixta',     desc: 'Una orden con tarimas y carga suelta en el mismo embarque.',     color: 'var(--mix)' },
]

function NuevaEntrega({ toast, irDetalle }) {
  const [sistema, setSistema] = useState('CS')
  const [odoo, setOdoo] = useState({ activa: false, usuario: '' })
  const [ovs, setOvs] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    api.odooSesion().then(s => {
      setOdoo(s)
      if (s.activa) api.odooListarOVs().then(setOvs).catch(() => setOvs([]))
    })
  }, [])

  const importarOdoo = async (ov) => {
    try {
      toast('Cargando ' + ov.num_ov + ' desde Odoo...')
      const datos = await api.odooCargarEntrega(ov.picking_ids)
      const res = await api.crearEntrega({ ...datos, sistema, fuente: 'odoo' })
      toast(datos.productos.length + ' productos importados', 'ok')
      irDetalle(res.id_entrega)
    } catch (e) { toast(e.message, 'error') }
  }

  const subirArchivo = async (archivo) => {
    if (!archivo || archivo.type !== 'application/pdf') {
      toast('Selecciona un archivo PDF', 'error'); return
    }
    setSubiendo(true)
    try {
      const res = await api.subirPDF(archivo, sistema, '')
      toast(res.total + ' productos extraidos del PDF', 'ok')
      irDetalle(res.id_entrega)
    } catch (e) { toast(e.message, 'error') }
    finally { setSubiendo(false) }
  }

  return (
    <div className="contenedor">
      <div className="titulo-pag">Nueva entrega</div>
      <div className="sub-pag">Elige como va el embarque y de donde vienen los datos</div>

      <div className="selector-sistema">
        {SISTEMAS.map(s => (
          <button key={s.cod}
            className={'tarjeta-sistema' + (sistema === s.cod ? ' sel' : '')}
            style={{ '--c': s.color }}
            onClick={() => setSistema(s.cod)}>
            <div className="ts-codigo">{s.cod}</div>
            <div className="ts-nombre">{s.nombre}</div>
            <div className="ts-desc">{s.desc}</div>
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="panel-titulo">
          Importar desde Odoo
          {odoo.activa
            ? <span className="chip chip-ok">Conectado · {odoo.usuario}</span>
            : <span className="chip chip-warn">Sin sesion</span>}
        </div>
        {!odoo.activa ? (
          <div className="vacio">
            Inicia sesion en <a href="https://ecor-b2b-35977843.dev.odoo.com" target="_blank"
              rel="noreferrer" style={{color:'var(--amarillo)'}}>Odoo</a> en
            otra pestana y recarga esta pagina. Solo movimientos Raiker y Korei.
          </div>
        ) : !ovs ? <div className="cargando">Buscando OVs pendientes...</div>
          : ovs.length === 0 ? <div className="vacio">Sin OVs pendientes de Raiker o Korei.</div>
          : (
          <div className="lista-scroll">
            {ovs.map(ov => (
              <div key={ov.num_ov} className="fila-ov" onClick={() => importarOdoo(ov)}>
                <span className="ov-num">{ov.num_ov}</span>
                <span className="ov-cliente">{ov.cliente}</span>
                <span className={'chip chip-' + ov.comercializador.toLowerCase()}>{ov.comercializador}</span>
                <span className="ov-fecha">{ov.fecha}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-titulo">Importar desde PDF</div>
        <div className="dropzone"
          onClick={() => fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over') }}
          onDragLeave={e => e.currentTarget.classList.remove('over')}
          onDrop={e => {
            e.preventDefault(); e.currentTarget.classList.remove('over')
            subirArchivo(e.dataTransfer.files[0])
          }}>
          {subiendo ? 'Procesando PDF...'
            : 'Arrastra aqui el PDF de la entrega (ECOR u orden SAP Raiker) o haz clic para elegirlo'}
        </div>
        <input ref={fileRef} type="file" accept="application/pdf" hidden
          onChange={e => subirArchivo(e.target.files[0])} />
      </div>
    </div>
  )
}

// ── MODAL GENERICO ────────────────────────────────────────
function Modal({ titulo, sub, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-titulo">{titulo}</div>
            {sub && <div className="modal-sub">{sub}</div>}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ── MODAL: NUEVA TARIMA (peso opcional) ──────────────────
function ModalNuevaTarima({ seleccionados, onClose, onConfirmar }) {
  const [peso, setPeso] = useState('')
  return (
    <Modal titulo="Nueva tarima" sub={`${seleccionados.length} producto(s) seleccionado(s)`} onClose={onClose}
      footer={<>
        <button className="btn-sec" onClick={onClose}>Cancelar</button>
        <button className="btn-principal" onClick={() => onConfirmar(parseFloat(peso) || 0)}>Crear tarima</button>
      </>}>
      <label className="dim-label">Peso del palet en kg (opcional)</label>
      <input className="inp" type="number" min="0" step="0.1" placeholder="0"
        value={peso} onChange={e => setPeso(e.target.value)} autoFocus />
    </Modal>
  )
}

// ── MODAL: CERRAR TARIMA (dimensiones opcionales) ────────
function ModalCerrarTarima({ onClose, onConfirmar }) {
  const [largo, setLargo] = useState('')
  const [ancho, setAncho] = useState('')
  const [alto, setAlto] = useState('')
  return (
    <Modal titulo="Cerrar tarima" sub="Dimensiones fisicas opcionales" onClose={onClose}
      footer={<>
        <button className="btn-sec" onClick={onClose}>Cancelar</button>
        <button className="btn-principal" onClick={() => onConfirmar({
          largo_cm: parseFloat(largo) || 0, ancho_cm: parseFloat(ancho) || 0, alto_cm: parseFloat(alto) || 0
        })}>Cerrar tarima</button>
      </>}>
      <div className="dim-grid">
        <div><label className="dim-label">Largo (cm)</label>
          <input className="inp" type="number" min="0" step="0.5" placeholder="0" value={largo} onChange={e => setLargo(e.target.value)} /></div>
        <div><label className="dim-label">Ancho (cm)</label>
          <input className="inp" type="number" min="0" step="0.5" placeholder="0" value={ancho} onChange={e => setAncho(e.target.value)} /></div>
        <div><label className="dim-label">Alto (cm)</label>
          <input className="inp" type="number" min="0" step="0.5" placeholder="0" value={alto} onChange={e => setAlto(e.target.value)} /></div>
      </div>
    </Modal>
  )
}

// ── DETALLE DE ENTREGA ───────────────────────────────────
function Detalle({ id, volver, toast, verEtiquetas }) {
  const [ent, setEnt] = useState(null)
  const [sel, setSel] = useState(new Set())
  const [modalNueva, setModalNueva] = useState(false)
  const [modalCerrar, setModalCerrar] = useState(null) // id_tarima o null
  const [abiertas, setAbiertas] = useState(new Set())

  const cargar = () => api.detalleEntrega(id).then(d => {
    setEnt(d)
    setAbiertas(new Set((d.tarimas || []).map(t => t.id_tarima)))
  }).catch(e => toast(e.message, 'error'))

  useEffect(() => { cargar(); setSel(new Set()) }, [id])

  if (!ent) return <div className="cargando">Cargando entrega...</div>

  const productos = ent.productos || []
  const tarimas   = ent.tarimas || []
  const sueltos   = productos.filter(p => !p.id_tarima)
  const usaTarimas = ent.sistema === 'TAR' || ent.sistema === 'MIX'
  const usaSueltos = ent.sistema === 'CS'  || ent.sistema === 'MIX'

  const toggleSel = (idProd) => {
    const n = new Set(sel)
    n.has(idProd) ? n.delete(idProd) : n.add(idProd)
    setSel(n)
  }

  const completar = async () => {
    try { await api.completarEntrega(id); toast('Entrega completada', 'ok'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  const crearTarimaConSel = async (pesoPaletKg) => {
    try {
      await api.crearTarima(id, [...sel], pesoPaletKg)
      toast('Tarima creada', 'ok')
      setSel(new Set()); setModalNueva(false); cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  const quitarDeTarima = async (idProd) => {
    try {
      await api.asignarProductoATarima(id, idProd, null)
      toast('Producto devuelto a sueltos', 'ok')
      cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  const eliminarTarima = async (idTarima) => {
    if (!confirm('¿Eliminar esta tarima? Los productos vuelven a sueltos.')) return
    try { await api.eliminarTarima(id, idTarima); toast('Tarima eliminada', 'ok'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  const cerrarConDims = async (dims) => {
    try {
      await api.cerrarTarima(id, modalCerrar, dims)
      toast('Tarima cerrada', 'ok')
      setModalCerrar(null); cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  const reabrir = async (idTarima) => {
    try { await api.reabrirTarima(id, idTarima); toast('Tarima reabierta', 'ok'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  const toggleAbierta = (idTarima) => {
    const n = new Set(abiertas)
    n.has(idTarima) ? n.delete(idTarima) : n.add(idTarima)
    setAbiertas(n)
  }

  return (
    <div className="contenedor">
      <div className="detalle-head">
        <div>
          <div className="detalle-folio">{ent.num_entrega}</div>
          <div className="detalle-cliente">{ent.nombre_cliente}</div>
          {ent.direccion && <div className="detalle-dir">{ent.direccion}</div>}
          <div style={{marginTop:8,display:'flex',gap:8,flexWrap:'wrap'}}>
            <span className={'badge-sistema badge-' + ent.sistema}>{ent.sistema}</span>
            <span className={'badge-estatus badge-' + ent.estatus}>{ent.estatus}</span>
            {ent.orden && <span className="chip chip-warn">{ent.orden}</span>}
          </div>
        </div>
        <div className="acciones">
          <button className="btn-sec" onClick={volver}>Volver</button>
          {tarimas.some(t => t.estatus === 'cerrada') &&
            <button className="btn-sec" onClick={() => verEtiquetas(id)}>Ver etiquetas</button>}
          {ent.estatus === 'pendiente' &&
            <button className="btn-principal" onClick={completar}>Completar entrega</button>}
        </div>
      </div>

      <div className={usaTarimas ? 'split-cols' : ''}>
        <div>
          {usaSueltos && (
            <div className="panel">
              <div className="panel-titulo">
                {usaTarimas ? 'Productos sueltos (carga suelta)' : 'Productos'}
                <span className="chip chip-ok">{sueltos.length}</span>
              </div>
              {sueltos.length === 0
                ? <div className="vacio">Sin productos sueltos pendientes.</div>
                : sueltos.map(p => (
                  <div key={p.id_producto} className="fila-prod-check" onClick={() => usaTarimas && toggleSel(p.id_producto)}>
                    {usaTarimas && <input type="checkbox" checked={sel.has(p.id_producto)} onChange={() => toggleSel(p.id_producto)} onClick={e => e.stopPropagation()} />}
                    <span className="fp-clave">{p.clave}</span>
                    <span className="fp-desc">{p.descripcion}</span>
                    <span className="fp-cant">x{p.cantidad_total}</span>
                  </div>
                ))}
              {usaTarimas && sel.size > 0 && (
                <div style={{marginTop:12}}>
                  <button className="btn-principal" onClick={() => setModalNueva(true)}>
                    Formar tarima con {sel.size} producto(s)
                  </button>
                </div>
              )}
            </div>
          )}

          {!usaSueltos && (
            <div className="panel">
              <div className="panel-titulo">Productos para tarimas<span className="chip chip-ok">{productos.length}</span></div>
              {productos.map(p => (
                <div key={p.id_producto} className={'fila-prod-check' + (p.id_tarima ? ' en-tarima' : '')} onClick={() => !p.id_tarima && toggleSel(p.id_producto)}>
                  <input type="checkbox" disabled={!!p.id_tarima} checked={sel.has(p.id_producto)} onChange={() => toggleSel(p.id_producto)} onClick={e => e.stopPropagation()} />
                  <span className="fp-clave">{p.clave}</span>
                  <span className="fp-desc">{p.descripcion}</span>
                  <span className="fp-cant">x{p.cantidad_total}</span>
                  {p.id_tarima && <span className="chip-tarima-tag">T{tarimas.find(t => t.id_tarima === p.id_tarima)?.numero_tarima}</span>}
                </div>
              ))}
              {sel.size > 0 && (
                <div style={{marginTop:12}}>
                  <button className="btn-principal" onClick={() => setModalNueva(true)}>
                    Formar tarima con {sel.size} producto(s)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {usaTarimas && (
          <div className="panel">
            <div className="panel-titulo">Tarimas<span className="chip chip-ok">{tarimas.length}</span></div>
            {tarimas.length === 0
              ? <div className="tarima-vacia">Sin tarimas. Selecciona productos y forma la primera.</div>
              : tarimas.map(t => {
                const prods = productos.filter(p => p.id_tarima === t.id_tarima)
                const abierta = abiertas.has(t.id_tarima)
                const cerrada = t.estatus === 'cerrada'
                return (
                  <div key={t.id_tarima} className={'tarima-card' + (cerrada ? ' cerrada' : '')}>
                    <div className="tarima-head" onClick={() => toggleAbierta(t.id_tarima)}>
                      <span className="tarima-num">Tarima {t.numero_tarima}</span>
                      <span className="tarima-count">{prods.length} prod.</span>
                      <span className={'chip ' + (cerrada ? 'chip-ok' : 'chip-warn')}>{cerrada ? 'cerrada' : 'abierta'}</span>
                    </div>
                    {(t.largo_cm > 0 && t.ancho_cm > 0 && t.alto_cm > 0) &&
                      <div className="tarima-dims-tag">{t.largo_cm}×{t.ancho_cm}×{t.alto_cm} cm</div>}
                    {abierta && (
                      <div className="tarima-body">
                        {prods.length === 0
                          ? <div className="tarima-vacia">Sin productos</div>
                          : prods.map(p => (
                            <div key={p.id_producto} className="tarima-prod-row">
                              <span className="tp-clave">{p.clave}</span>
                              <span className="tp-desc">{p.descripcion}</span>
                              <span className="tp-cant">x{p.cantidad_total}</span>
                              {!cerrada && <button className="btn-quitar-mini" onClick={() => quitarDeTarima(p.id_producto)}>Quitar</button>}
                            </div>
                          ))}
                        <div className="tarima-acciones">
                          {cerrada ? (
                            <>
                              <button className="btn-mini" onClick={() => verEtiquetas(id, t.id_tarima)}>Ver etiqueta</button>
                              <button className="btn-mini" onClick={() => reabrir(t.id_tarima)}>Reabrir</button>
                            </>
                          ) : (
                            <>
                              <button className="btn-mini btn-mini-exito" onClick={() => setModalCerrar(t.id_tarima)}>Cerrar tarima</button>
                              <button className="btn-mini" onClick={() => eliminarTarima(t.id_tarima)}>Eliminar</button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {modalNueva && (
        <ModalNuevaTarima seleccionados={[...sel]} onClose={() => setModalNueva(false)} onConfirmar={crearTarimaConSel} />
      )}
      {modalCerrar && (
        <ModalCerrarTarima onClose={() => setModalCerrar(null)} onConfirmar={cerrarConDims} />
      )}
    </div>
  )
}

// ── VISTA DE ETIQUETAS (imprimible) ──────────────────────
function VistaEtiquetas({ idEntrega, idTarima, volver, toast }) {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    const carga = idTarima
      ? api.obtenerEtiqueta(idEntrega, idTarima).then(d => [d])
      : api.obtenerTodasEtiquetas(idEntrega)
    carga.then(setDatos).catch(e => { toast(e.message, 'error'); volver() })
  }, [idEntrega, idTarima])

  if (!datos) return <div className="cargando">Generando etiqueta(s)...</div>

  return (
    <div>
      <div className="contenedor" style={{marginBottom: 12}}>
        <div className="acciones" style={{marginLeft: 0}}>
          <button className="btn-sec" onClick={volver}>Volver</button>
          <button className="btn-principal" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>
      <Etiquetas datos={datos} />
    </div>
  )
}

// ── APP ──────────────────────────────────────────────────
export default function App() {
  const [logueado, setLogueado] = useState(!!api.getToken())
  const [vista, setVista] = useState('dashboard')
  const [idDetalle, setIdDetalle] = useState(null)
  const [etiquetaTarima, setEtiquetaTarima] = useState(null)
  const [toast, Toast] = useToast()

  if (!logueado) return <Login onOk={() => setLogueado(true)} />

  const user = api.getUser()
  const irDetalle = (id) => { setIdDetalle(id); setVista('detalle') }
  const verEtiquetas = (idEnt, idTar = null) => {
    setIdDetalle(idEnt); setEtiquetaTarima(idTar); setVista('etiquetas')
  }

  return (
    <div className="shell">
      {vista !== 'etiquetas' && (
        <div className="topbar">
          <div className="topbar-marca">GRUPO<span>CLER</span></div>
          <nav className="topbar-nav">
            <button className={'nav-btn' + (vista === 'dashboard' ? ' activo' : '')}
              onClick={() => setVista('dashboard')}>Pulso</button>
            <button className={'nav-btn' + (vista === 'nueva' ? ' activo' : '')}
              onClick={() => setVista('nueva')}>Nueva entrega</button>
          </nav>
          <div className="topbar-user">
            <span>{user?.nombre || user?.usuario}</span>
            <button className="btn-salir" onClick={() => { api.logout(); setLogueado(false) }}>
              Salir
            </button>
          </div>
        </div>
      )}
      <div className="contenido">
        {vista === 'dashboard' && <Dashboard irDetalle={irDetalle} />}
        {vista === 'nueva'     && <NuevaEntrega toast={toast} irDetalle={irDetalle} />}
        {vista === 'detalle'   && idDetalle &&
          <Detalle id={idDetalle} volver={() => setVista('dashboard')} toast={toast} verEtiquetas={verEtiquetas} />}
        {vista === 'etiquetas' && idDetalle &&
          <VistaEtiquetas idEntrega={idDetalle} idTarima={etiquetaTarima}
            volver={() => setVista('detalle')} toast={toast} />}
      </div>
      <Toast />
    </div>
  )
}
