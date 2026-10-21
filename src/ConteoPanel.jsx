import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from './api.js'
import { Modal } from './App.jsx'

function ModalNuevoConteo({ onClose, onCreado, toast }) {
  const [f, setF] = useState({ nombre: '', ciego: true, bodega: '', zona: '', prefijo: '', soloConExistencia: false })
  const [creando, setCreando] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const crear = async () => {
    setCreando(true)
    try {
      const c = await api.crearConteo({
        nombre: f.nombre, ciego: f.ciego, bodega: f.bodega || null, zona: f.zona || null,
        prefijo: f.prefijo || null, solo_con_existencia: f.soloConExistencia
      })
      toast(`Conteo creado con ${c.progreso.ubicaciones} ubicaciones`, 'ok')
      onCreado(c)
    } catch (e) { toast(e.message, 'error') }
    finally { setCreando(false) }
  }

  return (
    <Modal titulo="Nuevo conteo de inventario"
      sub="Se congela la existencia que muestra el sistema (Odoo) para compararla contra lo que se cuente"
      onClose={onClose}
      footer={<>
        <button className="btn-sec" onClick={onClose} disabled={creando}>Cancelar</button>
        <button className="btn-principal" onClick={crear} disabled={creando || f.nombre.trim().length < 3}>
          {creando ? 'Creando...' : 'Crear conteo'}
        </button>
      </>}>
      <label className="dim-label">Nombre del conteo</label>
      <input className="inp" style={{marginBottom:12}} placeholder="Ej. Conteo ADIS rack 1, octubre" value={f.nombre}
        onChange={e => set('nombre', e.target.value)} autoFocus />

      <label className="dim-label">Que ubicaciones se cuentan (deja vacio para todo)</label>
      <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap'}}>
        <select className="inp" style={{flex:1,minWidth:130}} value={f.bodega} onChange={e => set('bodega', e.target.value)}>
          <option value="">Todas las bodegas</option>
          <option value="Bodega 01">Bodega 01 (ADIS)</option>
          <option value="Embarques">Embarques</option>
          <option value="Bodega 02">Bodega 02</option>
          <option value="Bodega 03">Bodega 03</option>
          <option value="Bodega 04">Bodega 04</option>
          <option value="Patio">Patio</option>
        </select>
        <select className="inp" style={{flex:1,minWidth:120}} value={f.zona} onChange={e => set('zona', e.target.value)}>
          <option value="">Todas las zonas</option>
          <option value="ORO">Zona Oro</option>
          <option value="PLATA">Zona Plata</option>
          <option value="BRONCE">Zona Bronce</option>
        </select>
      </div>
      <input className="inp" style={{marginBottom:10}} placeholder="Prefijo de ubicacion (opcional) — ej. ADISR1 o WKCR55"
        value={f.prefijo} onChange={e => set('prefijo', e.target.value)} />

      <label style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:12,marginBottom:8,cursor:'pointer'}}>
        <input type="checkbox" checked={f.ciego} onChange={e => set('ciego', e.target.checked)} style={{marginTop:2}} />
        <span><b>Conteo a ciegas</b> — quien cuenta no ve la existencia del sistema (recomendado, evita sesgar el conteo).</span>
      </label>
      <label style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:12,cursor:'pointer'}}>
        <input type="checkbox" checked={f.soloConExistencia} onChange={e => set('soloConExistencia', e.target.checked)} style={{marginTop:2}} />
        <span>Contar <b>solo ubicaciones donde el sistema dice que hay producto</b>. Si lo dejas apagado tambien se revisan las vacias (detecta sobrantes).</span>
      </label>
    </Modal>
  )
}

export default function ConteoPanel({ toast }) {
  const navigate = useNavigate()
  const rol = api.getUser()?.rol
  const gestor = rol === 'admin' || rol === 'gerente'
  const [conteos, setConteos] = useState(null)
  const [modal, setModal] = useState(false)

  const cargar = () => api.listarConteos().then(setConteos).catch(e => { toast(e.message, 'error'); setConteos([]) })
  useEffect(() => { cargar() }, [])

  return (
    <div className="contenedor">
      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <button className="btn-sec" onClick={() => navigate('/almacen')}>← Almacen</button>
        <div>
          <div className="titulo-pag" style={{marginBottom:0}}>Conteo de inventario</div>
          <div className="sub-pag">Cuenta ubicacion por ubicacion; las diferencias contra el sistema quedan anotadas en el reporte</div>
        </div>
        <div style={{flex:1}}></div>
        {gestor && <button className="btn-principal" onClick={() => setModal(true)}>Nuevo conteo</button>}
      </div>

      <div className="panel" style={{marginTop:16}}>
        {!conteos ? <div className="cargando">Cargando...</div>
          : conteos.length === 0 ? <div className="vacio">
              {gestor ? 'Aun no hay conteos. Crea el primero con "Nuevo conteo".' : 'No hay conteos abiertos por ahora.'}
            </div>
          : (
          <table className="tabla">
            <thead><tr><th>Conteo</th><th>Alcance</th><th>Avance</th><th>Estatus</th><th></th></tr></thead>
            <tbody>
              {conteos.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{fontWeight:700}}>{c.nombre}</div>
                    <div style={{fontSize:11,color:'var(--text3)'}}>{c.id} · {api.formatearFecha(c.fecha)} · {c.creado_por}{c.ciego ? ' · a ciegas' : ''}</div>
                  </td>
                  <td style={{fontSize:12}}>{c.alcance}</td>
                  <td style={{minWidth:150}}>
                    <div style={{fontSize:12,marginBottom:4}}>{c.progreso.contadas} / {c.progreso.ubicaciones} ({c.progreso.pct}%)</div>
                    <div style={{height:6,background:'var(--bg3)',borderRadius:4,overflow:'hidden'}}>
                      <div style={{width:`${c.progreso.pct}%`,height:'100%',background:'var(--cs)'}}></div>
                    </div>
                  </td>
                  <td><span className={'badge-estatus badge-' + (c.estatus === 'abierto' ? 'pendiente' : 'completada')}>{c.estatus}</span></td>
                  <td style={{whiteSpace:'nowrap'}}>
                    {c.estatus === 'abierto' && <button className="btn-mini" onClick={() => navigate(`/almacen/conteo/${c.id}`)}>Contar</button>}{' '}
                    {gestor && <button className="btn-mini" onClick={() => navigate(`/almacen/conteo/${c.id}/reporte`)}>Reporte</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && <ModalNuevoConteo toast={toast} onClose={() => setModal(false)}
        onCreado={(c) => { setModal(false); navigate(`/almacen/conteo/${c.id}`) }} />}
    </div>
  )
}
