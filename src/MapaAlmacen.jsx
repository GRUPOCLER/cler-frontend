import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from './api.js'
import { ModalAsignar } from './AlmacenPanel.jsx'

const COLOR_ZONA = { ORO: '#eab308', PLATA: '#94a3b8', BRONCE: '#c2650a' }
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
  const [ubicaciones, setUbicaciones] = useState(null)
  const [hover, setHover] = useState(null)
  const [modalUbicacion, setModalUbicacion] = useState(null)
  const [escala, setEscala] = useState(3.4)

  const cargar = () => api.mapaAlmacen().then(setUbicaciones).catch(e => toast(e.message, 'error'))
  useEffect(() => { cargar() }, [])

  const cerrarModalYRecargar = () => { setModalUbicacion(null); cargar() }

  return (
    <div className="contenedor" style={{maxWidth:'none',padding:'16px 20px'}}>
      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:12,flexWrap:'wrap'}}>
        <button className="btn-sec" onClick={() => navigate('/almacen')}>← Volver</button>
        <div>
          <div className="titulo-pag" style={{marginBottom:0}}>Mapa del CEDIS</div>
          <div className="sub-pag">Paso del Toro — click en cualquier posicion para asignar o editar</div>
        </div>
        <div style={{flex:1}}></div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button className="btn-mini" onClick={() => setEscala(e => Math.max(1, e - 0.4))}>−</button>
          <span style={{fontSize:12,color:'var(--text3)',minWidth:36,textAlign:'center'}}>{Math.round(escala * 100 / 3.4)}%</span>
          <button className="btn-mini" onClick={() => setEscala(e => Math.min(6, e + 0.4))}>+</button>
        </div>
      </div>

      <div style={{display:'flex',gap:16,marginBottom:10,fontSize:12,flexWrap:'wrap'}}>
        <span style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{width:14,height:14,background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:3,display:'inline-block'}}></span>
          Libre
        </span>
        <span style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{width:14,height:14,background:'#2f8fd9',borderRadius:3,display:'inline-block'}}></span>
          Con producto asignado
        </span>
        {Object.entries(COLOR_ZONA).map(([z, c]) => (
          <span key={z} style={{display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:14,height:14,border:`2px solid ${c}`,borderRadius:3,display:'inline-block'}}></span>
            Zona {z}
          </span>
        ))}
        {hover && (
          <span style={{marginLeft:'auto',color:'var(--text2)'}}>
            <b>{hover.codigo}</b> · {hover.bodega} · {hover.producto ? `${hover.producto} — ${hover.producto_desc} (existencia: ${hover.stock})` : 'Libre'}
          </span>
        )}
      </div>

      {!ubicaciones ? <div className="cargando">Cargando mapa...</div> : (
        <div style={{
          overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10,
          background: 'var(--bg3)', height: 'calc(100vh - 200px)'
        }}>
          <svg width={ANCHO_MAPA * escala} height={ALTO_MAPA * escala} viewBox={`0 0 ${ANCHO_MAPA} ${ALTO_MAPA}`} style={{display:'block'}}>
            {ETIQUETAS_BODEGA.map(e => (
              <text key={e.nombre} x={e.x} y={e.y} fontSize="7" fill="var(--text3)" fontWeight="700">{e.nombre}</text>
            ))}
            {ubicaciones.map(u => {
              const ocupada = !!u.producto
              const colorBorde = COLOR_ZONA[u.zona] || 'var(--border2)'
              const esHover = hover?.codigo === u.codigo
              // Pequeno margen interno para que las casillas no queden pegadas
              // borde con borde — se ve mucho menos amontonado
              const margen = 0.35
              const ancho = Math.max(u.ancho - margen * 2, 1)
              const alto = Math.max(u.alto - margen * 2, 1)
              return (
                <rect
                  key={u.codigo}
                  x={u.x + margen} y={u.y + margen} width={ancho} height={alto}
                  rx="0.6"
                  fill={ocupada ? '#2f8fd9' : 'var(--bg2)'}
                  stroke={esHover ? '#fff' : colorBorde}
                  strokeWidth={esHover ? 1.1 : 0.35}
                  style={{cursor:'pointer', transition:'fill .1s'}}
                  onMouseEnter={() => setHover(u)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setModalUbicacion(u)}
                >
                  <title>{u.codigo} — {u.producto ? `${u.producto} (${u.stock})` : 'Libre'}</title>
                </rect>
              )
            })}
          </svg>
        </div>
      )}

      {modalUbicacion && (
        <ModalAsignar ubicacion={modalUbicacion} toast={toast}
          onClose={() => setModalUbicacion(null)} onGuardado={cerrarModalYRecargar} />
      )}
    </div>
  )
}
