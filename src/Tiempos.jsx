// KPI de tiempos por etapa y por responsable.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from './api'
import { NOMBRE, nf, dur, quien } from './util'
import { SubNav } from './ControlOV'

const pct = (n) => (n === null || n === undefined ? '-' : n + '%')

function csv(k) {
  const q = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"'
  const min = (s) => (s === null || s === undefined ? '' : Math.round(s / 60))
  const filas = [['OV', 'Cliente', 'Estatus', 'Piezas', 'Resp. surtido', 'Resp. preparacion', 'Espera surtido (min)', 'Surtido (min)', 'Espera preparacion (min)', 'Preparacion (min)', 'Espera entrega SAP (min)', 'Espera factura (min)', 'Ciclo total (min)']]
  k.detalle.forEach(o => filas.push([o.num_ov, o.cliente, NOMBRE[o.estatus] || o.estatus, o.piezas, quien(k.nombres, o.surtido.responsable), quien(k.nombres, o.prep.responsable),
    min(o.seg.recibida), min(o.seg.en_surtido), min(o.seg.surtida), min(o.seg.en_preparacion), min(o.seg.preparada), min(o.seg.entregada_sap), min(o.ciclo_seg)]))
  return '﻿' + filas.map(f => f.map(q).join(',')).join('\r\n')
}

export default function Tiempos({ toast }) {
  const navigate = useNavigate()
  const [k, setK] = useState(null)
  const [error, setError] = useState(null)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [etapaResp, setEtapaResp] = useState('surtido')
  const [cargando, setCargando] = useState(false)

  const cargar = (d, h) => {
    setCargando(true)
    api.kpiTiempos(d, h).then(x => { setK(x); setDesde(x.desde); setHasta(x.hasta); setError(null) })
      .catch(e => setError(e.message)).finally(() => setCargando(false))
  }
  useEffect(() => { cargar('', '') }, [])

  const maxProm = k ? Math.max(1, ...k.etapas.map(e => e.prom_seg || 0)) : 1
  const resp = k ? k.responsables[etapaResp] : []

  return (
    <div className="contenedor ov-pagina">
      <div className="ov-cab"><h1 className="an-h1">Control de OV</h1></div>
      <SubNav activa="tiempos" />

      <div className="ov-filtros">
        <label className="an-campo">Desde<input className="inp" type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label>
        <label className="an-campo">Hasta<input className="inp" type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></label>
        <button className="btn-sec" disabled={cargando || !desde || !hasta} onClick={() => cargar(desde, hasta)}>{cargando ? 'Calculando...' : 'Actualizar'}</button>
        {k && <button className="btn-sec" onClick={() => api.descargar(`tiempos_ov_${k.desde}_${k.hasta}.csv`, 'text/csv;charset=utf-8', new TextEncoder().encode(csv(k)))}>Descargar CSV</button>}
      </div>
      <p className="an-nota" style={{ marginTop: 0 }}>Se cuentan las OV creadas en el periodo (sin canceladas). Cada etapa muestra solo los tiempos ya terminados. El responsable es la persona asignada; si no hubo asignación, quien inició la etapa.</p>

      {error && <div className="an-estado an-estado--error">{error}</div>}
      {!k && !error && <div className="cargando">Calculando tiempos...</div>}
      {k && k.total_ovs === 0 && <div className="an-estado">No hay OV creadas en ese periodo.</div>}
      {k && k.total_ovs > 0 && (<>
        <div className="ov-resumen kpi-res" role="group" aria-label="Resumen del periodo">
          <div className="ov-resumen-it"><span className="ov-resumen-n">{nf(k.total_ovs)}</span><span className="ov-resumen-t">OV en el periodo</span></div>
          <div className="ov-resumen-it"><span className="ov-resumen-n">{nf(k.facturadas)}</span><span className="ov-resumen-t">Facturadas</span></div>
          <div className="ov-resumen-it"><span className="ov-resumen-n">{dur(k.ciclo_prom_seg)}</span><span className="ov-resumen-t">Ciclo promedio (carga a factura)</span></div>
          <div className="ov-resumen-it"><span className="ov-resumen-n">{dur(k.ciclo_mediana_seg)}</span><span className="ov-resumen-t">Ciclo mediano</span></div>
        </div>

        <section className="ov-panel">
          <h2 className="ov-h2">Tiempo por etapa</h2>
          <div className="an-tabla-wrap">
            <table className="an-tabla">
              <thead><tr><th>Etapa</th><th className="num">OV</th><th>Promedio</th><th className="num">Mediana</th><th className="num">P90</th><th className="num">Máximo</th><th className="num">Meta</th><th className="num">En meta</th></tr></thead>
              <tbody>
                {k.etapas.map(e => (
                  <tr key={e.id}>
                    <td>{e.nombre}</td><td className="num">{e.n}</td>
                    <td style={{ minWidth: 200 }}>
                      <div className="kpi-barra"><div className="kpi-barra-pista"><div className="kpi-barra-relleno" style={{ width: (e.prom_seg ? Math.max(2, 100 * e.prom_seg / maxProm) : 0) + '%' }} /></div><span>{dur(e.prom_seg)}</span></div>
                    </td>
                    <td className="num">{dur(e.mediana_seg)}</td><td className="num">{dur(e.p90_seg)}</td><td className="num">{dur(e.max_seg)}</td>
                    <td className="num">{e.umbral_horas ? e.umbral_horas + ' h' : '-'}</td>
                    <td className="num">{pct(e.pct_en_tiempo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ov-panel">
          <div className="ov-lista-cab">
            <h2 className="ov-h2" style={{ margin: 0 }}>Por responsable</h2>
            <div className="seg-ctl" role="tablist" aria-label="Etapa">
              {[['surtido', 'Surtido'], ['prep', 'Preparación']].map(([id, n]) => (
                <button key={id} role="tab" aria-selected={etapaResp === id} className={'seg-btn' + (etapaResp === id ? ' on' : '')} onClick={() => setEtapaResp(id)}>{n}</button>
              ))}
            </div>
          </div>
          {resp.length === 0 ? <p className="an-nota">Todavía no hay OV terminadas en esta etapa.</p> : (
            <div className="an-tabla-wrap">
              <table className="an-tabla">
                <thead><tr><th>Responsable</th><th className="num">OV</th><th className="num">Piezas</th><th className="num">Tiempo por OV</th><th className="num">Piezas por hora</th><th className="num">En meta</th><th className="num">Tarda en arrancar</th></tr></thead>
                <tbody>
                  {resp.map(r => (
                    <tr key={r.email}><td>{r.nombre}</td><td className="num">{r.ovs}</td><td className="num">{nf(r.piezas)}</td><td className="num">{dur(r.prom_seg)}</td>
                      <td className="num">{r.piezas_hora === null ? '-' : nf(r.piezas_hora)}</td><td className="num">{pct(r.pct_en_tiempo)}</td><td className="num">{dur(r.arranque_prom_seg)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="an-nota" style={{ marginBottom: 0 }}>"Tarda en arrancar" es el tiempo entre que el gerente asigna la OV y la primera acción del operador.</p>
        </section>

        <section className="ov-panel">
          <h2 className="ov-h2">Detalle por OV</h2>
          <div className="an-tabla-wrap">
            <table className="an-tabla ov-tabla">
              <thead><tr><th>OV</th><th>Surtido</th><th>Preparación</th><th className="num">Espera surtido</th><th className="num">Espera prep.</th><th className="num">Ciclo</th></tr></thead>
              <tbody>
                {k.detalle.map(o => (
                  <tr key={o.id} tabIndex={0} onClick={() => navigate('/ov/' + o.id)} onKeyDown={e => e.key === 'Enter' && navigate('/ov/' + o.id)}>
                    <td className="an-folio">{o.num_ov}<div className="an-nota">{o.cliente}</div></td>
                    <td>{dur(o.seg.en_surtido)}<div className="an-nota">{quien(k.nombres, o.surtido.responsable) || '-'}</div></td>
                    <td>{dur(o.seg.en_preparacion)}<div className="an-nota">{quien(k.nombres, o.prep.responsable) || '-'}</div></td>
                    <td className="num">{dur(o.seg.recibida)}</td><td className="num">{dur(o.seg.surtida)}</td><td className="num">{dur(o.ciclo_seg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>)}
    </div>
  )
}
