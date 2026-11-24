// ============================================================
//  ETIQUETAS SUELTAS — carga suelta, una por SKU
//  Formato compacto 4x2 pulgadas (etiqueta termica)
// ============================================================
import { useEffect } from 'react'
import { fmtKg } from './formato'
import { textoSello } from './sello'

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

// El numero de OV es el encabezado: 36px para una OV normal (8 digitos); si es larga se achica para que nunca se corte.
function tamanoOV(txt) {
  const n = Math.max(String(txt || '').length, 1)
  return Math.max(14, Math.min(36, Math.floor(215 / (n * 0.68))))
}

function PaginaEtiquetaSuelta({ d }) {
  const hayOV = !!(d.orden && String(d.orden).trim())
  const doc = hayOV ? String(d.orden).trim() : String(d.num_entrega || '')
  return (
    <div className={'et-suelta-pagina' + (d.impresa_veces > 0 ? ' con-sello' : '')}>
      <div className="et-suelta-head">
        <div className="et-suelta-ovbox">
          <span className="et-suelta-ovlbl">{hayOV ? 'OV' : 'ENTREGA'}</span>
          <span className="et-suelta-ovnum" style={{ fontSize: tamanoOV(doc) }}>{doc}</span>
        </div>
        <div className="et-suelta-npbox">
          <div className="et-suelta-nplbl">{d.caja_master ? 'Caja' : 'Pieza'}</div>
          <div className="et-suelta-np">{d.num_sku}/{d.total_skus_entrega}</div>
        </div>
      </div>

      <div className="et-suelta-prod">
        <div className="et-suelta-prod-fila">
          <span className="et-suelta-clave">{d.clave}</span>
          {d.total_cajas_sku > 1 && (
            <span className="et-suelta-caja">{d.caja_master ? 'Caja' : 'Pieza'} {d.num_caja} de {d.total_cajas_sku} de este producto</span>
          )}
        </div>
        <div className="et-suelta-desc">{d.descripcion}</div>
      </div>

      <div className="et-suelta-mid">
        <span className="et-suelta-cliente">{d.nombre_cliente}</span>
        {d.sucursal && <span className="et-suelta-suc">{d.sucursal}</span>}
      </div>
      {d.direccion && <div className="et-suelta-dir">{d.direccion}</div>}

      <div className="et-suelta-bottom">
        <div className="et-suelta-cant-wrap">
          <div className="et-suelta-cant">{d.cantidad}</div>
          <div className="et-suelta-unidad">{d.unidad}</div>
          {d.peso_kg > 0 && <div className="et-suelta-peso">{fmtKg(d.peso_kg)}</div>}
        </div>
        <div className="et-suelta-bc-wrap">
          {d.barcode_entrega_url && <img src={d.barcode_entrega_url} className="et-suelta-bc-img" alt="bc" />}
          <div className="et-suelta-bc-txt">{d.barcode_entrega || d.num_entrega}</div>
        </div>
      </div>
      {(() => {
        const t = textoSello({ veces: d.impresa_veces, ultima: d.ultima_impresion_en, por: d.ultima_impresion_por, primera: d.primera_impresion_en })
        return t ? <div className={'et-suelta-sello' + (d.impresa_veces > 1 ? ' et-sello-re' : '')}>{t}</div> : null
      })()}
    </div>
  )
}

export default function EtiquetasSueltas({ datos, formato = 'chica' }) {
  const grande = formato === 'grande'
  // chica: 4x2in, una por pagina. grande: hoja 10x14cm con 3 etiquetas apiladas.
  usarTamanoPagina(grande ? '@page { size: 10cm 14cm; margin: 0; }' : '@page { size: 4in 2in; margin: 0; }')
  if (!grande) {
    return (
      <div className="et-suelta-wrap">
        {datos.map((d, i) => <PaginaEtiquetaSuelta key={i} d={d} />)}
      </div>
    )
  }
  const hojas = []
  for (let i = 0; i < datos.length; i += 3) hojas.push(datos.slice(i, i + 3))
  return (
    <div className="et-suelta-wrap">
      {hojas.map((grupo, i) => (
        <div className="et-suelta-hoja" key={i}>
          {grupo.map((d, j) => (
            <div className="et-suelta-slot" key={j}>
              <div className="et-suelta-escala"><PaginaEtiquetaSuelta d={d} /></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
