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
      {d.total_cajas_sku > 1 && (
        <div className="et-suelta-caja">{d.caja_master ? 'Caja' : 'Pieza'} {d.num_caja} de {d.total_cajas_sku}</div>
      )}

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
          {d.peso_kg > 0 && <div className="et-suelta-peso">{d.peso_kg} kg</div>}
        </div>
        <div className="et-suelta-bc-wrap">
          {d.barcode_entrega_url && <img src={d.barcode_entrega_url} className="et-suelta-bc-img" alt="bc" />}
          <div className="et-suelta-bc-txt">{d.barcode_entrega || d.num_entrega}</div>
        </div>
      </div>
    </div>
  )
}

export default function EtiquetasSueltas({ datos, formato = 'chica' }) {
  const grande = formato === 'grande'
  usarTamanoPagina(grande ? '@page { size: 10cm 14cm; margin: 0; }' : '@page { size: 4in 2in; margin: 0; }')
  if (!grande) {
    return (
      <div className="et-suelta-wrap">
        {datos.map(d => <PaginaEtiquetaSuelta key={d.id_producto} d={d} />)}
      </div>
    )
  }
  const hojas = []
  for (let i = 0; i < datos.length; i += 3) hojas.push(datos.slice(i, i + 3))
  return (
    <div className="et-suelta-wrap">
      {hojas.map((grupo, i) => (
        <div className="et-suelta-hoja" key={i}>
          {grupo.map(d => (
            <div className="et-suelta-slot" key={d.id_producto}>
              <div className="et-suelta-escala"><PaginaEtiquetaSuelta d={d} /></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
