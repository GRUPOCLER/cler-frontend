// Visor de archivos adjuntos: PDF (dibujado con pdf.js, sin depender del visor del navegador) y XML de factura (CFDI).
import { useEffect, useRef, useState } from 'react'
import * as api from './api'
import { tam } from './util'
import { parsearCFDI } from './cfdi'

let _pdfjs = null
async function cargarPdfjs() {
  if (_pdfjs) return _pdfjs
  const lib = await import('pdfjs-dist/build/pdf.js')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.js?url')).default
  lib.GlobalWorkerOptions.workerSrc = worker
  _pdfjs = lib
  return lib
}

const MAX_PAGINAS = 40

function bonito(xml) {   // sangrado simple para leer el XML
  let nivel = 0
  return String(xml).replace(/>\s*</g, '>\n<').split('\n').map(l => {
    const t = l.trim()
    if (/^<\//.test(t)) nivel = Math.max(0, nivel - 1)
    const linea = '  '.repeat(nivel) + t
    if (/^<[^!?/][^>]*[^/]>$/.test(t) && !/<\/.+>$/.test(t)) nivel++
    return linea
  }).join('\n')
}

export default function Visor({ adj, onClose }) {
  const [arch, setArch] = useState(null)
  const [error, setError] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [paginas, setPaginas] = useState(0)
  const cont = useRef(null)
  const esPdf = adj.mime === 'application/pdf'

  useEffect(() => { api.adjLeer(adj.id).then(setArch).catch(e => setError(e.message)) }, [adj.id])
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  useEffect(() => {
    if (!arch || !esPdf) return
    let cancelado = false
    const el = cont.current
    ;(async () => {
      try {
        const pdfjs = await cargarPdfjs()
        const doc = await pdfjs.getDocument({ data: arch.bytes.slice() }).promise
        if (cancelado) return
        setPaginas(doc.numPages)
        el.innerHTML = ''
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const ancho = Math.max(260, el.clientWidth - 8)
        for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGINAS) && !cancelado; n++) {
          const pg = await doc.getPage(n)
          const base = pg.getViewport({ scale: 1 })
          const escala = (ancho / base.width) * zoom
          const vp = pg.getViewport({ scale: escala * dpr })
          const c = document.createElement('canvas')
          c.width = Math.floor(vp.width); c.height = Math.floor(vp.height)
          c.style.width = Math.floor(vp.width / dpr) + 'px'; c.style.height = Math.floor(vp.height / dpr) + 'px'
          c.className = 'visor-pagina'
          c.setAttribute('role', 'img'); c.setAttribute('aria-label', `Página ${n} de ${doc.numPages}`)
          el.appendChild(c)
          await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
        }
      } catch (e) { if (!cancelado) setError('No se pudo mostrar el PDF: ' + (e.message || e)) }
    })()
    return () => { cancelado = true }
  }, [arch, zoom, esPdf])

  const texto = arch && !esPdf ? new TextDecoder('utf-8').decode(arch.bytes).replace(/^﻿/, '') : ''
  let resumen = null
  if (texto) { try { resumen = parsearCFDI(texto) } catch (e) { /* se muestra solo el texto */ } }
  const dinero = (n) => '$' + new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--ancho" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={adj.nombre}>
        <div className="modal-head">
          <div>
            <div className="modal-titulo">{adj.nombre}</div>
            <div className="modal-sub">{adj.tipo_nombre}{adj.tam ? ' | ' + tam(adj.tam) : ''}{esPdf && paginas ? ` | ${paginas} página(s)` : ''}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">x</button>
        </div>
        <div className="visor-barra">
          {esPdf && <>
            <button className="btn-mini" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} disabled={zoom <= 0.5} aria-label="Reducir">-</button>
            <span className="an-nota" style={{ minWidth: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button className="btn-mini" onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} disabled={zoom >= 3} aria-label="Ampliar">+</button>
          </>}
          <span style={{ flex: 1 }} />
          <button className="btn-principal" disabled={!arch} onClick={() => api.descargar(adj.nombre, adj.mime, arch.bytes)}>Descargar</button>
        </div>
        <div className="visor-cuerpo">
          {error && <div className="an-estado an-estado--error">{error}</div>}
          {!arch && !error && <div className="cargando">Abriendo archivo...</div>}
          {esPdf && <div ref={cont} className="visor-paginas" />}
          {!esPdf && arch && (
            <div>
              {resumen && (
                <dl className="ov-datos visor-cfdi">
                  <div><dt>Folio fiscal (UUID)</dt><dd className="ov-mono">{resumen.uuid || '-'}</dd></div>
                  <div><dt>Serie y folio</dt><dd>{(resumen.serie + ' ' + resumen.folio).trim() || '-'}</dd></div>
                  <div><dt>Fecha</dt><dd>{(resumen.fecha || '').replace('T', ' ') || '-'}</dd></div>
                  <div><dt>Total</dt><dd>{dinero(resumen.total)} {resumen.moneda}</dd></div>
                  <div><dt>Emisor</dt><dd>{resumen.rfc_emisor}{resumen.nombre_emisor ? ' | ' + resumen.nombre_emisor : ''}</dd></div>
                  <div><dt>Receptor</dt><dd>{resumen.rfc_receptor}{resumen.nombre_receptor ? ' | ' + resumen.nombre_receptor : ''}</dd></div>
                </dl>
              )}
              <pre className="visor-xml" tabIndex={0}>{bonito(texto)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
