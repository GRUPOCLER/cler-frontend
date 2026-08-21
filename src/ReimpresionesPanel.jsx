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

export default function ReimpresionesPanel({ toast }) {
  const [solicitudes, setSolicitudes] = useState(null)
  const [modalResolver, setModalResolver] = useState(null)

  const cargar = () => api.listarSolicitudes().then(setSolicitudes).catch(e => toast(e.message, 'error'))

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

  if (!solicitudes) return <div className="contenedor"><div className="cargando">Cargando...</div></div>

  const pendientes = solicitudes.filter(s => s.estatus === 'pendiente')
  const resueltas  = solicitudes.filter(s => s.estatus !== 'pendiente')

  return (
    <div className="contenedor">
      <div className="titulo-pag">Reimpresiones</div>
      <div className="sub-pag">Solicitudes de reimpresion y su historial</div>

      <div className="panel">
        <div className="panel-titulo">
          Solicitudes pendientes<span className="chip chip-warn">{pendientes.length}</span>
          <button className="btn-quitar-mini" style={{marginLeft:'auto'}} onClick={cargar}>Actualizar</button>
        </div>
        {pendientes.length === 0 ? <div className="vacio">Sin solicitudes pendientes.</div> : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Documento</th><th>Folio</th><th>Solicito</th><th>Motivo</th><th></th></tr></thead>
            <tbody>
              {pendientes.map(s => (
                <tr key={s.id}>
                  <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>{(s.fecha_solicitud || '').substring(0,16)}</td>
                  <td><span className="chip chip-warn">{s.tipo}</span></td>
                  <td style={{fontFamily:'var(--mono)',fontWeight:700}}>{s.num_entrega || s.referencia}</td>
                  <td style={{fontFamily:'var(--mono)'}}>{s.solicitado_por}</td>
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
        <div className="panel-titulo">Historial reciente</div>
        {resueltas.length === 0 ? <div className="vacio">Sin historial.</div> : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Documento</th><th>Folio</th><th>Solicito</th><th>Estatus</th><th>Autorizo</th></tr></thead>
            <tbody>
              {resueltas.slice(0, 30).map(s => (
                <tr key={s.id}>
                  <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>{(s.fecha_resolucion || s.fecha_solicitud || '').substring(0,16)}</td>
                  <td><span className="chip chip-ok">{s.tipo}</span></td>
                  <td style={{fontFamily:'var(--mono)',fontWeight:700}}>{s.num_entrega || s.referencia}</td>
                  <td style={{fontFamily:'var(--mono)'}}>{s.solicitado_por}</td>
                  <td><span className={s.estatus === 'aprobada' || s.estatus === 'usada' ? 'chip chip-ok' : 'chip chip-warn'}>{s.estatus}</span></td>
                  <td style={{fontFamily:'var(--mono)',fontSize:12}}>{s.autorizado_por || '—'}</td>
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
    </div>
  )
}
