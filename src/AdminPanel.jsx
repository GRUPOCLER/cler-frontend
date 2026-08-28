import { useState, useEffect } from 'react'
import * as api from './api.js'
import { Modal } from './App.jsx'

const ROLES = [
  { valor: 'operador', nombre: 'Operador', desc: 'Opera los modulos, sin reimpresion ni reapertura' },
  { valor: 'gerente',  nombre: 'Gerente',  desc: 'Autoriza reimpresiones, reabre entregas, registra operadores' },
  { valor: 'admin',    nombre: 'Administrador', desc: 'Control total del sistema' },
]

function chipRol(rol) {
  const map = { admin: 'chip-warn', gerente: 'chip-raiker', operador: 'chip-ok' }
  return map[rol] || 'chip-ok'
}

// ── MODAL: CREAR / EDITAR USUARIO ────────────────────────
function ModalUsuario({ usuarioActual, miRol, onClose, onGuardado, toast }) {
  const editando = !!usuarioActual
  const soyGerente = miRol === 'gerente'
  const [usuario, setUsuario] = useState(usuarioActual?.usuario || '')
  const [email, setEmail] = useState(usuarioActual?.email || '')
  const [nombre, setNombre] = useState(usuarioActual?.nombre_display || '')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState(usuarioActual?.rol || 'operador')
  const [activo, setActivo] = useState(usuarioActual ? usuarioActual.activo : true)
  const [guardando, setGuardando] = useState(false)

  const rolesDisponibles = miRol === 'admin' ? ROLES : ROLES.filter(r => r.valor === 'operador')

  const guardar = async () => {
    setGuardando(true)
    try {
      if (editando) {
        const body = { nombre_display: nombre, rol, activo, email }
        if (password) body.password = password
        await api.editarUsuario(usuario, body)
        toast('Usuario actualizado', 'ok')
      } else {
        await api.crearUsuario({ usuario, password, nombre_display: nombre, rol, email })
        toast('Usuario creado', 'ok')
      }
      onGuardado()
    } catch (e) { toast(e.message, 'error') }
    finally { setGuardando(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-titulo">{editando ? 'Editar usuario' : soyGerente ? 'Registrar operador' : 'Nuevo usuario'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label className="dim-label">Usuario</label>
          <input className="inp" style={{marginBottom:12}} value={usuario}
            disabled={editando} onChange={e => setUsuario(e.target.value)} />

          <label className="dim-label">Correo electronico</label>
          <input className="inp" style={{marginBottom:12}} type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="nombre@grupocler.com.mx" />

          <label className="dim-label">Nombre para mostrar</label>
          <input className="inp" style={{marginBottom:12}} value={nombre} onChange={e => setNombre(e.target.value)} />

          <label className="dim-label">{editando ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
          <input className="inp" style={{marginBottom:12}} type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder={editando ? 'Dejar en blanco para no cambiar' : ''} />

          {!soyGerente && (
            <>
              <label className="dim-label">Rol</label>
              <select className="inp" style={{marginBottom:6}} value={rol} onChange={e => setRol(e.target.value)}>
                {rolesDisponibles.map(r => <option key={r.valor} value={r.valor}>{r.nombre}</option>)}
              </select>
              <div style={{fontSize:11,color:'var(--text3)',marginBottom:12}}>
                {ROLES.find(r => r.valor === rol)?.desc}
              </div>
            </>
          )}

          {editando && (
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
              <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
              Cuenta activa
            </label>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn-sec" onClick={onClose}>Cancelar</button>
          <button className="btn-principal" disabled={guardando || !usuario || (!editando && !password)} onClick={guardar}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ALMACENES DE TRASPASO (busca en Odoo, agrega/quita) ──
function PanelAlmacenes({ toast }) {
  const [configurados, setConfigurados] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState(null)
  const [buscando, setBuscando] = useState(false)

  const cargarConfigurados = () => api.listarAlmacenesConfigurados().then(setConfigurados).catch(e => toast(e.message, 'error'))

  useEffect(() => { cargarConfigurados() }, [])

  const buscar = async () => {
    setBuscando(true)
    try { setResultados(await api.buscarAlmacenesOdoo(busqueda)) }
    catch (e) { toast(e.message, 'error') }
    finally { setBuscando(false) }
  }

  const agregar = async (a) => {
    try {
      await api.agregarAlmacen({
        odoo_warehouse_id: a.id, odoo_location_id: a.location_id,
        nombre: a.nombre, codigo: a.codigo
      })
      toast('Almacen agregado: ' + a.nombre, 'ok')
      cargarConfigurados()
    } catch (e) { toast(e.message, 'error') }
  }

  const toggleActivo = async (a) => {
    try { await api.editarAlmacen(a.id, { activo: !a.activo }); cargarConfigurados() }
    catch (e) { toast(e.message, 'error') }
  }

  const quitar = async (a) => {
    if (!confirm(`¿Quitar "${a.nombre}" de los almacenes vigilados?`)) return
    try { await api.quitarAlmacen(a.id); toast('Almacen quitado', 'ok'); cargarConfigurados() }
    catch (e) { toast(e.message, 'error') }
  }

  const idsYaConfigurados = new Set((configurados || []).map(a => a.odoo_warehouse_id))

  return (
    <>
      <div className="panel">
        <div className="panel-titulo">
          Almacenes vigilados<span className="chip chip-ok">{configurados ? configurados.length : '…'}</span>
        </div>
        <p style={{fontSize:12,color:'var(--text3)',marginBottom:12,lineHeight:1.5}}>
          Solo los traspasos con destino a estos almacenes apareceran en la pestana "Traspasos" de Nueva entrega.
        </p>
        {!configurados ? <div className="cargando">Cargando...</div>
          : configurados.length === 0 ? <div className="vacio">Ninguno configurado todavia — busca abajo y agrega.</div>
          : (
          <table className="tabla">
            <thead><tr><th>Nombre</th><th>Codigo</th><th>Estatus</th><th>Agrego</th><th></th></tr></thead>
            <tbody>
              {configurados.map(a => (
                <tr key={a.id}>
                  <td style={{fontWeight:700}}>{a.nombre}</td>
                  <td>{a.codigo}</td>
                  <td><span className={a.activo ? 'chip chip-ok' : 'chip chip-warn'}>{a.activo ? 'activo' : 'pausado'}</span></td>
                  <td style={{fontSize:12,color:'var(--text3)'}}>{a.agregado_por}</td>
                  <td style={{display:'flex',gap:6}}>
                    <button className="btn-quitar-mini" onClick={() => toggleActivo(a)}>{a.activo ? 'Pausar' : 'Activar'}</button>
                    <button className="btn-quitar-mini" onClick={() => quitar(a)}>Quitar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-titulo">Buscar almacen en Odoo</div>
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <input type="text" className="inp" placeholder="Ej. CEDIS, Expo, Meli..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()} />
          <button className="btn-principal" onClick={buscar} disabled={buscando}>{buscando ? 'Buscando...' : 'Buscar'}</button>
        </div>
        {resultados && (
          resultados.length === 0 ? <div className="vacio">Sin resultados.</div> : (
            <div className="lista-scroll">
              {resultados.map(a => (
                <div key={a.id} className="fila-ov">
                  <span className="ov-num">{a.codigo}</span>
                  <span className="ov-cliente">{a.nombre}</span>
                  {idsYaConfigurados.has(a.id) ? (
                    <span className="chip chip-ok">Ya agregado</span>
                  ) : (
                    <button className="btn-mini btn-mini-primario" onClick={() => agregar(a)}>+ Agregar</button>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </>
  )
}

// ── PANEL DE ADMINISTRACION (solo Admin: usuarios + bitacora) ───
export default function AdminPanel({ toast, miRol }) {
  const [tab, setTab] = useState('usuarios')
  const [usuarios, setUsuarios] = useState(null)
  const [logs, setLogs] = useState(null)
  const [modalUsuario, setModalUsuario] = useState(undefined)

  const cargarUsuarios = () => api.listarUsuarios().then(setUsuarios).catch(e => toast(e.message, 'error'))
  const cargarLogs     = () => api.verLogs().then(setLogs).catch(e => toast(e.message, 'error'))

  useEffect(() => {
    if (tab === 'usuarios' && !usuarios) cargarUsuarios()
    if (tab === 'logs' && !logs) cargarLogs()
  }, [tab])

  // Un Gerente solo puede registrar operadores, sin ver listas
  if (miRol === 'gerente') {
    return (
      <div className="contenedor">
        <div className="titulo-pag">Registrar operador</div>
        <div className="sub-pag">Como Gerente puedes dar de alta cuentas de Operador</div>
        <div className="panel">
          <button className="btn-principal" onClick={() => setModalUsuario(null)}>+ Registrar operador</button>
        </div>
        {modalUsuario !== undefined && (
          <ModalUsuario usuarioActual={modalUsuario} miRol={miRol} toast={toast}
            onClose={() => setModalUsuario(undefined)}
            onGuardado={() => setModalUsuario(undefined)} />
        )}
      </div>
    )
  }

  return (
    <div className="contenedor">
      <div className="titulo-pag">Administracion</div>
      <div className="sub-pag">Usuarios, roles y bitacora de acciones</div>

      <div className="topbar-nav" style={{marginBottom:20}}>
        <button className={'nav-btn' + (tab === 'usuarios' ? ' activo' : '')} onClick={() => setTab('usuarios')}>Usuarios</button>
        <button className={'nav-btn' + (tab === 'almacenes' ? ' activo' : '')} onClick={() => setTab('almacenes')}>Almacenes de traspaso</button>
        <button className={'nav-btn' + (tab === 'logs' ? ' activo' : '')} onClick={() => setTab('logs')}>Bitacora</button>
      </div>

      {tab === 'almacenes' && <PanelAlmacenes toast={toast} />}

      {tab === 'usuarios' && (
        <div className="panel">
          <div className="panel-titulo">
            Usuarios
            {usuarios && <span className="chip chip-ok">{usuarios.length}</span>}
            <button className="btn-mini btn-mini-primario" style={{marginLeft:'auto'}} onClick={() => setModalUsuario(null)}>
              + Nuevo usuario
            </button>
          </div>
          {!usuarios ? <div className="cargando">Cargando...</div>
            : usuarios.length === 0 ? <div className="vacio">Sin usuarios.</div>
            : (
            <table className="tabla">
              <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estatus</th><th>Último acceso</th><th></th></tr></thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.usuario} onClick={() => setModalUsuario(u)}>
                    <td style={{fontWeight:700}}>{u.usuario}</td>
                    <td>{u.nombre_display || '—'}</td>
                    <td><span className={'chip ' + chipRol(u.rol)}>{u.rol}</span></td>
                    <td><span className={u.activo ? 'chip chip-ok' : 'chip chip-warn'}>{u.activo ? 'activo' : 'inactivo'}</span></td>
                    <td style={{fontSize:11,color:'var(--text3)'}}>{(u.ultimo_acceso || '—').substring(0,16)}</td>
                    <td><button className="btn-quitar-mini" onClick={e => { e.stopPropagation(); setModalUsuario(u) }}>Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="panel">
          <div className="panel-titulo">Bitacora reciente{logs && <span className="chip chip-ok">{logs.length}</span>}</div>
          {!logs ? <div className="cargando">Cargando...</div>
            : logs.length === 0 ? <div className="vacio">Sin registros.</div>
            : (
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Accion</th><th>Detalle</th><th>Resultado</th></tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{fontSize:11,color:'var(--text3)'}}>{(l.fecha || '').substring(0,19)}</td>
                    <td style={{}}>{l.usuario}</td>
                    <td>{l.accion}</td>
                    <td style={{color:'var(--text2)'}}>{l.detalle}</td>
                    <td><span className={l.exito ? 'chip chip-ok' : 'chip chip-warn'}>{l.exito ? 'ok' : 'error'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalUsuario !== undefined && (
        <ModalUsuario usuarioActual={modalUsuario} miRol={miRol} toast={toast}
          onClose={() => setModalUsuario(undefined)}
          onGuardado={() => { setModalUsuario(undefined); cargarUsuarios() }} />
      )}
    </div>
  )
}
