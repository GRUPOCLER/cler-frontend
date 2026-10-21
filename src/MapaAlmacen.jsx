import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as api from './api.js'
import { ModalUbicacion, BuscadorProducto } from './AlmacenPanel.jsx'

const COLOR_ZONA = { ORO: '#eab308', PLATA: '#94a3b8', BRONCE: '#c2650a' }
const COLOR_RESALTE = '#ff6a00'
const ANCHO_MAPA = 930, ALTO_MAPA = 345 // coordenadas reales del layout del CEDIS

// Etiquetas de bodega: una por cada region, centradas aproximadamente
const ETIQUETAS_BODEGA = [
  { nombre: 'Bodega 04', x: 95,  y: 128 },
  { nombre: 'Patio',     x: 266, y: 120 },
  { nombre: 'Bodega 03', x: 415, y: 6   },
  { nombre: 'Bodega 02', x: 662, y: 6   },
  { nombre: 'Bodega 01', x: 835, y: 10  },
]

export default function MapaAlmacen({ toast }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [ubicaciones, setUbicaciones] = useState(null)
  const [hover, setHover] = useState(null)
  const [modalUbicacion, setModalUbicacion] = useState(null)
  const [escala, setEscala] = useState(3.4)
  const [producto, setProducto] = useState(null)
  const contenedorRef = useRef()

  const claveUrl = params.get('producto') || ''

  useEffect(() => { api.mapaAlmacen().then(setUbicaciones).catch(e => toast(e.message, 'error')) }, [])

  // Si llega ?producto=CLAVE desde el listado, lo cargamos y resaltamos
  useEffect(() => {
    if (!claveUrl) { setProducto(null); return }
    if (producto?.clave === claveUrl) return
    api.buscarProductoAlmacen(claveUrl)
      .then(rs => setProducto(rs.find(x => x.clave === claveUrl) || rs[0] || null))
      .catch(e => toast(e.message, 'error'))
  }, [claveUrl])

  const elegirProducto = (p) => {
    setProducto(p)
    if (p) setParams({ producto: p.clave }, { replace: true })
    else setParams({}, { replace: true })
  }

  const resaltadas = new Set((producto?.distribucion || []).map(d => d.codigo))
  const hayResalte = !!producto

  // Al elegir un producto, llevamos la vista a sus ubicaciones
  useEffect(() => {
    if (!ubicaciones || !producto || !contenedorRef.current) return
    const mias = ubicaciones.filter(u => resaltadas.has(u.codigo))
    if (!mias.length) return
    const x = Math.min(...mias.map(u => u.x)), y = Math.min(...mias.map(u => u.y))
    contenedorRef.current.scrollTo({
      left: Math.max(0, x * escala - 150), top: Math.max(0, y * escala - 120), behavior: 'smooth'
    })
  }, [producto, ubicaciones])

  const fueraDelMapa = producto ? producto.distribucion.filter(d => !d.en_mapa).length : 0

  return (
    <div className="contenedor" style={{maxWidth:'none',padding:'16px 20px'}}>
      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:12,flexWrap:'wrap'}}>
        <button className="btn-sec" onClick={() => navigate('/almacen')}>← Volver</button>
        <div>
          <div className="titulo-pag" style={{marginBottom:0}}>Mapa del CEDIS</div>
          <div className="sub-pag">Paso del Toro — busca un equipo para ver dónde está; click en una posición para ver su detalle</div>
        </div>
        <div style={{flex:1}}></div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button className="btn-mini" onClick={() => setEscala(e => Math.max(1, e - 0.6))}>−</button>
          <span style={{fontSize:12,color:'var(--text3)',minWidth:36,textAlign:'center'}}>{Math.round(escala * 100 / 3.4)}%</span>
          <button className="btn-mini" onClick={() => setEscala(e => Math.min(14, e + 0.6))}>+</button>
        </div>
      </div>

      <BuscadorProducto toast={toast} seleccionado={producto} onSeleccionar={elegirProducto} />
      {fueraDelMapa > 0 && (
        <div style={{fontSize:12,color:'var(--rojo)',marginBottom:10}}>
          {fueraDelMapa} ubicacion(es) de este producto no estan dibujadas en el mapa (marcadas con ⚠ en la tabla).
        </div>
      )}

      <div style={{display:'flex',gap:16,marginBottom:10,fontSize:12,flexWrap:'wrap'}}>
        <span style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{width:14,height:14,background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:3,display:'inline-block'}}></span>
          Libre
        </span>
        <span style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{width:14,height:14,background:'#2f8fd9',borderRadius:3,display:'inline-block'}}></span>
          Con existencia
        </span>
        {hayResalte && (
          <span style={{display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:14,height:14,background:COLOR_RESALTE,borderRadius:3,display:'inline-block',border:'1px solid #fff'}}></span>
            {producto.clave}
          </span>
        )}
        {Object.entries(COLOR_ZONA).map(([z, c]) => (
          <span key={z} style={{display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:14,height:14,border:`2px solid ${c}`,borderRadius:3,display:'inline-block'}}></span>
            Zona {z}
          </span>
        ))}
        {hover && (
          <span style={{marginLeft:'auto',color:'var(--text2)'}}>
            <b>{hover.codigo}</b> · {hover.bodega} · {hover.productos.length
              ? hover.productos.map(p => `${p.clave} (${p.cantidad})`).join(', ') : 'Libre'}
          </span>
        )}
      </div>

      {!ubicaciones ? <div className="cargando">Cargando mapa...</div> : (
        <div ref={contenedorRef} style={{
          overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10,
          background: 'var(--bg3)', height: 'calc(100vh - 260px)', minHeight: 300
        }}>
          <svg width={ANCHO_MAPA * escala} height={ALTO_MAPA * escala} viewBox={`0 0 ${ANCHO_MAPA} ${ALTO_MAPA}`} style={{display:'block'}}>
            {ETIQUETAS_BODEGA.map(e => (
              <text key={e.nombre} x={e.x} y={e.y} fontSize="7" fill="var(--text3)" fontWeight="700">{e.nombre}</text>
            ))}
            {ubicaciones.map(u => {
              const ocupada = u.ocupada
              const esResalte = hayResalte && resaltadas.has(u.codigo)
              const colorBorde = COLOR_ZONA[u.zona] || 'var(--border2)'
              const esHover = hover?.codigo === u.codigo
              const margen = 0.35
              const ancho = Math.max(u.ancho - margen * 2, 1)
              const alto = Math.max(u.alto - margen * 2, 1)
              return (
                <rect
                  key={u.codigo}
                  x={u.x + margen} y={u.y + margen} width={ancho} height={alto}
                  rx="0.6"
                  fill={esResalte ? COLOR_RESALTE : ocupada ? '#2f8fd9' : 'var(--bg2)'}
                  opacity={hayResalte && !esResalte ? 0.28 : 1}
                  stroke={esResalte ? '#fff' : esHover ? '#fff' : colorBorde}
                  strokeWidth={esResalte ? 1.2 : esHover ? 1.1 : 0.35}
                  style={{cursor:'pointer', transition:'fill .1s'}}
                  onMouseEnter={() => setHover(u)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setModalUbicacion(u)}
                >
                  <title>{u.codigo} — {u.productos.length ? u.productos.map(p => `${p.clave} (${p.cantidad})`).join(', ') : 'Libre'}</title>
                </rect>
              )
            })}
          </svg>
        </div>
      )}

      {modalUbicacion && <ModalUbicacion ubicacion={modalUbicacion} onClose={() => setModalUbicacion(null)} />}
    </div>
  )
}
