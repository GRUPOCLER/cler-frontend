// ============================================================
//  LISTA DE EMPAQUE (PACKING LIST) — imprimible
// ============================================================

export default function ListaEmpaque({ datos }) {
  const { entrega, es_fusion, entregas_involucradas, remitente, tarimas, sueltos, total_bultos, total_piezas, peso_palet_total_kg } = datos

  const folios = es_fusion ? entregas_involucradas.map(e => e.num_entrega).filter(Boolean).join(' + ') : entrega.num_entrega
  const ovs    = es_fusion ? entregas_involucradas.map(e => e.orden).filter(Boolean).join(' + ') : (entrega.orden || '-')
  const fecha  = new Date().toLocaleDateString('es-MX')

  return (
    <div className="pk-doc">
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
              <div className="pk-titulo-grande">PACKING LIST</div>
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
              <div className="pk-label">Direccion</div>
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
                  BULTO {t.numero_tarima} / {total_bultos}
                  <span className="pk-bulto-id">{t.id_tarima}</span>
                </th>
                <th className="pk-bulto-meta" colSpan={3}>
                  Piezas: <b>{t.total_piezas}</b>
                  {t.peso_palet_kg > 0 && <> &nbsp;|&nbsp; Palet: <b>{t.peso_palet_kg} kg</b></>}
                  {t.largo_cm > 0 && t.ancho_cm > 0 && t.alto_cm > 0 &&
                    <> &nbsp;|&nbsp; Medidas: <b>{t.largo_cm}×{t.ancho_cm}×{t.alto_cm} cm</b></>}
                </th>
              </tr>
              <tr className="pk-col-head">
                <th style={{textAlign:'left'}}>Clave</th>
                <th style={{textAlign:'left'}}>Descripcion</th>
                <th style={{textAlign:'right'}}>Cant.</th>
                <th style={{textAlign:'center'}}>Unidad</th>
              </tr>
            </thead>
            <tbody>
              {t.productos.length ? t.productos.map((p, i) => (
                <tr key={p.id_detalle} className={i % 2 === 0 ? 'pk-row-a' : 'pk-row-b'}>
                  <td className="pk-td-clave">{p.clave}</td>
                  <td>{p.descripcion}</td>
                  <td style={{textAlign:'right',fontWeight:700}}>{p.cantidad_asignada}</td>
                  <td style={{textAlign:'center',color:'#555'}}>{p.unidad}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} style={{color:'#888',padding:6}}>Sin productos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}

      {sueltos && sueltos.length > 0 && (
        <div className="pk-bulto">
          <table className="pk-tabla-bulto">
            <thead>
              <tr className="pk-bulto-head pk-bulto-head-suelto">
                <th colSpan={4} className="pk-bulto-titulo">
                  CARGA SUELTA
                  <span className="pk-bulto-id">{sueltos.length} SKU{sueltos.length !== 1 ? 's' : ''}</span>
                </th>
              </tr>
              <tr className="pk-col-head">
                <th style={{textAlign:'left'}}>Clave</th>
                <th style={{textAlign:'left'}}>Descripcion</th>
                <th style={{textAlign:'right'}}>Cant.</th>
                <th style={{textAlign:'center'}}>Unidad</th>
              </tr>
            </thead>
            <tbody>
              {sueltos.map((p, i) => (
                <tr key={p.id_producto} className={i % 2 === 0 ? 'pk-row-a' : 'pk-row-b'}>
                  <td className="pk-td-clave">{p.clave}</td>
                  <td>{p.descripcion}</td>
                  <td style={{textAlign:'right',fontWeight:700}}>{p.cantidad_pendiente ?? p.cantidad_total}</td>
                  <td style={{textAlign:'center',color:'#555'}}>{p.unidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <table className="pk-tabla-totales">
        <tbody>
          <tr className="pk-totales-head"><td colSpan={3}>Totales Generales</td></tr>
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
              <div className="pk-label">Peso pallets</div>
              <div className="pk-total-num-sm">{peso_palet_total_kg > 0 ? `${peso_palet_total_kg} kg` : '-'}</div>
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
