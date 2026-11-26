// Pagina PUBLICA de seguimiento de una OV para el cliente. Se entra con una liga con codigo; no pide usuario.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { seguimientoPublico } from './api'
import { nf, fechaHora, fechaCorta } from './util'

function Avance({ etiqueta, texto, pct }) {
  const p = Math.max(0, Math.min(100, pct || 0))
  return (
    <div className="seg-av">
      <div className="seg-av-cab"><span>{etiqueta}</span><b>{Math.round(p)}%</b></div>
      <div className="seg-barra" role="img" aria-label={`${etiqueta} ${Math.round(p)}%`}><div className="seg-barra-rel" style={{ width: p + '%' }} /></div>
      <div className="seg-nota">{texto}</div>
    </div>
  )
}

export default function Seguimiento() {
  const { token } = useParams()
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let vivo = true
    const cargar = () => seguimientoPublico(token).then(r => { if (vivo) { setD(r); setErr('') } }).catch(e => { if (vivo) setErr(e.message) })
    cargar()
    const t = setInterval(cargar, 60000)
    return () => { vivo = false; clearInterval(t) }
  }, [token])
  useEffect(() => { document.title = 'Seguimiento de pedido'; const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex,nofollow'; document.head.appendChild(m); return () => m.remove() }, [])

  if (err && !d) return <div className="seg-pag"><div className="seg-caja"><h1 className="seg-h1">Seguimiento de pedido</h1><p className="seg-error">{err}</p></div></div>
  if (!d) return <div className="seg-pag"><div className="seg-caja">Cargando...</div></div>
  const a = d.avance
  return (
    <div className="seg-pag">
      <header className="seg-cab"><div className="seg-marca">Grupo CLER</div><div className="seg-cab-sub">Seguimiento de pedido</div></header>
      <main className="seg-caja">
        <section className="seg-enc">
          <div>
            <div className="seg-nota">Orden de venta</div>
            <h1 className="seg-h1">{d.num_ov}</h1>
            <div className="seg-cli">{d.cliente}</div>
            <div className="seg-nota">{[d.ciudad, d.referencia && 'Ref. ' + d.referencia, d.fecha_entrega && 'Entrega programada ' + fechaCorta(d.fecha_entrega)].filter(Boolean).join(' | ')}</div>
          </div>
          <div className={'seg-estado' + (d.cancelada ? ' seg-estado--mal' : d.estatus === 'facturada' ? ' seg-estado--ok' : '')}>{d.estatus_nombre}</div>
        </section>

        <ol className="seg-etapas" aria-label="Etapas del pedido">
          {d.etapas.map(e => (
            <li key={e.id} className={'seg-et seg-et--' + e.estado} aria-current={e.estado === 'actual' ? 'step' : undefined}>
              <span className="seg-punto" aria-hidden="true" />
              <div><div className="seg-et-n">{e.nombre}</div><div className="seg-nota">{e.fecha ? fechaHora(e.fecha) : (e.estado === 'pendiente' ? 'Pendiente' : '')}</div></div>
            </li>
          ))}
        </ol>
        {d.cancelada && <p className="seg-error">Este pedido fue cancelado. Si tienes dudas, comunícate con tu contacto.</p>}

        <section className="seg-sec">
          <Avance etiqueta="Surtido" pct={a.pct_surtido} texto={`${nf(a.surtidas)} de ${nf(a.piezas)} piezas surtidas`} />
          <Avance etiqueta="Preparación en cajas" pct={a.pct_preparado} texto={`${nf(a.empacadas)} piezas empacadas en ${a.cajas} caja(s) cerrada(s)`} />
        </section>

        <section className="seg-sec">
          <h2 className="seg-h2">Partidas</h2>
          <div className="seg-tabla-wrap">
            <table className="seg-tabla">
              <thead><tr><th>Código</th><th>Descripción</th><th className="num">Pedidas</th><th className="num">Surtidas</th><th className="num">Empacadas</th></tr></thead>
              <tbody>
                {d.partidas.map((p, i) => (
                  <tr key={i}>
                    <td className="seg-cod">{p.codigo}</td><td>{p.descripcion}</td>
                    <td className="num">{nf(p.pedida)}</td>
                    <td className="num">{nf(p.surtida)}{p.faltante > 0 && <span className="seg-falta"> faltan {nf(p.faltante)}</span>}</td>
                    <td className="num">{nf(p.empacada)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <footer className="seg-pie">Actualizado {fechaHora(d.actualizado)} (hora de Ciudad de México). Esta página se actualiza sola cada minuto.</footer>
      </main>
    </div>
  )
}
