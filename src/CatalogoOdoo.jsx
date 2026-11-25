// Comparacion Odoo vs hoja, sincronizacion de solo lectura y exportacion de CSV para cargar a Odoo.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from './api'
import { nf } from './util'

const ESTADOS = [
  ['diferencias', 'Con diferencias', 'diferencias'],
  ['falta_en_odoo', 'Falta en Odoo', 'falta_en_odoo'],
  ['no_en_odoo', 'No existe en Odoo', 'no_en_odoo'],
  ['coincide', 'Coinciden', 'coincide'],
  ['todos', 'Todos', 'total'],
]
const CAMPOS = { peso_unit: 'Peso (kg)', m3_unit: 'Volumen (m3)', lr_unit: 'Largo (cm)', an_unit: 'Ancho (cm)', al_unit: 'Alto (cm)', cm_cant: 'Pzas caja master', cm_lr: 'Master largo', cm_an: 'Master ancho', cm_al: 'Master alto' }
const EST_TXT = { igual: 'Igual', diferente: 'Diferente', solo_local: 'Solo aquí', solo_odoo: 'Solo Odoo', sin_dato: 'Sin dato' }
const EXPORTS = [
  ['productos', 'Productos (peso y medidas)', 'Actualiza peso, volumen y medidas de productos que ya existen en Odoo.'],
  ['empaques', 'Cajas master (empaques)', 'Una línea de empaque por producto con las piezas por caja master.'],
  ['no_en_odoo', 'Productos que no existen en Odoo', 'Lista para darlos de alta en Odoo.'],
  ['completo', 'Respaldo completo', 'Todo el catálogo con la fuente de cada dato.'],
]

export default function CatalogoOdoo({ toast }) {
  const navigate = useNavigate()
  const [estado, setEstado] = useState('diferencias')
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(0)
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)
  const [incluir, setIncluir] = useState('faltantes')
  const [diag, setDiag] = useState(null)
  const [diagSku, setDiagSku] = useState('')
  const [abierto, setAbierto] = useState(null)
  const timer = useRef(null)

  const cargar = useCallback(() => {
    return api.catOdooComparar({ estado, buscar: q, pagina })
      .then(x => { setD(x); setError(null); return x }).catch(e => setError(e.message))
  }, [estado, q, pagina])
  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t) }, [cargar])
  useEffect(() => { setPagina(0) }, [estado, q])

  const sync = d?.estado
  useEffect(() => {
    if (!sync?.corriendo) return
    timer.current = setTimeout(cargar, 1500)
    return () => clearTimeout(timer.current)
  }, [sync, cargar])

  const sincronizar = async () => {
    try { await api.catOdooSincronizar(); cargar() } catch (e) { toast?.(e.message, 'err') }
  }
  const exportar = async (tipo) => {
    try { await api.catExportar(tipo, incluir) } catch (e) { toast?.(e.message, 'err') }
  }
  const diagnosticar = async () => {
    try { setDiag(await api.catOdooDiagnostico(diagSku.trim())) } catch (e) { toast?.(e.message, 'err') }
  }

  const r = d?.resumen
  const paginas = d ? Math.max(1, Math.ceil(d.total / d.limite)) : 1
  const res = sync?.resultado

  return (
    <div className="contenedor">
      <div className="cg-cab">
        <div>
          <button className="btn-mini" onClick={() => navigate('/catalogo')}>Catálogo</button>
          <div className="titulo-pag" style={{ marginTop: 8 }}>Odoo contra hoja</div>
          <div className="sub-pag">Se lee de Odoo sin modificarlo. Prioridad de cada dato: editado aquí, luego Odoo, luego la hoja.</div>
        </div>
        <button className="btn-principal" disabled={!!sync?.corriendo} onClick={sincronizar}>
          {sync?.corriendo ? `Leyendo Odoo ${nf(sync.hechos)} de ${nf(sync.total)}` : 'Leer datos de Odoo'}
        </button>
      </div>

      {error && <div className="ov-aviso ov-aviso--warn">{error}</div>}
      {sync?.error && <div className="ov-aviso ov-aviso--warn">Error al leer Odoo: {sync.error}</div>}
      {res && !sync.corriendo && (
        <div className="cg-nota">Última lectura: {nf(res.encontrados)} encontrados en Odoo, {nf(res.no_encontrados)} sin coincidencia, {nf(res.con_peso)} con peso, {nf(res.con_empaque)} con empaque. {res.empaques_ambiguos > 0 && `${nf(res.empaques_ambiguos)} con varios empaques (revisar).`}</div>
      )}
      {r && r.sin_consultar === r.total && r.total > 0 && <div className="ov-aviso">Todavía no se ha leído Odoo. Pulsa "Leer datos de Odoo".</div>}

      <div className="cg-barra">
        <div className="seg-ctl" role="tablist" aria-label="Estado">
          {ESTADOS.map(([id, nom, k]) => (
            <button key={id} role="tab" aria-selected={estado === id} className={'seg-btn' + (estado === id ? ' on' : '')} onClick={() => setEstado(id)}>
              {nom}{r ? ` (${nf(r[k])})` : ''}
            </button>
          ))}
        </div>
        <input className="inp cg-buscar" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por clave o descripción" aria-label="Buscar producto" />
      </div>

      <div className="panel">
        <table className="tabla">
          <thead><tr><th>Clave</th><th>Descripción</th><th>En Odoo</th><th>Estado</th><th>Campos distintos</th></tr></thead>
          <tbody>
            {d?.items.map(it => {
              const dif = Object.entries(it.campos).filter(([, v]) => v.estado === 'diferente' || v.estado === 'solo_local')
              const ab = abierto === it.sku
              return [
                <tr key={it.sku} onClick={() => setAbierto(ab ? null : it.sku)} style={{ cursor: 'pointer' }}>
                  <td className="cg-mono">{it.sku}</td>
                  <td>{it.descripcion || '-'}</td>
                  <td>{it.consultado ? (it.en_odoo ? 'Sí' : 'No') : '-'}</td>
                  <td><span className="chip">{ESTADOS.find(e => e[0] === it.estado)?.[1] || it.estado.replace('_', ' ')}</span></td>
                  <td>{dif.length ? dif.map(([k]) => CAMPOS[k]).join(', ') : '-'}</td>
                </tr>,
                ab && (
                  <tr key={it.sku + '-d'}><td colSpan={5}>
                    <table className="tabla">
                      <thead><tr><th>Campo</th><th>Aquí / hoja</th><th>Odoo</th><th>Estado</th><th></th></tr></thead>
                      <tbody>{Object.entries(it.campos).map(([k, v]) => (
                        <tr key={k}>
                          <td>{CAMPOS[k]}</td><td>{nf(v.local)}{v.editado && ' (editado aquí)'}</td><td>{it.en_odoo ? nf(v.odoo) : '-'}</td>
                          <td>{EST_TXT[v.estado]}</td><td>{v.unidad_dudosa ? 'Posible unidad distinta (g, mm, m)' : ''}</td>
                        </tr>))}
                      </tbody>
                    </table>
                    <button className="btn-sec" onClick={() => navigate('/catalogo/' + encodeURIComponent(it.sku))}>Abrir producto</button>
                  </td></tr>
                ),
              ]
            })}
            {d && d.items.length === 0 && <tr><td colSpan={5} className="vacio">Sin resultados</td></tr>}
          </tbody>
        </table>
        {paginas > 1 && (
          <div className="cg-barra">
            <button className="btn-sec" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button>
            <span>Página {pagina + 1} de {paginas}</span>
            <button className="btn-sec" disabled={pagina + 1 >= paginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-titulo">Exportar para cargar a Odoo</div>
        <div className="cg-nota">Archivos CSV con el formato de importación de Odoo. Primero haz una prueba con pocos registros.</div>
        <div className="seg-ctl" role="tablist" aria-label="Qué incluir" style={{ margin: '8px 0' }}>
          <button role="tab" aria-selected={incluir === 'faltantes'} className={'seg-btn' + (incluir === 'faltantes' ? ' on' : '')} onClick={() => setIncluir('faltantes')}>Solo lo que Odoo no tiene</button>
          <button role="tab" aria-selected={incluir === 'todo'} className={'seg-btn' + (incluir === 'todo' ? ' on' : '')} onClick={() => setIncluir('todo')}>También donde difiere</button>
        </div>
        {EXPORTS.map(([id, nom, nota]) => (
          <div key={id} className="cg-cab" style={{ marginBottom: 6 }}>
            <div><div>{nom}</div><div className="cg-nota">{nota}</div></div>
            <button className="btn-sec" onClick={() => exportar(id)}>Descargar CSV</button>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-titulo">Diagnóstico de Odoo</div>
        <div className="cg-nota">Muestra qué campos y modelos existen en tu Odoo y cómo se interpreta un producto. Úsalo si algo no se lee bien.</div>
        <div className="cg-barra">
          <input className="inp cg-buscar" value={diagSku} onChange={e => setDiagSku(e.target.value)} placeholder="Clave de un producto (opcional)" aria-label="Clave para diagnóstico" />
          <button className="btn-sec" onClick={diagnosticar}>Ejecutar diagnóstico</button>
        </div>
        {diag && <pre className="cg-mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>{JSON.stringify(diag, null, 2)}</pre>}
      </div>
    </div>
  )
}
