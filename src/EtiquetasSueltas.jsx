// ============================================================
//  ETIQUETAS SUELTAS — carga suelta, una por SKU
//  Formato compacto 4x2 pulgadas (etiqueta termica)
// ============================================================
import { useEffect } from 'react'

// Le dice al navegador que el tamano de pagina de impresion ES 4x2in,
// para que no encoja el contenido al asumir tamano Carta por defecto.
function usarTamanoPagina(reglaCss) {
  useEffect(() => {
    const estilo = document.createElement('style')
    estilo.textContent = reglaCss
    document.head.appendChild(estilo)
    return () => document.head.removeChild(estilo)
  }, [reglaCss])
}

function PaginaEtiquetaSuelta({ d }) {
  return (
    <div className="et-suelta-pagina">
      <div className="et-suelta-top">
        <div className="et-suelta-clave">{d.clave}</div>
        <div className="et-suelta-bulto-wrap">
          <div className="et-suelta-bulto-lbl">Bulto</div>
          <div className="et-suelta-bulto">{d.num_sku}/{d.total_skus_entrega}</div>
        </div>
      </div>

      <div className="et-suelta-desc">{d.descripcion}</div>

      <div className="et-suelta-mid">
        <span className="et-suelta-cliente">{d.nombre_cliente}</span>
        {d.orden && <span className="et-suelta-ov">OV {d.orden}</span>}
        {d.sucursal && <span className="et-suelta-ov">{d.sucursal}</span>}
      </div>
      {d.direccion && <div className="et-suelta-dir">{d.direccion}</div>}

      <div className="et-suelta-bottom">
        <div className="et-suelta-cant-wrap">
          <div className="et-suelta-cant">{d.cantidad}</div>
          <div className="et-suelta-unidad">{d.unidad}</div>
        </div>
        <div className="et-suelta-bc-wrap">
          {d.barcode_entrega_url && <img src={d.barcode_entrega_url} className="et-suelta-bc-img" alt="bc" />}
          <div className="et-suelta-bc-txt">{d.barcode_entrega || d.num_entrega}</div>
        </div>
      </div>
    </div>
  )
}

export default function EtiquetasSueltas({ datos }) {
  usarTamanoPagina('@page { size: 4in 2in; margin: 0; }')
  return (
    <div className="et-suelta-wrap">
      {datos.map(d => <PaginaEtiquetaSuelta key={d.id_producto} d={d} />)}
    </div>
  )
}
