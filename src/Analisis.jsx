// ============================================================
//  ANALISIS - reporteria con storytelling para tres audiencias.
//  Cada vista abre con la conclusion (titular), sigue con las cifras que la prueban,
//  y cierra con "Para decidir". Los titulos de cada grafica son el hallazgo.
// ============================================================
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from './api'
import { nf, fechaCorta, TarjetaGrafica, Kpi, Columnas, Ranking, ApiladaDuo, Medidor, MapaCalor, Segmentada, Sankey, Estado } from './graficas'

const hoyMX = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
const sumaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const fechaLarga = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }
const horas = (h) => h == null ? '-' : h < 1 ? `${nf(h * 60)} min` : h < 48 ? `${nf(h, 1)} h` : `${nf(h / 24, 1)} días`
const pct = (a, b) => (b ? (100 * a) / b : 0)
const DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

const VISTAS = [
  { id: 'direccion', nombre: 'Dirección General', pregunta: 'Cuánto movimos y qué significa' },
  { id: 'operaciones', nombre: 'Gerencia de Operaciones', pregunta: 'Qué tan bien operamos' },
  { id: 'embarques', nombre: 'Jefatura de Embarques', pregunta: 'Qué sale y qué se está atrasando' },
]
const PRESETS = [{ id: 7, t: '7 días' }, { id: 30, t: '30 días' }, { id: 90, t: '90 días' }]

function media7(serie, campo) {
  return serie.map((_, i) => {
    if (i < 6) return null
    let s = 0; for (let k = i - 6; k <= i; k++) s += serie[k][campo]
    return s / 7
  })
}
function variacion(delta, dias) {
  if (delta === null || delta === undefined) return `Sin periodo anterior con qué comparar.`
  if (delta === 0) return `Igual que los ${dias} días anteriores.`
  return `${nf(Math.abs(delta), 1)}% ${delta > 0 ? 'más' : 'menos'} que los ${dias} días anteriores.`
}

export default function Analisis({ toast }) {
  const navigate = useNavigate()
  const [preset, setPreset] = useState(30)
  const [rango, setRango] = useState(() => ({ desde: sumaDias(hoyMX(), -29), hasta: hoyMX() }))
  const [empresa, setEmpresa] = useState('')
  const [sistema, setSistema] = useState('')
  const [vista, setVista] = useState(() => { try { return localStorage.getItem('cler_vista_analisis') || 'direccion' } catch { return 'direccion' } })
  const [estado, setEstado] = useState({ cargando: true, error: null, datos: null })
  const [odoo, setOdoo] = useState({ cargando: true, error: null, datos: null })
  const [empresas, setEmpresas] = useState([])

  const aplicarPreset = (n) => { setPreset(n); setRango({ desde: sumaDias(hoyMX(), -(n - 1)), hasta: hoyMX() }) }
  const cambiarVista = (v) => { setVista(v); try { localStorage.setItem('cler_vista_analisis', v) } catch {} }

  const cargar = useCallback(() => {
    setEstado(s => ({ ...s, cargando: true, error: null }))
    api.obtenerAnalisis({ ...rango, empresa, sistema })
      .then(d => { setEstado({ cargando: false, error: null, datos: d }); if (!empresa) setEmpresas(d.empresas_disponibles || []) })
      .catch(e => setEstado({ cargando: false, error: e.message || 'No se pudo calcular el reporte. Intenta de nuevo.', datos: null }))
  }, [rango.desde, rango.hasta, empresa, sistema])
  useEffect(() => { cargar() }, [cargar])

  const cargarOdoo = useCallback(() => {
    setOdoo({ cargando: true, error: null, datos: null })
    api.obtenerAnalisisOdoo()
      .then(d => setOdoo({ cargando: false, error: null, datos: d }))
      .catch(e => setOdoo({ cargando: false, error: e.message || 'No se pudo consultar Odoo. Intenta de nuevo.', datos: null }))
  }, [])
  useEffect(() => { cargarOdoo() }, [cargarOdoo])

  const d = estado.datos
  const vacio = d && d.kpis.entregas === 0
  const vistaInfo = VISTAS.find(v => v.id === vista)

  return (
    <div className="contenedor an-pagina">
      <div className="an-no-print">
        <h1 className="an-h1">Análisis</h1>
        <div className="an-filtros">
          <div className="an-preset" role="group" aria-label="Periodo">
            {PRESETS.map(p => (
              <button key={p.id} className={'an-chip' + (preset === p.id ? ' on' : '')} onClick={() => aplicarPreset(p.id)}>{p.t}</button>
            ))}
          </div>
          <label className="an-campo">Desde
            <input className="inp" type="date" value={rango.desde} max={rango.hasta}
              onChange={e => { setPreset(0); setRango(r => ({ ...r, desde: e.target.value })) }} />
          </label>
          <label className="an-campo">Hasta
            <input className="inp" type="date" value={rango.hasta} min={rango.desde} max={hoyMX()}
              onChange={e => { setPreset(0); setRango(r => ({ ...r, hasta: e.target.value })) }} />
          </label>
          <label className="an-campo">Empresa
            <select className="inp" value={empresa} onChange={e => setEmpresa(e.target.value)}>
              <option value="">Todas</option>
              {empresas.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label className="an-campo">Sistema
            <select className="inp" value={sistema} onChange={e => setSistema(e.target.value)}>
              <option value="">Todos</option>
              <option value="TAR">Tarima</option><option value="CS">Carga suelta</option><option value="MIX">Mixta</option>
            </select>
          </label>
          <button className="btn-sec an-imprimir" onClick={() => window.print()} disabled={!d}>Imprimir reporte</button>
        </div>

        <div className="an-tabs" role="tablist">
          {VISTAS.map(v => (
            <button key={v.id} role="tab" aria-selected={vista === v.id} className={'an-tab' + (vista === v.id ? ' on' : '')} onClick={() => cambiarVista(v.id)}>
              <span className="an-tab-n">{v.nombre}</span>
              <span className="an-tab-p">{v.pregunta}</span>
            </button>
          ))}
        </div>
      </div>

      <Estado cargando={estado.cargando && !d} error={estado.error} vacio={vacio} reintentar={cargar}>
        {d && !vacio && (
          <div className={'an-doc' + (estado.cargando ? ' an-actualizando' : '')}>
            <div className="an-doc-cab">
              <div>Reporte | {vistaInfo.nombre}</div>
              <div>Periodo {fechaLarga(d.periodo.desde)} al {fechaLarga(d.periodo.hasta)} ({d.periodo.dias} días){d.filtros.empresa ? ` | ${d.filtros.empresa}` : ''}{d.filtros.sistema ? ` | ${d.filtros.sistema}` : ''}</div>
            </div>
            {vista === 'direccion' && <VistaDireccion d={d} odoo={odoo} recargarOdoo={cargarOdoo} />}
            {vista === 'operaciones' && <VistaOperaciones d={d} />}
            {vista === 'embarques' && <VistaEmbarques d={d} ir={(id) => navigate(`/entregas/${id}`)} />}
            <div className="an-nota-pie">Fuente: sistema de Tarimas{vista === 'direccion' ? ' y consulta de solo lectura a Odoo' : ''}. Los kilos se calculan con el peso del catálogo.</div>
          </div>
        )}
      </Estado>
    </div>
  )
}

// ── bloque de cierre ──
function ParaDecidir({ puntos }) {
  if (!puntos.length) return null
  return (
    <section className="an-decidir">
      <h3>Para decidir</h3>
      <ul>{puntos.map((p, i) => <li key={i}>{p}</li>)}</ul>
    </section>
  )
}
const Titular = ({ children, sub }) => (
  <div className="an-titular"><h2>{children}</h2>{sub && <p>{sub}</p>}</div>
)


// ── Sankey de volumen por cliente (empresa -> tipo de entrega -> cliente) ──
const METRICAS = [{ id: 'piezas', t: 'Piezas', u: 'piezas' }, { id: 'kg', t: 'Kilos', u: 'kg' }, { id: 'bultos', t: 'Bultos', u: 'bultos' }]
function SankeyClientes({ d }) {
  const [metrica, setMetrica] = useState('piezas')
  const [topN, setTopN] = useState(8)
  const m = METRICAS.find(x => x.id === metrica)
  const flujo = d.flujo || []
  const porCli = {}
  flujo.forEach(f => { porCli[f.cliente] = (porCli[f.cliente] || 0) + (f[metrica] || 0) })
  const orden = Object.entries(porCli).sort((a, b) => b[1] - a[1])
  const total = orden.reduce((a, x) => a + x[1], 0)
  const top3 = orden.slice(0, 3).reduce((a, x) => a + x[1], 0)
  const titulo = total && orden.length > 3
    ? `3 clientes concentran ${nf(pct(top3, total))}% de ${m.u === 'kg' ? 'los kilos' : 'las ' + m.u}: ${orden.slice(0, 3).map(x => x[0]).join(', ')}`
    : 'De dónde viene y a quién llega el volumen'
  const filas = [...flujo].sort((a, b) => (b[metrica] || 0) - (a[metrica] || 0)).map(f => [f.empresa, ({ TAR: 'Tarima', CS: 'Carga suelta', MIX: 'Mixta' })[f.sistema] || f.sistema, f.cliente, nf(f.piezas), nf(f.kg), nf(f.bultos)])
  return (
    <TarjetaGrafica ancho="3" titulo={titulo}
      sub={`Cómo fluye el volumen de cada empresa, por tipo de entrega, hasta el cliente. Se muestran los ${topN} clientes con más ${m.u}; el resto se agrupa.`}
      tabla={{ cols: ['Empresa', 'Tipo de entrega', 'Cliente', 'Piezas', 'Kg', 'Bultos'], filas }}>
      <div className="an-sankey-ctl">
        <div className="an-preset" role="group" aria-label="Medir en">
          {METRICAS.map(x => <button key={x.id} className={'an-chip' + (metrica === x.id ? ' on' : '')} onClick={() => setMetrica(x.id)}>{x.t}</button>)}
        </div>
        <div className="an-preset" role="group" aria-label="Clientes a mostrar">
          {[5, 8, 12].map(n => <button key={n} className={'an-chip' + (topN === n ? ' on' : '')} onClick={() => setTopN(n)}>Top {n}</button>)}
        </div>
      </div>
      <Sankey flujo={flujo} metrica={metrica} topN={topN} unidad={m.u} />
    </TarjetaGrafica>
  )
}

// ───────────────────────── DIRECCION GENERAL ─────────────────────────
function VistaDireccion({ d, odoo, recargarOdoo }) {
  const k = d.kpis, dias = d.periodo.dias
  const serie = d.serie_diaria
  const m7 = useMemo(() => media7(serie, 'piezas'), [serie])
  const pico = serie.reduce((mx, s, i) => (s.piezas > serie[mx].piezas ? i : mx), 0)
  const topEmp = d.por_empresa[0]
  const totalPz = d.por_empresa.reduce((a, e) => a + e.piezas, 0)
  const topCli = d.top_clientes[0]
  const o = odoo.datos
  const decidir = []
  if (o && o.sin_tomar > 0) decidir.push(`Hay ${nf(o.sin_tomar)} órdenes de venta en Odoo (últimos ${o.ventana_dias} días) que aún no se trabajan en Tarimas. Confirmar con Embarques cuáles tienen prioridad.`)
  if (topEmp && pct(topEmp.piezas, totalPz) >= 50 && d.por_empresa.length > 1) decidir.push(`${topEmp.nombre} concentra ${nf(pct(topEmp.piezas, totalPz))}% de las piezas: un cambio en su demanda mueve todo el volumen.`)
  if (d.pendientes.antiguedad[3].n + d.pendientes.antiguedad[2].n > 0) decidir.push(`${nf(d.pendientes.antiguedad[3].n + d.pendientes.antiguedad[2].n)} entregas llevan más de 3 días sin completarse.`)
  if (k.cobertura_peso < 95) decidir.push(`El peso total es un mínimo: el catálogo no tiene peso para ${nf(100 - k.cobertura_peso, 1)}% de las piezas.`)
  return (
    <>
      <Titular sub={variacion(k.delta.piezas, dias)}>
        Movimos {nf(k.piezas)} piezas ({nf(k.kg)} kg) en {nf(k.entregas)} entregas
      </Titular>
      <div className="an-kpis">
        <Kpi heroe titulo="Piezas movidas" valor={nf(k.piezas)} delta={k.delta.piezas} />
        <Kpi titulo="Entregas" valor={nf(k.entregas)} delta={k.delta.entregas} nota={`${nf(k.completadas)} completadas`} />
        <Kpi titulo="Peso movido" valor={nf(k.kg)} unidad="kg" delta={k.delta.kg} nota={`Peso de catálogo en ${nf(k.cobertura_peso)}% de las piezas`} />
        <Kpi titulo="Bultos cerrados" valor={nf(k.bultos)} delta={k.delta.bultos} nota={`${nf(k.tarimas)} tarimas y ${nf(k.cajas)} cajas`} />
      </div>

      <div className="an-grid">
        <TarjetaGrafica ancho="2" titulo={`El día de mayor volumen fue el ${fechaCorta(serie[pico].fecha)}, con ${nf(serie[pico].piezas)} piezas`}
          sub="Piezas por día de captura. La línea es el promedio de 7 días: muestra la tendencia sin el ruido diario."
          tabla={{ cols: ['Fecha', 'Piezas', 'Entregas'], filas: serie.map(s => [fechaLarga(s.fecha), nf(s.piezas), nf(s.entregas)]) }}>
          <Columnas datos={serie.map(s => ({ etq: fechaCorta(s.fecha), valor: s.piezas, extra: `${nf(s.entregas)} entregas` }))} resaltar={[pico]} media={m7} unidad="piezas" />
        </TarjetaGrafica>

        <SankeyClientes d={d} />

        <TarjetaGrafica titulo={topEmp ? `${topEmp.nombre} concentra ${nf(pct(topEmp.piezas, totalPz))}% de las piezas` : 'Piezas por empresa'}
          sub="Piezas por empresa que genera la entrega."
          tabla={{ cols: ['Empresa', 'Piezas', 'Entregas', 'Kg'], filas: d.por_empresa.map(e => [e.nombre, nf(e.piezas), nf(e.entregas), nf(e.kg)]) }}>
          <Ranking filas={d.por_empresa.map(e => ({ nombre: e.nombre, valor: e.piezas, nota: `${nf(e.entregas)} entregas | ${nf(e.kg)} kg` }))} unidad="pzas" />
        </TarjetaGrafica>

        <TarjetaGrafica titulo={topCli ? `${topCli.nombre} es el destino con más piezas` : 'Principales destinos'}
          sub="Ocho clientes con más piezas en el periodo."
          tabla={{ cols: ['Cliente', 'Piezas', 'Entregas', 'Kg'], filas: d.top_clientes.map(e => [e.nombre, nf(e.piezas), nf(e.entregas), nf(e.kg)]) }}>
          <Ranking filas={d.top_clientes.map(e => ({ nombre: e.nombre, valor: e.piezas }))} unidad="pzas" />
        </TarjetaGrafica>

        <TarjetaGrafica titulo={o ? `${nf(o.cobertura_pct)}% de las órdenes de venta de Odoo ya están en el sistema` : 'Demanda en Odoo contra lo trabajado'}
          sub={`Órdenes de venta confirmadas en Odoo (últimos ${o?.ventana_dias || 45} días): las que ya se trabajan en Tarimas y las que no.`}
          tabla={o ? { cols: ['Almacén', 'Tomadas', 'Sin tomar'], filas: o.por_almacen.map(a => [a.nombre, nf(a.tomadas), nf(a.ovs - a.tomadas)]) } : null}>
          <Estado cargando={odoo.cargando} error={odoo.error} reintentar={recargarOdoo}>
            {o && (
              <>
                <Medidor pct={o.cobertura_pct} etiqueta={`${nf(o.tomadas)} de ${nf(o.total_ovs)} órdenes`} />
                <div style={{ height: 12 }} />
                <ApiladaDuo nombreA="Ya en el sistema" nombreB="Sin tomar" filas={o.por_almacen.map(a => ({ nombre: a.nombre, a: a.tomadas, b: a.ovs - a.tomadas }))} />
              </>
            )}
          </Estado>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Cómo se reparte el trabajo por tipo de entrega" sub="Entregas por sistema: tarima, carga suelta o mixta."
          tabla={{ cols: ['Sistema', 'Entregas', 'Piezas'], filas: d.por_sistema.map(s => [s.nombre, nf(s.entregas), nf(s.piezas)]) }}>
          <Segmentada partes={d.por_sistema.map(s => ({ nombre: ({ TAR: 'Tarima', CS: 'Carga suelta', MIX: 'Mixta' })[s.nombre] || s.nombre, valor: s.entregas }))} />
        </TarjetaGrafica>
      </div>
      <ParaDecidir puntos={decidir} />
    </>
  )
}

// ───────────────────────── GERENCIA DE OPERACIONES ─────────────────────────
function VistaOperaciones({ d }) {
  const k = d.kpis, c = d.ciclo, q = d.calidad
  const menos24 = c.muestra ? pct(c.buckets[0].n + c.buckets[1].n + c.buckets[2].n, c.muestra) : 0
  const totalBultosU = d.usuarios.reduce((a, u) => a + u.bultos, 0)
  const sol = q.solicitudes_reimpresion
  const decidir = []
  if (q.tasa_reimpresion > 15) decidir.push(`${nf(q.tasa_reimpresion, 1)}% de los documentos se reimprimen. Revisar en Autorizaciones los motivos más repetidos y atacar la causa.`)
  if (q.mediana_resolucion_horas && q.mediana_resolucion_horas > 4) decidir.push(`Las autorizaciones tardan ${horas(q.mediana_resolucion_horas)} (mediana): una tarima detenida espera ese tiempo.`)
  if (c.muestra && menos24 < 70) decidir.push(`Solo ${nf(menos24)}% de las entregas se cierra en menos de 24 h. Ver en qué día y hora se acumulan los pendientes.`)
  if (q.listas_parciales.total > 0) decidir.push(`${nf(q.listas_parciales.total)} listas de empaque parciales (${nf(q.listas_parciales.pct_de_entregas, 1)}% de las entregas): conviene saber por qué no se envía completo.`)
  return (
    <>
      <Titular sub={c.muestra ? `Medido sobre ${nf(c.muestra)} entregas completadas, desde que se captura la entrega hasta que se cierra su último bulto.` : 'Aún no hay entregas completadas con bultos cerrados en este periodo.'}>
        {c.muestra ? `Una entrega se cierra en ${horas(c.mediana_horas)} (mediana); 1 de cada 10 tarda más de ${horas(c.p90_horas)}` : 'Sin entregas completadas para medir el tiempo de cierre'}
      </Titular>
      <div className="an-kpis">
        <Kpi heroe titulo="Tiempo de cierre (mediana)" valor={horas(c.mediana_horas)} nota={c.muestra ? `El 90% se cierra en ${horas(c.p90_horas)} o menos` : ''} />
        <Kpi titulo="Entregas completadas" valor={`${nf(pct(k.completadas, k.entregas))}%`} nota={`${nf(k.completadas)} de ${nf(k.entregas)}`} />
        <Kpi titulo="Piezas ya asignadas a bultos" valor={`${nf(q.avance_asignacion_pct)}%`} nota="Avance de armado sobre lo capturado" />
        <Kpi titulo="Documentos reimpresos" valor={`${nf(q.tasa_reimpresion, 1)}%`} bueno="baja" nota="Etiquetas y listas de empaque" />
      </div>

      <div className="an-grid">
        <TarjetaGrafica ancho="2" titulo={c.muestra ? `${nf(menos24)}% de las entregas se cierra en menos de 24 horas` : 'Tiempo de cierre'}
          sub="Entregas completadas según el tiempo que tardaron. En naranja, las que pasan de 24 horas."
          tabla={{ cols: ['Tiempo', 'Entregas'], filas: c.buckets.map(b => [b.etq, nf(b.n)]) }}>
          <Columnas datos={c.buckets.map(b => ({ etq: b.etq, valor: b.n }))} resaltar={[3, 4]} unidad="entregas" alto={190} />
        </TarjetaGrafica>

        <TarjetaGrafica titulo={`${nf(q.tasa_reimpresion, 1)}% de lo impreso fue reimpresión`} sub="Documentos impresos: solo original contra reimpresiones."
          tabla={{ cols: ['Documento', 'Impresos', 'Reimpresos'], filas: q.documentos.map(x => [x.nombre, nf(x.impresos), nf(x.reimpresos)]) }}>
          <ApiladaDuo nombreA="Solo original" nombreB="Reimpresos" filas={q.documentos.map(x => ({ nombre: x.nombre, a: x.impresos - x.reimpresos, b: x.reimpresos }))} />
        </TarjetaGrafica>

        <TarjetaGrafica titulo={d.usuarios[0] ? `${d.usuarios[0].usuario} cerró ${nf(pct(d.usuarios[0].bultos, totalBultosU))}% de los bultos` : 'Bultos cerrados por persona'}
          sub="Bultos cerrados por usuario en el periodo."
          tabla={{ cols: ['Usuario', 'Bultos'], filas: d.usuarios.map(u => [u.usuario, nf(u.bultos)]) }}>
          <Ranking filas={d.usuarios.map(u => ({ nombre: u.usuario, valor: u.bultos }))} unidad="bultos" enfasis={0} />
        </TarjetaGrafica>

        <TarjetaGrafica titulo={`${nf(sol.total)} solicitudes de reimpresión; ${nf(sol.rechazadas)} rechazadas`}
          sub={`Resultado de las solicitudes. Mediana de respuesta: ${horas(q.mediana_resolucion_horas)}.`}
          tabla={{ cols: ['Resultado', 'Solicitudes'], filas: [['Aprobadas', nf(sol.aprobadas)], ['Rechazadas', nf(sol.rechazadas)], ['Pendientes', nf(sol.pendientes)]] }}>
          {sol.total ? <Segmentada partes={[{ nombre: 'Aprobadas', valor: sol.aprobadas }, { nombre: 'Rechazadas', valor: sol.rechazadas }, { nombre: 'Pendientes', valor: sol.pendientes }].filter(p => p.valor > 0)} /> : <div className="an-estado">Sin solicitudes en el periodo.</div>}
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Lo que se sale del flujo normal" sub="Listas parciales y extensiones en el periodo.">
          <ul className="an-lista">
            <li><b>{nf(q.listas_parciales.total)}</b> listas de empaque parciales <span>({nf(q.listas_parciales.pct_de_entregas, 1)}% de las entregas)</span></li>
            <li><b>{nf(q.extensiones)}</b> productos con extensión</li>
          </ul>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Carga por tipo de entrega" sub="Entregas y piezas por sistema."
          tabla={{ cols: ['Sistema', 'Entregas', 'Piezas', 'Bultos'], filas: d.por_sistema.map(s => [s.nombre, nf(s.entregas), nf(s.piezas), nf(s.bultos)]) }}>
          <Ranking filas={d.por_sistema.map(s => ({ nombre: ({ TAR: 'Tarima', CS: 'Carga suelta', MIX: 'Mixta' })[s.nombre] || s.nombre, valor: s.entregas, nota: `${nf(s.piezas)} piezas` }))} unidad="entregas" />
        </TarjetaGrafica>
      </div>
      <ParaDecidir puntos={decidir} />
    </>
  )
}

// ───────────────────────── JEFATURA DE EMBARQUES ─────────────────────────
function VistaEmbarques({ d, ir }) {
  const k = d.kpis, p = d.pendientes, serie = d.serie_diaria
  const viejas = p.antiguedad[2].n + p.antiguedad[3].n
  const mejor = serie.reduce((mx, s, i) => (s.bultos > serie[mx].bultos ? i : mx), 0)
  const diasConMov = serie.filter(s => s.bultos > 0).length
  const fuerte = d.heatmap.reduce((mx, c) => (!mx || c.bultos > mx.bultos ? c : mx), null)
  const porBultos = [...d.top_clientes].sort((a, b) => b.bultos - a.bultos).filter(c => c.bultos > 0)
  const decidir = []
  if (p.antiguedad[3].n > 0) decidir.push(`${nf(p.antiguedad[3].n)} entregas llevan más de 7 días pendientes: ${p.lista.filter(x => x.dias >= 7).slice(0, 3).map(x => x.num_entrega).join(', ')}. Definir si se surten o se cancelan.`)
  if (fuerte) decidir.push(`El mayor cierre de bultos ocurre ${DIAS_LARGO[fuerte.dia]} a las ${fuerte.hora}:00. Reforzar personal en esa franja evita cuellos de botella.`)
  return (
    <>
      <Titular sub={viejas ? `${nf(viejas)} llevan 3 días o más sin completarse.` : 'Ninguna lleva más de 3 días pendiente.'}>
        {nf(p.total)} entregas por embarcar{viejas ? ` y ${nf(viejas)} ya se están atrasando` : ''}
      </Titular>
      <div className="an-kpis">
        <Kpi heroe titulo="Entregas pendientes" valor={nf(p.total)} nota={`${nf(viejas)} con 3 días o más`} />
        <Kpi titulo="Bultos cerrados" valor={nf(k.bultos)} delta={k.delta.bultos} nota={`${nf(k.tarimas)} tarimas y ${nf(k.cajas)} cajas`} />
        <Kpi titulo="Peso embarcado" valor={nf(k.kg)} unidad="kg" delta={k.delta.kg} />
        <Kpi titulo="Bultos por día con movimiento" valor={nf(diasConMov ? k.bultos / diasConMov : 0, 1)} nota={`${nf(diasConMov)} días con cierres`} />
      </div>

      <div className="an-grid">
        <TarjetaGrafica ancho="2" titulo={k.bultos ? `Se cerraron ${nf(k.bultos)} bultos; el mejor día fue el ${fechaCorta(serie[mejor].fecha)} con ${nf(serie[mejor].bultos)}` : 'Bultos cerrados por día'}
          sub="Bultos (tarimas y cajas) cerrados por día."
          tabla={{ cols: ['Fecha', 'Bultos cerrados'], filas: serie.map(s => [fechaLarga(s.fecha), nf(s.bultos)]) }}>
          <Columnas datos={serie.map(s => ({ etq: fechaCorta(s.fecha), valor: s.bultos }))} resaltar={k.bultos ? [mejor] : []} unidad="bultos" />
        </TarjetaGrafica>

        <TarjetaGrafica titulo={viejas ? `${nf(viejas)} de ${nf(p.total)} pendientes pasan de 3 días` : 'Antigüedad de los pendientes'}
          sub="Entregas sin completar según los días desde su captura. En naranja, las que ya se atrasan."
          tabla={{ cols: ['Antigüedad', 'Entregas'], filas: p.antiguedad.map(b => [b.etq, nf(b.n)]) }}>
          <Columnas datos={p.antiguedad.map(b => ({ etq: b.etq, valor: b.n }))} resaltar={[2, 3]} unidad="entregas" alto={180} />
        </TarjetaGrafica>

        <TarjetaGrafica titulo={fuerte ? `La franja más fuerte: ${DIAS_LARGO[fuerte.dia]} a las ${fuerte.hora}:00` : 'Cuándo se cierran los bultos'} sub="Bultos cerrados por día de la semana y hora.">
          {d.heatmap.length ? <MapaCalor celdas={d.heatmap} /> : <div className="an-estado">Sin cierres de bultos en el periodo.</div>}
        </TarjetaGrafica>

        <TarjetaGrafica ancho="2" titulo="Pendientes más antiguos" sub="Las ocho entregas que llevan más tiempo abiertas. Haz clic para abrirla.">
          {p.lista.length ? (
            <div className="an-tabla-wrap">
              <table className="an-tabla an-tabla-clic">
                <thead><tr><th>Entrega</th><th>Cliente</th><th>Empresa</th><th className="num">Días</th><th>Avance</th></tr></thead>
                <tbody>
                  {p.lista.map(x => (
                    <tr key={x.id_entrega} tabIndex={0} onClick={() => ir(x.id_entrega)} onKeyDown={e => e.key === 'Enter' && ir(x.id_entrega)}>
                      <td className="an-folio">{x.num_entrega}</td><td>{x.cliente}</td><td>{x.empresa}</td>
                      <td className="num">{nf(x.dias, 1)}</td>
                      <td style={{ minWidth: 120 }}>{x.sistema === 'CS' ? <span className="an-nota">Carga suelta</span> : <Medidor pct={x.avance_pct} etiqueta="" enfasis={x.dias >= 3} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="an-estado">No hay entregas pendientes.</div>}
        </TarjetaGrafica>

        <TarjetaGrafica titulo={porBultos[0] ? `${porBultos[0].nombre} recibió más bultos` : 'Destinos por bultos'} sub="Clientes con más bultos cerrados."
          tabla={{ cols: ['Cliente', 'Bultos', 'Kg'], filas: porBultos.map(c => [c.nombre, nf(c.bultos), nf(c.kg)]) }}>
          <Ranking filas={porBultos.map(c => ({ nombre: c.nombre, valor: c.bultos }))} unidad="bultos" />
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Tarimas y cajas" sub="Qué tipo de bulto se está cerrando.">
          {k.bultos ? <Segmentada partes={[{ nombre: 'Tarimas', valor: k.tarimas }, { nombre: 'Cajas', valor: k.cajas }].filter(x => x.valor > 0)} /> : <div className="an-estado">Sin bultos cerrados.</div>}
        </TarjetaGrafica>
      </div>
      <ParaDecidir puntos={decidir} />
    </>
  )
}
