// ============================================================
//  ETIQUETAS SUELTAS — carga suelta, una por SKU
//  10x14cm, con codigo de barras de la entrega/OV
// ============================================================

function PaginaEtiquetaSuelta({ d }) {
  return (
    <div className="et-pagina">
      <div className="et-head">
        <div>
          <div className="et-label-sm">Remitente</div>
          <div className="et-remitente">{d.remitente}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="et-label-sm">SKU</div>
          <div className="et-bulto-num">{d.num_sku}</div>
          <div className="et-bulto-de">de {d.total_skus_entrega} SKUs</div>
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

      <div className="et-sku-box">
        <div className="et-sku-clave">{d.clave}</div>
        <div className="et-sku-desc">{d.descripcion}</div>
        <div className="et-sku-cant-wrap">
          <div className="et-sku-cant">{d.cantidad}</div>
          <div className="et-sku-unidad">{d.unidad}</div>
        </div>
      </div>

      <div className="et-sku-pieza">
        Piezas {d.pieza_inicio}–{d.pieza_inicio + d.cantidad - 1} de {d.total_piezas_entrega} totales
      </div>

      <div className="et-footer">
        <div className="et-bc-block">
          <div className="et-bc-lbl">Entrega</div>
          {d.barcode_entrega_url && <img src={d.barcode_entrega_url} className="et-bc-img" alt="bc-entrega" />}
          <div className="et-bc-txt">{d.barcode_entrega || d.num_entrega || '-'}</div>
        </div>
      </div>
    </div>
  )
}

export default function EtiquetasSueltas({ datos }) {
  return (
    <div className="et-wrap">
      {datos.map(d => <PaginaEtiquetaSuelta key={d.id_producto} d={d} />)}
    </div>
  )
}
