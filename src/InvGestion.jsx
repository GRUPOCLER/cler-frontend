// Herramientas del gestor de un conteo: reportes, reconteo, revision de capturas, movimientos de Odoo, comprometido, reconteo externo,
// reporte final con firmas e informe imprimible, y comparacion entre conteos. Odoo solo se lee.
import { useEffect, useState, useCallback } from 'react'
import * as api from './api'
import { Modal } from './ControlOV'
import { nf } from './util'
import { fh, dinero } from './InvUI'

const inv = api.inv
const SEC = [['reporte', 'Resumen'], ['reconteo', 'Reconteo'], ['capturas', 'Revisar capturas'], ['mov', 'Movimientos de Odoo'], ['comp', 'Comprometido'], ['sku', 'Reconteo externo'], ['final', 'Reporte final'], ['comparar', 'Comparar']]
const RES_TXT = { requiere_reconteo: 'Pide otro reconteo', discrepancia: 'Decide el supervisor', pendiente: 'Pendiente de contar', confirmada: 'Confirmada', error_conteo: 'Error del conteo original', decidida: 'Decidida', cuadra_mov: 'Cuadra con movimientos', cuadra: 'Cuadra', sin_reconteo: 'Sin reconteo' }
const MOV_TXT = { explicada: 'Explicada', parcial: 'Parcial', sin_explicar: 'Sin explicar', mal_surtido: 'Mal surtido', mal_surtido_parcial: 'Mal surtido parcial' }
const RECO_TXT = { cuadra: 'Cuadra con el sistema', cuadra_mov: 'Cuadra con movimientos', confirma: 'Confirma el conteo', se_acerca: 'Se acerca al sistema', se_aleja: 'Se aleja del sistema', sin_sistema: 'Sin existencia en sistema', sin_reconteo: 'Con diferencia, sin reconteo', fuera_conteo: 'Fuera del conteo', cuadrado: 'Sin diferencia' }
const COM_TXT = { cuadra: 'Cuadra con el faltante', parcial: 'Cubre parte', excede: 'Mayor que el faltante', sin_faltante: 'Sin faltante', fuera_conteo: 'Fuera del conteo' }

function Kpi({ t, v, n }) { return <div className="inv-kpi"><div className="inv-kpi-t">{t}</div><div className="inv-kpi-v">{v}</div>{n && <div className="inv-kpi-n">{n}</div>}</div> }
const Avisos = ({ l }) => (l || []).map((a, i) => <div key={i} className="ov-aviso ov-aviso--warn">{a}</div>)
const Num = ({ v }) => <span className={v < 0 ? 'inv-neg' : v > 0 ? 'inv-pos' : ''}>{nf(v)}</span>

// ---------- Resumen ----------
function Resumen({ id, toast }) {
  const [r, setR] = useState(null)
  useEffect(() => { inv.get(`/conteos/${id}/reporte`).then(setR).catch(e => toast(e.message, 'error')) }, [id, toast])
  if (!r) return <div className="cargando">Calculando...</div>
  const s = r.resumen
  return (
    <>
      <div className="inv-kpis">
        <Kpi t="Avance" v={s.avance_pct + '%'} n={`${s.contadas} de ${s.ubicaciones}`} />
        <Kpi t="Exactitud por ubicacion" v={s.exactitud_ubicacion_pct === null ? '-' : s.exactitud_ubicacion_pct + '%'} n={`${s.ubicaciones_con_diferencia} con diferencia`} />
        <Kpi t="Exactitud por pieza" v={s.exactitud_pieza_pct === null ? '-' : s.exactitud_pieza_pct + '%'} n={`faltan ${nf(s.faltante_unidades)} / sobran ${nf(s.sobrante_unidades)}`} />
        <Kpi t="Valor faltante" v={s.con_costos ? dinero(s.valor_faltante) : '-'} n={s.con_costos ? 'sobrante ' + dinero(s.valor_sobrante) : 'sin costos: actualiza en Reporte final'} />
      </div>
      <div className="panel">
        <div className="inv-fila" style={{ justifyContent: 'space-between' }}><div className="panel-titulo" style={{ margin: 0 }}>Diferencias ({r.diferencias.length})</div>
          <div className="inv-fila"><button className="btn-sec" onClick={() => inv.csv(`/conteos/${id}/reporte/csv`)}>CSV diferencias</button><button className="btn-sec" onClick={() => inv.csv(`/conteos/${id}/reporte/csv?todas=true`)}>CSV completo</button><button className="btn-sec" onClick={() => inv.csv(`/conteos/${id}/totales-sku/csv`)}>CSV por SKU</button></div></div>
        <div className="lista-scroll"><table className="tabla"><thead><tr><th>Ubicacion</th><th>Clave</th><th>Sistema</th><th>Contado</th><th>Dif.</th><th>Valor</th><th>Contado por</th></tr></thead>
          <tbody>{r.diferencias.slice(0, 300).map((d, i) => <tr key={i} style={{ cursor: 'default' }}><td>{d.codigo}</td><td><b>{d.producto}</b>{d.inesperado && <span className="chip chip-warn" style={{ marginLeft: 6 }}>no esperado</span>}<div className="sub-pag" style={{ margin: 0 }}>{d.descripcion}</div></td><td>{nf(d.esperado)}</td><td>{nf(d.contado)}</td><td><Num v={d.diferencia} /></td><td>{s.con_costos ? dinero(d.valor) : '-'}</td><td>{d.contado_por}</td></tr>)}</tbody></table></div>
      </div>
      <div className="panel"><div className="panel-titulo">Por auditor</div>
        <table className="tabla"><thead><tr><th>Auditor</th><th>Asignadas</th><th>Contadas</th><th>Con diferencia</th></tr></thead><tbody>{r.por_asignado.map(a => <tr key={a.usuario} style={{ cursor: 'default' }}><td>{a.usuario}</td><td>{a.asignadas}</td><td>{a.contadas}</td><td>{a.con_diferencia}</td></tr>)}</tbody></table></div>
      {r.minutos_pausado > 0 && <div className="sub-pag">Tiempo total en pausa: {r.minutos_pausado} min.</div>}
    </>
  )
}

// ---------- Reconteo ----------
function Reconteo({ id, toast, onCambio }) {
  const [cand, setCand] = useState(null)
  const [seg, setSeg] = useState(null)
  const [us, setUs] = useState([])
  const [sel, setSel] = useState({})
  const [quien, setQuien] = useState('')
  const [modo, setModo] = useState('ciego')
  const [prod, setProd] = useState('')
  const [forzar, setForzar] = useState(null)
  const [dec, setDec] = useState(null)
  const [canc, setCanc] = useState(null)
  const cargar = useCallback(async () => {
    try { const [c, s] = await Promise.all([inv.get(`/conteos/${id}/reconteo/candidatos?producto=${encodeURIComponent(prod)}`), inv.get(`/conteos/${id}/reconteo/seguimiento`)]); setCand(c); setSeg(s) } catch (e) { toast(e.message, 'error') }
  }, [id, prod, toast])
  useEffect(() => { cargar(); inv.get('/usuarios').then(setUs).catch(() => {}) }, [cargar])
  const crear = async (forz) => {
    const codigos = Object.keys(sel).filter(k => sel[k])
    try { const r = await inv.post(`/conteos/${id}/reconteo`, { codigos, email: quien, modo, forzar: forz }); toast(`${r.ubicaciones} ubicaciones a reconteo`, 'ok'); setSel({}); setForzar(null); cargar(); onCambio() }
    catch (e) { if (e.message.startsWith('REPETIDO')) setForzar(e.message); else toast(e.message, 'error') }
  }
  if (!cand || !seg) return <div className="cargando">Cargando...</div>
  const elegibles = cand.ubicaciones.filter(u => !u.en_reconteo)
  return (
    <>
      <div className="panel">
        <div className="panel-titulo">Elegir ubicaciones para recontar</div>
        <div className="sub-pag">Se recuenta por otra persona. A ciegas = no ve la cuenta anterior. La cuenta anterior queda en el historial.</div>
        <div className="inv-fila">
          <input className="inp" placeholder="Buscar por producto (opcional)" value={prod} onChange={e => setProd(e.target.value)} />
          <select className="inp" value={quien} onChange={e => setQuien(e.target.value)}><option value="">Sin asignar</option>{us.map(u => <option key={u.usuario} value={u.usuario}>{u.nombre}</option>)}</select>
          <select className="inp" value={modo} onChange={e => setModo(e.target.value)}><option value="ciego">A ciegas</option><option value="previo">Viendo la cuenta previa</option></select>
          <button className="btn-principal" disabled={!Object.values(sel).some(Boolean)} onClick={() => crear(false)}>Mandar a reconteo</button>
        </div>
        <div className="lista-scroll"><table className="tabla"><thead><tr><th style={{ width: 40 }} /><th>Ubicacion</th><th>Lineas con dif.</th><th>Unidades</th><th>%</th><th>Detalle</th></tr></thead>
          <tbody>{elegibles.slice(0, 300).map(u => (
            <tr key={u.codigo} style={{ cursor: 'default' }}><td><input type="checkbox" aria-label={'Elegir ' + u.codigo} checked={!!sel[u.codigo]} onChange={e => setSel(s => ({ ...s, [u.codigo]: e.target.checked }))} /></td>
              <td><b>{u.codigo}</b><div className="sub-pag" style={{ margin: 0 }}>Ronda {u.ronda}</div></td><td>{u.lineas_dif}</td><td>{nf(u.unidades_dif)}</td><td>{u.pct === null ? '-' : u.pct + '%'}</td>
              <td>{u.lineas.map(l => `${l.producto} ${l.esperado}/${l.contado === null ? '-' : l.contado}`).join(', ')}</td></tr>))}</tbody></table></div>
        {elegibles.length === 0 && <div className="sub-pag">No hay ubicaciones contadas con diferencia.</div>}
      </div>
      <div className="panel">
        <div className="inv-fila" style={{ justifyContent: 'space-between' }}><div className="panel-titulo" style={{ margin: 0 }}>Seguimiento de reconteos</div>
          <div className="inv-fila"><button className="btn-sec" onClick={() => inv.csv(`/conteos/${id}/reconteo/historial/csv`)}>Historial CSV</button>{seg.ubicaciones.length > 0 && <button className="btn-sec" onClick={() => setCanc(true)}>Cancelar reconteos</button>}</div></div>
        <Avisos l={seg.aviso_mov ? [seg.aviso_mov] : []} />
        <div className="inv-chips">{Object.entries(seg.cuenta).map(([k, n]) => <span key={k} className="chip">{RES_TXT[k]}: {n}</span>)}</div>
        {seg.ubicaciones.length === 0 ? <div className="sub-pag" style={{ marginTop: 10 }}>Aun no hay reconteos.</div> : seg.ubicaciones.map(o => (
          <div key={o.codigo} className="inv-prod"><div><b>{o.codigo}</b> - {o.estado === 'reconteo' ? `en reconteo (ronda ${o.ronda}) ${o.asignado_a ? 'asignado a ' + o.asignado_a : 'sin asignar'}` : `ronda ${o.ronda}`}</div>
            <table className="tabla"><thead><tr><th>Clave</th><th>Sistema</th><th>Cuentas</th><th>Resultado</th><th /></tr></thead>
              <tbody>{o.lineas.map(l => <tr key={l.producto} style={{ cursor: 'default' }}><td><b>{l.producto}</b></td><td>{nf(l.esperado)}</td><td>{l.final ? `Final ${nf(l.final.valor)}` : l.rondas.map(r => `${r.ronda}: ${nf(r.contado)}`).join(' / ') || '-'}</td>
                <td>{RES_TXT[l.resultado]}<div className="sub-pag" style={{ margin: 0 }}>{l.nota}</div></td>
                <td>{o.estado === 'contada' && <button className="btn-sec" onClick={() => setDec({ codigo: o.codigo, producto: l.producto, valor: l.rondas.length ? String(l.rondas[l.rondas.length - 1].contado) : '', nota: '' })}>Decidir valor</button>}</td></tr>)}</tbody></table></div>
        ))}
        {seg.anulados.length > 0 && <div className="sub-pag">Reconteos cancelados (quedan en el registro): {seg.anulados.map(a => `${a.codigo} (${a.por}: ${a.motivo})`).join('; ')}</div>}
      </div>
      {forzar && <Modal titulo="Misma persona" onClose={() => setForzar(null)}><div style={{ marginBottom: 14 }}>{forzar}</div><div className="inv-fila" style={{ justifyContent: 'flex-end' }}><button className="btn-sec" onClick={() => setForzar(null)}>Elegir a otra persona</button><button className="btn-principal" onClick={() => crear(true)}>Forzar de todos modos</button></div></Modal>}
      {dec && <Modal titulo={`Valor final: ${dec.producto}`} sub={`${dec.codigo}. Este valor es el que usan los reportes.`} onClose={() => setDec(null)}>
        <div className="inv-form"><label>Cantidad final<input className="inp" type="number" min="0" value={dec.valor} onChange={e => setDec({ ...dec, valor: e.target.value })} /></label>
          <label>Nota<input className="inp" value={dec.nota} onChange={e => setDec({ ...dec, nota: e.target.value })} /></label>
          <div className="inv-fila" style={{ justifyContent: 'flex-end' }}><button className="btn-sec" onClick={() => setDec(null)}>Cancelar</button><button className="btn-principal" disabled={dec.valor === ''} onClick={async () => { try { await inv.post(`/conteos/${id}/reconteo/decidir`, { ...dec, valor: Number(dec.valor) }); setDec(null); cargar(); onCambio() } catch (e) { toast(e.message, 'error') } }}>Guardar decision</button></div></div></Modal>}
      {canc && <Modal titulo="Cancelar reconteos" sub="Las ubicaciones vuelven a su conteo original. Las cuentas canceladas se conservan como anuladas." onClose={() => setCanc(null)}>
        <div className="inv-form"><label>Motivo (obligatorio)<input className="inp" value={canc === true ? '' : canc} onChange={e => setCanc(e.target.value || true)} /></label>
          <div className="inv-fila" style={{ justifyContent: 'flex-end' }}><button className="btn-sec" onClick={() => setCanc(null)}>Cerrar</button><button className="btn-principal" disabled={typeof canc !== 'string' || canc.trim().length < 3} onClick={async () => { try { const r = await inv.post(`/conteos/${id}/reconteo/cancelar`, { todos: true, motivo: canc }); toast(r.ubicaciones + ' reconteos cancelados', 'ok'); setCanc(null); cargar(); onCambio() } catch (e) { toast(e.message, 'error') } }}>Cancelar todos los reconteos</button></div></div></Modal>}
    </>
  )
}

// ---------- Revisar capturas ----------
function Capturas({ id, toast, onCambio }) {
  const [v, setV] = useState(null)
  const [esp, setEsp] = useState(null)
  const [nu, setNu] = useState({})
  const cargar = useCallback(() => inv.get(`/conteos/${id}/capturas/validar`).then(setV).catch(e => toast(e.message, 'error')), [id, toast])
  useEffect(() => { cargar() }, [cargar])
  const resolver = async (h, accion) => {
    const k = h.codigo + h.producto
    try { await inv.post(`/conteos/${id}/capturas/resolver`, { items: [{ codigo: h.codigo, producto: h.producto, accion, nuevo: nu[k], motivo: accion === 'corregir' ? 'Correccion desde revision de capturas' : 'Confirmada como correcta' }] }); toast('Listo', 'ok'); cargar(); onCambio() } catch (e) { toast(e.message, 'error') }
  }
  const fusionar = async (h) => { try { await inv.post(`/conteos/${id}/capturas/fusionar`, { items: [{ codigo: h.codigo, de: h.de, a: h.a }] }); toast('Fusionado', 'ok'); cargar(); onCambio() } catch (e) { toast(e.message, 'error') } }
  const completar = async (aplicar) => { try { setEsp(await inv.post(`/conteos/${id}/completar-esperado`, { aplicar, incluir_no_contados: false })); if (aplicar) { toast('Esperados corregidos', 'ok'); cargar(); onCambio() } } catch (e) { toast(e.message, 'error') } }
  if (!v) return <div className="cargando">Revisando...</div>
  return (
    <>
      <div className="panel"><div className="panel-titulo">Hallazgos ({v.total})</div><div className="sub-pag">{v.nota}</div>
        {v.hallazgos.length === 0 ? <div className="sub-pag">No hay capturas sospechosas.</div> : v.hallazgos.map(h => {
          const k = h.codigo + h.producto
          return <div key={k + h.tipo} className="inv-prod"><div><b>{h.codigo}</b> - {h.producto} <span className="chip chip-warn">{{ clave_inexistente: 'Clave no existe', cantidad_atipica: 'Cantidad atipica', posible_fusion: 'Posible error de escritura' }[h.tipo]}</span></div>
            <div className="sub-pag">{h.explicacion}</div><div className="sub-pag">{h.accion}</div>
            <div className="inv-fila">
              {h.tipo === 'posible_fusion' && <button className="btn-principal" onClick={() => fusionar(h)}>Fusionar con {h.a}</button>}
              {h.tipo === 'cantidad_atipica' && <><input className="inp inv-cant" type="number" min="0" placeholder="Cantidad correcta" value={nu[k] || ''} onChange={e => setNu({ ...nu, [k]: e.target.value })} /><button className="btn-sec" disabled={nu[k] === undefined || nu[k] === ''} onClick={() => resolver(h, 'corregir')}>Corregir cantidad</button><button className="btn-sec" onClick={() => resolver(h, 'confirmar')}>Confirmar que es correcta</button></>}
            </div></div>
        })}
      </div>
      <div className="panel"><div className="panel-titulo">Completar esperado</div><div className="sub-pag">Si un producto se capturo como no esperado pero si existia en el sistema al inicio, esto corrige el esperado usando las existencias sincronizadas y los movimientos de Odoo (solo lectura).</div>
        <button className="btn-sec" onClick={() => completar(false)}>Ver que cambiaria</button>
        {esp && (esp.lineas.length === 0 ? <div className="sub-pag" style={{ marginTop: 10 }}>No hay nada que corregir.</div> : <>
          <table className="tabla"><thead><tr><th>Ubicacion</th><th>Clave</th><th>Esperado al inicio</th><th>Contado</th><th>Dif. despues</th></tr></thead><tbody>{esp.lineas.map((l, i) => <tr key={i} style={{ cursor: 'default' }}><td>{l.codigo}</td><td>{l.producto}</td><td>{nf(l.esperado_inicio)}</td><td>{nf(l.contado)}</td><td><Num v={l.diferencia_despues} /></td></tr>)}</tbody></table>
          {!esp.aplicado && <button className="btn-principal" style={{ marginTop: 10 }} onClick={() => completar(true)}>Aplicar correccion</button>}</>)}
      </div>
    </>
  )
}

// ---------- Movimientos de Odoo ----------
function Movimientos({ id, toast }) {
  const [m, setM] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { inv.get(`/conteos/${id}/movimientos`).then(setM).catch(e => setErr(e.message)) }, [id])
  if (err) return <div className="ov-aviso ov-aviso--mal">{err}</div>
  if (!m) return <div className="cargando">Consultando movimientos de Odoo...</div>
  const r = m.resumen
  return (
    <>
      <div className="sub-pag">Ventana: {m.ventana.desde} a {m.ventana.hasta}. Una diferencia puede deberse a una OV o traslado entre la sincronizacion y el conteo.</div>
      <Avisos l={m.ventana.aviso_mal_surtido ? [m.ventana.aviso_mal_surtido] : []} />
      <div className="inv-kpis"><Kpi t="Diferencias" v={r.diferencias} /><Kpi t="Explicadas" v={r.explicada} /><Kpi t="Sin explicar" v={r.sin_explicar} /><Kpi t="OV surtidas" v={r.ovs} n={nf(r.unidades_ov) + ' unidades'} /></div>
      <div className="panel"><div className="inv-fila" style={{ justifyContent: 'space-between' }}><div className="panel-titulo" style={{ margin: 0 }}>Diferencias vs movimientos</div><button className="btn-sec" onClick={() => inv.csv(`/conteos/${id}/movimientos/csv`)}>Descargar CSV</button></div>
        <div className="lista-scroll"><table className="tabla"><thead><tr><th>Ubicacion</th><th>Clave</th><th>Dif.</th><th>Movimiento neto</th><th>Sin explicar</th><th>Estado</th><th>Documentos</th></tr></thead>
          <tbody>{m.diferencias.slice(0, 300).map((d, i) => <tr key={i} style={{ cursor: 'default' }}><td>{d.codigo}</td><td><b>{d.producto}</b></td><td><Num v={d.diferencia} /></td><td><Num v={d.movimiento_neto} /></td><td><Num v={d.diferencia_sin_explicar} /></td><td>{MOV_TXT[d.estado]}</td><td>{d.docs.map(x => x.documento).filter(Boolean).join(', ')}{d.posible_origen.map((o, j) => <div key={j} className="sub-pag" style={{ margin: 0 }}>{o.tipo === 'cruce' ? `Cruce con ${o.ubicacion} (${o.cantidad})` : `OV ${o.documento || ''} desde ${o.ubicacion} (${o.cantidad})`}</div>)}</td></tr>)}</tbody></table></div></div>
    </>
  )
}

// ---------- Comprometido ----------
function Comprometido({ id, toast }) {
  const [c, setC] = useState(null)
  const [alm, setAlm] = useState([])
  const [modo, setModo] = useState('tope')
  const [texto, setTexto] = useState('')
  const [cant, setCant] = useState({})
  const cargar = useCallback(() => inv.get(`/conteos/${id}/comprometido`).then(x => { setC(x); setAlm(x.config.almacenes); setModo(x.config.modo) }).catch(e => toast(e.message, 'error')), [id, toast])
  useEffect(() => { cargar() }, [cargar])
  if (!c) return <div className="cargando">Calculando...</div>
  const t = c.totales
  const guardaCfg = async () => { try { await inv.post(`/conteos/${id}/comprometido/config`, { almacenes: alm, modo }); toast('Configuracion guardada', 'ok'); cargar() } catch (e) { toast(e.message, 'error') } }
  const carga = async () => { try { const r = await inv.post(`/conteos/${id}/comprometido/cargar`, { texto }); toast(r.importados + ' productos cargados', 'ok'); setTexto(''); cargar() } catch (e) { toast(e.message, 'error') } }
  const descuenta = async (f, n) => { try { await inv.post(`/conteos/${id}/comprometido/descontar`, { items: [{ producto: f.producto, cantidad: n }] }); cargar() } catch (e) { toast(e.message, 'error') } }
  return (
    <>
      <div className="sub-pag">{c.nota}</div><Avisos l={c.avisos} />
      <div className="inv-kpis"><Kpi t="Faltante original" v={dinero(t.falt_v0)} /><Kpi t="Faltante ajustado" v={dinero(t.falt_v1)} /><Kpi t="Sobrante original" v={dinero(t.sobr_v0)} /><Kpi t="Sobrante ajustado" v={dinero(t.sobr_v1)} /></div>
      <div className="panel"><div className="panel-titulo">Configuracion</div>
        <div className="inv-fila">{(c.almacenes_disponibles || []).map(a => <label key={a.nombre} className="inv-chk"><input type="checkbox" checked={alm.includes(a.nombre)} onChange={e => setAlm(e.target.checked ? [...alm, a.nombre] : alm.filter(x => x !== a.nombre))} /> {a.nombre}</label>)}
          <select className="inp" value={modo} onChange={e => setModo(e.target.value)}><option value="tope">Descontar solo hasta el tope</option><option value="exacto">Descontar solo lo que cuadra exacto</option><option value="manual">Todo manual</option></select>
          <button className="btn-sec" disabled={!alm.length} onClick={guardaCfg}>Guardar</button></div></div>
      <div className="panel"><div className="panel-titulo">Cargar comprometido manual</div><div className="sub-pag">Pega columnas: Producto, Cantidad, Motivo (cantidad 0 quita lo capturado).</div>
        <textarea className="inp inv-area" value={texto} onChange={e => setTexto(e.target.value)} /><button className="btn-sec" disabled={!texto.trim()} onClick={carga}>Cargar</button></div>
      <div className="panel"><div className="inv-fila" style={{ justifyContent: 'space-between' }}><div className="panel-titulo" style={{ margin: 0 }}>Productos con comprometido ({c.filas.length})</div><button className="btn-sec" onClick={() => inv.csv(`/conteos/${id}/comprometido/csv`)}>Descargar CSV</button></div>
        <div className="lista-scroll"><table className="tabla"><thead><tr><th>Producto</th><th>Tipo</th><th>Diferencia</th><th>Comprometido</th><th>Descontado</th><th>Resultado</th><th /></tr></thead>
          <tbody>{c.filas.map(f => <tr key={f.producto} style={{ cursor: 'default' }}><td><b>{f.producto}</b><div className="sub-pag" style={{ margin: 0 }}>{f.explicacion}</div></td><td>{f.tipo}</td><td>{nf(f.faltante)}</td><td>{nf(f.comprometido)}</td><td>{nf(f.descontar)}{f.auto && ' (auto)'}</td><td>{COM_TXT[f.estado]}</td>
            <td>{f.tipo !== 'ninguno' && <div className="inv-fila"><input className="inp inv-cant" type="number" min="0" aria-label="Cantidad a descontar" value={cant[f.producto] ?? ''} placeholder={String(f.sugerido)} onChange={e => setCant({ ...cant, [f.producto]: e.target.value })} /><button className="btn-sec" onClick={() => descuenta(f, cant[f.producto] === undefined || cant[f.producto] === '' ? f.sugerido : Number(cant[f.producto]))}>Descontar</button></div>}</td></tr>)}</tbody></table></div></div>
    </>
  )
}

// ---------- Reconteo externo por SKU ----------
function RecoSku({ id, toast }) {
  const [r, setR] = useState(null)
  const [texto, setTexto] = useState('')
  const [mov, setMov] = useState(false)
  const cargar = useCallback(() => inv.get(`/conteos/${id}/reconteo-sku?movimientos_=${mov}`).then(setR).catch(e => toast(e.message, 'error')), [id, mov, toast])
  useEffect(() => { cargar() }, [cargar])
  const carga = async () => { try { const x = await inv.post(`/conteos/${id}/reconteo-sku`, { texto }); toast(x.importados + ' productos cargados' + (x.avisos.length ? ` (${x.avisos.length} avisos)` : ''), 'ok'); setTexto(''); cargar() } catch (e) { toast(e.message, 'error') } }
  return (
    <>
      <div className="panel"><div className="panel-titulo">Cargar reconteo hecho fuera del sistema</div><div className="sub-pag">Pega columnas: Producto, Recontado, Observacion (opcional). Es por producto, sin ubicacion.</div>
        <textarea className="inp inv-area" value={texto} onChange={e => setTexto(e.target.value)} /><button className="btn-principal" disabled={!texto.trim()} onClick={carga}>Cargar reconteo</button></div>
      {!r ? <div className="cargando">Calculando...</div> : (
        <div className="panel"><Avisos l={r.avisos} />
          <div className="inv-fila" style={{ justifyContent: 'space-between' }}><div className="panel-titulo" style={{ margin: 0 }}>Resultado ({r.recontados} recontados)</div>
            <div className="inv-fila"><label className="inv-chk"><input type="checkbox" checked={mov} onChange={e => setMov(e.target.checked)} /> Considerar movimientos de Odoo</label><button className="btn-sec" onClick={() => inv.csv(`/conteos/${id}/reconteo-sku/csv?movimientos_=${mov}`)}>Descargar CSV</button></div></div>
          <div className="inv-chips">{Object.entries(r.cuenta).map(([k, n]) => <span key={k} className="chip">{RECO_TXT[k]}: {n}</span>)}</div>
          <div className="lista-scroll"><table className="tabla"><thead><tr><th>Producto</th><th>Sistema</th><th>Contado</th><th>Recontado</th><th>Resultado</th></tr></thead>
            <tbody>{r.filas.map(f => <tr key={f.producto} style={{ cursor: 'default' }}><td><b>{f.producto}</b><div className="sub-pag" style={{ margin: 0 }}>{f.explicacion}</div></td><td>{nf(f.sistema)}</td><td>{nf(f.contado)}</td><td>{f.recontado === null ? '-' : nf(f.recontado)}</td><td>{RECO_TXT[f.estado]}</td></tr>)}</tbody></table></div>
          <div className="sub-pag">{r.nota_final}</div></div>
      )}
    </>
  )
}

// ---------- Reporte final + firmas + informe ----------
function Final({ id, conteo, toast }) {
  const [r, setR] = useState(null)
  const [op, setOp] = useState({ mov: false, ajustado: true })
  const [firmas, setFirmas] = useState([{ nombre: '', cargo: '' }])
  const [ocupado, setOcupado] = useState(false)
  const [ne, setNe] = useState(null)
  const cargar = useCallback(async (actualizar = false) => {
    setOcupado(true)
    try { const x = await inv.get(`/conteos/${id}/final?actualizar_costos=${actualizar}&movimientos_=${op.mov}&ajustado=${op.ajustado}`); setR(x); if (x.firmas.length) setFirmas(x.firmas) } catch (e) { toast(e.message, 'error') } finally { setOcupado(false) }
  }, [id, op, toast])
  useEffect(() => { cargar() }, [cargar])
  const guardaFirmas = async () => { try { await inv.post(`/conteos/${id}/firmas`, { firmas }); toast('Firmas guardadas', 'ok') } catch (e) { toast(e.message, 'error') } }
  const verNe = async () => { try { setNe(await inv.get(`/conteos/${id}/no-esperados`)) } catch (e) { toast(e.message, 'error') } }
  const clasifica = async (p, unidad) => { try { await inv.post(`/conteos/${id}/otras-un`, { items: [{ producto: p, unidad, quitar: !unidad }] }); verNe(); cargar() } catch (e) { toast(e.message, 'error') } }
  if (!r) return <div className="cargando">Calculando reporte final...</div>
  const v = r.valor, real = r.real
  return (
    <>
      <div className="panel inv-no-print">
        <div className="inv-fila" style={{ justifyContent: 'space-between' }}>
          <div className="inv-fila"><label className="inv-chk"><input type="checkbox" checked={op.ajustado} onChange={e => setOp({ ...op, ajustado: e.target.checked })} /> Ajustar por comprometido y reconteo externo</label>
            <label className="inv-chk"><input type="checkbox" checked={op.mov} onChange={e => setOp({ ...op, mov: e.target.checked })} /> Incluir movimientos de Odoo</label></div>
          <div className="inv-fila"><button className="btn-sec" disabled={ocupado} onClick={() => cargar(true)}>Actualizar costos desde Odoo</button><button className="btn-principal" onClick={() => window.print()}>Imprimir informe</button></div></div>
        <div className="inv-fila" style={{ marginTop: 10 }}>{['valor', 'faltantes', 'inventario', 'compensados', 'defectuosos', 'movimientos', 'causas', 'otras_un'].map(s => <button key={s} className="btn-sec" onClick={() => inv.csv(`/conteos/${id}/final/csv?seccion=${s}`).catch(e => toast(e.message, 'error'))}>CSV {s.replace('_', ' ')}</button>)}</div>
      </div>
      <div className="inv-informe">
        <div className="panel">
          <div className="panel-titulo">Informe de auditoria de inventario - {r.conteo.nombre}</div>
          <div className="sub-pag">{r.conteo.id} - {r.conteo.alcance} - {r.conteo.estatus} - {fh(r.conteo.fecha)}{r.conteo.fecha_cierre ? ' a ' + fh(r.conteo.fecha_cierre) : ''} - {r.avance.contadas} de {r.avance.ubicaciones} ubicaciones contadas</div>
          <Avisos l={r.avisos} />{r.sin_costo.length > 0 && <div className="ov-aviso ov-aviso--warn">{r.sin_costo.length} productos sin costo en Odoo: {r.sin_costo.slice(0, 12).join(', ')}</div>}
          <div className="inv-kpis"><Kpi t="Valor sistema" v={dinero(v.valor_sistema)} /><Kpi t="Valor contado" v={dinero(v.valor_contado)} /><Kpi t="Diferencia" v={dinero(v.diferencia)} n={`faltante ${dinero(v.faltante)} / sobrante ${dinero(v.sobrante)}`} /><Kpi t="Incidencias" v={r.incidencias.total} n={`${r.incidencias.abiertas} abiertas`} /></div>
        </div>
        {real && <div className="panel"><div className="panel-titulo">Cifra real (despues de ajustes)</div>
          <table className="tabla"><tbody>{real.puente.map(p => <tr key={p.clave} style={{ cursor: 'default' }}><td><b>{p.etiqueta}</b><div className="sub-pag" style={{ margin: 0 }}>{p.detalle}</div></td><td style={{ textAlign: 'right' }}>{dinero(p.valor)}</td></tr>)}</tbody></table>
          <div className="sub-pag">Real: faltante {dinero(real.faltante)} ({nf(real.faltante_u)} piezas) / sobrante {dinero(real.sobrante)} ({nf(real.sobrante_u)} piezas). No vendible: {dinero(real.no_vendible)}.</div></div>}
        <div className="panel"><div className="panel-titulo">Mayores diferencias por valor</div>
          <table className="tabla"><thead><tr><th>Ubicacion</th><th>Clave</th><th>Dif.</th><th>Valor</th></tr></thead><tbody>{r.faltantes_sobrantes.detalle.slice(0, 15).map((d, i) => <tr key={i} style={{ cursor: 'default' }}><td>{d.codigo}</td><td>{d.producto}</td><td><Num v={d.diferencia} /></td><td>{dinero(d.valor)}</td></tr>)}</tbody></table></div>
        {r.movimientos && <div className="panel"><div className="panel-titulo">Causas de las diferencias</div>
          <table className="tabla"><thead><tr><th>Causa</th><th>Unidades</th><th>Valor</th></tr></thead><tbody>{r.movimientos.causas.categorias.map(c => <tr key={c.clave} style={{ cursor: 'default' }}><td>{c.nombre}</td><td>{nf(c.unidades)}</td><td>{dinero(c.valor)}</td></tr>)}</tbody></table></div>}
        {r.otras_un.productos > 0 && <div className="panel"><div className="panel-titulo">Mercancia de otras unidades de negocio</div><div className="sub-pag">{r.otras_un.productos} productos, {nf(r.otras_un.unidades)} unidades. No cuentan como sobrante.</div></div>}
        <div className="panel inv-firmas"><div className="panel-titulo">Firmas de recibido</div>
          <div className="inv-firmas-grid">{firmas.map((f, i) => <div key={i} className="inv-firma"><div className="inv-firma-linea" /><div>{f.nombre || ' '}</div><div className="sub-pag" style={{ margin: 0 }}>{f.cargo}</div></div>)}</div></div>
      </div>
      <div className="panel inv-no-print"><div className="panel-titulo">Firmas del informe (hasta 6)</div>
        {firmas.map((f, i) => <div key={i} className="inv-fila" style={{ marginBottom: 6 }}><input className="inp" placeholder="Nombre" value={f.nombre} onChange={e => setFirmas(firmas.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} /><input className="inp" placeholder="Cargo" value={f.cargo} onChange={e => setFirmas(firmas.map((x, j) => j === i ? { ...x, cargo: e.target.value } : x))} /><button className="btn-sec" onClick={() => setFirmas(firmas.filter((_, j) => j !== i))}>Quitar</button></div>)}
        <div className="inv-fila">{firmas.length < 6 && <button className="btn-sec" onClick={() => setFirmas([...firmas, { nombre: '', cargo: '' }])}>Agregar persona</button>}<button className="btn-principal" onClick={guardaFirmas}>Guardar firmas</button></div></div>
      <div className="panel inv-no-print"><div className="panel-titulo">Mercancia no esperada</div><div className="sub-pag">Marca los productos que son de otra unidad de negocio para que no cuenten como sobrante.</div>
        <button className="btn-sec" onClick={verNe}>Ver productos no esperados</button>
        {ne && (ne.productos.length === 0 ? <div className="sub-pag" style={{ marginTop: 8 }}>No hay productos no esperados.</div> : <table className="tabla"><thead><tr><th>Clave</th><th>Unidades</th><th>Ubicaciones</th><th>Unidad de negocio</th></tr></thead>
          <tbody>{ne.productos.map(p => <tr key={p.producto} style={{ cursor: 'default' }}><td><b>{p.producto}</b></td><td>{nf(p.unidades)}</td><td>{p.ubicaciones.slice(0, 4).join(', ')}</td><td><select className="inp" value={p.unidad} onChange={e => clasifica(p.producto, e.target.value)}><option value="">Es del sistema (sobrante)</option>{ne.unidades_negocio.map(u => <option key={u}>{u}</option>)}</select></td></tr>)}</tbody></table>)}</div>
    </>
  )
}

// ---------- Comparar ----------
function Comparar({ id, toast }) {
  const [conteos, setConteos] = useState([])
  const [otro, setOtro] = useState('')
  const [r, setR] = useState(null)
  useEffect(() => { inv.get('/conteos').then(l => setConteos(l.filter(c => c.id !== id))).catch(() => {}) }, [id])
  const comparar = async () => { try { setR(await inv.get(`/comparar?a=${id}&b=${otro}`)) } catch (e) { toast(e.message, 'error') } }
  const K = ({ k }) => <><td>{r.kpi_a[k] === null ? '-' : nf(r.kpi_a[k])}</td><td>{r.kpi_b[k] === null ? '-' : nf(r.kpi_b[k])}</td></>
  return (
    <div className="panel"><div className="panel-titulo">Comparar contra otro conteo</div>
      <div className="inv-fila"><select className="inp" value={otro} onChange={e => setOtro(e.target.value)}><option value="">Elige otro conteo...</option>{conteos.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.id})</option>)}</select><button className="btn-principal" disabled={!otro} onClick={comparar}>Comparar</button></div>
      {r && <>
        <div className="sub-pag" style={{ marginTop: 12 }}>Anterior: {r.a.nombre} ({fh(r.a.fecha)}) - Reciente: {r.b.nombre} ({fh(r.b.fecha)}). Ubicaciones en comun: {r.alcance.comunes}.</div>
        <div className="inv-chips"><span className="chip chip-ok">Mejoraron: {r.cuenta.mejoro}</span><span className="chip chip-warn">Empeoraron: {r.cuenta.empeoro}</span><span className="chip">Persisten: {r.cuenta.persiste}</span><span className="chip">Sin diferencia: {r.cuenta.sin_dif}</span></div>
        <table className="tabla"><thead><tr><th>Indicador</th><th>Anterior</th><th>Reciente</th></tr></thead><tbody>
          <tr style={{ cursor: 'default' }}><td>Exactitud por ubicacion (%)</td><K k="exactitud_ubicacion_pct" /></tr><tr style={{ cursor: 'default' }}><td>Exactitud por pieza (%)</td><K k="exactitud_pieza_pct" /></tr>
          <tr style={{ cursor: 'default' }}><td>Faltante (unidades)</td><K k="faltante_unidades" /></tr><tr style={{ cursor: 'default' }}><td>Sobrante (unidades)</td><K k="sobrante_unidades" /></tr></tbody></table>
        <div className="inv-fila" style={{ marginTop: 10 }}><button className="btn-sec" onClick={() => inv.csv(`/comparar/csv?a=${id}&b=${otro}`)}>CSV por ubicacion</button><button className="btn-sec" onClick={() => inv.csv(`/comparar/csv?a=${id}&b=${otro}&seccion=productos`)}>CSV reincidentes</button></div>
        {r.reincidentes.length > 0 && <><div className="panel-titulo" style={{ marginTop: 14 }}>Reincidentes (con diferencia en ambos)</div><table className="tabla"><thead><tr><th>Ubicacion</th><th>Clave</th><th>Dif. anterior</th><th>Dif. reciente</th></tr></thead><tbody>{r.reincidentes.slice(0, 30).map((x, i) => <tr key={i} style={{ cursor: 'default' }}><td>{x.codigo}</td><td>{x.producto}</td><td><Num v={x.dif_a} /></td><td><Num v={x.dif_b} /></td></tr>)}</tbody></table></>}
      </>}
    </div>
  )
}

export default function Gestion({ id, conteo, toast, onCambio }) {
  const [s, setS] = useState('reporte')
  return (
    <>
      <div className="seg-ctl inv-tabs inv-no-print" role="tablist">{SEC.map(([k, t]) => <button key={k} role="tab" aria-selected={s === k} className={'seg-btn' + (s === k ? ' on' : '')} onClick={() => setS(k)}>{t}</button>)}</div>
      {s === 'reporte' && <Resumen id={id} toast={toast} />}
      {s === 'reconteo' && <Reconteo id={id} toast={toast} onCambio={onCambio} />}
      {s === 'capturas' && <Capturas id={id} toast={toast} onCambio={onCambio} />}
      {s === 'mov' && <Movimientos id={id} toast={toast} />}
      {s === 'comp' && <Comprometido id={id} toast={toast} />}
      {s === 'sku' && <RecoSku id={id} toast={toast} />}
      {s === 'final' && <Final id={id} conteo={conteo} toast={toast} />}
      {s === 'comparar' && <Comparar id={id} toast={toast} />}
    </>
  )
}
