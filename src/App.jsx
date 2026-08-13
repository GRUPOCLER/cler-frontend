import { useState, useEffect, useRef } from 'react'
import * as api from './api.js'

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

// ── DETALLE DE ENTREGA ───────────────────────────────────
function Detalle({ id, volver, toast }) {
  const [ent, setEnt] = useState(null)

  const cargar = () => api.detalleEntrega(id).then(setEnt).catch(e => toast(e.message, 'error'))
  useEffect(() => { cargar() }, [id])

  const completar = async () => {
    try {
      await api.completarEntrega(id)
      toast('Entrega marcada como completada', 'ok')
      cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  if (!ent) return <div className="cargando">Cargando entrega...</div>

  return (
    <div className="contenedor">
      <div className="detalle-head">
        <div>
          <div className="detalle-folio">{ent.num_entrega}</div>
          <div className="detalle-cliente">{ent.nombre_cliente}</div>
          {ent.direccion && <div className="detalle-dir">{ent.direccion}</div>}
          <div style={{marginTop:8,display:'flex',gap:8}}>
            <span className={'badge-sistema badge-' + ent.sistema}>{ent.sistema}</span>
            <span className={'badge-estatus badge-' + ent.estatus}>{ent.estatus}</span>
            {ent.orden && <span className="chip chip-warn">{ent.orden}</span>}
          </div>
        </div>
        <div className="acciones">
          <button className="btn-sec" onClick={volver}>Volver</button>
          {ent.estatus === 'pendiente' &&
            <button className="btn-principal" onClick={completar}>Completar entrega</button>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-titulo">
          Productos
          <span className="chip chip-ok">{(ent.productos || []).length}</span>
        </div>
        {(ent.productos || []).map(p => (
          <div key={p.id_producto} className="fila-prod">
            <span className="prod-clave">{p.clave}</span>
            <span className="prod-desc">{p.descripcion}</span>
            <span className="prod-cant">x{p.cantidad_total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── APP ──────────────────────────────────────────────────
export default function App() {
  const [logueado, setLogueado] = useState(!!api.getToken())
  const [vista, setVista] = useState('dashboard')
  const [idDetalle, setIdDetalle] = useState(null)
  const [toast, Toast] = useToast()

  if (!logueado) return <Login onOk={() => setLogueado(true)} />

  const user = api.getUser()
  const irDetalle = (id) => { setIdDetalle(id); setVista('detalle') }

  return (
    <div className="shell">
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
      <div className="contenido">
        {vista === 'dashboard' && <Dashboard irDetalle={irDetalle} />}
        {vista === 'nueva'     && <NuevaEntrega toast={toast} irDetalle={irDetalle} />}
        {vista === 'detalle'   && idDetalle &&
          <Detalle id={idDetalle} volver={() => setVista('dashboard')} toast={toast} />}
      </div>
      <Toast />
    </div>
  )
}