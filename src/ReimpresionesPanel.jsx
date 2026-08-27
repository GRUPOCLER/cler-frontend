import { useState, useEffect } from 'react'
import * as api from './api.js'
import { Modal } from './App.jsx'

function ModalResolver({ solicitud, accion, onClose, onConfirmar }) {
  const [comentario, setComentario] = useState('')
  const esAprobar = accion === 'aprobar'
  return (
    <Modal titulo={esAprobar ? 'Aprobar reimpresion' : 'Rechazar reimpresion'}
      sub={`${solicitud.tipo} — ${solicitud.num_entrega || solicitud.referencia}`} onClose={onClose}
      footer={<>
        <button className="btn-sec" onClick={onClose}>Cancelar</button>
        <button className={esAprobar ? 'btn-principal' : 'btn-mini'} onClick={() => onConfirmar(comentario)}>
          {esAprobar ? 'Aprobar' : 'Rechazar'}
        </button>
      </>}>
      <div style={{fontSize:12,color:'var(--text2)',marginBottom:10,background:'var(--bg3)',padding:10,borderRadius:6}}>
        <b>Motivo del solicitante:</b><br/>{solicitud.motivo}
      </div>
      <label className="dim-label">Comentario {esAprobar ? '(opcional)' : ''}</label>
      <textarea className="inp" rows={2} style={{resize:'vertical'}} value={comentario}
        onChange={e => setComentario(e.target.value)} placeholder={esAprobar ? '' : 'Explica por que se rechaza'} />
    </Modal>
  )
}

function ModalResolverCambio({ solicitud, accion, onClose, onConfirmar }) {
  const [comentario, setComentario] = useState('')
  const esAprobar = accion === 'aprobar'
  return (
    <Modal titulo={esAprobar ? 'Aprobar cambio de sistema' : 'Rechazar cambio de sistema'}
      sub={solicitud.num_entrega || solicitud.id_entrega} onClose={onClose}
      footer={<>
        <button className="btn-sec" onClick={onClose}>Cancelar</button>
        <button className={esAprobar ? 'btn-principal' : 'btn-mini'} onClick={() => onConfirmar(comentario)}>
          {esAprobar ? 'Aprobar' : 'Rechazar'}
        </button>
      </>}>
      <div style={{fontSize:12,color:'var(--text2)',marginBottom:10,background:'var(--bg3)',padding:10,borderRadius:6}}>
        <b>Cambio solicitado:</b> {solicitud.sistema_actual} → {solicitud.sistema_nuevo}<br/><br/>
        <b>Motivo:</b><br/>{solicitud.motivo}
      </div>
      <label className="dim-label">Comentario {esAprobar ? '(opcional)' : ''}</label>
      <textarea className="inp" rows={2} style={{resize:'vertical'}} value={comentario}
        onChange={e => setComentario(e.target.value)} placeholder={esAprobar ? '' : 'Explica por que se rechaza'} />
    </Modal>
  )
}

export default function ReimpresionesPanel({ toast }) {
  const [solicitudes, setSolicitudes] = useState(null)
  const [cambios, setCambios] = useState(null)
  const [modalResolver, setModalResolver] = useState(null)
  const [modalResolverCambio, setModalResolverCambio] = useState(null)

  const cargar = () => {
    api.listarSolicitudes().then(setSolicitudes).catch(e => toast(e.message, 'error'))
    api.listarCambiosSistema().then(setCambios).catch(e => toast(e.message, 'error'))
  }

  useEffect(() => { cargar() }, [])

  const resolver = async (comentario) => {
    try {
      const { solicitud, accion } = modalResolver
      if (accion === 'aprobar') await api.aprobarSolicitud(solicitud.id, comentario || null)
      else await api.rechazarSolicitud(solicitud.id, comentario || null)
      toast(accion === 'aprobar' ? 'Solicitud aprobada' : 'Solicitud rechazada', 'ok')
      setModalResolver(null); cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  const resolverCambio = async (comentario) => {
    try {
      const { solicitud, accion } = modalResolverCambio
      if (accion === 'aprobar') await api.aprobarCambioSistema(solicitud.id, comentario || null)
      else await api.rechazarCambioSistema(solicitud.id, comentario || null)
      toast(accion === 'aprobar' ? 'Cambio aprobado y aplicado' : 'Cambio rechazado', 'ok')
      setModalResolverCambio(null); cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  if (!solicitudes || !cambios) return <div className="contenedor"><div className="cargando">Cargando...</div></div>

  const pendientes = solicitudes.filter(s => s.estatus === 'pendiente')
  const resueltas  = solicitudes.filter(s => s.estatus !== 'pendiente')
  const cambiosPend = cambios.filter(c => c.estatus === 'pendiente')
  const cambiosRes  = cambios.filter(c => c.estatus !== 'pendiente')

  return (
    <div className="contenedor">
      <div className="titulo-pag">Autorizaciones</div>
      <div className="sub-pag">Reimpresiones y correcciones que requieren visto bueno de Gerencia</div>

      <div className="panel">
        <div className="panel-titulo">
          Reimpresiones pendientes<span className="chip chip-warn">{pendientes.length}</span>
          <button className="btn-quitar-mini" style={{marginLeft:'auto'}} onClick={cargar}>Actualizar</button>
        </div>
        {pendientes.length === 0 ? <div className="vacio">Sin solicitudes pendientes.</div> : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Documento</th><th>Folio</th><th>Solicito</th><th>Motivo</th><th></th></tr></thead>
            <tbody>
              {pendientes.map(s => (
                <tr key={s.id}>
                  <td style={{fontSize:11,color:'var(--text3)'}}>{(s.fecha_solicitud || '').substring(0,16)}</td>
                  <td><span className="chip chip-warn">{s.tipo}</span></td>
                  <td style={{fontWeight:700}}>{s.num_entrega || s.referencia}</td>
                  <td>{s.solicitado_por}</td>
                  <td style={{color:'var(--text2)',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.motivo}</td>
                  <td style={{display:'flex',gap:6}}>
                    <button className="btn-mini btn-mini-exito" onClick={() => setModalResolver({ solicitud: s, accion: 'aprobar' })}>Aprobar</button>
                    <button className="btn-mini" onClick={() => setModalResolver({ solicitud: s, accion: 'rechazar' })}>Rechazar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-titulo">
          Cambios de sistema pendientes<span className="chip chip-warn">{cambiosPend.length}</span>
        </div>
        {cambiosPend.length === 0 ? <div className="vacio">Sin solicitudes pendientes.</div> : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Folio</th><th>Cambio</th><th>Solicito</th><th>Motivo</th><th></th></tr></thead>
            <tbody>
              {cambiosPend.map(c => (
                <tr key={c.id}>
                  <td style={{fontSize:11,color:'var(--text3)'}}>{(c.fecha_solicitud || '').substring(0,16)}</td>
                  <td style={{fontWeight:700}}>{c.num_entrega || c.id_entrega}</td>
                  <td><span className="chip chip-warn">{c.sistema_actual} → {c.sistema_nuevo}</span></td>
                  <td>{c.solicitado_por}</td>
                  <td style={{color:'var(--text2)',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.motivo}</td>
                  <td style={{display:'flex',gap:6}}>
                    <button className="btn-mini btn-mini-exito" onClick={() => setModalResolverCambio({ solicitud: c, accion: 'aprobar' })}>Aprobar</button>
                    <button className="btn-mini" onClick={() => setModalResolverCambio({ solicitud: c, accion: 'rechazar' })}>Rechazar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-titulo">Historial de reimpresiones</div>
        {resueltas.length === 0 ? <div className="vacio">Sin historial.</div> : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Documento</th><th>Folio</th><th>Solicito</th><th>Estatus</th><th>Autorizo</th></tr></thead>
            <tbody>
              {resueltas.slice(0, 30).map(s => (
                <tr key={s.id}>
                  <td style={{fontSize:11,color:'var(--text3)'}}>{(s.fecha_resolucion || s.fecha_solicitud || '').substring(0,16)}</td>
                  <td><span className="chip chip-ok">{s.tipo}</span></td>
                  <td style={{fontWeight:700}}>{s.num_entrega || s.referencia}</td>
                  <td>{s.solicitado_por}</td>
                  <td><span className={s.estatus === 'aprobada' || s.estatus === 'usada' ? 'chip chip-ok' : 'chip chip-warn'}>{s.estatus}</span></td>
                  <td style={{fontSize:12}}>{s.autorizado_por || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-titulo">Historial de cambios de sistema</div>
        {cambiosRes.length === 0 ? <div className="vacio">Sin historial.</div> : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Folio</th><th>Cambio</th><th>Solicito</th><th>Estatus</th><th>Autorizo</th></tr></thead>
            <tbody>
              {cambiosRes.slice(0, 30).map(c => (
                <tr key={c.id}>
                  <td style={{fontSize:11,color:'var(--text3)'}}>{(c.fecha_resolucion || c.fecha_solicitud || '').substring(0,16)}</td>
                  <td style={{fontWeight:700}}>{c.num_entrega || c.id_entrega}</td>
                  <td><span className="chip chip-ok">{c.sistema_actual} → {c.sistema_nuevo}</span></td>
                  <td>{c.solicitado_por}</td>
                  <td><span className={c.estatus === 'aprobada' ? 'chip chip-ok' : 'chip chip-warn'}>{c.estatus}</span></td>
                  <td style={{fontSize:12}}>{c.autorizado_por || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalResolver && (
        <ModalResolver solicitud={modalResolver.solicitud} accion={modalResolver.accion}
          onClose={() => setModalResolver(null)} onConfirmar={resolver} />
      )}
      {modalResolverCambio && (
        <ModalResolverCambio solicitud={modalResolverCambio.solicitud} accion={modalResolverCambio.accion}
          onClose={() => setModalResolverCambio(null)} onConfirmar={resolverCambio} />
      )}
    </div>
  )
}
