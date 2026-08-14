// ============================================================
//  ETIQUETA DE TARIMA — imprimible, 10x14cm
//  Replica el diseno del sistema Apps Script original
// ============================================================

const MAX_PRODS_POR_PAGINA = 6

function chunk(arr, size) {
  if (!arr.length) return [[]]
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function PaginaEtiqueta({ d, chunkProds, sub, subTotal }) {
  const numLabel = subTotal > 1 ? `${d.numero_tarima} (${sub}/${subTotal})` : d.numero_tarima
  const hayPesos = d.peso_neto_kg > 0 || d.peso_palet_kg > 0 || d.peso_bruto_kg > 0
  const tieneDims = d.largo_cm > 0 && d.ancho_cm > 0 && d.alto_cm > 0

  return (
    <div className="et-pagina">
      <div className="et-head">
        <div>
          <div className="et-label-sm">Remitente</div>
          <div className="et-remitente">{d.remitente}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="et-label-sm">Bulto</div>
          <div className="et-bulto-num">{numLabel}</div>
          <div className="et-bulto-de">de {d.total_tarimas} tarimas</div>
        </div>
      </div>

      <div className="et-destinatario">
        <div className="et-label-sm">Destinatario</div>
        <div className="et-cliente">{d.nombre_cliente || '-'}</div>
        {d.sucursal && <div className="et-sucursal">Suc: {d.sucursal}</div>}
        <div className="et-direccion">{d.direccion || '-'}</div>
      </div>

      <div className="et-grid3">
        <div>
          <div className="et-label-sm">N Entrega</div>
          <div className="et-mono-bold">{d.barcode_entrega || d.num_entrega}</div>
        </div>
        {d.orden && (
          <div>
            <div className="et-label-sm">OV</div>
            <div className="et-mono-bold">{d.orden}</div>
          </div>
        )}
        <div>
          <div className="et-label-sm">Fecha</div>
          <div className="et-fecha">{(d.fecha_entrega || '').substring(0, 10) || '-'}</div>
        </div>
      </div>

      {hayPesos && (
        <div className="et-pesos" style={{ gridTemplateColumns: tieneDims ? 'repeat(4,1fr)' : 'repeat(3,1fr)' }}>
          <div className="et-peso-box">
            <div className="et-peso-lbl">Neto</div>
            <div className="et-peso-val">{d.peso_neto_kg > 0 ? `${d.peso_neto_kg} kg` : '-'}</div>
          </div>
          <div className="et-peso-box">
            <div className="et-peso-lbl">Palet</div>
            <div className="et-peso-val">{d.peso_palet_kg > 0 ? `${d.peso_palet_kg} kg` : '-'}</div>
          </div>
          <div className="et-peso-box" style={{ borderRight: tieneDims ? '1px solid #000' : 'none' }}>
            <div className="et-peso-lbl">Bruto</div>
            <div className="et-peso-val">{d.peso_bruto_kg > 0 ? `${d.peso_bruto_kg} kg` : '-'}</div>
          </div>
          {tieneDims && (
            <div className="et-peso-box" style={{ borderRight: 'none' }}>
              <div className="et-peso-lbl">Medidas</div>
              <div className="et-peso-val" style={{ fontSize: 8.5, fontFamily: 'monospace' }}>
                {d.largo_cm}x{d.ancho_cm}x{d.alto_cm}cm
              </div>
            </div>
          )}
        </div>
      )}

      <div className="et-contenido">
        <div className="et-label-sm" style={{ marginBottom: 2 }}>Contenido</div>
        <table className="et-tabla">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Clave</th>
              <th style={{ textAlign: 'left' }}>Descripcion</th>
              <th style={{ textAlign: 'right' }}>Cant</th>
            </tr>
          </thead>
          <tbody>
            {chunkProds.length ? chunkProds.map(p => (
              <tr key={p.id_producto}>
                <td className="et-td-clave">{p.clave}</td>
                <td className="et-td-desc">{p.descripcion}</td>
                <td className="et-td-cant">{p.cantidad_total}</td>
              </tr>
            )) : (
              <tr><td colSpan={3} style={{ fontSize: 8, color: '#888', padding: 4 }}>Sin productos</td></tr>
            )}
          </tbody>
        </table>
        {subTotal > 1 && <div className="et-parte">Parte {sub} de {subTotal}</div>}
      </div>

      <div className="et-footer">
        <div className="et-bc-block">
          <div className="et-bc-lbl">Entrega</div>
          {d.barcode_entrega_url && <img src={d.barcode_entrega_url} className="et-bc-img" alt="bc-entrega" />}
          <div className="et-bc-txt">{d.barcode_entrega || d.num_entrega || '-'}</div>
        </div>
        <div className="et-bc-block et-bc-block-2">
          <div className="et-bc-lbl">Tarima</div>
          {d.barcode_tarima_url && <img src={d.barcode_tarima_url} className="et-bc-img" alt="bc-tarima" />}
          <div className="et-bc-txt">{d.barcode_tarima || d.id_tarima || '-'}</div>
        </div>
      </div>
    </div>
  )
}

export default function Etiquetas({ datos }) {
  // datos: array de objetos etiqueta (uno o varias tarimas)
  const paginas = []
  datos.forEach(d => {
    const grupos = chunk(d.productos || [], MAX_PRODS_POR_PAGINA)
    grupos.forEach((g, i) => {
      paginas.push(
        <PaginaEtiqueta
          key={d.id_tarima + '-' + i}
          d={d}
          chunkProds={g}
          sub={i + 1}
          subTotal={grupos.length}
        />
      )
    })
  })
  return <div className="et-wrap">{paginas}</div>
}
