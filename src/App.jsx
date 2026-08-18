import { useState, useEffect, useRef } from 'react'
import * as api from './api.js'
import Etiquetas from './Etiquetas.jsx'
import EtiquetasSueltas from './EtiquetasSueltas.jsx'

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
function ModalNuevaTarima({ onClose, onConfirmar }) {
  const [peso, setPeso] = useState('')
  return (
    <Modal titulo="Nueva tarima" sub="Se crea vacia; despues le asignas productos" onClose={onClose}
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

// ── MODAL: ASIGNAR PRODUCTOS A TARIMA (cantidad por SKU) ──
function ModalAsignar({ tarimasAbiertas, productos, idTarimaPre, onClose, onConfirmar }) {
  const [idTarima, setIdTarima] = useState(idTarimaPre || (tarimasAbiertas[0]?.id_tarima ?? ''))
  const [cants, setCants] = useState(() => {
    const init = {}
    productos.forEach(p => { init[p.id_producto] = p.cantidad_pendiente })
    return init
  })

  const confirmar = () => {
    const asignaciones = productos
      .map(p => ({ id_producto: p.id_producto, cantidad: parseInt(cants[p.id_producto]) || 0 }))
      .filter(a => a.cantidad > 0)
    if (!idTarima) return
    if (!asignaciones.length) return
    onConfirmar(idTarima, asignaciones)
  }

  return (
    <Modal titulo="Asignar a tarima" sub={`${productos.length} producto(s) seleccionado(s)`} onClose={onClose}
      footer={<>
        <button className="btn-sec" onClick={onClose}>Cancelar</button>
        <button className="btn-principal" onClick={confirmar}>Confirmar</button>
      </>}>
      <label className="dim-label">Tarima destino</label>
      <select className="inp" style={{marginBottom: 14}} value={idTarima} onChange={e => setIdTarima(e.target.value)}>
        {tarimasAbiertas.map(t => (
          <option key={t.id_tarima} value={t.id_tarima}>Tarima {t.numero_tarima}</option>
        ))}
      </select>
      <label className="dim-label">Cantidad por producto</label>
      {productos.map(p => (
        <div key={p.id_producto} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--amarillo)'}}>{p.clave}</div>
            <div style={{fontSize:12,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.descripcion}</div>
            <div style={{fontSize:10,color:'var(--text3)'}}>Disponible: {p.cantidad_pendiente}</div>
          </div>
          <input type="number" min="1" max={p.cantidad_pendiente}
            className="inp" style={{width:70,textAlign:'right',padding:'7px 8px'}}
            value={cants[p.id_producto]}
            onChange={e => setCants({ ...cants, [p.id_producto]: e.target.value })} />
        </div>
      ))}
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

// ── MODAL: EXTENSION DE SKU ────────────────────────────────
function ModalExtension({ producto, onClose, onConfirmar }) {
  return (
    <Modal titulo="Extension de SKU" sub={`Clave: ${producto.clave}`} onClose={onClose}
      footer={<>
        <button className="btn-sec" onClick={onClose}>Cancelar</button>
        <button className="btn-principal" onClick={() => onConfirmar(producto.cantidad_total)}>
          Crear extension ({producto.cantidad_total})
        </button>
      </>}>
      <p style={{fontSize:12,color:'var(--text3)',marginBottom:14,lineHeight:1.5}}>
        Para productos con 2+ empaques fisicos separados. Se creara una extension
        con la misma cantidad que el SKU original ({producto.cantidad_total}).
      </p>
    </Modal>
  )
}

// ── SUCURSALES RAIKER ─────────────────────────────────────
const SUCURSALES_RAIKER = [
  'ACAYUCAN','APIZACO','ATLIXCO','BOCA','BOTICARIA','BOULEVARD','CANCUN','CARDEL',
  'CARDENAS','CBA. AVENIDA','CBA. ESQUINA','CD. ISLA','COATZA','COSAMALOAPAN',
  'DIAZ MIRON','EMILIANO ZAPATA','GUADALAJARA','IZUCAR','LAS CHOAPAS','LOMA BONITA',
  'MALIBRAN','MARTINEZ','MERIDA CANEK','MERIDA CENTRO','OAXACA','ORIZABA','PACHUCA',
  'PAPANTLA','PEROTE','PUEBLA','SALINA CRUZ','SAN ANDRES','TECAMACHALCO',
  'TEHUACAN AVE','TEHUACAN BLVD.','TEJERIA','TENOSIQUE','TEXMELUCAN','TIERRA BLANCA',
  'TIZAYUCA','TLALNEPANTLA','TUXPAN','TUXTEPEC','VER NORTE','VILLAHERMOSA',
  'XALAPA','XALAPA 2'
]

// ── MODAL: SUCURSAL RAIKER ────────────────────────────────
function ModalSucursal({ actual, onClose, onConfirmar }) {
  const [valor, setValor] = useState(actual || '')
  return (
    <Modal titulo="Sucursal Raiker" sub="Selecciona la sucursal de destino" onClose={onClose}
      footer={<>
        <button className="btn-sec" onClick={onClose}>Cancelar</button>
        <button className="btn-principal" disabled={!valor} onClick={() => onConfirmar(valor)}>Guardar</button>
      </>}>
      <select className="inp" value={valor} onChange={e => setValor(e.target.value)} autoFocus>
        <option value="">-- Selecciona sucursal --</option>
        {SUCURSALES_RAIKER.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </Modal>
  )
}

// ── MODAL: CLIENTE Y DIRECCION ────────────────────────────
function ModalCliente({ nombre, direccion, onClose, onConfirmar }) {
  const [n, setN] = useState(nombre || '')
  const [d, setD] = useState(direccion || '')
  return (
    <Modal titulo="Cliente y direccion" onClose={onClose}
      footer={<>
        <button className="btn-sec" onClick={onClose}>Cancelar</button>
        <button className="btn-principal" onClick={() => onConfirmar(n, d)}>Guardar</button>
      </>}>
      <label className="dim-label">Nombre del cliente</label>
      <input className="inp" style={{marginBottom:12}} value={n} onChange={e => setN(e.target.value)} autoFocus />
      <label className="dim-label">Direccion</label>
      <textarea className="inp" rows={3} style={{resize:'vertical'}} value={d} onChange={e => setD(e.target.value)} />
    </Modal>
  )
}

// ── DETALLE DE ENTREGA ───────────────────────────────────
function Detalle({ id, volver, toast, verEtiquetas, verEtiquetasSueltas }) {
  const [ent, setEnt] = useState(null)
  const [sel, setSel] = useState(new Set())
  const [modalNueva, setModalNueva] = useState(false)
  const [modalAsignarPre, setModalAsignarPre] = useState(undefined) // undefined=cerrado, null|id_tarima=abierto
  const [modalCerrar, setModalCerrar] = useState(null)
  const [modalExt, setModalExt] = useState(null)
  const [modalSucursal, setModalSucursal] = useState(false)
  const [modalCliente, setModalCliente] = useState(false)
  const [abiertas, setAbiertas] = useState(new Set())

  const cargar = () => api.detalleEntrega(id).then(d => {
    setEnt(d)
    setAbiertas(prev => new Set([...prev, ...(d.tarimas || []).map(t => t.id_tarima)]))
  }).catch(e => toast(e.message, 'error'))

  useEffect(() => { cargar(); setSel(new Set()) }, [id])

  if (!ent) return <div className="cargando">Cargando entrega...</div>

  const productos = ent.productos || []
  const tarimas    = ent.tarimas || []
  const abiertasT  = tarimas.filter(t => t.estatus === 'abierta')
  const pendientes = productos.filter(p => p.cantidad_pendiente > 0)
  const usaTarimas = ent.sistema === 'TAR' || ent.sistema === 'MIX'

  const toggleSel = (idProd) => {
    const n = new Set(sel)
    n.has(idProd) ? n.delete(idProd) : n.add(idProd)
    setSel(n)
  }

  const completar = async () => {
    try { await api.completarEntrega(id); toast('Entrega completada', 'ok'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  const crearTarimaVacia = async (pesoPaletKg) => {
    try {
      await api.crearTarima(id, pesoPaletKg)
      toast('Tarima creada', 'ok')
      setModalNueva(false); cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  const abrirAsignar = (idTarimaPre) => {
    if (abiertasT.length === 0) { toast('Crea una tarima abierta primero', 'error'); return }
    if (sel.size === 0) { toast('Selecciona productos pendientes', 'error'); return }
    setModalAsignarPre(idTarimaPre ?? null)
  }

  const confirmarAsignar = async (idTarima, asignaciones) => {
    try {
      const res = await api.asignarProductos(id, idTarima, asignaciones)
      toast(`${res.asignados} asignado(s)`, 'ok')
      if (res.advertencias) toast(res.advertencias.join(' · '), 'error')
      setSel(new Set()); setModalAsignarPre(undefined); cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  const quitarUnDetalle = async (idDetalle) => {
    if (!confirm('¿Quitar y devolver stock a pendiente?')) return
    try { await api.quitarDetalle(id, idDetalle); toast('Devuelto', 'ok'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  const eliminarUnaTarima = async (idTarima) => {
    if (!confirm('¿Eliminar esta tarima? Sus cantidades vuelven a pendiente.')) return
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

  const crearExtension = async (cantidad) => {
    try {
      const res = await api.agregarExtension(id, modalExt.id_producto, cantidad)
      toast('Extension creada: ' + res.clave, 'ok')
      setModalExt(null); cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  const guardarSucursal = async (sucursal) => {
    try {
      await api.actualizarEntrega(id, { sucursal })
      toast('Sucursal actualizada', 'ok')
      setModalSucursal(false); cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  const guardarCliente = async (nombre_cliente, direccion) => {
    try {
      await api.actualizarEntrega(id, { nombre_cliente, direccion })
      toast('Cliente actualizado', 'ok')
      setModalCliente(false); cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  const toggleAbierta = (idTarima) => {
    const n = new Set(abiertas)
    n.has(idTarima) ? n.delete(idTarima) : n.add(idTarima)
    setAbiertas(n)
  }

  const productosSeleccionados = productos.filter(p => sel.has(p.id_producto))
  const esRaiker = (ent.comercializador || '').toLowerCase().includes('raiker')

  return (
    <div className="contenedor">
      <div className="detalle-head">
        <div>
          <div className="detalle-folio">{ent.num_entrega}</div>
          <div className="detalle-cliente">
            {ent.nombre_cliente || 'Sin cliente'}
            <button className="btn-quitar-mini" style={{marginLeft:8}} onClick={() => setModalCliente(true)}>Editar</button>
          </div>
          {ent.direccion && <div className="detalle-dir">{ent.direccion}</div>}
          <div style={{marginTop:8,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <span className={'badge-sistema badge-' + ent.sistema}>{ent.sistema}</span>
            <span className={'badge-estatus badge-' + ent.estatus}>{ent.estatus}</span>
            {ent.orden && <span className="chip chip-warn">{ent.orden}</span>}
            {esRaiker && (
              <span className="chip chip-raiker" style={{cursor:'pointer'}} onClick={() => setModalSucursal(true)}>
                {ent.sucursal ? 'Suc: ' + ent.sucursal : 'Elegir sucursal ✎'}
              </span>
            )}
          </div>
        </div>
        <div className="acciones">
          <button className="btn-sec" onClick={volver}>Volver</button>
          {productos.some(p => p.cantidad_pendiente > 0) && (ent.sistema === 'CS' || ent.sistema === 'MIX') &&
            <button className="btn-sec" onClick={() => verEtiquetasSueltas(id)}>Imprimir etiquetas sueltas</button>}
          {tarimas.some(t => t.estatus === 'cerrada') &&
            <button className="btn-sec" onClick={() => verEtiquetas(id)}>Ver etiquetas de tarima</button>}
          {ent.estatus === 'pendiente' &&
            <button className="btn-principal" onClick={completar}>Completar entrega</button>}
        </div>
      </div>

      <div className={usaTarimas ? 'split-cols' : ''}>
        <div>
          <div className="panel">
            <div className="panel-titulo">
              Productos
              <span className="chip chip-ok">{productos.length}</span>
            </div>
            {productos.length === 0 ? <div className="vacio">Sin productos.</div> : (
              <>
                <div style={{display:'grid',gridTemplateColumns:'20px 1fr 2fr 50px 60px 60px 50px',gap:8,padding:'6px 12px',fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em'}}>
                  <span></span><span>Clave</span><span>Descripcion</span><span style={{textAlign:'right'}}>Total</span>
                  <span style={{textAlign:'right'}}>Asig.</span><span style={{textAlign:'right'}}>Pend.</span><span></span>
                </div>
                {productos.map(p => {
                  const done = p.cantidad_pendiente === 0
                  const esExt = p.id_producto.includes('-EXT')
                  return (
                    <div key={p.id_producto}
                      style={{display:'grid',gridTemplateColumns:'20px 1fr 2fr 50px 60px 60px 50px',gap:8,alignItems:'center',
                        padding:'8px 12px',borderBottom:'1px solid var(--border)',fontSize:12,opacity:done?0.5:1}}>
                      <input type="checkbox" disabled={done} checked={sel.has(p.id_producto)} onChange={() => toggleSel(p.id_producto)} />
                      <span style={{fontFamily:'var(--mono)',color:'var(--amarillo)',fontWeight:700,fontSize:11}}>{p.clave}</span>
                      <span style={{color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.descripcion}</span>
                      <span style={{textAlign:'right',fontFamily:'var(--mono)'}}>{p.cantidad_total}</span>
                      <span style={{textAlign:'right',fontFamily:'var(--mono)',color:'var(--text3)'}}>{p.cantidad_asignada || 0}</span>
                      <span style={{textAlign:'right',fontFamily:'var(--mono)',color: done ? 'var(--text3)' : 'var(--amarillo)'}}>{p.cantidad_pendiente}</span>
                      <span>{!esExt && <button className="btn-quitar-mini" onClick={() => setModalExt(p)}>+Ext</button>}</span>
                    </div>
                  )
                })}
              </>
            )}
            {usaTarimas && sel.size > 0 && (
              <div style={{marginTop:12,display:'flex',gap:8}}>
                <button className="btn-principal" onClick={() => abrirAsignar()}>
                  Asignar {sel.size} producto(s) a tarima
                </button>
              </div>
            )}
          </div>
        </div>

        {usaTarimas && (
          <div className="panel">
            <div className="panel-titulo">
              Tarimas<span className="chip chip-ok">{tarimas.length}</span>
            </div>
            <button className="btn-mini btn-mini-primario" style={{width:'100%',marginBottom:10}} onClick={() => setModalNueva(true)}>
              + Nueva tarima
            </button>
            {tarimas.length === 0
              ? <div className="tarima-vacia">Sin tarimas todavia.</div>
              : tarimas.map(t => {
                const abierta = abiertas.has(t.id_tarima)
                const cerrada = t.estatus === 'cerrada'
                const detalle = t.productos || []
                return (
                  <div key={t.id_tarima} className={'tarima-card' + (cerrada ? ' cerrada' : '')}>
                    <div className="tarima-head" onClick={() => toggleAbierta(t.id_tarima)}>
                      <span className="tarima-num">Tarima {t.numero_tarima}</span>
                      <span className="tarima-count">{detalle.length} prod.</span>
                      <span className={'chip ' + (cerrada ? 'chip-ok' : 'chip-warn')}>{cerrada ? 'cerrada' : 'abierta'}</span>
                    </div>
                    {(t.largo_cm > 0 && t.ancho_cm > 0 && t.alto_cm > 0) &&
                      <div className="tarima-dims-tag">{t.largo_cm}×{t.ancho_cm}×{t.alto_cm} cm</div>}
                    {abierta && (
                      <div className="tarima-body">
                        {detalle.length === 0
                          ? <div className="tarima-vacia">Sin productos</div>
                          : detalle.map(d => (
                            <div key={d.id_detalle} className="tarima-prod-row">
                              <span className="tp-clave">{d.clave}</span>
                              <span className="tp-desc">{d.descripcion}</span>
                              <span className="tp-cant">x{d.cantidad_asignada}</span>
                              {!cerrada && <button className="btn-quitar-mini" onClick={() => quitarUnDetalle(d.id_detalle)}>Quitar</button>}
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
                              <button className="btn-mini" onClick={() => { if (sel.size === 0) { toast('Selecciona productos pendientes arriba', 'error'); return } abrirAsignar(t.id_tarima) }}>+ Productos</button>
                              <button className="btn-mini btn-mini-exito" onClick={() => setModalCerrar(t.id_tarima)}>Cerrar</button>
                              <button className="btn-mini" onClick={() => eliminarUnaTarima(t.id_tarima)}>Eliminar</button>
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
        <ModalNuevaTarima onClose={() => setModalNueva(false)} onConfirmar={crearTarimaVacia} />
      )}
      {modalAsignarPre !== undefined && (
        <ModalAsignar
          tarimasAbiertas={abiertasT}
          productos={productosSeleccionados}
          idTarimaPre={modalAsignarPre}
          onClose={() => setModalAsignarPre(undefined)}
          onConfirmar={confirmarAsignar}
        />
      )}
      {modalCerrar && (
        <ModalCerrarTarima onClose={() => setModalCerrar(null)} onConfirmar={cerrarConDims} />
      )}
      {modalExt && (
        <ModalExtension producto={modalExt} onClose={() => setModalExt(null)} onConfirmar={crearExtension} />
      )}
      {modalSucursal && (
        <ModalSucursal actual={ent.sucursal} onClose={() => setModalSucursal(false)} onConfirmar={guardarSucursal} />
      )}
      {modalCliente && (
        <ModalCliente nombre={ent.nombre_cliente} direccion={ent.direccion}
          onClose={() => setModalCliente(false)} onConfirmar={guardarCliente} />
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

// ── VISTA DE ETIQUETAS SUELTAS (por SKU, carga suelta) ───
function VistaEtiquetasSueltas({ idEntrega, volver, toast }) {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    api.obtenerEtiquetasSueltas(idEntrega).then(setDatos).catch(e => { toast(e.message, 'error'); volver() })
  }, [idEntrega])

  if (!datos) return <div className="cargando">Generando etiquetas...</div>

  return (
    <div>
      <div className="contenedor" style={{marginBottom: 12}}>
        <div className="acciones" style={{marginLeft: 0}}>
          <button className="btn-sec" onClick={volver}>Volver</button>
          <button className="btn-principal" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>
      <EtiquetasSueltas datos={datos} />
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
  const verEtiquetasSueltas = (idEnt) => {
    setIdDetalle(idEnt); setVista('etiquetas-sueltas')
  }

  const enVistaEtiqueta = vista === 'etiquetas' || vista === 'etiquetas-sueltas'

  return (
    <div className="shell">
      {!enVistaEtiqueta && (
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
          <Detalle id={idDetalle} volver={() => setVista('dashboard')} toast={toast}
            verEtiquetas={verEtiquetas} verEtiquetasSueltas={verEtiquetasSueltas} />}
        {vista === 'etiquetas' && idDetalle &&
          <VistaEtiquetas idEntrega={idDetalle} idTarima={etiquetaTarima}
            volver={() => setVista('detalle')} toast={toast} />}
        {vista === 'etiquetas-sueltas' && idDetalle &&
          <VistaEtiquetasSueltas idEntrega={idDetalle}
            volver={() => setVista('detalle')} toast={toast} />}
      </div>
      <Toast />
    </div>
  )
}
