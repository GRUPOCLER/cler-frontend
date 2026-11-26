// ============================================================
//  CONTROL DE OV (refacciones)
//  OV de SAP (PDF) -> surtido por escaneo -> preparacion en cajas mixtas -> entrega SAP -> factura
//  Rutas: /ov  /ov/:id  /ov/:id/etiquetas
// ============================================================
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as api from './api'
import Etiquetas from './Etiquetas'

import PanelArchivos from './Archivos'
import {
  ORDEN, NOMBRE, TONO, ES_JEFE, PUEDE_CARGAR, PUEDE_FACTURAR, nf, dur, fechaHora, fechaCorta, useAhora, segDesde, quien,
} from './util'

export function Modal({ titulo, sub, onClose, children, footer }) {
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

export function Chip({ estatus, children }) {
  return <span className={'ov-chip ov-chip--' + (TONO[estatus] || 'neutro')}>{children || NOMBRE[estatus] || estatus}</span>
}
export function Barra({ pct, etiqueta }) {
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

export function SubNav({ activa }) {
  const navigate = useNavigate()
  const rol = api.rolEn('refacciones')
  if (!ES_JEFE(rol)) return null
  const items = [['lista', 'Lista', '/ov'], ['asignacion', 'Asignación', '/ov/asignacion'], ['tiempos', 'Tiempos', '/ov/tiempos']]
  return (
    <div className="sub-tabs" role="tablist" aria-label="Secciones de Control de OV">
      {items.map(([id, n, ruta]) => (
        <button key={id} role="tab" aria-selected={activa === id} className={'sub-tab' + (activa === id ? ' on' : '')} onClick={() => navigate(ruta)}>{n}</button>
      ))}
    </div>
  )
}

// responsable de la etapa en la que esta la OV (para la lista)
function responsableDe(o, nombres) {
  const em = ['recibida', 'en_surtido'].includes(o.estatus) ? o.asig_surtido : ['surtida', 'en_preparacion'].includes(o.estatus) ? o.asig_prep : null
  return em ? quien(nombres, em) : ''
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
  const yo = user ? String(user.usuario || '').toLowerCase() : ''
  const [soloMias, setSoloMias] = useState(rol === 'operador')

  const ovs = useMemo(() => (datos ? datos.ovs.filter(o => !(soloMias && rol === 'operador' && o.asig_surtido !== yo && o.asig_prep !== yo)) : []),
    [datos, soloMias, rol, yo])

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
      <SubNav activa="lista" />

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
        {rol === 'operador' && (
          <label className="ov-check ov-mias"><input type="checkbox" checked={soloMias} onChange={e => setSoloMias(e.target.checked)} /> Solo mis OV</label>
        )}
        <label className="an-campo ov-buscar">Buscar
          <input className="inp" value={q} onChange={e => setQ(e.target.value)} placeholder="OV, cliente, referencia o folio de entrega" />
        </label>
      </div>

      {error && <div className="an-estado an-estado--error">{error} <button className="btn-sec" onClick={cargar}>Reintentar</button></div>}
      {!datos && !error && <div className="cargando">Cargando OV...</div>}
      {datos && ovs.length === 0 && <div className="an-estado">{soloMias && rol === 'operador' ? 'No tienes OV asignadas con ese filtro. Quita "Solo mis OV" para ver todas.' : 'No hay OV con ese filtro.'}{PUEDE_CARGAR(rol) && !(soloMias && rol === 'operador') ? ' Usa "Cargar OV" para adjuntar el PDF de SAP.' : ''}</div>}
      {datos && ovs.length > 0 && (
        <div className="an-tabla-wrap">
          <table className="tabla ov-tabla">
            <thead><tr><th>OV</th><th>Cliente</th><th>Estatus</th><th>Responsable</th><th>Surtido</th><th>Preparado</th><th className="num">Cajas</th><th>Entrega</th></tr></thead>
            <tbody>
              {ovs.map(o => (
                <tr key={o.id} tabIndex={0} onClick={() => navigate(`/ov/${o.id}`)} onKeyDown={e => e.key === 'Enter' && navigate(`/ov/${o.id}`)}>
                  <td className="an-folio">{o.num_ov}{o.referencia && <div className="an-nota">{o.referencia}</div>}</td>
                  <td>{o.cliente}<div className="an-nota">{o.destino_ciudad}</div></td>
                  <td><Chip estatus={o.estatus} /><div><Tiempo ov={o} ahora={ahora} /></div></td>
                  <td>{responsableDe(o, datos.nombres) || <span className="an-nota">-</span>}</td>
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
  const [archivo, setArchivo] = useState(null)
  const [leyendo, setLeyendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const leer = async (f) => {
    if (!f) return
    setError(null); setPrev(null); setArchivo(f); setLeyendo(true)
    try { setPrev(await api.ovLeer(f)) } catch (e) { setError(e.message) } finally { setLeyendo(false) }
  }
  const crear = async () => {
    setGuardando(true)
    try {
      const r = await api.ovCrear(prev)
      try { if (archivo) await api.adjSubir(r.id, 'ov_pdf', archivo); toast('OV cargada', 'ok') }
      catch (e) { toast('La OV se cargó, pero no se pudo guardar el PDF: ' + e.message, 'error') }
      onCreada(r.id)
    }
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

function Responsables({ d, rol, toast, recargar }) {
  const jefe = ES_JEFE(rol)
  const etapas = [['surtido', 'Surtido', ['recibida', 'en_surtido']], ['prep', 'Preparación', ['recibida', 'en_surtido', 'surtida', 'en_preparacion']]]
  const cambiar = async (etapa, email) => {
    try { await api.ovAsignar(d.id, etapa, email); toast('Responsable actualizado', 'ok'); await recargar() } catch (e) { toast(e.message, 'error') }
  }
  const visibles = etapas.filter(([id]) => d['asig_' + id] || (jefe && etapas.find(e => e[0] === id)[2].includes(d.estatus)))
  if (!visibles.length) return null
  return (
    <section className="ov-resp" aria-label="Responsables">
      {visibles.map(([id, nombre, ests]) => {
        const em = d['asig_' + id], editable = jefe && ests.includes(d.estatus), ops = d.operadores || []
        return (
          <div key={id} className="ov-resp-it">
            <div className="an-nota">Responsable de {nombre.toLowerCase()}</div>
            {editable ? (
              <select className="inp" value={em || ''} onChange={e => cambiar(id, e.target.value)} aria-label={'Responsable de ' + nombre.toLowerCase()}>
                <option value="">Sin asignar</option>
                {ops.map(p => <option key={p.email} value={p.email}>{p.nombre}</option>)}
                {em && !ops.some(p => p.email === em) && <option value={em}>{quien(d.nombres, em)}</option>}
              </select>
            ) : <b>{em ? quien(d.nombres, em) : 'Sin asignar'}</b>}
            {em && d['asig_' + id + '_en'] && <div className="an-nota">Asignado {fechaHora(d['asig_' + id + '_en'])}{d['asig_' + id + '_por'] ? ' por ' + quien(d.nombres, d['asig_' + id + '_por']) : ''}</div>}
          </div>
        )
      })}
    </section>
  )
}

// aviso + bloqueo cuando el usuario no es el responsable de la etapa
function Bloqueo({ op, children }) {
  const ok = !op || op.ok
  return (
    <>
      {!ok && <div className="ov-aviso ov-aviso--mal" role="alert">{op.motivo}</div>}
      <fieldset className="ov-fs" disabled={!ok}>{children}</fieldset>
    </>
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

      {abierta && <Responsables d={d} rol={rol} toast={toast} recargar={cargar} />}

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

      <PanelArchivos d={d} rol={rol} toast={toast} />

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
      <Bloqueo op={d.operar && d.operar.surtido}>
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
      </Bloqueo>
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
      <Bloqueo op={d.operar && d.operar.prep}>
        <button className="btn-principal" onClick={async () => { try { await api.ovPrepIniciar(d.id); await recargar() } catch (e) { toast(e.message, 'error') } }}>Iniciar preparación</button>
      </Bloqueo>
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

// Partidas pendientes de empacar: pasar a la caja abierta todo, una parte o varias partidas a la vez.
function PorEmpacar({ lineas, abierta, onAsignar }) {
  const [sel, setSel] = useState({})        // linea_id -> true
  const [cant, setCant] = useState({})      // linea_id -> texto (cantidad parcial)
  const [fb, setFb] = useState(null)
  const [env, setEnv] = useState(false)
  const [filtro, setFiltro] = useState('')
  const pend = (l) => l.surtida - l.empacada
  const f = filtro.trim().toUpperCase()
  const vis = f ? lineas.filter(l => (l.codigo + ' ' + (l.descripcion || '')).toUpperCase().includes(f)) : lineas
  const ids = vis.map(l => l.id)
  const marcadas = lineas.filter(l => sel[l.id])
  const todasMarcadas = ids.length > 0 && ids.every(id => sel[id])
  const tot = lineas.reduce((a, l) => a + pend(l), 0)
  const q = (l) => { const n = parseInt(cant[l.id]); return Number.isFinite(n) && n > 0 ? Math.min(n, pend(l)) : null }
  const go = async (items, todo, texto) => {
    if (env) return
    setEnv(true)
    try { await onAsignar(items, todo); setFb({ ok: true, texto }); setSel({}); setCant({}) } catch (e) { setFb({ ok: false, texto: e.message }) } finally { setEnv(false) }
  }
  const marca = (id, v) => setSel(s => ({ ...s, [id]: v }))
  return (
    <div className="ov-porempacar">
      <div className="ov-lista-cab">
        <h3 className="ov-h3" style={{ margin: 0 }}>Por empacar ({lineas.length} partidas, {nf(tot)} piezas)</h3>
        {abierta && lineas.length > 0 && <button className="btn-sec" disabled={env} onClick={() => go([], true, `Todo lo pendiente pasó a la caja ${abierta.numero}`)}>Pasar todo a la caja {abierta.numero}</button>}
      </div>
      {lineas.length === 0 ? <p className="an-nota">Nada pendiente.</p> : (<>
        {!abierta && <p className="an-nota">Abre una caja para pasar piezas a ella.</p>}
        {abierta && (
          <div className="ov-pe-barra">
            <input className="inp" placeholder="Filtrar por código o descripción" value={filtro} onChange={e => setFiltro(e.target.value)} aria-label="Filtrar partidas" />
            <button className="btn-sec" disabled={env || marcadas.length === 0} onClick={() => go(marcadas.map(l => ({ linea_id: l.id, cantidad: q(l) })), false, `${marcadas.length} partida(s) pasaron a la caja ${abierta.numero}`)}>
              Pasar {marcadas.length ? marcadas.length + ' seleccionada(s)' : 'seleccionadas'}
            </button>
          </div>
        )}
        <div className={'ov-fb' + (fb ? (fb.ok ? ' ov-fb--ok' : ' ov-fb--mal') : '')} role="status" aria-live="polite">{fb ? fb.texto : ' '}</div>
        <div className="an-tabla-wrap">
          <table className="an-tabla">
            <thead><tr>
              {abierta && <th style={{ width: 40 }}><input type="checkbox" checked={todasMarcadas} onChange={e => setSel(Object.fromEntries(ids.map(id => [id, e.target.checked])))} aria-label="Seleccionar todas" /></th>}
              <th>Código</th><th>Descripción</th><th>Categoría</th><th className="num">Por empacar</th>{abierta && <th className="num">Cantidad</th>}{abierta && <th />}
            </tr></thead>
            <tbody>
              {vis.map(l => (
                <tr key={l.id}>
                  {abierta && <td><input type="checkbox" checked={!!sel[l.id]} onChange={e => marca(l.id, e.target.checked)} aria-label={'Seleccionar ' + l.codigo} /></td>}
                  <td className="an-folio">{l.codigo}</td><td>{l.descripcion}</td><td>{l.division}</td><td className="num">{nf(pend(l))}</td>
                  {abierta && <td className="num"><input className="inp ov-pe-cant" type="number" min="1" max={pend(l)} placeholder={String(pend(l))} value={cant[l.id] || ''} onChange={e => { setCant(c => ({ ...c, [l.id]: e.target.value })); if (e.target.value) marca(l.id, true) }} aria-label={'Cantidad de ' + l.codigo} /></td>}
                  {abierta && <td className="ov-acc">
                    <button className="btn-mini" disabled={env} onClick={() => go([{ linea_id: l.id, cantidad: 1 }], false, `${l.codigo}: +1`)}>+1</button>
                    <button className="btn-mini" disabled={env} onClick={() => go([{ linea_id: l.id, cantidad: q(l) }], false, `${l.codigo}: ${nf(q(l) || pend(l))} pieza(s) a la caja ${abierta.numero}`)}>{q(l) ? 'Pasar ' + q(l) : 'Pasar todo'}</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}
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
  const asignar = async (items, todo) => {
    const r = await api.ovCajaAsignar(d.id, abierta.id, items, todo)
    setD(r)
    return r
  }
  return (
    <section className="ov-panel">
      <h2 className="ov-h2">Preparación</h2>
      <Bloqueo op={d.operar && d.operar.prep}>
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
            {abierta.piezas > 0 && <button className="btn-sec" onClick={() => run(async () => setD(await api.ovCajaVaciar(d.id, abierta.id)), 'Caja vaciada')}>Vaciar caja</button>}
            {porEmpacar.length > 0 && <button className="btn-sec" disabled={abierta.piezas < 1} onClick={() => run(async () => { await api.ovCajaCerrar(d.id, abierta.id, parseFloat(peso) || null); setPeso(''); setD(await (async () => { await api.ovCajaNueva(d.id); return api.ovDetalle(d.id) })()) }, `Caja ${abierta.numero} cerrada, nueva caja abierta`)}>Cerrar y abrir siguiente</button>}
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

      <PorEmpacar lineas={porEmpacar} abierta={abierta} onAsignar={asignar} />
      </Bloqueo>
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
  const [motivo, setMotivo] = useState('')
  const [sinPdf, setSinPdf] = useState(false)
  const [env, setEnv] = useState(false)
  const puede = PUEDE_CARGAR(rol)
  const jefe = ES_JEFE(rol)
  const validar = async (f) => {
    setArch(f); setVal(null); setConf(false); setMotivo('')
    if (!f) return
    try { const v = await api.ovEntregaValidar(d.id, f); setVal(v); setFolio(v.folio) } catch (e) { toast(e.message, 'error'); setArch(null) }
  }
  const registrar = async () => {
    setEnv(true)
    try {
      await api.ovEntregaRegistrar(d.id, { folio, archivo: sinPdf ? null : arch, confirmar: conf, motivo })
      toast('Entrega generada. La OV queda en espera de facturación.', 'ok'); await recargar()
    }
    catch (e) { toast(e.message, 'error') } finally { setEnv(false) }
  }
  const necesitaAut = val && !val.corresponde
  const autorizada = conf && motivo.trim().length >= 5
  const listo = sinPdf ? (jefe && folio.trim() && motivo.trim().length >= 5) : (val && (val.corresponde || (val.puede_autorizar && autorizada)))
  return (
    <section className="ov-panel">
      <h2 className="ov-h2">Entrega en sistema pendiente</h2>
      <p>La mercancía está preparada en {d.cajas} caja(s). Para continuar, adjunta el PDF de la entrega ya generada en SAP: se valida contra lo preparado y, si corresponde, la OV pasa a espera de facturación.</p>
      <div className="ov-acc"><button className="btn-sec" onClick={() => navigate(`/ov/${d.id}/etiquetas`)}>Etiquetas de cajas</button></div>
      <ListaCajas d={d} rol={rol} navigate={navigate} />
      {!puede && <div className="ov-aviso">Pendiente: el encargado de SAP debe generar la entrega y adjuntar su PDF.</div>}
      {puede && (
        <div className="ov-form">
          {!sinPdf && <label className="an-campo">PDF de la entrega (informe de lotes de SAP) <input type="file" accept="application/pdf" className="inp" onChange={e => validar(e.target.files[0])} /></label>}
          {!sinPdf && val && <Conciliacion v={val} />}
          {!sinPdf && val && !val.cliente_coincide && <div className="ov-aviso ov-aviso--mal">El cliente de la entrega ({val.cliente}) no es el de la OV.</div>}
          {!sinPdf && necesitaAut && !val.puede_autorizar && <div className="ov-aviso ov-aviso--mal">La entrega no corresponde a la OV. Solo un gerente puede autorizarla; avísale para que la valide.</div>}
          {!sinPdf && necesitaAut && val.puede_autorizar && (<>
            <label className="ov-check"><input type="checkbox" checked={conf} onChange={e => setConf(e.target.checked)} /> Revisé las diferencias y autorizo registrar la entrega</label>
            <label className="an-campo">Motivo de la autorización <input className="inp" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. El cliente aceptó entrega parcial" /></label>
          </>)}
          {sinPdf && (<>
            <div className="ov-aviso ov-aviso--mal">Excepción de gerente: se registra sin PDF y queda asentado en el historial.</div>
            <label className="an-campo">Folio de la entrega <input className="inp" value={folio} onChange={e => setFolio(e.target.value)} placeholder="Ej. 107810" /></label>
            <label className="an-campo">Motivo <input className="inp" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Por qué no se adjunta el PDF" /></label>
          </>)}
          <button className="btn-principal" disabled={!listo || env} onClick={registrar}>{env ? 'Guardando...' : 'Registrar entrega generada'}</button>
          {jefe && <button className="btn-mini" type="button" onClick={() => { setSinPdf(v => !v); setVal(null); setArch(null); setConf(false); setMotivo(''); setFolio('') }}>{sinPdf ? 'Volver a adjuntar el PDF' : 'Registrar sin PDF (excepción)'}</button>}
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
  const [xml, setXml] = useState(null)
  const [cfdi, setCfdi] = useState(null)
  const puede = PUEDE_FACTURAR(rol)
  const elegirXml = async (f) => {
    setXml(f); setCfdi(null); setAviso(null); setConf(false)
    if (!f) return
    try { setCfdi(await api.leerCFDI(f)) } catch (e) { toast(e.message, 'error'); setXml(null) }
  }
  const registrar = async () => {
    setEnv(true); setAviso(null)
    try {
      await api.ovFacturaRegistrar(d.id, { folio, archivo: arch, xml, confirmar: conf })
      const fallas = []
      if (arch) { try { await api.adjSubir(d.id, 'factura_pdf', arch) } catch (e) { fallas.push('PDF: ' + e.message) } }
      if (xml) { try { await api.adjSubir(d.id, 'factura_xml', xml) } catch (e) { fallas.push('XML: ' + e.message) } }
      if (fallas.length) toast('La factura se registró, pero no se guardó el archivo (' + fallas.join('; ') + ').', 'error'); else toast('Factura registrada', 'ok')
      await recargar()
    }
    catch (e) { if (/no coincide/i.test(e.message)) setAviso(e.message); else toast(e.message, 'error') } finally { setEnv(false) }
  }
  return (
    <section className="ov-panel">
      <h2 className="ov-h2">En espera de facturación</h2>
      <dl className="ov-datos">
        <div><dt>Entrega SAP</dt><dd>{d.entrega_folio}</dd></div>
        <div><dt>Registrada</dt><dd>{fechaHora(d.entrega_en)} ({d.entrega_por})</dd></div>
      </dl>
      {!puede && <div className="ov-aviso">Pendiente: Facturación debe generar la factura con la entrega {d.entrega_folio}.</div>}
      {puede && (
        <div className="ov-form">
          <label className="an-campo">PDF de la factura <input type="file" accept="application/pdf" className="inp" onChange={e => { setArch(e.target.files[0]); setAviso(null); setConf(false) }} /></label>
          <label className="an-campo">XML de la factura (CFDI) <input type="file" accept=".xml,text/xml,application/xml" className="inp" onChange={e => elegirXml(e.target.files[0])} /></label>
          {cfdi && <div className="ov-aviso ov-aviso--ok">XML leído: folio fiscal {cfdi.uuid || 'no encontrado'} | {(cfdi.serie + cfdi.folio) || 'sin folio'} | total ${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2 }).format(cfdi.total)} {cfdi.moneda}</div>}
          <label className="an-campo">Folio de la factura <input className="inp" value={folio} onChange={e => setFolio(e.target.value)} placeholder="Si adjuntas el PDF o el XML se llena solo" /></label>
          {aviso && <div className="ov-aviso ov-aviso--mal">{aviso}</div>}
          {aviso && <label className="ov-check"><input type="checkbox" checked={conf} onChange={e => setConf(e.target.checked)} /> Confirmo que es la factura correcta</label>}
          <button className="btn-principal" disabled={(!folio.trim() && !arch && !xml) || env || (aviso && !conf)} onClick={registrar}>{env ? 'Guardando...' : 'Registrar factura'}</button>
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
