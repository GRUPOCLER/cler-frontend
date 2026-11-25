// Gestion del catalogo de productos: pesos, medidas, caja master, empaques adicionales e historial.
// Todo lo que se edita aqui se guarda en la base del sistema; nada se escribe en Odoo.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as api from './api'
import { fechaHora, nf } from './util'
import { Modal } from './ControlOV'

const LINEAS = [['', 'Todos'], ['equipos', 'Equipos'], ['refacciones', 'Refacciones']]

const FILTROS = [
  ['todos', 'Todos', 'total'],
  ['sin_master', 'Sin caja master', 'sin_master'],
  ['editados', 'Editados aquí', 'editados'],
  ['con_adicionales', 'Con adicionales', 'con_adicionales'],
]
const TIPOS = [['extension', 'Extensión'], ['adicional', 'Adicional'], ['accesorio', 'Accesorio']]
const ORIGEN = { manual: 'Edición', hoja: 'Hoja', odoo: 'Odoo', alta: 'Alta', adicional: 'Adicional' }

const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(String(v).replace(',', '.')))
const med = (a, b, c) => (a && b && c ? `${nf(a)} x ${nf(b)} x ${nf(c)}` : '-')
const fmt = (v) => (v === null || v === undefined || v === '' ? '-' : String(v))

// ───────────────────────── LISTA ─────────────────────────
export default function Catalogo({ toast }) {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [linea, setLinea] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('linea')
    if (p) return p
    return api.tieneModulo('embarques') ? '' : 'refacciones'
  })
  const [pagina, setPagina] = useState(0)
  const [nuevo, setNuevo] = useState(false)
  const [importar, setImportar] = useState(false)

  const cargar = useCallback(() => {
    api.catGestionListar({ buscar: q, filtro, linea, pagina })
      .then(x => { setD(x); setError(null) }).catch(e => setError(e.message))
  }, [q, filtro, linea, pagina])
  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t) }, [cargar])
  useEffect(() => { setPagina(0) }, [q, filtro, linea])

  const puede = d?.puede_editar
  const paginas = d ? Math.max(1, Math.ceil(d.total / d.limite)) : 1

  return (
    <div className="contenedor">
      <div className="cg-cab">
        <div>
          <div className="titulo-pag">Catálogo de productos</div>
          <div className="sub-pag">Pesos, medidas, caja master y empaques adicionales. Los cambios se guardan aquí y no se envían a Odoo.</div>
        </div>
        <div className="cg-acciones">
          {puede && <button className="btn-sec" onClick={() => setImportar(true)}>Importar pesos de refacciones</button>}
          <button className="btn-sec" onClick={() => navigate('/catalogo/odoo')}>Odoo contra hoja</button>
          {puede && <button className="btn-principal" onClick={() => setNuevo(true)}>Nuevo producto</button>}
        </div>
      </div>

      <div className="cg-barra">
        <div className="seg-ctl" role="tablist" aria-label="Línea">
          {LINEAS.map(([id, nom]) => (
            <button key={id} role="tab" aria-selected={linea === id} className={'seg-btn' + (linea === id ? ' on' : '')} onClick={() => setLinea(id)}>{nom}</button>
          ))}
        </div>
      </div>
      <div className="cg-barra">
        <div className="seg-ctl" role="tablist" aria-label="Filtro">
          {FILTROS.map(([id, nom, k]) => (
            <button key={id} role="tab" aria-selected={filtro === id} className={'seg-btn' + (filtro === id ? ' on' : '')} onClick={() => setFiltro(id)}>
              {nom}{d ? ` (${nf(d.resumen[k])})` : ''}
            </button>
          ))}
        </div>
        <input className="inp cg-buscar" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por clave o descripción" aria-label="Buscar producto" />
      </div>

      {error && <div className="ov-aviso ov-aviso--mal">{error}</div>}
      <div className="panel">
        <table className="tabla">
          <thead><tr>
            <th>Clave</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Peso (kg)</th><th>Medidas (cm)</th>
            <th style={{ textAlign: 'right' }}>Pzas por caja master</th><th>Estado</th>
          </tr></thead>
          <tbody>
            {!d && <tr><td colSpan={6} className="vacio">Cargando...</td></tr>}
            {d && d.items.length === 0 && <tr><td colSpan={6} className="vacio">No hay productos con ese filtro.</td></tr>}
            {d && d.items.map(i => (
              <tr key={i.sku} tabIndex={0} onClick={() => navigate('/catalogo/' + encodeURIComponent(i.sku))}
                onKeyDown={e => e.key === 'Enter' && navigate('/catalogo/' + encodeURIComponent(i.sku))}>
                <td><b className="cg-mono">{i.sku}</b></td>
                <td>{i.descripcion || '-'}</td>
                <td style={{ textAlign: 'right' }}>{i.peso_unit ? nf(i.peso_unit) : '-'}</td>
                <td>{med(i.lr_unit, i.an_unit, i.al_unit)}</td>
                <td style={{ textAlign: 'right' }}>{i.cm_cant > 0 ? nf(i.cm_cant) : <span className="chip chip-warn">Sin caja master</span>}</td>
                <td>
                  {i.campos_manuales.length > 0 && <span className="chip chip-ok">Editado aquí</span>}{' '}
                  {i.adicionales > 0 && <span className="chip chip-fusion" style={{ marginLeft: 0 }}>{i.adicionales} adicional{i.adicionales > 1 ? 'es' : ''}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {d && d.total > d.limite && (
          <div className="cg-pag">
            <button className="btn-sec" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button>
            <span>Página {pagina + 1} de {paginas} ({nf(d.total)} productos)</span>
            <button className="btn-sec" disabled={pagina + 1 >= paginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
          </div>
        )}
      </div>
      {importar && <ModalImportar toast={toast} onClose={() => setImportar(false)} onListo={() => { setLinea('refacciones'); cargar() }} />}
      {nuevo && <ModalNuevo toast={toast} onClose={() => setNuevo(false)} onCreado={(sku) => navigate('/catalogo/' + encodeURIComponent(sku))} />}
    </div>
  )
}

function ModalImportar({ onClose, onListo, toast }) {
  const [arch, setArch] = useState(null)
  const [rep, setRep] = useState(null)
  const [env, setEnv] = useState(false)
  const [error, setError] = useState(null)

  const correr = async (simular) => {
    setEnv(true); setError(null)
    try {
      const r = await api.catImportarRefacciones(arch, simular)
      setRep(r)
      if (!simular) { toast?.('Importación lista', 'ok'); onListo() }
    } catch (e) { setError(e.message) } finally { setEnv(false) }
  }
  const guardado = rep && !rep.simulacion
  return (
    <Modal titulo="Importar pesos de refacciones" sub="Archivo de pesos y dimensiones (hoja CONSOLIDADO). Solo se guarda en esta plataforma; Odoo no se modifica." onClose={onClose}>
      <div className="cg-nota">Columnas: CODIGO, DESCRIPCION, PESO (en gramos, se convierte a kg), LARGO, ANCHO y ALTO (cm). Lo que editaste aquí y lo que ya viene de Odoo no se pisa.</div>
      <label className="an-campo">Archivo .xlsx
        <input type="file" accept=".xlsx" className="inp" onChange={e => { setArch(e.target.files[0] || null); setRep(null); setError(null) }} />
      </label>
      {error && <div className="ov-aviso ov-aviso--mal">{error}</div>}
      {rep && (
        <div className="ov-aviso">
          <div>{rep.simulacion ? 'Simulación (no se guardó nada)' : 'Importado'}: {nf(rep.total_filas)} filas, {nf(rep.insertados)} nuevas, {nf(rep.actualizados)} actualizadas.</div>
          {rep.campos_protegidos > 0 && <div>{nf(rep.campos_protegidos)} datos editados aquí se conservaron.</div>}
          {rep.total_avisos > 0 && <div>{nf(rep.total_avisos)} avisos, por ejemplo: {rep.avisos.slice(0, 3).join('; ')}</div>}
        </div>
      )}
      <div className="cg-guardar">
        <button className="btn-sec" disabled={!arch || env} onClick={() => correr(true)}>Simular</button>
        {guardado
          ? <button className="btn-principal" onClick={onClose}>Cerrar</button>
          : <button className="btn-principal" disabled={!arch || env || !rep || !rep.simulacion} onClick={() => correr(false)}>Importar y guardar</button>}
      </div>
    </Modal>
  )
}

function ModalNuevo({ onClose, onCreado, toast }) {
  const [f, setF] = useState({ sku: '', descripcion: '', peso_unit: '', cm_cant: '', motivo: '' })
  const [env, setEnv] = useState(false)
  const [err, setErr] = useState('')
  const valido = f.sku.trim() && f.descripcion.trim() && f.motivo.trim().length >= 3
  const crear = async () => {
    if (!valido || env) return
    setEnv(true); setErr('')
    try {
      const campos = {}
      if (f.peso_unit !== '') campos.peso_unit = num(f.peso_unit)
      if (f.cm_cant !== '') campos.cm_cant = num(f.cm_cant)
      const r = await api.catGestionAlta({ sku: f.sku, descripcion: f.descripcion, campos, motivo: f.motivo })
      toast('Producto creado', 'ok'); onCreado(r.item.sku)
    } catch (e) { setErr(e.message); setEnv(false) }
  }
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }))
  return (
    <Modal titulo="Nuevo producto" sub="Para equipos que todavía no están en la hoja" onClose={onClose}>
      <div className="cg-form">
        <label className="an-campo">Clave<input className="inp" value={f.sku} onChange={set('sku')} autoFocus /></label>
        <label className="an-campo">Descripción<input className="inp" value={f.descripcion} onChange={set('descripcion')} /></label>
        <div className="cg-fila2">
          <label className="an-campo">Peso unitario (kg)<input className="inp" inputMode="decimal" value={f.peso_unit} onChange={set('peso_unit')} /></label>
          <label className="an-campo">Piezas por caja master<input className="inp" inputMode="numeric" value={f.cm_cant} onChange={set('cm_cant')} /></label>
        </div>
        <label className="an-campo">Motivo del alta<input className="inp" value={f.motivo} onChange={set('motivo')} placeholder="Ej. llegó equipo nuevo en caja master" /></label>
        {err && <div className="ov-aviso ov-aviso--mal">{err}</div>}
        <div className="cg-acciones">
          <button className="btn-sec" onClick={onClose}>Cancelar</button>
          <button className="btn-principal" disabled={!valido || env} onClick={crear}>Crear producto</button>
        </div>
      </div>
    </Modal>
  )
}

// ───────────────────────── DETALLE ─────────────────────────
const GRUPOS = [
  { id: 'prod', titulo: 'Producto', nota: 'Peso y medidas de una pieza.', campos: [
    ['descripcion', 'Descripción', 'txt', true], ['peso_unit', 'Peso (kg)'], ['lr_unit', 'Largo (cm)'], ['an_unit', 'Ancho (cm)'], ['al_unit', 'Alto (cm)'], ['m3_unit', 'Volumen (m3)']] },
  { id: 'master', titulo: 'Caja master', nota: 'Si el equipo viene en caja master, captura cuántas piezas trae y sus medidas. Con piezas en 0 el producto no se ofrece en caja master.', campos: [
    ['cm_cant', 'Piezas por caja', 'int'], ['cm_peso', 'Peso de la caja (kg)'], ['cm_lr', 'Largo (cm)'], ['cm_an', 'Ancho (cm)'], ['cm_al', 'Alto (cm)'], ['cm_m3', 'Volumen (m3)']] },
  { id: 'sat', titulo: 'SAT', nota: 'Datos fiscales del producto.', campos: [['sat_codigo', 'Código SAT', 'txt'], ['sat_desc', 'Descripción SAT', 'txt', true]] },
]

export function CatalogoDetalle({ toast }) {
  const { sku } = useParams()
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)
  const [forma, setForma] = useState({})
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [modalAdic, setModalAdic] = useState(null)

  const cargar = useCallback(() => {
    api.catGestionDetalle(sku).then(x => { setD(x); setForma({}); setMotivo(''); setError(null) }).catch(e => setError(e.message))
  }, [sku])
  useEffect(() => { cargar() }, [cargar])

  const it = d?.item
  const puede = d?.puede_editar
  const valor = (k) => (k in forma ? forma[k] : fmt2(it?.[k]))
  const cambios = useMemo(() => {
    if (!it) return {}
    const o = {}
    for (const k of Object.keys(forma)) {
      const ant = it[k]
      const nuevo = typeof ant === 'string' ? forma[k] : num(forma[k])
      if (typeof ant === 'string' ? (ant || '') !== (nuevo || '') : Math.abs((ant || 0) - nuevo) > 1e-9) o[k] = nuevo
    }
    return o
  }, [forma, it])
  const hayCambios = Object.keys(cambios).length > 0

  const guardar = async () => {
    if (!hayCambios || motivo.trim().length < 3 || guardando) return
    setGuardando(true)
    try {
      const r = await api.catGestionEditar(sku, cambios, motivo.trim())
      toast('Cambios guardados en el historial', 'ok')
      cargar()
      if (r.avisos?.length) toast('Ojo: ' + r.avisos[0], 'error')
    } catch (e) { toast(e.message, 'error') }
    finally { setGuardando(false) }
  }
  const liberar = async (campo) => {
    try { await api.catGestionLiberar(sku, [campo]); toast('El campo vuelve a tomar el valor de la hoja en la próxima sincronización', 'ok'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  if (error) return <div className="contenedor"><div className="ov-aviso ov-aviso--mal">{error}</div><button className="btn-sec" onClick={() => navigate('/catalogo')}>Volver al catálogo</button></div>
  if (!d) return <div className="contenedor"><div className="vacio">Cargando...</div></div>

  return (
    <div className="contenedor">
      <div className="cg-cab">
        <div>
          <button className="btn-mini" onClick={() => navigate('/catalogo')}>Catálogo</button>
          <div className="titulo-pag cg-mono" style={{ marginTop: 8 }}>{it.sku}</div>
          <div className="sub-pag">{it.descripcion || 'Sin descripción'}</div>
        </div>
        {it.editado_en && <div className="cg-ult">Última edición: {fechaHora(it.editado_en)} por {it.editado_por}</div>}
      </div>

      {d.avisos.length > 0 && <div className="ov-aviso ov-aviso--warn">{d.avisos.map((a, i) => <div key={i}>{a}</div>)}</div>}

      {GRUPOS.map(g => (
        <div className="panel" key={g.id}>
          <div className="panel-titulo">{g.titulo}</div>
          <div className="cg-nota">{g.nota}</div>
          <div className="cg-form cg-grid">
            {g.campos.map(([k, nom, tipo, ancho]) => (
              <label key={k} className={'an-campo' + (ancho ? ' cg-ancho' : '')}>
                <span>{nom}{it.campos_manuales.includes(k) ? <> <span className="chip chip-ok">Editado aquí</span></> : (it.fuentes?.[k] && it.fuentes[k] !== 'sin_dato') ? <> <span className="chip">{it.fuentes[k] === 'odoo' ? 'Odoo' : 'Hoja'}</span></> : null}</span>
                <input className="inp" disabled={!puede} value={valor(k)} inputMode={tipo === 'txt' ? 'text' : 'decimal'}
                  onChange={e => setForma(f => ({ ...f, [k]: e.target.value }))} />
                {puede && it.campos_manuales.includes(k) && <button type="button" className="cg-link" onClick={() => liberar(k)}>Devolver a la hoja</button>}
              </label>
            ))}
          </div>
        </div>
      ))}

      {puede && (
        <div className="cg-guardar">
          <label className="an-campo cg-motivo">Motivo del cambio (queda en el historial)
            <input className="inp" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. llegó en caja master de 4 piezas" />
          </label>
          <button className="btn-principal" disabled={!hayCambios || motivo.trim().length < 3 || guardando} onClick={guardar}>
            {hayCambios ? `Guardar ${Object.keys(cambios).length} cambio${Object.keys(cambios).length > 1 ? 's' : ''}` : 'Sin cambios'}
          </button>
        </div>
      )}

      <div className="panel">
        <div className="cg-cab" style={{ marginBottom: 6 }}>
          <div>
            <div className="panel-titulo" style={{ marginBottom: 2 }}>Empaques adicionales</div>
            <div className="cg-nota">Si este equipo siempre trae una extensión, un adicional o un accesorio en empaque aparte, decláralo aquí. Al cargar una entrega con esta clave, el empaque se agrega solo.</div>
          </div>
          {puede && <button className="btn-sec" onClick={() => setModalAdic({})}>Agregar empaque</button>}
        </div>
        {d.adicionales.length === 0 ? <div className="vacio" style={{ padding: 16 }}>Este producto no tiene empaques adicionales declarados.</div> : (
          <table className="tabla">
            <thead><tr><th>Tipo</th><th>Nombre</th><th>A qué corresponde</th><th style={{ textAlign: 'right' }}>Por equipo</th><th>Medidas (cm)</th><th style={{ textAlign: 'right' }}>Peso (kg)</th><th>Estado</th></tr></thead>
            <tbody>
              {d.adicionales.map(a => (
                <tr key={a.id} tabIndex={0} onClick={() => puede && setModalAdic(a)} onKeyDown={e => e.key === 'Enter' && puede && setModalAdic(a)}>
                  <td>{a.tipo_nombre}</td><td><b>{a.nombre}</b></td><td>{a.corresponde_a}</td>
                  <td style={{ textAlign: 'right' }}>{a.cantidad_por_equipo}</td><td>{med(a.lr, a.an, a.al)}</td>
                  <td style={{ textAlign: 'right' }}>{a.peso_kg ? nf(a.peso_kg) : '-'}</td>
                  <td>{a.activo ? <span className="chip chip-ok">Activo</span> : <span className="chip">Inactivo</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-titulo">Historial de cambios</div>
        {d.historial.length === 0 ? <div className="vacio" style={{ padding: 16 }}>Todavía no hay cambios registrados.</div> : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Cambio</th><th>Antes</th><th>Después</th><th>Motivo</th></tr></thead>
            <tbody>
              {d.historial.map(h => (
                <tr key={h.id} style={{ cursor: 'default' }}>
                  <td>{fechaHora(h.creado_en)}</td><td>{h.usuario || '-'}</td>
                  <td><span className="chip">{ORIGEN[h.origen] || h.origen}</span> {h.campo_nombre}</td>
                  <td className="cg-mono">{fmt(h.anterior)}</td><td className="cg-mono">{fmt(h.nuevo)}</td><td>{h.motivo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modalAdic && <ModalAdicional sku={it.sku} a={modalAdic} toast={toast} onClose={() => setModalAdic(null)} onListo={() => { setModalAdic(null); cargar() }} />}
    </div>
  )
}

const fmt2 = (v) => (v === null || v === undefined ? '' : String(v))

function ModalAdicional({ sku, a, onClose, onListo, toast }) {
  const nuevo = !a.id
  const [f, setF] = useState({
    tipo: a.tipo || 'extension', nombre: a.nombre || '', corresponde_a: a.corresponde_a || '', cantidad_por_equipo: a.cantidad_por_equipo || 1,
    peso_kg: a.peso_kg || '', lr: a.lr || '', an: a.an || '', al: a.al || '', activo: a.activo !== false, motivo: '',
  })
  const [env, setEnv] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }))
  const valido = f.nombre.trim() && f.corresponde_a.trim() && num(f.cantidad_por_equipo) >= 1 && (nuevo || f.motivo.trim().length >= 3)
  const guardar = async () => {
    if (!valido || env) return
    setEnv(true); setErr('')
    const body = { tipo: f.tipo, nombre: f.nombre, corresponde_a: f.corresponde_a, cantidad_por_equipo: Math.round(num(f.cantidad_por_equipo)),
      peso_kg: num(f.peso_kg), lr: num(f.lr), an: num(f.an), al: num(f.al), activo: f.activo, motivo: f.motivo }
    try {
      if (nuevo) await api.catAdicionalCrear(sku, body); else await api.catAdicionalEditar(a.id, body)
      toast('Empaque adicional guardado', 'ok'); onListo()
    } catch (e) { setErr(e.message); setEnv(false) }
  }
  return (
    <Modal titulo={nuevo ? 'Agregar empaque adicional' : 'Editar empaque adicional'} sub={'Equipo ' + sku} onClose={onClose}>
      <div className="cg-form">
        <div className="cg-fila2">
          <label className="an-campo">Tipo
            <select className="inp" value={f.tipo} onChange={set('tipo')}>{TIPOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
          </label>
          <label className="an-campo">Cantidad por cada equipo<input className="inp" inputMode="numeric" value={f.cantidad_por_equipo} onChange={set('cantidad_por_equipo')} /></label>
        </div>
        <label className="an-campo">Nombre<input className="inp" value={f.nombre} onChange={set('nombre')} placeholder="Ej. Tubo de extensión" /></label>
        <label className="an-campo">A qué corresponde
          <input className="inp" value={f.corresponde_a} onChange={set('corresponde_a')} placeholder="Ej. Tubo largo del cabezal; viene en caja aparte" />
        </label>
        <div className="cg-fila4">
          <label className="an-campo">Peso (kg)<input className="inp" inputMode="decimal" value={f.peso_kg} onChange={set('peso_kg')} /></label>
          <label className="an-campo">Largo (cm)<input className="inp" inputMode="decimal" value={f.lr} onChange={set('lr')} /></label>
          <label className="an-campo">Ancho (cm)<input className="inp" inputMode="decimal" value={f.an} onChange={set('an')} /></label>
          <label className="an-campo">Alto (cm)<input className="inp" inputMode="decimal" value={f.al} onChange={set('al')} /></label>
        </div>
        {!nuevo && <label className="ov-check"><input type="checkbox" checked={f.activo} onChange={e => setF(x => ({ ...x, activo: e.target.checked }))} /> Activo (se agrega solo en las entregas nuevas)</label>}
        <label className="an-campo">Motivo {nuevo ? '(opcional)' : '(obligatorio)'}<input className="inp" value={f.motivo} onChange={set('motivo')} /></label>
        {err && <div className="ov-aviso ov-aviso--mal">{err}</div>}
        <div className="cg-acciones">
          <button className="btn-sec" onClick={onClose}>Cancelar</button>
          <button className="btn-principal" disabled={!valido || env} onClick={guardar}>Guardar</button>
        </div>
      </div>
    </Modal>
  )
}
