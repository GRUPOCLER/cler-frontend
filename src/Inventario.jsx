// ============================================================
//  INVENTARIO Y OPERACIONES
//  Mapa del almacen, buscador de producto (existencias de Odoo, solo lectura), conteos de auditoria y administracion.
//  Rutas: /inventario  /inventario/buscar  /inventario/conteos  /inventario/conteos/:id  /inventario/admin
// ============================================================
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as api from './api'
import { Modal } from './ControlOV'
import { nf } from './util'
import ConteoDetalle from './InvConteo'
import { MapaSvg, Leyenda, ESTADO_TXT, fh } from './InvUI'

const inv = api.inv
const estadoDe = (i) => (i.t && i.t !== 'rack' ? null : (i.n > 0 ? 'con' : 'vacia'))
const tituloDe = (i) => [i.c, i.b, i.z && 'Zona ' + i.z, i.n > 0 ? `${i.n} producto(s), ${nf(i.s)} pzas` : (!i.t || i.t === 'rack' ? 'Vacia' : '')].filter(Boolean).join(' - ')
// ---------- MAPA con existencias ----------
function Mapa({ toast }) {
  const [d, setD] = useState(null)
  const [sel, setSel] = useState(null)
  const [det, setDet] = useState(null)
  const [prod, setProd] = useState('')
  const [resalta, setResalta] = useState(null)
  useEffect(() => { inv.get('/mapa').then(setD).catch(e => toast(e.message, 'error')) }, [toast])
  const buscaProd = async (e) => {
    e.preventDefault()
    if (prod.trim().length < 2) { setResalta(null); return }
    try { const r = await inv.get('/listar?limite=5000&producto=' + encodeURIComponent(prod.trim())); setResalta(new Set(r.filas.map(x => x.codigo))) } catch (er) { toast(er.message, 'error') }
  }
  const abre = async (i) => {
    setSel(i.c)
    try { setDet(await inv.get('/ubicacion/' + encodeURIComponent(i.c))) } catch { setDet({ codigo: i.c, productos: [], sinDato: true }) }
  }
  if (!d) return <div className="cargando">Cargando mapa...</div>
  const clase = (i) => (i.t && i.t !== 'rack' ? '' : (i.n > 0 ? 'inv-e-con' : 'inv-e-vacia'))
  return (
    <div className="panel">
      <div className="panel-titulo">Mapa del almacen</div>
      <div className="sub-pag">{d.sync ? `Existencias de Odoo al ${fh(d.sync.fecha)}` : 'Aun no se han sincronizado existencias de Odoo.'}</div>
      <form className="inv-fila" onSubmit={buscaProd} style={{ marginTop: 10 }}>
        <input className="inp" placeholder="Resaltar donde esta un producto (clave o descripcion)" value={prod} onChange={e => setProd(e.target.value)} />
        <button className="btn-sec" type="submit">Resaltar</button>
        {resalta && <button className="btn-sec" type="button" onClick={() => { setResalta(null); setProd('') }}>Quitar</button>}
      </form>
      {resalta && <div className="sub-pag">{resalta.size ? `${nf(resalta.size)} ubicacion(es) con ese producto.` : 'Ninguna ubicacion tiene ese producto.'}</div>}
      <MapaSvg items={d.items} claseDe={clase} estadoDe={estadoDe} leyenda={['con', 'vacia']} onClick={abre} sel={sel} resaltar={resalta} tituloDe={tituloDe} />
      {det && (
        <Modal titulo={det.codigo} sub={[det.bodega, det.zona && 'Zona ' + det.zona].filter(Boolean).join(' - ')} onClose={() => { setDet(null); setSel(null) }}>
          {det.productos.length === 0 ? <div className="sub-pag">Sin existencias registradas en esta ubicacion.</div> : (
            <table className="tabla"><thead><tr><th>Clave</th><th>Descripcion</th><th>Cantidad</th><th>Reservado</th></tr></thead>
              <tbody>{det.productos.map(p => <tr key={p.clave}><td><b>{p.clave}</b></td><td>{p.descripcion}</td><td>{nf(p.cantidad)}</td><td>{nf(p.reservado)}</td></tr>)}</tbody></table>
          )}
        </Modal>
      )}
    </div>
  )
}

// ---------- BUSCAR producto / listar ubicaciones ----------
function Buscar({ toast }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [cod, setCod] = useState('')
  const [lista, setLista] = useState(null)
  const buscar = async () => { try { setRes(await inv.get('/producto?q=' + encodeURIComponent(q))) } catch (e) { toast(e.message, 'error') } }
  const listar = async () => { try { setLista(await inv.get('/listar?limite=200&codigo=' + encodeURIComponent(cod))) } catch (e) { toast(e.message, 'error') } }
  return (
    <>
      <div className="panel">
        <div className="panel-titulo">Donde esta un producto</div>
        <form className="inv-fila" onSubmit={e => { e.preventDefault(); buscar() }}>
          <input className="inp" placeholder="Clave o descripcion (minimo 2 letras)" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn-principal" type="submit">Buscar</button>
        </form>
        {res && res.length === 0 && <div className="sub-pag" style={{ marginTop: 12 }}>No se encontro ese producto en las existencias sincronizadas.</div>}
        {res && res.map(p => (
          <div key={p.clave} className="inv-prod">
            <div><b>{p.clave}</b> - {p.descripcion}</div>
            <div className="sub-pag">Total {nf(p.total)} en {p.ubicaciones} ubicacion(es). {p.por_bodega.map(b => `${b.bodega}: ${nf(b.cantidad)}`).join(' / ')}</div>
            <div className="lista-scroll"><table className="tabla"><thead><tr><th>Ubicacion</th><th>Bodega</th><th>Zona</th><th>Cantidad</th><th>Reservado</th></tr></thead>
              <tbody>{p.distribucion.map(d => <tr key={d.codigo}><td>{d.codigo}{!d.en_mapa && <span className="chip chip-warn" style={{ marginLeft: 6 }}>sin mapa</span>}</td><td>{d.bodega}</td><td>{d.zona}</td><td>{nf(d.cantidad)}</td><td>{nf(d.reservado)}</td></tr>)}</tbody></table></div>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-titulo">Listado de ubicaciones</div>
        <form className="inv-fila" onSubmit={e => { e.preventDefault(); listar() }}>
          <input className="inp" placeholder="Parte del codigo de ubicacion" value={cod} onChange={e => setCod(e.target.value)} />
          <button className="btn-sec" type="submit">Ver ubicaciones</button>
          {api.esJefeEn('inventario') && <button className="btn-sec" type="button" onClick={() => inv.csv('/listar/csv').catch(e => toast(e.message, 'error'))}>Descargar CSV</button>}
        </form>
        {lista && (
          <div className="lista-scroll"><table className="tabla"><thead><tr><th>Ubicacion</th><th>Bodega</th><th>Zona</th><th>Productos</th><th>Stock</th></tr></thead>
            <tbody>{lista.filas.map(f => <tr key={f.codigo}><td>{f.codigo}</td><td>{f.bodega}</td><td>{f.zona}</td><td>{f.productos.map(p => p.clave).join(', ') || '-'}</td><td>{nf(f.stock)}</td></tr>)}</tbody></table>
            <div className="sub-pag">{nf(lista.total)} ubicaciones{lista.total > lista.filas.length ? ' (se muestran las primeras ' + lista.filas.length + ')' : ''}</div></div>
        )}
      </div>
    </>
  )
}

// ---------- CONTEOS: lista + nuevo ----------
function Conteos({ toast }) {
  const nav = useNavigate()
  const gestor = api.esJefeEn('inventario')
  const [lista, setLista] = useState(null)
  const [nuevo, setNuevo] = useState(false)
  const cargar = useCallback(() => inv.get('/conteos').then(setLista).catch(e => toast(e.message, 'error')), [toast])
  useEffect(() => { cargar() }, [cargar])
  if (!lista) return <div className="cargando">Cargando conteos...</div>
  return (
    <div className="panel">
      <div className="inv-fila" style={{ justifyContent: 'space-between' }}>
        <div className="panel-titulo" style={{ margin: 0 }}>Conteos de inventario</div>
        {gestor && <button className="btn-principal" onClick={() => setNuevo(true)}>Nuevo conteo</button>}
      </div>
      {lista.length === 0 ? <div className="sub-pag" style={{ marginTop: 12 }}>{gestor ? 'Aun no hay conteos. Crea el primero.' : 'No tienes conteos abiertos por ahora.'}</div> : (
        <div className="lista-scroll"><table className="tabla"><thead><tr><th>Conteo</th><th>Alcance</th><th>Estatus</th><th>Avance</th>{!gestor && <th>Mis ubicaciones</th>}<th>Creado</th></tr></thead>
          <tbody>{lista.map(c => (
            <tr key={c.id} onClick={() => nav('/inventario/conteos/' + c.id)}>
              <td><b>{c.nombre}</b><div className="sub-pag" style={{ margin: 0 }}>{c.id}{c.tipo === 'producto' ? ' - por producto' : ''}</div></td>
              <td>{c.alcance}</td>
              <td><span className={'chip ' + (c.estatus === 'abierto' ? 'chip-ok' : c.estatus === 'pausado' ? 'chip-warn' : '')}>{c.estatus}</span></td>
              <td>{c.progreso.contadas} de {c.progreso.ubicaciones} ({c.progreso.pct}%)</td>
              {!gestor && <td>{c.mias.contadas} de {c.mias.total}</td>}
              <td>{fh(c.fecha)}</td>
            </tr>))}</tbody></table></div>
      )}
      {nuevo && <ModalNuevo toast={toast} onClose={() => setNuevo(false)} onCreado={(id) => { setNuevo(false); nav('/inventario/conteos/' + id) }} />}
    </div>
  )
}

function ModalNuevo({ toast, onClose, onCreado }) {
  const [f, setF] = useState({ nombre: '', bodega: '', zona: '', prefijo: '', productos: '', ciego: true, solo_con_existencia: true })
  const [filtros, setFiltros] = useState({ bodegas: [], zonas: [] })
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => { inv.get('/filtros').then(setFiltros).catch(() => {}) }, [])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const crear = async () => {
    setOcupado(true)
    try { const r = await inv.post('/conteos', f); toast('Conteo creado con ' + r.progreso.ubicaciones + ' ubicaciones', 'ok'); onCreado(r.id) }
    catch (e) { toast(e.message, 'error'); setOcupado(false) }
  }
  return (
    <Modal titulo="Nuevo conteo" sub="Se arma con las existencias de Odoo de la ultima sincronizacion. Odoo no se modifica." onClose={onClose}>
      <div className="inv-form">
        <label>Nombre<input className="inp" value={f.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej. Conteo ciclico bodega 1" /></label>
        <label>Bodega<select className="inp" value={f.bodega} onChange={e => set('bodega', e.target.value)}><option value="">Todas</option>{(filtros.bodegas || []).map(b => <option key={b}>{b}</option>)}</select></label>
        <label>Zona<select className="inp" value={f.zona} onChange={e => set('zona', e.target.value)}><option value="">Todas</option>{(filtros.zonas || []).map(b => <option key={b}>{b}</option>)}</select></label>
        <label>Prefijo de ubicacion (opcional)<input className="inp" value={f.prefijo} onChange={e => set('prefijo', e.target.value)} placeholder="Ej. ADISR1" /></label>
        <label>Solo estos productos (opcional, claves separadas por coma)<input className="inp" value={f.productos} onChange={e => set('productos', e.target.value)} /></label>
        <label className="inv-chk"><input type="checkbox" checked={f.ciego} onChange={e => set('ciego', e.target.checked)} /> Conteo ciego (el auditor no ve la cantidad del sistema)</label>
        <label className="inv-chk"><input type="checkbox" checked={f.solo_con_existencia} onChange={e => set('solo_con_existencia', e.target.checked)} /> Solo ubicaciones con existencia</label>
        <div className="inv-fila" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-sec" onClick={onClose}>Cancelar</button>
          <button className="btn-principal" disabled={ocupado || f.nombre.trim().length < 3} onClick={crear}>{ocupado ? 'Creando...' : 'Crear conteo'}</button>
        </div>
      </div>
    </Modal>
  )
}

// ---------- ADMIN: sincronizar + plano ----------
function Admin({ toast }) {
  const [sync, setSync] = useState(null)
  const [ocupado, setOcupado] = useState('')
  const [res, setRes] = useState(null)
  useEffect(() => { inv.get('/sync').then(setSync).catch(() => {}) }, [])
  const sincronizar = async () => {
    setOcupado('sync')
    try { const r = await inv.post('/sincronizar'); setSync(r); toast(`Sincronizado: ${nf(r.quants)} existencias en ${nf(r.ubicaciones)} ubicaciones`, 'ok') }
    catch (e) { toast(e.message, 'error') } finally { setOcupado('') }
  }
  const plano = async (e) => {
    const a = e.target.files[0]; if (!a) return
    setOcupado('plano')
    try { const r = await inv.archivo('/ubicaciones/importar', a); setRes(r); toast('Plano importado: ' + r.ubicaciones + ' ubicaciones', 'ok') }
    catch (er) { toast(er.message, 'error') } finally { setOcupado(''); e.target.value = '' }
  }
  return (
    <>
      <div className="panel">
        <div className="panel-titulo">Existencias de Odoo</div>
        <div className="sub-pag">Se leen de Odoo (solo lectura) y se guardan aqui. Sincroniza antes de crear un conteo.</div>
        {sync && <div className="inv-datos"><div>Ultima sincronizacion: <b>{fh(sync.fecha)}</b> por {sync.usuario}</div>
          <div>{nf(sync.quants)} existencias en {nf(sync.ubicaciones)} ubicaciones</div>
          {sync.sin_mapa > 0 && <div className="chip chip-warn">{sync.sin_mapa} ubicaciones de Odoo no estan en el plano: {sync.detalle}</div>}</div>}
        <button className="btn-principal" disabled={!!ocupado} onClick={sincronizar}>{ocupado === 'sync' ? 'Sincronizando...' : 'Sincronizar con Odoo'}</button>
      </div>
      <div className="panel">
        <div className="panel-titulo">Plano de ubicaciones</div>
        <div className="sub-pag">Sube el CSV del plano (codigo, bodega, rack, lado, tramo, nivel, zona, capacidad, x, y, ancho, alto, tipo). Reemplaza el plano actual; los conteos ya hechos no cambian.</div>
        <label className="btn-sec inv-archivo">{ocupado === 'plano' ? 'Importando...' : 'Elegir CSV del plano'}<input type="file" accept=".csv,text/csv" onChange={plano} hidden /></label>
        {res && <div className="sub-pag" style={{ marginTop: 10 }}>Se importaron {res.ubicaciones} ubicaciones.</div>}
      </div>
    </>
  )
}

// ---------- contenedor con pestanas ----------
export default function Inventario({ toast }) {
  const nav = useNavigate()
  const { id, seccion } = useParams()
  const gestor = api.esJefeEn('inventario')
  const nivel = api.nivelInv()
  const tab = id ? 'conteos' : (seccion || 'mapa')
  const tabs = [['mapa', 'Mapa'], ['buscar', 'Buscar'], ...(nivel >= 2 ? [['conteos', 'Conteos']] : []), ...(gestor ? [['admin', 'Administrar']] : [])]
  return (
    <div className="contenedor inv-pag">
      <div className="titulo-pag">Inventario y Operaciones</div>
      <div className="seg-ctl inv-tabs" role="tablist">
        {tabs.map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={'seg-btn' + (tab === k ? ' on' : '')} onClick={() => nav(k === 'mapa' ? '/inventario' : '/inventario/' + k)}>{t}</button>)}
      </div>
      {id ? <ConteoDetalle id={id} toast={toast} />
        : tab === 'buscar' ? <Buscar toast={toast} />
        : tab === 'conteos' && nivel >= 2 ? <Conteos toast={toast} />
        : tab === 'admin' && gestor ? <Admin toast={toast} />
        : <Mapa toast={toast} />}
    </div>
  )
}
