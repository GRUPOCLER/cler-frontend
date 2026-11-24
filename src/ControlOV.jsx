// ============================================================
//  CONTROL DE OV (refacciones)
//  OV de SAP (PDF) -> surtido por escaneo -> preparacion en cajas mixtas -> entrega SAP -> factura
//  Rutas: /ov  /ov/:id  /ov/:id/etiquetas
// ============================================================
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as api from './api'
import Etiquetas from './Etiquetas'

const ORDEN = ['recibida', 'en_surtido', 'surtida', 'en_preparacion', 'preparada', 'entregada_sap', 'facturada']
const NOMBRE = {
  recibida: 'Recibida', en_surtido: 'En surtido', surtida: 'Surtida', en_preparacion: 'En preparación',
  preparada: 'Preparada', entregada_sap: 'Entrega generada', facturada: 'Facturada', cancelada: 'Cancelada',
}
const TONO = {
  recibida: 'neutro', en_surtido: 'activo', surtida: 'neutro', en_preparacion: 'activo',
  preparada: 'neutro', entregada_sap: 'neutro', facturada: 'ok', cancelada: 'mal',
}
const ES_JEFE = (r) => r === 'admin' || r === 'gerente'
const PUEDE_CARGAR = (r) => r === 'admin' || r === 'gerente' || r === 'sap'
const PUEDE_FACTURAR = (r) => r === 'admin' || r === 'gerente' || r === 'facturacion'
const nf = (n) => new Intl.NumberFormat('es-MX').format(n || 0)

function dur(seg) {
  if (seg === null || seg === undefined) return '-'
  const m = Math.floor(seg / 60)
  if (m < 1) return 'menos de 1 min'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} h ${m % 60} min`
  return `${Math.floor(h / 24)} d ${h % 24} h`
}
function fechaHora(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map(x => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}
const fechaCorta = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '-') }

function useAhora(ms = 30000) {
  const [t, setT] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setT(Date.now()), ms); return () => clearInterval(i) }, [ms])
  return t
}
const segDesde = (iso, ahora) => (iso ? Math.max(0, Math.floor((ahora - Date.parse(iso)) / 1000)) : 0)

function Modal({ titulo, sub, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-head">
          <div><div className="modal-titulo">{titulo}</div>{sub && <div className="modal-sub">{sub}</div>}</div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">x</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

function Chip({ estatus, children }) {
  return <span className={'ov-chip ov-chip--' + (TONO[estatus] || 'neutro')}>{children || NOMBRE[estatus] || estatus}</span>
}
function Barra({ pct, etiqueta }) {
  const p = Math.max(0, Math.min(100, pct || 0))
  return (
    <div className="ov-barra" role="img" aria-label={`${etiqueta || 'Avance'} ${Math.round(p)}%`}>
      <div className="ov-barra-pista"><div className="ov-barra-relleno" style={{ width: p + '%' }} /></div>
      <span className="ov-barra-n">{Math.round(p)}%</span>
    </div>
  )
}
function Tiempo({ ov, ahora }) {
  const seg = segDesde(ov.estatus_desde, ahora)
  const final = ov.estatus === 'facturada' || ov.estatus === 'cancelada'
  if (final) return <span className="ov-tiempo">{fechaHora(ov.estatus_desde)}</span>
  const atras = ov.umbral_horas && seg > ov.umbral_horas * 3600
  return <span className={'ov-tiempo' + (atras ? ' ov-tiempo--atraso' : '')}>{dur(seg)} en este estatus{atras ? ' | atrasada' : ''}</span>
}

// ───────────────────────── TABLERO ─────────────────────────
export default function ControlOV({ toast }) {
  const navigate = useNavigate()
  const user = api.getUser()
  const rol = api.rolEn('refacciones')
  const ahora = useAhora()
  const [datos, setDatos] = useState(null)
  const [ver, setVer] = useState('activas')
  const [q, setQ] = useState('')
  const [error, setError] = useState(null)
  const [cargarOV, setCargarOV] = useState(false)
  const [modalCat, setModalCat] = useState(false)

  const cargar = useCallback(() => {
    api.ovListar(ver, q).then(d => { setDatos(d); setError(null) }).catch(e => setError(e.message))
  }, [ver, q])
  useEffect(() => { const t = setTimeout(cargar, q ? 250 : 0); return () => clearTimeout(t) }, [cargar])
  useEffect(() => { const i = setInterval(cargar, 30000); return () => clearInterval(i) }, [cargar])

  const activos = ORDEN.filter(e => e !== 'facturada')
  return (
    <div className="contenedor ov-pagina">
      <div className="ov-cab">
        <h1 className="an-h1">Control de OV</h1>
        <div className="ov-cab-acc">
          {ES_JEFE(rol) && <button className="btn-sec" onClick={() => setModalCat(true)}>Categorías de productos</button>}
          {PUEDE_CARGAR(rol) && <button className="btn-principal" onClick={() => setCargarOV(true)}>Cargar OV</button>}
        </div>
      </div>

      {datos && (
        <div className="ov-resumen" role="group" aria-label="OV por estatus">
          {activos.map(e => (
            <button key={e} className={'ov-resumen-it' + (ver === e ? ' on' : '')} onClick={() => setVer(ver === e ? 'activas' : e)}>
              <span className="ov-resumen-n">{datos.conteo[e] || 0}</span>
              <span className="ov-resumen-t">{NOMBRE[e]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="ov-filtros">
        <label className="an-campo">Ver
          <select className="inp" value={ver} onChange={e => setVer(e.target.value)}>
            <option value="activas">Activas</option>
            <option value="todas">Todas</option>
            {ORDEN.concat(['cancelada']).map(e => <option key={e} value={e}>{NOMBRE[e]}</option>)}
          </select>
        </label>
        <label className="an-campo ov-buscar">Buscar
          <input className="inp" value={q} onChange={e => setQ(e.target.value)} placeholder="OV, cliente, referencia o folio de entrega" />
        </label>
      </div>

      {error && <div className="an-estado an-estado--error">{error} <button className="btn-sec" onClick={cargar}>Reintentar</button></div>}
      {!datos && !error && <div className="cargando">Cargando OV...</div>}
      {datos && datos.ovs.length === 0 && <div className="an-estado">No hay OV con ese filtro.{PUEDE_CARGAR(rol) ? ' Usa "Cargar OV" para adjuntar el PDF de SAP.' : ''}</div>}
      {datos && datos.ovs.length > 0 && (
        <div className="an-tabla-wrap">
          <table className="tabla ov-tabla">
            <thead><tr><th>OV</th><th>Cliente</th><th>Estatus</th><th>Surtido</th><th>Preparado</th><th className="num">Cajas</th><th>Entrega</th></tr></thead>
            <tbody>
              {datos.ovs.map(o => (
                <tr key={o.id} tabIndex={0} onClick={() => navigate(`/ov/${o.id}`)} onKeyDown={e => e.key === 'Enter' && navigate(`/ov/${o.id}`)}>
                  <td className="an-folio">{o.num_ov}{o.referencia && <div className="an-nota">{o.referencia}</div>}</td>
                  <td>{o.cliente}<div className="an-nota">{o.destino_ciudad}</div></td>
                  <td><Chip estatus={o.estatus} /><div><Tiempo ov={o} ahora={ahora} /></div></td>
                  <td style={{ minWidth: 120 }}><Barra pct={o.progreso.pct_surtido} etiqueta="Surtido" /></td>
                  <td style={{ minWidth: 120 }}>{['recibida', 'en_surtido', 'surtida'].includes(o.estatus) ? <span className="an-nota">-</span> : <Barra pct={o.progreso.pct_preparado} etiqueta="Preparado" />}</td>
                  <td className="num">{o.cajas || '-'}</td>
                  <td>{fechaCorta(o.fecha_entrega)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cargarOV && <ModalCargarOV toast={toast} onClose={() => setCargarOV(false)} onCreada={(id) => { setCargarOV(false); navigate(`/ov/${id}`) }} />}
      {modalCat && <ModalCategorias toast={toast} onClose={() => setModalCat(false)} />}
    </div>
  )
}

function ModalCargarOV({ toast, onClose, onCreada }) {
  const [prev, setPrev] = useState(null)
  const [leyendo, setLeyendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const leer = async (f) => {
    if (!f) return
    setError(null); setPrev(null); setLeyendo(true)
    try { setPrev(await api.ovLeer(f)) } catch (e) { setError(e.message) } finally { setLeyendo(false) }
  }
  const crear = async () => {
    setGuardando(true)
    try { const r = await api.ovCrear(prev); toast('OV cargada', 'ok'); onCreada(r.id) }
    catch (e) { setError(e.message); setGuardando(false) }
  }
  const piezas = prev ? prev.partidas.reduce((a, p) => a + p.cantidad, 0) : 0
  const bloqueada = prev && prev.ya_existe && !['recibida', 'cancelada'].includes(prev.ya_existe_estatus)
  return (
    <Modal titulo="Cargar OV de SAP" sub="Adjunta el PDF de la confirmación de pedido" onClose={onClose}
      footer={<><button className="btn-sec" onClick={onClose}>Cancelar</button>
        <button className="btn-principal" disabled={!prev || guardando || bloqueada} onClick={crear}>{guardando ? 'Guardando...' : 'Crear OV'}</button></>}>
      <input type="file" accept="application/pdf" className="inp" onChange={e => leer(e.target.files[0])} aria-label="PDF de la OV" />
      {leyendo && <div className="cargando">Leyendo el PDF...</div>}
      {error && <div className="an-estado an-estado--error">{error}</div>}
      {prev && (
        <div className="ov-prev">
          <dl className="ov-datos">
            <div><dt>OV</dt><dd>{prev.num_ov}</dd></div>
            <div><dt>Cliente</dt><dd>{prev.cliente}</dd></div>
            <div><dt>Destino</dt><dd>{prev.destino_ciudad || prev.destino}</dd></div>
            <div><dt>Referencia</dt><dd>{prev.referencia || '-'}</dd></div>
            <div><dt>Partidas</dt><dd>{nf(prev.partidas.length)}</dd></div>
            <div><dt>Piezas</dt><dd>{nf(piezas)}</dd></div>
            <div><dt>Entrega parcial</dt><dd>{prev.permite_parcial ? 'Permitida' : 'No indicada'}</dd></div>
          </dl>
          {prev.ya_existe && <div className="ov-aviso ov-aviso--mal">{bloqueada ? `La OV ya está en el sistema (${NOMBRE[prev.ya_existe_estatus]}). Cancélala antes de volver a cargarla.` : 'La OV ya estaba cargada; se reemplazará con este PDF.'}</div>}
          {prev.avisos.map((a, i) => <div key={i} className="ov-aviso ov-aviso--mal">{a}</div>)}
          {prev.sin_categoria.length > 0 && <div className="ov-aviso">{prev.sin_categoria.length} producto(s) no están en el catálogo de categorías: {prev.sin_categoria.slice(0, 5).join(', ')}{prev.sin_categoria.length > 5 ? '...' : ''}</div>}
        </div>
      )}
    </Modal>
  )
}

function ModalCategorias({ toast, onClose }) {
  const [n, setN] = useState(null)
  const [sub, setSub] = useState(false)
  useEffect(() => { api.ovCatalogoEstado().then(d => setN(d.productos)).catch(() => {}) }, [])
  const subir = async (f) => {
    if (!f) return
    setSub(true)
    try { const r = await api.ovCatalogoImportar(f); setN(r.productos); toast(`Categorías actualizadas: ${nf(r.productos)} productos`, 'ok') }
    catch (e) { toast(e.message, 'error') } finally { setSub(false) }
  }
  return (
    <Modal titulo="Categorías de productos" sub={n === null ? '' : `${nf(n)} productos cargados`} onClose={onClose}
      footer={<button className="btn-sec" onClick={onClose}>Cerrar</button>}>
      <p className="an-nota" style={{ marginTop: 0 }}>Sube el archivo CATEGORIAS (hoja CATEGORIAS, con CODIGO, DESCRIPCION, TIPO, MARCA, DIVISION, GRUPO). Se usa para clasificar las partidas de cada OV.</p>
      <input type="file" accept=".xlsx" className="inp" disabled={sub} onChange={e => subir(e.target.files[0])} aria-label="Archivo de categorías" />
      {sub && <div className="cargando">Importando, puede tardar unos segundos...</div>}
    </Modal>
  )
}

// ───────────────────────── DETALLE ─────────────────────────
export function OVDetalle({ toast }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const rol = api.rolEn('refacciones')
  const ahora = useAhora()
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)
  const [modalCancelar, setModalCancelar] = useState(false)

  const cargar = useCallback(() => api.ovDetalle(id).then(x => { setD(x); setError(null); return x }).catch(e => { setError(e.message) }), [id])
  useEffect(() => { cargar() }, [cargar])

  if (error && !d) return <div className="contenedor"><div className="an-estado an-estado--error">{error} <button className="btn-sec" onClick={() => navigate('/ov')}>Volver</button></div></div>
  if (!d) return <div className="cargando">Cargando OV...</div>
  const idx = ORDEN.indexOf(d.estatus)
  const abierta = !['facturada', 'cancelada'].includes(d.estatus)
  const p = d.progreso

  return (
    <div className="contenedor ov-pagina">
      <div className="ov-cab">
        <div>
          <button className="btn-sec" onClick={() => navigate('/ov')}>Volver</button>
        </div>
        <div className="ov-cab-acc">
          {abierta && ES_JEFE(rol) && <button className="btn-sec" onClick={() => setModalCancelar(true)}>Cancelar OV</button>}
        </div>
      </div>

      <section className="ov-encab">
        <div>
          <div className="an-nota">Orden de venta</div>
          <h1 className="ov-num">{d.num_ov}</h1>
          <div className="ov-cliente">{d.cliente}</div>
          <div className="an-nota">{[d.destino_ciudad, d.referencia && 'Ref. ' + d.referencia, 'Entrega ' + fechaCorta(d.fecha_entrega)].filter(Boolean).join(' | ')}</div>
        </div>
        <div className="ov-encab-est">
          <Chip estatus={d.estatus} />
          <div><Tiempo ov={d} ahora={ahora} /></div>
          <div className="an-nota">En el sistema desde {fechaHora(d.creado_en)} ({dur(segDesde(d.creado_en, ahora))})</div>
        </div>
      </section>

      <ol className="ov-rail" aria-label="Avance de la OV">
        {ORDEN.map((e, i) => (
          <li key={e} className={'ov-rail-it' + (d.estatus === e ? ' on' : i < idx ? ' hecho' : '')} aria-current={d.estatus === e ? 'step' : undefined}>{NOMBRE[e]}</li>
        ))}
      </ol>

      <div className="ov-avances">
        <div><div className="an-nota">Surtido: {nf(p.surtidas)} de {nf(p.piezas)} piezas ({p.lineas_surtidas} de {p.lineas} partidas)</div><Barra pct={p.pct_surtido} etiqueta="Surtido" /></div>
        <div><div className="an-nota">Preparado: {nf(p.empacadas)} de {nf(p.surtidas)} piezas surtidas en {d.cajas} caja(s)</div><Barra pct={p.pct_preparado} etiqueta="Preparado" /></div>
      </div>

      {['recibida', 'en_surtido'].includes(d.estatus) && <PanelSurtido d={d} rol={rol} toast={toast} recargar={cargar} />}
      {d.estatus === 'surtida' && <PanelListoParaPreparar d={d} toast={toast} recargar={cargar} />}
      {d.estatus === 'en_preparacion' && <PanelPreparacion d={d} rol={rol} toast={toast} recargar={cargar} setD={setD} navigate={navigate} />}
      {d.estatus === 'preparada' && <PanelEntrega d={d} rol={rol} toast={toast} recargar={cargar} navigate={navigate} />}
      {d.estatus === 'entregada_sap' && <PanelFactura d={d} rol={rol} toast={toast} recargar={cargar} />}
      {d.estatus === 'facturada' && <PanelCerrada d={d} />}
      {d.estatus === 'cancelada' && <div className="ov-panel"><div className="ov-aviso ov-aviso--mal">OV cancelada. {(d.eventos.find(e => e.estatus === 'cancelada') || {}).nota}</div></div>}

      {d.cajas_detalle.length > 0 && !['en_preparacion', 'preparada'].includes(d.estatus) && (
        <section className="ov-panel"><h2 className="ov-h2">Cajas</h2><ListaCajas d={d} rol={rol} navigate={navigate} /></section>
      )}

      <section className="ov-panel">
        <h2 className="ov-h2">Historial y tiempos</h2>
        <div className="an-tabla-wrap">
          <table className="an-tabla">
            <thead><tr><th>Estatus</th><th>Desde</th><th className="num">Duración</th><th>Usuario</th><th>Nota</th></tr></thead>
            <tbody>
              {d.eventos.map((e, i) => (
                <tr key={i}><td>{NOMBRE[e.estatus]}</td><td>{fechaHora(e.desde)}</td>
                  <td className="num">{e.en_curso ? dur(segDesde(e.desde, ahora)) + ' (en curso)' : dur(e.segundos)}</td><td>{e.por}</td><td>{e.nota}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ov-panel">
        <h2 className="ov-h2">Partidas</h2>
        <TablaPartidas lineas={d.lineas} />
      </section>

      {modalCancelar && <ModalMotivo titulo="Cancelar OV" texto="La OV quedará cancelada. Escribe el motivo." onClose={() => setModalCancelar(false)}
        onOk={async (m) => { try { await api.ovCancelar(id, m); setModalCancelar(false); toast('OV cancelada', 'ok'); cargar() } catch (e) { toast(e.message, 'error') } }} />}
    </div>
  )
}

function ModalMotivo({ titulo, texto, onClose, onOk, boton = 'Confirmar' }) {
  const [m, setM] = useState('')
  const [env, setEnv] = useState(false)
  const ok = m.trim().length >= 3
  return (
    <Modal titulo={titulo} sub={texto} onClose={onClose}
      footer={<><button className="btn-sec" onClick={onClose} disabled={env}>Cancelar</button>
        <button className="btn-principal" disabled={!ok || env} onClick={async () => { setEnv(true); try { await onOk(m.trim()) } finally { setEnv(false) } }}>{boton}</button></>}>
      <label className="an-campo">Motivo<textarea className="inp" rows={3} value={m} onChange={e => setM(e.target.value)} autoFocus /></label>
    </Modal>
  )
}

function TablaPartidas({ lineas }) {
  return (
    <div className="an-tabla-wrap">
      <table className="an-tabla">
        <thead><tr><th>#</th><th>Código</th><th>Descripción</th><th>Categoría</th><th className="num">Pedido</th><th className="num">Surtido</th><th className="num">Empacado</th><th className="num">En entrega</th></tr></thead>
        <tbody>
          {lineas.map(l => (
            <tr key={l.id}>
              <td>{l.linea}</td><td className="an-folio">{l.codigo}</td><td>{l.descripcion}{l.motivo_faltante && <div className="an-nota">Faltante: {l.motivo_faltante}</div>}</td>
              <td>{l.division}{l.marca && <div className="an-nota">{l.marca}</div>}</td>
              <td className="num">{nf(l.cantidad)}</td><td className="num">{nf(l.surtida)}</td><td className="num">{nf(l.empacada)}</td>
              <td className="num">{l.entrega_cantidad === null || l.entrega_cantidad === undefined ? '-' : nf(l.entrega_cantidad)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Entrada de escaneo reutilizable ──
function Escaner({ onScan, etiqueta, deshabilitado }) {
  const ref = useRef(null)
  const [cod, setCod] = useState('')
  const [cant, setCant] = useState(1)
  const [fb, setFb] = useState(null)   // { ok, texto }
  const [env, setEnv] = useState(false)
  useEffect(() => { ref.current && ref.current.focus() }, [])
  const enviar = async () => {
    const c = cod.trim()
    if (!c || env) return
    setEnv(true)
    try {
      const r = await onScan(c, Math.max(1, parseInt(cant) || 1))
      setFb({ ok: true, texto: r || 'Listo' }); setCod(''); setCant(1)
    } catch (e) { setFb({ ok: false, texto: e.message }); setCod('') }
    finally { setEnv(false); ref.current && ref.current.focus() }
  }
  return (
    <div className="ov-escaner">
      <div className="ov-escaner-fila">
        <label className="an-campo ov-escaner-cod">{etiqueta}
          <input ref={ref} className="inp ov-escaner-inp" value={cod} onChange={e => setCod(e.target.value)} disabled={deshabilitado}
            onKeyDown={e => e.key === 'Enter' && enviar()} placeholder="Escanea o escribe el código" autoComplete="off" inputMode="text" />
        </label>
        <label className="an-campo ov-escaner-cant">Piezas
          <input className="inp" type="number" min="1" value={cant} onChange={e => setCant(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviar()} disabled={deshabilitado} />
        </label>
        <button className="btn-principal" onClick={enviar} disabled={!cod.trim() || env || deshabilitado}>Agregar</button>
      </div>
      <div className={'ov-fb' + (fb ? (fb.ok ? ' ov-fb--ok' : ' ov-fb--mal') : '')} role="status" aria-live="polite">{fb ? fb.texto : ' '}</div>
    </div>
  )
}

// ── Surtido ──
function PanelSurtido({ d, rol, toast, recargar }) {
  const [soloPend, setSoloPend] = useState(true)
  const [modalFalt, setModalFalt] = useState(false)
  const falt = d.lineas.filter(l => l.surtida < l.cantidad)
  const lista = soloPend ? falt : d.lineas
  const escanear = async (cod, cant) => {
    const r = await api.ovSurtirEscanear(d.id, cod, cant)
    await recargar()
    return `${r.linea.codigo}: ${r.linea.surtida} de ${r.linea.cantidad}`
  }
  const total = async (l) => { try { await api.ovSurtirLinea(d.id, l.id, l.cantidad); await recargar() } catch (e) { toast(e.message, 'error') } }
  const quitar = async (l) => { try { await api.ovSurtirLinea(d.id, l.id, 0); await recargar() } catch (e) { toast(e.message, 'error') } }
  const terminar = async (motivo) => {
    try { await api.ovSurtidoTerminar(d.id, motivo); setModalFalt(false); toast('Surtido terminado', 'ok'); await recargar() } catch (e) { toast(e.message, 'error') }
  }
  return (
    <section className="ov-panel">
      <h2 className="ov-h2">Surtido</h2>
      <Escaner etiqueta="Código del producto" onScan={escanear} />
      <div className="ov-lista-cab">
        <label className="ov-check"><input type="checkbox" checked={soloPend} onChange={e => setSoloPend(e.target.checked)} /> Mostrar solo lo pendiente ({falt.length})</label>
        {falt.length > 0
          ? (ES_JEFE(rol)
            ? <button className="btn-sec" onClick={() => setModalFalt(true)}>Terminar con faltantes</button>
            : <span className="an-nota">Para cerrar con faltantes se requiere un gerente.</span>)
          : <button className="btn-principal" onClick={() => terminar('')}>Terminar surtido</button>}
      </div>
      <div className="an-tabla-wrap">
        <table className="an-tabla">
          <thead><tr><th>#</th><th>Código</th><th>Descripción</th><th className="num">Pedido</th><th>Surtido</th><th /></tr></thead>
          <tbody>
            {lista.map(l => (
              <tr key={l.id} className={l.surtida >= l.cantidad ? 'ov-fila-ok' : ''}>
                <td>{l.linea}</td>
                <td className="an-folio">{l.codigo}{l.en_mezanine && <div className="an-nota">Mezanine</div>}</td>
                <td>{l.descripcion}<div className="an-nota">{[l.division, l.marca].filter(Boolean).join(' | ')}</div></td>
                <td className="num">{nf(l.cantidad)}</td>
                <td style={{ minWidth: 130 }}><Barra pct={100 * l.surtida / (l.cantidad || 1)} etiqueta={`Partida ${l.linea}`} /><span className="an-nota">{nf(l.surtida)} de {nf(l.cantidad)}</span></td>
                <td className="ov-acc">
                  {l.surtida < l.cantidad && <button className="btn-mini" onClick={() => total(l)}>Confirmar total</button>}
                  {l.surtida > 0 && <button className="btn-mini" onClick={() => quitar(l)} aria-label={`Reiniciar partida ${l.linea}`}>Reiniciar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modalFalt && <ModalMotivo titulo="Terminar surtido con faltantes" texto={`${falt.length} partida(s) quedan incompletas.`} boton="Terminar surtido" onClose={() => setModalFalt(false)} onOk={terminar} />}
    </section>
  )
}

function PanelListoParaPreparar({ d, toast, recargar }) {
  const falt = d.lineas.filter(l => l.surtida < l.cantidad)
  return (
    <section className="ov-panel">
      <h2 className="ov-h2">Lista para preparar</h2>
      <p>El surtido terminó{d.nota_faltantes ? ' con faltantes' : ' completo'}.</p>
      {d.nota_faltantes && <div className="ov-aviso">Faltantes ({falt.length} partidas): {d.nota_faltantes}</div>}
      <button className="btn-principal" onClick={async () => { try { await api.ovPrepIniciar(d.id); await recargar() } catch (e) { toast(e.message, 'error') } }}>Iniciar preparación</button>
    </section>
  )
}

// ── Preparacion ──
function ListaCajas({ d, rol, navigate, onReabrir }) {
  return (
    <div className="ov-cajas">
      {d.cajas_detalle.filter(c => c.estatus === 'cerrada').map(c => (
        <div key={c.id} className="ov-caja">
          <div className="ov-caja-cab"><b>Caja {c.numero}</b><span className="an-nota">{nf(c.piezas)} piezas | {c.items.length} producto(s){c.peso_kg ? ` | ${c.peso_kg} kg` : (c.peso_calc_completo ? ` | ${c.peso_calc_kg} kg calc.` : '')}</span></div>
          <div className="an-nota">{c.impresa_veces ? `Impresa ${c.impresa_veces} ${c.impresa_veces === 1 ? "vez" : "veces"}, última ${fechaHora(c.ultima_impresion_en)} (${c.ultima_impresion_por})` : 'Sin imprimir'}</div>
          <div className="ov-acc">
            <button className="btn-mini" onClick={() => navigate(`/ov/${d.id}/etiquetas?caja=${c.id}`)}>{c.impresa_veces ? 'Reimprimir etiqueta' : 'Imprimir etiqueta'}</button>
            {onReabrir && ES_JEFE(rol) && <button className="btn-mini" onClick={() => onReabrir(c)}>Reabrir</button>}
          </div>
        </div>
      ))}
    </div>
  )
}

function PanelPreparacion({ d, rol, toast, recargar, setD, navigate }) {
  const abierta = d.cajas_detalle.find(c => c.estatus === 'abierta')
  const [peso, setPeso] = useState('')
  const [modalTerm, setModalTerm] = useState(false)
  const porEmpacar = d.lineas.filter(l => l.surtida > l.empacada)
  const run = async (fn, ok) => { try { const r = await fn(); if (ok) toast(ok, 'ok'); await recargar(); return r } catch (e) { toast(e.message, 'error') } }
  const escanear = async (cod, cant) => {
    const r = await api.ovCajaEscanear(d.id, abierta.id, cod, cant)
    setD(r)
    const l = r.lineas.find(x => x.codigo.replace(/[\s_]/g, '').toUpperCase() === cod.replace(/[*\s_]/g, '').toUpperCase())
    return l ? `${l.codigo}: ${nf(l.empacada)} de ${nf(l.surtida)} empacadas` : 'Agregado'
  }
  return (
    <section className="ov-panel">
      <h2 className="ov-h2">Preparación</h2>
      {!abierta && (
        <div className="ov-lista-cab">
          <span>{porEmpacar.length ? `Faltan ${nf(porEmpacar.reduce((a, l) => a + l.surtida - l.empacada, 0))} piezas por empacar.` : 'Todo está empacado.'}</span>
          <button className="btn-principal" onClick={() => run(() => api.ovCajaNueva(d.id))}>Abrir caja {d.cajas_detalle.length + 1}</button>
        </div>
      )}
      {abierta && (
        <div className="ov-caja-actual">
          <div className="ov-caja-cab"><b>Caja {abierta.numero} (abierta)</b><span className="an-nota">{nf(abierta.piezas)} piezas</span></div>
          <Escaner etiqueta="Código del producto" onScan={escanear} />
          {abierta.items.length > 0 && (
            <div className="an-tabla-wrap">
              <table className="an-tabla">
                <thead><tr><th>Código</th><th>Descripción</th><th className="num">Piezas</th><th /></tr></thead>
                <tbody>
                  {abierta.items.map(i => (
                    <tr key={i.linea_id}><td className="an-folio">{i.codigo}</td><td>{i.descripcion}</td><td className="num">{nf(i.cantidad)}</td>
                      <td className="ov-acc"><button className="btn-mini" onClick={() => run(async () => setD(await api.ovCajaQuitar(d.id, abierta.id, i.linea_id, 1)))}>Quitar 1</button>
                        <button className="btn-mini" onClick={() => run(async () => setD(await api.ovCajaQuitar(d.id, abierta.id, i.linea_id, i.cantidad)))}>Quitar todo</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="ov-escaner-fila">
            <label className="an-campo">Peso real en kg (opcional)
              <input className="inp" type="number" min="0" step="0.1" value={peso} onChange={e => setPeso(e.target.value)} />
            </label>
            <button className="btn-principal" disabled={abierta.piezas < 1} onClick={() => run(async () => { setD(await api.ovCajaCerrar(d.id, abierta.id, parseFloat(peso) || null)); setPeso('') }, `Caja ${abierta.numero} cerrada`)}>Cerrar caja {abierta.numero}</button>
          </div>
        </div>
      )}

      {d.cajas_detalle.some(c => c.estatus === 'cerrada') && (<>
        <h3 className="ov-h3">Cajas cerradas</h3>
        <ListaCajas d={d} rol={rol} navigate={navigate} onReabrir={(c) => run(() => api.ovCajaReabrir(d.id, c.id), `Caja ${c.numero} reabierta`)} />
        <div className="ov-acc"><button className="btn-sec" onClick={() => navigate(`/ov/${d.id}/etiquetas`)}>Etiquetas de todas las cajas</button></div>
      </>)}

      {!abierta && d.cajas_detalle.length > 0 && porEmpacar.length > 0 && (
        ES_JEFE(rol) ? <div className="ov-acc"><button className="btn-sec" onClick={() => setModalTerm(true)}>Terminar con piezas sin empacar</button></div>
          : <p className="an-nota">Para terminar con piezas sin empacar se requiere un gerente.</p>
      )}

      <h3 className="ov-h3">Por empacar ({porEmpacar.length} partidas)</h3>
      {porEmpacar.length === 0 ? <p className="an-nota">Nada pendiente.</p> : (
        <div className="an-tabla-wrap">
          <table className="an-tabla">
            <thead><tr><th>Código</th><th>Descripción</th><th>Categoría</th><th className="num">Por empacar</th></tr></thead>
            <tbody>{porEmpacar.map(l => <tr key={l.id}><td className="an-folio">{l.codigo}</td><td>{l.descripcion}</td><td>{l.division}</td><td className="num">{nf(l.surtida - l.empacada)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {modalTerm && <ModalMotivo titulo="Terminar preparación" texto="Quedan piezas surtidas sin empacar." boton="Terminar" onClose={() => setModalTerm(false)}
        onOk={async (m) => { try { await api.ovPrepTerminar(d.id, m); setModalTerm(false); await recargar() } catch (e) { toast(e.message, 'error') } }} />}
    </section>
  )
}

// ── Entrega SAP ──
function Conciliacion({ v }) {
  const c = v.conciliacion
  return (
    <div className="ov-conc">
      <div className={'ov-aviso' + (c.limpia ? ' ov-aviso--ok' : ' ov-aviso--mal')}>
        Entrega {v.folio}: {c.coinciden} partida(s) coinciden con lo preparado{c.limpia ? '. Todo cuadra.' : `; ${c.diferencias.length + c.no_en_ov.length} con diferencia.`}
      </div>
      {v.avisos.map((a, i) => <div key={i} className="ov-aviso ov-aviso--mal">{a}</div>)}
      {c.diferencias.length > 0 && (
        <div className="an-tabla-wrap"><table className="an-tabla">
          <thead><tr><th>Código</th><th>Descripción</th><th className="num">Pedido</th><th className="num">Preparado</th><th className="num">En entrega SAP</th></tr></thead>
          <tbody>{c.diferencias.map((x, i) => <tr key={i}><td className="an-folio">{x.codigo}</td><td>{x.descripcion}</td><td className="num">{nf(x.pedida)}</td><td className="num">{nf(x.empacada)}</td><td className="num"><b>{nf(x.entrega)}</b></td></tr>)}</tbody>
        </table></div>
      )}
      {c.no_en_ov.length > 0 && <div className="ov-aviso ov-aviso--mal">En la entrega y no en la OV: {c.no_en_ov.map(x => `${x.codigo} (${x.entrega})`).join(', ')}</div>}
    </div>
  )
}

function PanelEntrega({ d, rol, toast, recargar, navigate }) {
  const [folio, setFolio] = useState('')
  const [arch, setArch] = useState(null)
  const [val, setVal] = useState(null)
  const [conf, setConf] = useState(false)
  const [env, setEnv] = useState(false)
  const puede = PUEDE_CARGAR(rol)
  const validar = async (f) => {
    setArch(f); setVal(null); setConf(false)
    if (!f) return
    try { const v = await api.ovEntregaValidar(d.id, f); setVal(v); setFolio(v.folio) } catch (e) { toast(e.message, 'error') }
  }
  const registrar = async () => {
    setEnv(true)
    try { await api.ovEntregaRegistrar(d.id, { folio, archivo: arch, confirmar: conf }); toast('Entrega registrada', 'ok'); await recargar() }
    catch (e) { toast(e.message, 'error') } finally { setEnv(false) }
  }
  const sinConfirmar = val && !val.conciliacion.limpia && !conf
  return (
    <section className="ov-panel">
      <h2 className="ov-h2">Entrega en SAP</h2>
      <p>La mercancía está preparada en {d.cajas} caja(s). El encargado de SAP genera la entrega y registra aquí el folio.</p>
      <div className="ov-acc"><button className="btn-sec" onClick={() => navigate(`/ov/${d.id}/etiquetas`)}>Etiquetas de cajas</button></div>
      <ListaCajas d={d} rol={rol} navigate={navigate} />
      {!puede && <div className="ov-aviso">Pendiente: el encargado de SAP debe generar la entrega.</div>}
      {puede && (
        <div className="ov-form">
          <label className="an-campo">PDF de la entrega (informe de lotes) <input type="file" accept="application/pdf" className="inp" onChange={e => validar(e.target.files[0])} /></label>
          <label className="an-campo">Folio de la entrega <input className="inp" value={folio} onChange={e => setFolio(e.target.value)} placeholder="Ej. 107810" /></label>
          {val && <Conciliacion v={val} />}
          {val && !val.conciliacion.limpia && <label className="ov-check"><input type="checkbox" checked={conf} onChange={e => setConf(e.target.checked)} /> Revisé las diferencias y son correctas</label>}
          <button className="btn-principal" disabled={!folio.trim() || sinConfirmar || env} onClick={registrar}>{env ? 'Guardando...' : 'Registrar entrega'}</button>
        </div>
      )}
    </section>
  )
}

function PanelFactura({ d, rol, toast, recargar }) {
  const [folio, setFolio] = useState('')
  const [arch, setArch] = useState(null)
  const [env, setEnv] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [conf, setConf] = useState(false)
  const puede = PUEDE_FACTURAR(rol)
  const registrar = async () => {
    setEnv(true); setAviso(null)
    try { await api.ovFacturaRegistrar(d.id, { folio, archivo: arch, confirmar: conf }); toast('Factura registrada', 'ok'); await recargar() }
    catch (e) { if (/no coincide/i.test(e.message)) setAviso(e.message); else toast(e.message, 'error') } finally { setEnv(false) }
  }
  return (
    <section className="ov-panel">
      <h2 className="ov-h2">Por facturar</h2>
      <dl className="ov-datos">
        <div><dt>Entrega SAP</dt><dd>{d.entrega_folio}</dd></div>
        <div><dt>Registrada</dt><dd>{fechaHora(d.entrega_en)} ({d.entrega_por})</dd></div>
      </dl>
      {!puede && <div className="ov-aviso">Pendiente: Facturación debe generar la factura con la entrega {d.entrega_folio}.</div>}
      {puede && (
        <div className="ov-form">
          <label className="an-campo">PDF de la factura (opcional) <input type="file" accept="application/pdf" className="inp" onChange={e => { setArch(e.target.files[0]); setAviso(null); setConf(false) }} /></label>
          <label className="an-campo">Folio de la factura <input className="inp" value={folio} onChange={e => setFolio(e.target.value)} placeholder="Si adjuntas el PDF se llena solo" /></label>
          {aviso && <div className="ov-aviso ov-aviso--mal">{aviso}</div>}
          {aviso && <label className="ov-check"><input type="checkbox" checked={conf} onChange={e => setConf(e.target.checked)} /> Confirmo que es la factura correcta</label>}
          <button className="btn-principal" disabled={(!folio.trim() && !arch) || env || (aviso && !conf)} onClick={registrar}>{env ? 'Guardando...' : 'Registrar factura'}</button>
        </div>
      )}
    </section>
  )
}

function PanelCerrada({ d }) {
  return (
    <section className="ov-panel">
      <h2 className="ov-h2">OV facturada</h2>
      <dl className="ov-datos">
        <div><dt>Entrega SAP</dt><dd>{d.entrega_folio}</dd></div>
        <div><dt>Factura</dt><dd>{d.factura_folio}</dd></div>
        <div><dt>Fecha de factura</dt><dd>{fechaCorta(d.factura_fecha)}</dd></div>
        <div><dt>Folio fiscal</dt><dd className="ov-mono">{d.factura_uuid || '-'}</dd></div>
        <div><dt>Registró</dt><dd>{d.factura_por} ({fechaHora(d.factura_en)})</dd></div>
      </dl>
    </section>
  )
}

// ───────────────────────── ETIQUETAS ─────────────────────────
export function OVEtiquetas({ toast }) {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const caja = sp.get('caja')
  const navigate = useNavigate()
  const [datos, setDatos] = useState(null)
  const volver = () => navigate(`/ov/${id}`)
  const cargar = () => api.ovEtiquetas(id, caja).then(setDatos)
  useEffect(() => { cargar().catch(e => { toast(e.message, 'error'); volver() }) }, [id, caja])
  if (!datos) return <div className="cargando">Generando etiqueta(s)...</div>
  const yaImpresa = datos.some(x => (x.impresa_veces || 0) > 0)
  const imprimir = async () => {
    try {
      await api.ovMarcarImpresas(id, datos.map(x => x.id_caja))
      await cargar()
      setTimeout(() => window.print(), 150)
    } catch (e) {
      toast(/permiso/i.test(e.message) ? 'Para reimprimir pide autorización a un gerente.' : e.message, 'error')
    }
  }
  return (
    <div>
      <div className="contenedor" style={{ marginBottom: 12 }}>
        <div className="acciones" style={{ marginLeft: 0 }}>
          <button className="btn-sec" onClick={volver}>Volver</button>
          <button className="btn-principal" onClick={imprimir}>{yaImpresa ? 'Reimprimir' : 'Imprimir'}</button>
        </div>
      </div>
      <Etiquetas datos={datos} />
    </div>
  )
}
