// Detalle de un conteo: avance en el mapa, captura (auditor), incidencias, asignacion y herramientas del gestor.
import { useEffect, useState, useCallback, useRef } from 'react'
import * as api from './api'
import { Modal } from './ControlOV'
import { nf } from './util'
import { MapaSvg, Leyenda, ESTADO_TXT, fh } from './InvUI'
import Gestion from './InvGestion'

const inv = api.inv

function Barra({ pct }) {
  const p = Math.max(0, Math.min(100, pct || 0))
  return <div className="ov-barra" role="img" aria-label={`Avance ${Math.round(p)}%`}><div className="ov-barra-pista"><div className="ov-barra-relleno" style={{ width: p + '%' }} /></div><span className="ov-barra-n">{Math.round(p)}%</span></div>
}

// ---------- AVANCE: mapa coloreado por estado ----------
function Avance({ id, toast }) {
  const [d, setD] = useState(null)
  const [mov, setMov] = useState(false)
  const [det, setDet] = useState(null)
  const cargar = useCallback(() => inv.get(`/conteos/${id}/mapa?movimientos_=${mov}`).then(setD).catch(e => toast(e.message, 'error')), [id, mov, toast])
  useEffect(() => { cargar() }, [cargar])
  if (!d) return <div className="cargando">Cargando mapa...</div>
  const claves = d.gestor ? ['pendiente', 'asignada', 'reconteo', 'ok', 'dif', ...(mov ? ['explicada'] : [])] : ['pendiente', 'asignada', 'reconteo', 'contada']
  const abre = async (i) => { if (i.e === 'fuera') return; try { setDet(await inv.get(`/conteos/${id}/mapa/${encodeURIComponent(i.c)}`)) } catch (e) { toast(e.message, 'error') } }
  return (
    <div className="panel">
      <div className="inv-fila" style={{ justifyContent: 'space-between' }}>
        <div className="panel-titulo" style={{ margin: 0 }}>Avance en el almacen</div>
        <div className="inv-fila">
          {d.gestor && <label className="inv-chk"><input type="checkbox" checked={mov} onChange={e => setMov(e.target.checked)} /> Considerar movimientos de Odoo</label>}
          <button className="btn-sec" onClick={cargar}>Actualizar</button>
        </div>
      </div>
      <Leyenda cuenta={d.cuenta} claves={claves} />
      <MapaSvg items={d.items} claseDe={i => 'inv-e-' + i.e + (i.mia ? ' inv-ub--mia' : '')} onClick={abre} />
      {det && (
        <Modal titulo={det.codigo} sub={ESTADO_TXT[det.estado === 'contada' ? 'contada' : det.estado] || det.estado} onClose={() => setDet(null)}>
          <div className="sub-pag">{[det.bodega, det.zona && 'Zona ' + det.zona, det.grupo, det.asignado_a && 'Asignada a ' + det.asignado_a, det.contada_por && 'Contada por ' + det.contada_por + ' ' + fh(det.fecha_conteo)].filter(Boolean).join(' - ')}</div>
          {det.lineas && (
            <table className="tabla"><thead><tr><th>Clave</th><th>Sistema</th><th>Contado</th><th>Dif.</th></tr></thead>
              <tbody>{det.lineas.map(l => <tr key={l.producto}><td><b>{l.producto}</b>{l.inesperado && <span className="chip chip-warn" style={{ marginLeft: 6 }}>no esperado</span>}<div className="sub-pag" style={{ margin: 0 }}>{l.descripcion}</div></td>
                <td>{nf(l.esperado)}</td><td>{l.contado === null ? '-' : nf(l.contado)}</td><td className={l.diferencia ? 'inv-neg' : ''}>{l.diferencia === null ? '-' : nf(l.diferencia)}</td></tr>)}</tbody></table>
          )}
          {det.incidencias && det.incidencias.length > 0 && <div className="sub-pag">Incidencias: {det.incidencias.map(i => i.tipo_txt).join(', ')}</div>}
        </Modal>
      )}
    </div>
  )
}

// ---------- CAPTURA (auditor y gestor) ----------
function Capturar({ id, conteo, toast, onCambio }) {
  const [lista, setLista] = useState(null)
  const [buscar, setBuscar] = useState('')
  const [mias, setMias] = useState(!api.esJefeEn('inventario'))
  const [abierta, setAbierta] = useState(null)
  const scan = useRef(null)
  const cargar = useCallback(async () => {
    try { setLista(await inv.get(`/conteos/${id}/ubicaciones?mias=${mias}&buscar=${encodeURIComponent(buscar)}&limite=200`)) } catch (e) { toast(e.message, 'error') }
  }, [id, mias, buscar, toast])
  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t) }, [cargar])
  const abrir = (cod) => { setAbierta(cod) }
  const escaneo = (e) => { e.preventDefault(); const v = buscar.trim().toUpperCase(); if (!v) return; const l = (lista || []).find(x => x.codigo.toUpperCase() === v); abrir(l ? l.codigo : v); setBuscar('') }
  const cerrada = conteo.estatus !== 'abierto'
  return (
    <div className="panel">
      <div className="panel-titulo">Contar ubicaciones</div>
      {conteo.estatus === 'pausado' && <div className="ov-aviso ov-aviso--warn">El conteo esta en pausa. Un gestor debe reanudarlo para seguir capturando.</div>}
      <form className="inv-fila" onSubmit={escaneo}>
        <input ref={scan} className="inp" autoFocus placeholder="Escanea o escribe la ubicacion" value={buscar} onChange={e => setBuscar(e.target.value)} />
        <button className="btn-principal" type="submit">Abrir</button>
        <label className="inv-chk"><input type="checkbox" checked={mias} onChange={e => setMias(e.target.checked)} /> Solo las mias</label>
      </form>
      {!lista ? <div className="cargando">Cargando...</div> : lista.length === 0 ? <div className="sub-pag" style={{ marginTop: 12 }}>{mias ? 'No tienes ubicaciones asignadas que coincidan.' : 'Sin ubicaciones.'}</div> : (
        <div className="lista-scroll"><table className="tabla"><thead><tr><th>Ubicacion</th><th>Grupo</th><th>Estado</th><th>Asignada a</th></tr></thead>
          <tbody>{lista.map(u => (
            <tr key={u.codigo} onClick={() => !cerrada && abrir(u.codigo)}>
              <td><b>{u.codigo}</b></td><td>{u.grupo}</td>
              <td><span className={'chip ' + (u.estado === 'contada' ? 'chip-ok' : u.estado === 'reconteo' ? 'chip-warn' : '')}>{u.estado === 'reconteo' ? 'Reconteo ' + u.ronda : u.estado}</span></td>
              <td>{u.asignado_a || '-'}</td></tr>))}</tbody></table></div>
      )}
      {abierta && <ModalCaptura id={id} codigo={abierta} toast={toast} onClose={() => setAbierta(null)} onGuardada={() => { setAbierta(null); cargar(); onCambio() }} />}
    </div>
  )
}

function ModalCaptura({ id, codigo, toast, onClose, onGuardada }) {
  const [u, setU] = useState(null)
  const [vals, setVals] = useState({})
  const [extras, setExtras] = useState([])
  const [nota, setNota] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [confirma, setConfirma] = useState(null)
  const [incid, setIncid] = useState(false)
  useEffect(() => {
    inv.get(`/conteos/${id}/ubicacion/${encodeURIComponent(codigo)}`).then(x => {
      setU(x); setNota(x.nota || '')
      const v = {}; x.lineas.forEach(l => { v[l.producto] = l.contado === null || l.contado === undefined ? '' : String(l.contado) }); setVals(v)
    }).catch(e => { toast(e.message, 'error'); onClose() })
  }, [id, codigo, toast, onClose])
  if (!u) return null
  const guardar = async (extra = {}) => {
    const lineas = u.lineas.filter(l => !l.inesperado || vals[l.producto] !== '').map(l => ({ producto: l.producto, contado: vals[l.producto] === '' ? undefined : Number(vals[l.producto]) }))
    for (const x of extras) if (x.producto.trim() && x.contado !== '') lineas.push({ producto: x.producto.trim(), descripcion: x.descripcion, contado: Number(x.contado), otra_un: x.otra_un })
    setOcupado(true)
    try {
      await inv.post(`/conteos/${id}/capturar`, { codigo, lineas, nota, ...extra })
      toast(codigo + ' guardada', 'ok'); onGuardada()
    } catch (e) {
      if (e.message.startsWith('CONFIRMAR:')) setConfirma(e.message.slice(10).replace(/\n\n¿Guardar tal cual.*$/s, ''))
      else toast(e.message, 'error')
      setOcupado(false)
    }
  }
  const faltaAlgo = u.lineas.some(l => !l.inesperado && vals[l.producto] === '')
  const addExtra = () => setExtras(x => [...x, { producto: '', descripcion: '', contado: '', otra_un: false }])
  const setEx = (i, k, v) => setExtras(x => x.map((e, j) => j === i ? { ...e, [k]: v } : e))
  return (
    <Modal titulo={codigo} sub={[u.grupo, u.estado === 'reconteo' ? `Reconteo ${u.ronda}${u.modo_reco === 'previo' ? ' (con cuenta previa)' : ' (a ciegas)'}` : ''].filter(Boolean).join(' - ')} onClose={onClose}>
      {u.lineas.length === 0 && <div className="sub-pag">El sistema no tiene productos en esta ubicacion. Si encuentras algo, agregalo abajo.</div>}
      <div className="inv-lineas">
        {u.lineas.map(l => (
          <div key={l.producto} className="inv-linea">
            <div><b>{l.producto}</b>{l.inesperado && <span className="chip chip-warn" style={{ marginLeft: 6 }}>no esperado</span>}<div className="sub-pag" style={{ margin: 0 }}>{l.descripcion}{l.esperado !== null && l.esperado !== undefined ? ` - sistema ${nf(l.esperado)}` : ''}</div></div>
            <input className="inp inv-cant" inputMode="decimal" type="number" min="0" aria-label={'Cantidad contada de ' + l.producto} value={vals[l.producto] ?? ''} onChange={e => setVals(v => ({ ...v, [l.producto]: e.target.value }))} />
          </div>
        ))}
        {extras.map((x, i) => (
          <div key={i} className="inv-linea inv-linea--extra">
            <div className="inv-extra-campos">
              <input className="inp" placeholder="Clave del producto" value={x.producto} onChange={e => setEx(i, 'producto', e.target.value)} />
              <input className="inp" placeholder="Descripcion (opcional)" value={x.descripcion} onChange={e => setEx(i, 'descripcion', e.target.value)} />
              <label className="inv-chk"><input type="checkbox" checked={x.otra_un} onChange={e => setEx(i, 'otra_un', e.target.checked)} /> Es de otra unidad de negocio</label>
            </div>
            <input className="inp inv-cant" inputMode="decimal" type="number" min="0" aria-label="Cantidad" value={x.contado} onChange={e => setEx(i, 'contado', e.target.value)} />
          </div>
        ))}
      </div>
      <div className="inv-fila" style={{ marginTop: 10 }}>
        <button className="btn-sec" onClick={addExtra}>Agregar producto no esperado</button>
        <button className="btn-sec" onClick={() => setIncid(true)}>Reportar incidencia</button>
      </div>
      <label className="inv-form" style={{ marginTop: 10 }}>Nota (opcional)<input className="inp" value={nota} onChange={e => setNota(e.target.value)} /></label>
      <div className="inv-fila" style={{ justifyContent: 'space-between', marginTop: 14 }}>
        <button className="btn-sec" disabled={ocupado} onClick={() => guardar({ vacia: true, confirmar: true })}>Ubicacion vacia</button>
        <button className="btn-principal" disabled={ocupado || faltaAlgo} onClick={() => guardar()}>{ocupado ? 'Guardando...' : 'Guardar conteo'}</button>
      </div>
      {faltaAlgo && <div className="sub-pag">Captura todas las cantidades. Si no hay nada de un producto, escribe 0.</div>}
      {confirma && (
        <Modal titulo="Revisa antes de guardar" onClose={() => setConfirma(null)}>
          <div style={{ whiteSpace: 'pre-line', marginBottom: 14 }}>{confirma}</div>
          <div className="inv-fila" style={{ justifyContent: 'flex-end' }}>
            <button className="btn-sec" onClick={() => setConfirma(null)}>Corregir</button>
            <button className="btn-principal" onClick={() => { setConfirma(null); guardar({ confirmar: true }) }}>Si, es correcto: guardar</button>
          </div>
        </Modal>
      )}
      {incid && <ModalIncidencia id={id} codigo={codigo} toast={toast} onClose={() => setIncid(false)} />}
    </Modal>
  )
}

// ---------- INCIDENCIAS ----------
function reduceFoto(archivo) {
  return new Promise((ok, mal) => {
    const r = new FileReader()
    r.onload = () => {
      const im = new Image()
      im.onload = () => {
        const k = Math.min(1, 1000 / Math.max(im.width, im.height)); const c = document.createElement('canvas')
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
        ok(c.toDataURL('image/jpeg', 0.7))
      }
      im.onerror = () => mal(new Error('No se pudo leer la foto')); im.src = r.result
    }
    r.onerror = () => mal(new Error('No se pudo leer la foto')); r.readAsDataURL(archivo)
  })
}

function ModalIncidencia({ id, codigo, toast, onClose, onCreada }) {
  const [op, setOp] = useState(null)
  const [f, setF] = useState({ tipo: '', codigo: codigo || '', producto: '', cantidad: '', impacto: 'No aplica', accion: 'Pendiente de definir', detalle: '', foto: null })
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => { inv.get('/incidencias/opciones').then(setOp).catch(() => {}) }, [])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const foto = async (e) => { const a = e.target.files[0]; if (!a) return; try { set('foto', { data: await reduceFoto(a), tipo: 'image/jpeg' }) } catch (er) { toast(er.message, 'error') } }
  const enviar = async () => {
    setOcupado(true)
    try { await inv.post(`/conteos/${id}/incidencias`, { ...f, cantidad: Number(f.cantidad) }); toast('Incidencia registrada', 'ok'); onCreada && onCreada(); onClose() }
    catch (e) { toast(e.message, 'error'); setOcupado(false) }
  }
  if (!op) return null
  return (
    <Modal titulo="Reportar incidencia" onClose={onClose}>
      <div className="inv-form">
        <label>Tipo<select className="inp" value={f.tipo} onChange={e => set('tipo', e.target.value)}><option value="">Elige...</option>{Object.entries(op.tipos).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label>Ubicacion<input className="inp" value={f.codigo} onChange={e => set('codigo', e.target.value)} /></label>
        <label>Numero de parte o descripcion<input className="inp" value={f.producto} onChange={e => set('producto', e.target.value)} /></label>
        <label>Cantidad afectada<input className="inp" type="number" min="0" inputMode="decimal" value={f.cantidad} onChange={e => set('cantidad', e.target.value)} /></label>
        <label>Impacto<select className="inp" value={f.impacto} onChange={e => set('impacto', e.target.value)}>{op.impactos.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Accion tomada<select className="inp" value={f.accion} onChange={e => set('accion', e.target.value)}>{op.acciones.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Detalle<input className="inp" value={f.detalle} onChange={e => set('detalle', e.target.value)} /></label>
        <label className="btn-sec inv-archivo">{f.foto ? 'Foto lista (cambiar)' : 'Tomar o elegir foto'}<input type="file" accept="image/*" capture="environment" hidden onChange={foto} /></label>
        <div className="inv-fila" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-sec" onClick={onClose}>Cancelar</button>
          <button className="btn-principal" disabled={ocupado || !f.tipo || !f.producto || !(Number(f.cantidad) > 0)} onClick={enviar}>{ocupado ? 'Enviando...' : 'Registrar incidencia'}</button>
        </div>
      </div>
    </Modal>
  )
}

function Incidencias({ id, toast, gestor }) {
  const [lista, setLista] = useState(null)
  const [nueva, setNueva] = useState(false)
  const cargar = useCallback(() => inv.get(`/conteos/${id}/incidencias`).then(setLista).catch(e => toast(e.message, 'error')), [id, toast])
  useEffect(() => { cargar() }, [cargar])
  const resolver = async (i, reabrir) => { try { await inv.post(`/incidencias/${i.id}/resolver`, { reabrir, nota: '' }); cargar() } catch (e) { toast(e.message, 'error') } }
  return (
    <div className="panel">
      <div className="inv-fila" style={{ justifyContent: 'space-between' }}>
        <div className="panel-titulo" style={{ margin: 0 }}>Incidencias</div>
        <div className="inv-fila">
          {gestor && <button className="btn-sec" onClick={() => inv.csv(`/conteos/${id}/incidencias/csv`).catch(e => toast(e.message, 'error'))}>Descargar CSV</button>}
          <button className="btn-principal" onClick={() => setNueva(true)}>Nueva incidencia</button>
        </div>
      </div>
      {!lista ? <div className="cargando">Cargando...</div> : lista.length === 0 ? <div className="sub-pag" style={{ marginTop: 12 }}>Sin incidencias.</div> : (
        <div className="lista-scroll"><table className="tabla"><thead><tr><th>Fecha</th><th>Ubicacion</th><th>Producto</th><th>Tipo</th><th>Cant.</th><th>Estado</th>{gestor && <th />}</tr></thead>
          <tbody>{lista.map(i => (
            <tr key={i.id} style={{ cursor: 'default' }}>
              <td>{fh(i.fecha)}</td><td>{i.codigo}</td><td>{i.producto}<div className="sub-pag" style={{ margin: 0 }}>{i.detalle}</div></td><td>{i.tipo_txt}</td><td>{nf(i.cantidad)}</td>
              <td><span className={'chip ' + (i.estado === 'resuelta' ? 'chip-ok' : 'chip-warn')}>{i.estado}</span></td>
              {gestor && <td><button className="btn-sec" onClick={() => resolver(i, i.estado === 'resuelta')}>{i.estado === 'resuelta' ? 'Reabrir' : 'Resolver'}</button></td>}
            </tr>))}</tbody></table></div>
      )}
      {nueva && <ModalIncidencia id={id} toast={toast} onClose={() => setNueva(false)} onCreada={cargar} />}
    </div>
  )
}

// ---------- ASIGNAR (gestor) ----------
function Asignar({ id, toast, onCambio }) {
  const [grupos, setGrupos] = useState(null)
  const [us, setUs] = useState([])
  const [sel, setSel] = useState({})
  const [quien, setQuien] = useState('')
  const cargar = useCallback(() => inv.get(`/conteos/${id}/grupos`).then(setGrupos).catch(e => toast(e.message, 'error')), [id, toast])
  useEffect(() => { cargar(); inv.get('/usuarios').then(setUs).catch(() => {}) }, [cargar])
  const asignar = async () => {
    const gs = Object.keys(sel).filter(k => sel[k])
    try { const r = await inv.post(`/conteos/${id}/asignar`, { grupos: gs, email: quien }); toast(`${r.cambiadas} ubicaciones ${quien ? 'asignadas' : 'sin asignar'}`, 'ok'); setSel({}); cargar(); onCambio() }
    catch (e) { toast(e.message, 'error') }
  }
  if (!grupos) return <div className="cargando">Cargando...</div>
  const todos = grupos.length > 0 && grupos.every(g => sel[g.grupo])
  return (
    <div className="panel">
      <div className="panel-titulo">Asignar por rack</div>
      <div className="inv-fila">
        <select className="inp" value={quien} onChange={e => setQuien(e.target.value)}><option value="">Sin asignar</option>{us.map(u => <option key={u.usuario} value={u.usuario}>{u.nombre} ({u.rol})</option>)}</select>
        <button className="btn-principal" disabled={!Object.values(sel).some(Boolean)} onClick={asignar}>Aplicar a los seleccionados</button>
      </div>
      <div className="lista-scroll"><table className="tabla"><thead><tr><th style={{ width: 40 }}><input type="checkbox" aria-label="Seleccionar todos" checked={todos} onChange={e => setSel(Object.fromEntries(grupos.map(g => [g.grupo, e.target.checked])))} /></th><th>Grupo</th><th>Ubicaciones</th><th>Contadas</th><th>Asignado a</th></tr></thead>
        <tbody>{grupos.map(g => (
          <tr key={g.grupo} style={{ cursor: 'default' }}>
            <td><input type="checkbox" aria-label={'Seleccionar ' + g.grupo} checked={!!sel[g.grupo]} onChange={e => setSel(s => ({ ...s, [g.grupo]: e.target.checked }))} /></td>
            <td><b>{g.grupo}</b></td><td>{g.total}</td><td>{g.contadas}</td><td>{g.asignado_a || '-'}</td></tr>))}</tbody></table></div>
    </div>
  )
}

// ---------- contenedor ----------
export default function ConteoDetalle({ id, toast }) {
  const gestor = api.esJefeEn('inventario')
  const [c, setC] = useState(null)
  const [tab, setTab] = useState(gestor ? 'avance' : 'contar')
  const [modal, setModal] = useState(null)
  const [motivo, setMotivo] = useState('')
  const cargar = useCallback(() => inv.get('/conteos/' + id).then(setC).catch(e => toast(e.message, 'error')), [id, toast])
  useEffect(() => { cargar() }, [cargar])
  if (!c) return <div className="cargando">Cargando conteo...</div>
  const accion = async (ruta, body, msg) => {
    try { await inv.post(`/conteos/${id}/${ruta}`, body); toast(msg, 'ok'); setModal(null); setMotivo(''); cargar() } catch (e) { toast(e.message, 'error') }
  }
  const tabs = gestor
    ? [['avance', 'Avance'], ['contar', 'Contar'], ['asignar', 'Asignar'], ['incidencias', 'Incidencias'], ['gestion', 'Reportes y revision']]
    : [['contar', 'Contar'], ['avance', 'Avance'], ['incidencias', 'Incidencias']]
  return (
    <>
      <div className="panel">
        <div className="inv-fila" style={{ justifyContent: 'space-between' }}>
          <div><div className="panel-titulo" style={{ margin: 0 }}>{c.nombre}</div><div className="sub-pag" style={{ margin: 0 }}>{c.id} - {c.alcance} - {c.ciego ? 'conteo ciego' : 'con cantidad del sistema'} - creado {fh(c.fecha)} por {c.creado_por}</div></div>
          <span className={'chip ' + (c.estatus === 'abierto' ? 'chip-ok' : c.estatus === 'pausado' ? 'chip-warn' : '')}>{c.estatus}</span>
        </div>
        <Barra pct={c.progreso.pct} />
        <div className="sub-pag">{c.progreso.contadas} de {c.progreso.ubicaciones} ubicaciones contadas</div>
        {c.pausa && <div className="ov-aviso ov-aviso--warn">En pausa desde {fh(c.pausa.inicio)} por {c.pausa.pausado_por}{c.pausa.motivo ? ': ' + c.pausa.motivo : ''}</div>}
        {gestor && (
          <div className="inv-fila">
            {c.estatus === 'abierto' && <button className="btn-sec" onClick={() => setModal('pausar')}>Pausar</button>}
            {c.estatus === 'pausado' && <button className="btn-sec" onClick={() => accion('reanudar', {}, 'Conteo reanudado')}>Reanudar</button>}
            {c.estatus !== 'cerrado' && <button className="btn-sec" onClick={() => setModal('cerrar')}>Cerrar conteo</button>}
            {c.estatus === 'cerrado' && <button className="btn-sec" onClick={() => setModal('reabrir')}>Reabrir</button>}
          </div>
        )}
      </div>
      <div className="seg-ctl inv-tabs" role="tablist">
        {tabs.map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={'seg-btn' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{t}</button>)}
      </div>
      {tab === 'avance' && <Avance id={id} toast={toast} />}
      {tab === 'contar' && <Capturar id={id} conteo={c} toast={toast} onCambio={cargar} />}
      {tab === 'asignar' && gestor && <Asignar id={id} toast={toast} onCambio={cargar} />}
      {tab === 'incidencias' && <Incidencias id={id} toast={toast} gestor={gestor} />}
      {tab === 'gestion' && gestor && <Gestion id={id} conteo={c} toast={toast} onCambio={cargar} />}
      {modal === 'pausar' && (
        <Modal titulo="Pausar conteo" sub="Nadie podra capturar hasta que lo reanudes. El tiempo en pausa queda registrado." onClose={() => setModal(null)}>
          <label className="inv-form">Motivo<input className="inp" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. fin de turno" /></label>
          <div className="inv-fila" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button><button className="btn-principal" onClick={() => accion('pausar', { motivo }, 'Conteo en pausa')}>Pausar</button></div>
        </Modal>
      )}
      {modal === 'cerrar' && (
        <Modal titulo="Cerrar conteo" sub={`Hay ${c.progreso.pendientes} ubicaciones sin contar. Al cerrar se guarda una foto de las cifras para comparar despues.`} onClose={() => setModal(null)}>
          <div className="inv-fila" style={{ justifyContent: 'flex-end' }}><button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button><button className="btn-principal" onClick={() => accion('cerrar', {}, 'Conteo cerrado')}>Cerrar conteo</button></div>
        </Modal>
      )}
      {modal === 'reabrir' && (
        <Modal titulo="Reabrir conteo" sub="Queda en pausa hasta que lo reanudes." onClose={() => setModal(null)}>
          <label className="inv-form">Motivo<input className="inp" value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
          <div className="inv-fila" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button><button className="btn-principal" onClick={() => accion('reabrir', { motivo }, 'Conteo reabierto (en pausa)')}>Reabrir</button></div>
        </Modal>
      )}
    </>
  )
}
