// ============================================================
//  LISTA DE EMPAQUE (PACKING LIST) — imprimible
// ============================================================
import { useEffect } from 'react'
import { fmtKg, unirPorClave } from './formato'

function usarTamanoPagina(reglaCss) {
  useEffect(() => {
    const estilo = document.createElement('style')
    estilo.textContent = reglaCss
    document.head.appendChild(estilo)
    return () => document.head.removeChild(estilo)
  }, [reglaCss])
}

export default function ListaEmpaque({ datos }) {
  usarTamanoPagina('@page { size: letter portrait; margin: 10mm; }')
  const { entrega, es_fusion, entregas_involucradas, remitente, tarimas, sueltos, total_bultos, total_piezas,
    peso_palet_total_kg, peso_mercancia_kg, peso_total_kg } = datos

  const folios = es_fusion ? entregas_involucradas.map(e => e.num_entrega).filter(Boolean).join(' + ') : entrega.num_entrega
  const ovs    = es_fusion ? entregas_involucradas.map(e => e.orden).filter(Boolean).join(' + ') : (entrega.orden || '-')
  const fecha  = new Date().toLocaleDateString('es-MX')

  return (
    <div className="pk-doc">
      {datos.es_parcial && (
        <div className="pk-banner-parcial">
          LISTA PARCIAL — incluye solo lo que se envio. Autorizo: {datos.parcial?.autorizado_por || '-'}
          {datos.parcial?.motivo ? ` | Motivo: ${datos.parcial.motivo}` : ''}
        </div>
      )}
      {es_fusion && (
        <div className="pk-banner-fusion">
          EMBARQUE CON {entregas_involucradas.length} ORDENES DE VENTA DEL MISMO CLIENTE
        </div>
      )}

      <table className="pk-tabla-head">
        <tbody>
          <tr>
            <td className="pk-box pk-box-remitente">
              <div className="pk-label">Exportador / Remitente</div>
              <div className="pk-remitente-nombre">{remitente}</div>
            </td>
            <td className="pk-box pk-box-titulo">
              <div className="pk-titulo-grande">PACKING LIST{datos.es_parcial ? ' (PARCIAL)' : ''}</div>
              <div className="pk-label">Lista de Empaque</div>
              <div className="pk-fecha">Fecha: {fecha}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="pk-tabla-info">
        <tbody>
          <tr>
            <td className="pk-info-cell">
              <div className="pk-label">N Entrega{es_fusion ? 's' : ''}</div>
              <div className="pk-info-mono">{folios}</div>
            </td>
            <td className="pk-info-cell">
              <div className="pk-label">OV{es_fusion ? 's' : ''}</div>
              <div className="pk-info-mono pk-info-ov">{ovs}</div>
            </td>
            <td className="pk-info-cell">
              <div className="pk-label">Cliente</div>
              <div className="pk-info-cliente">{entrega.nombre_cliente}</div>
              {entrega.sucursal && <div className="pk-info-sucursal">Sucursal: {entrega.sucursal}</div>}
            </td>
            <td className="pk-info-cell">
              <div className="pk-label">Dirección</div>
              <div className="pk-info-dir">{entrega.direccion || '-'}</div>
            </td>
            <td className="pk-info-cell pk-info-bultos">
              <div className="pk-label">Bultos</div>
              <div className="pk-bultos-num">{total_bultos}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {tarimas.map(t => (
        <div key={t.id_tarima} className="pk-bulto">
          <table className="pk-tabla-bulto">
            <thead>
              <tr className="pk-bulto-head">
                <th colSpan={t.productos.length ? 1 : 1} className="pk-bulto-titulo">
                  BULTO {t.numero_bulto} / {t.total_bultos}
                  <span className="pk-bulto-id">{t.tipo_bulto === 'caja' ? 'Caja' : 'Tarima'} {t.numero_tarima} — {t.id_tarima}</span>
                </th>
                <th className="pk-bulto-meta" colSpan={3}>
                  Piezas: <b>{t.total_piezas}</b>
                  {t.peso_neto_kg > 0 && <> &nbsp;|&nbsp; Peso mercancia: <b>{fmtKg(t.peso_neto_kg)}</b></>}
                  {t.peso_palet_kg > 0 && <> &nbsp;|&nbsp; Palet: <b>{fmtKg(t.peso_palet_kg)}</b></>}
                  {t.peso_bruto_kg > 0 && <> &nbsp;|&nbsp; Bruto: <b>{fmtKg(t.peso_bruto_kg)}</b></>}
                  {t.largo_cm > 0 && t.ancho_cm > 0 && t.alto_cm > 0 &&
                    <> &nbsp;|&nbsp; Medidas: <b>{t.largo_cm}×{t.ancho_cm}×{t.alto_cm} cm</b></>}
                </th>
              </tr>
              <tr className="pk-col-head">
                <th style={{textAlign:'left'}}>Clave</th>
                <th style={{textAlign:'left'}}>Descripción</th>
                <th style={{textAlign:'right'}}>Cant.</th>
                <th style={{textAlign:'center'}}>Unidad</th>
                <th style={{textAlign:'right'}}>Peso</th>
              </tr>
            </thead>
            <tbody>
              {t.productos.length ? unirPorClave(t.productos, 'cantidad_asignada').map((p, i) => (
                <tr key={p.clave + '-' + i} className={i % 2 === 0 ? 'pk-row-a' : 'pk-row-b'}>
                  <td className="pk-td-clave">{p.clave}</td>
                  <td>{p.descripcion}</td>
                  <td style={{textAlign:'right',fontWeight:700}}>{p.cantidad_asignada}</td>
                  <td style={{textAlign:'center',color:'#555'}}>{p.unidad}</td>
                  <td style={{textAlign:'right',color:'#555',fontSize:11}}>{fmtKg(p.peso_kg)}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{color:'#888',padding:6}}>Sin productos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}

      {sueltos && sueltos.length > 0 && sueltos.map((p, i) => (
        <div key={p.id_producto ?? i} className="pk-bulto">
          <table className="pk-tabla-bulto">
            <thead>
              <tr className="pk-bulto-head pk-bulto-head-suelto">
                <th colSpan={2} className="pk-bulto-titulo">
                  BULTO {p.numero_bulto} / {p.total_bultos}
                  <span className="pk-bulto-id">Carga suelta</span>
                </th>
                <th className="pk-bulto-meta" colSpan={2}>Pieza unica / caja</th>
              </tr>
              <tr className="pk-col-head">
                <th style={{textAlign:'left'}}>Clave</th>
                <th style={{textAlign:'left'}}>Descripción</th>
                <th style={{textAlign:'right'}}>Cant.</th>
                <th style={{textAlign:'center'}}>Unidad</th>
                <th style={{textAlign:'right'}}>Peso</th>
              </tr>
            </thead>
            <tbody>
              <tr className="pk-row-a">
                <td className="pk-td-clave">{p.clave}</td>
                <td>{p.descripcion}</td>
                <td style={{textAlign:'right',fontWeight:700}}>{p.cantidad_envio ?? p.cantidad_pendiente ?? p.cantidad_total}</td>
                <td style={{textAlign:'center',color:'#555'}}>{p.unidad}</td>
                <td style={{textAlign:'right',color:'#555',fontSize:11}}>{fmtKg(p.peso_kg)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {datos.es_parcial && datos.omitidos?.length > 0 && (
        <div className="pk-omitidos">
          <b>No incluido en este envio (queda pendiente):</b>
          <ul>
            {datos.omitidos.map((o, i) => (
              <li key={i}>
                {o.tipo === 'tarima'
                  ? <>Bulto {o.referencia} ({o.piezas} pzas)</>
                  : <>{o.referencia} — {o.descripcion}: enviado {o.enviado} de {o.solicitado} (faltan {o.faltante})</>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <table className="pk-tabla-totales">
        <tbody>
          <tr className="pk-totales-head"><td colSpan={5}>Totales Generales</td></tr>
          <tr>
            <td className="pk-total-cell">
              <div className="pk-label">Total bultos</div>
              <div className="pk-total-num">{total_bultos}</div>
            </td>
            <td className="pk-total-cell">
              <div className="pk-label">Total piezas</div>
              <div className="pk-total-num">{total_piezas}</div>
            </td>
            <td className="pk-total-cell">
              <div className="pk-label">Peso mercancia</div>
              <div className="pk-total-num-sm">{fmtKg(peso_mercancia_kg)}</div>
            </td>
            <td className="pk-total-cell">
              <div className="pk-label">Peso pallets</div>
              <div className="pk-total-num-sm">{fmtKg(peso_palet_total_kg)}</div>
            </td>
            <td className="pk-total-cell">
              <div className="pk-label">Peso total</div>
              <div className="pk-total-num-sm">{fmtKg(peso_total_kg)}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {es_fusion && (
        <div className="pk-ovs-incluidas">
          <b>OVs incluidas:</b>{' '}
          {entregas_involucradas.map(e => (
            <span key={e.id_entrega} className="pk-ov-chip">{e.num_entrega}{e.orden ? ' OV ' + e.orden : ''}</span>
          ))}
        </div>
      )}

      <table className="pk-tabla-firmas">
        <tbody>
          <tr>
            <td className="pk-firma-cell">
              <div className="pk-label">Firma y sello del exportador</div>
              <div className="pk-firma-nombre">{remitente}</div>
              <div className="pk-firma-fecha">Fecha: {fecha}</div>
            </td>
            <td className="pk-firma-sep"></td>
            <td className="pk-firma-cell">
              <div className="pk-label">Recibido conforme</div>
              <div className="pk-firma-linea">Nombre: ___________________________________</div>
              <div className="pk-firma-linea">Fecha: ____________________________________</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
