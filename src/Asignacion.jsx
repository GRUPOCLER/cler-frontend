// Tablero de asignacion: arrastra cada OV al operador que hara el surtido o la preparacion.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from './api'
import { NOMBRE, nf, dur, fechaCorta, useAhora, segDesde, quien } from './util'
import { SubNav, Chip, Barra } from './ControlOV'

const ETAPAS = [
  { id: 'surtido', nombre: 'Surtido', estatus: ['recibida', 'en_surtido'] },
  { id: 'prep', nombre: 'Preparación', estatus: ['recibida', 'en_surtido', 'surtida', 'en_preparacion'] },
]

function pendientes(o, etapa) {
  const p = o.progreso
  if (etapa === 'surtido') return Math.max(0, p.piezas - p.surtidas)
  return ['surtida', 'en_preparacion'].includes(o.estatus) ? Math.max(0, p.surtidas - p.empacadas) : p.piezas
}

export default function Asignacion({ toast }) {
  const navigate = useNavigate()
  const user = api.getUser()
  const ahora = useAhora()
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)
  const [etapa, setEtapa] = useState('surtido')
  const [arrastrando, setArrastrando] = useState(null)
  const [sobre, setSobre] = useState(null)

  const cargar = useCallback(() => {
    if (arrastrando) return
    api.asigTablero().then(x => { setD(x); setError(null) }).catch(e => setError(e.message))
  }, [arrastrando])
  useEffect(() => { cargar() }, [])
  useEffect(() => { const i = setInterval(cargar, 30000); return () => clearInterval(i) }, [cargar])

  const et = ETAPAS.find(e => e.id === etapa)
  const campo = 'asig_' + etapa
  const ovs = useMemo(() => (d ? d.ovs.filter(o => et.estatus.includes(o.estatus)) : []), [d, etapa])

  const columnas = useMemo(() => {
    if (!d) return []
    const cols = [{ key: '', nombre: 'Sin asignar' }, ...d.operadores.map(o => ({ key: o.email, nombre: o.nombre }))]
    const conocidos = new Set(cols.map(c => c.key))
    ovs.forEach(o => { const a = o[campo]; if (a && !conocidos.has(a)) { conocidos.add(a); cols.push({ key: a, nombre: quien(d.nombres, a) }) } })
    return cols
  }, [d, ovs, campo])

  const asignar = async (ovId, email) => {
    const previo = d
    setD(x => ({ ...x, ovs: x.ovs.map(o => (o.id === ovId ? { ...o, [campo]: email || null } : o)) }))
    try { await api.ovAsignar(ovId, etapa, email) }
    catch (e) { setD(previo); toast(e.message, 'error') }
  }
  const soltar = (e, key) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || arrastrando
    setSobre(null); setArrastrando(null)
    const o = d.ovs.find(x => x.id === id)
    if (o && (o[campo] || '') !== key) asignar(id, key)
  }
  const cambiarExigir = async (v) => {
    try { await api.asigConfig(v); setD(x => ({ ...x, exigir: v })); toast(v ? 'Ahora solo trabajan las OV que se les asignen' : 'Los operadores pueden tomar OV sin asignar', 'ok') }
    catch (e) { toast(e.message, 'error') }
  }

  return (
    <div className="contenedor ov-pagina">
      <div className="ov-cab"><h1 className="an-h1">Control de OV</h1></div>
      <SubNav activa="asignacion" />
      <p className="an-nota" style={{ marginTop: 0 }}>Arrastra una OV a la columna del operador. En celular o tableta usa el selector "Asignar a" de cada tarjeta.</p>

      <div className="asig-barra">
        <div className="seg-ctl" role="tablist" aria-label="Etapa a asignar">
          {ETAPAS.map(e => (
            <button key={e.id} role="tab" aria-selected={etapa === e.id} className={'seg-btn' + (etapa === e.id ? ' on' : '')} onClick={() => setEtapa(e.id)}>{e.nombre}</button>
          ))}
        </div>
        {user && user.es_admin && d && (
          <label className="ov-check">
            <input type="checkbox" checked={!!d.exigir} onChange={e => cambiarExigir(e.target.checked)} />
            Los operadores solo trabajan las OV que se les asignen
          </label>
        )}
      </div>

      {error && <div className="an-estado an-estado--error">{error} <button className="btn-sec" onClick={cargar}>Reintentar</button></div>}
      {!d && !error && <div className="cargando">Cargando...</div>}
      {d && d.operadores.length === 0 && <div className="ov-aviso">No hay usuarios con rol Operador. Agrégalos en Usuarios para poder asignarles OV.</div>}
      {d && (
        <div className="asig-cols">
          {columnas.map(c => {
            const items = ovs.filter(o => (o[campo] || '') === c.key)
            const pzas = items.reduce((a, o) => a + pendientes(o, etapa), 0)
            return (
              <section key={c.key || 'libre'} className={'asig-col' + (sobre === c.key ? ' sobre' : '') + (c.key === '' ? ' libre' : '')}
                onDragOver={e => { e.preventDefault(); if (sobre !== c.key) setSobre(c.key) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setSobre(null) }}
                onDrop={e => soltar(e, c.key)} aria-label={'Columna ' + c.nombre}>
                <header className="asig-col-cab">
                  <b>{c.nombre}</b>
                  <span className="an-nota">{items.length} OV | {nf(pzas)} pzas pendientes</span>
                </header>
                <div className="asig-lista">
                  {items.length === 0 && <div className="asig-vacio">{c.key === '' ? 'Todo asignado' : 'Suelta una OV aquí'}</div>}
                  {items.map(o => {
                    const seg = segDesde(o.estatus_desde, ahora)
                    const atras = o.umbral_horas && seg > o.umbral_horas * 3600
                    return (
                      <article key={o.id} className={'asig-card' + (arrastrando === o.id ? ' arrastrando' : '')} draggable
                        onDragStart={e => { e.dataTransfer.setData('text/plain', o.id); e.dataTransfer.effectAllowed = 'move'; setArrastrando(o.id) }}
                        onDragEnd={() => { setArrastrando(null); setSobre(null) }}>
                        <div className="asig-card-cab">
                          <button className="asig-ov" onClick={() => navigate('/ov/' + o.id)} title="Abrir la OV">{o.num_ov}</button>
                          <Chip estatus={o.estatus} />
                        </div>
                        <div className="asig-cliente">{o.cliente}</div>
                        <div className="an-nota">{o.destino_ciudad}{o.fecha_entrega ? ' | Entrega ' + fechaCorta(o.fecha_entrega) : ''}</div>
                        <div className="an-nota">{nf(o.progreso.piezas)} pzas | {o.progreso.lineas} partidas</div>
                        <Barra pct={etapa === 'surtido' ? o.progreso.pct_surtido : o.progreso.pct_preparado} etiqueta="Avance" />
                        <div className={'ov-tiempo' + (atras ? ' ov-tiempo--atraso' : '')}>{dur(seg)} en este estatus{atras ? ' | atrasada' : ''}</div>
                        <label className="an-campo asig-sel">Asignar a
                          <select className="inp" value={o[campo] || ''} onChange={e => asignar(o.id, e.target.value)}>
                            <option value="">Sin asignar</option>
                            {d.operadores.map(p => <option key={p.email} value={p.email}>{p.nombre}</option>)}
                            {o[campo] && !d.operadores.some(p => p.email === o[campo]) && <option value={o[campo]}>{quien(d.nombres, o[campo])}</option>}
                          </select>
                        </label>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
