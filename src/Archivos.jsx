// Panel "Archivos" de una OV: PDF de la OV, de la entrega SAP, de la factura y XML de la factura.
import { useCallback, useEffect, useState } from 'react'
import * as api from './api'
import Visor from './Visor'
import { ES_JEFE, PUEDE_CARGAR, PUEDE_FACTURAR, fechaHora, tam, quien } from './util'

const TIPOS = {
  ov_pdf: { nombre: 'OV (PDF)', accept: 'application/pdf', puede: PUEDE_CARGAR },
  entrega_pdf: { nombre: 'Entrega SAP (PDF)', accept: 'application/pdf', puede: PUEDE_CARGAR },
  factura_pdf: { nombre: 'Factura (PDF)', accept: 'application/pdf', puede: PUEDE_FACTURAR },
  factura_xml: { nombre: 'Factura (XML)', accept: '.xml,text/xml,application/xml', puede: PUEDE_FACTURAR },
}

export default function PanelArchivos({ d, rol, toast }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [ver, setVer] = useState(null)
  const [tipo, setTipo] = useState('')
  const [arch, setArch] = useState(null)
  const [env, setEnv] = useState(false)
  const [clave, setClave] = useState(0)

  const cargar = useCallback(() => api.adjListar(d.id).then(x => { setLista(x); setError(null) }).catch(e => setError(e.message)), [d.id])
  useEffect(() => { cargar() }, [cargar, d.estatus])

  const permitidos = Object.keys(TIPOS).filter(t => TIPOS[t].puede(rol) && (!t.startsWith('factura') || ['entregada_sap', 'facturada'].includes(d.estatus)))
  useEffect(() => { if (!permitidos.includes(tipo)) setTipo(permitidos[0] || '') }, [permitidos.join(), tipo])

  const subir = async () => {
    if (!arch || !tipo) return
    setEnv(true)
    try {
      await api.adjSubir(d.id, tipo, arch)
      toast('Archivo guardado', 'ok'); setArch(null); setClave(k => k + 1); await cargar()
    } catch (e) { toast(e.message, 'error') } finally { setEnv(false) }
  }
  const quitar = async (a) => {
    try { await api.adjBorrar(a.id); toast('Archivo eliminado', 'ok'); await cargar() } catch (e) { toast(e.message, 'error') }
  }
  const tiene = (t) => lista && lista.some(a => a.tipo === t)
  const sinXml = d.estatus === 'facturada' && lista && !tiene('factura_xml')

  return (
    <section className="ov-panel" aria-labelledby="h-archivos">
      <h2 className="ov-h2" id="h-archivos">Archivos</h2>
      {error && <div className="an-estado an-estado--error">{error}</div>}
      {!lista && !error && <div className="cargando">Cargando archivos...</div>}
      {sinXml && <div className="ov-aviso">Falta el XML de la factura. {PUEDE_FACTURAR(rol) ? 'Adjúntalo abajo para tener completo el soporte de facturación.' : 'Facturación debe adjuntarlo.'}</div>}
      {lista && lista.length === 0 && <p className="an-nota">Todavía no hay archivos adjuntos en esta OV.</p>}
      {lista && lista.length > 0 && (
        <div className="an-tabla-wrap">
          <table className="an-tabla">
            <thead><tr><th>Documento</th><th>Archivo</th><th className="num">Tamaño</th><th>Subido</th><th /></tr></thead>
            <tbody>
              {lista.map(a => (
                <tr key={a.id}>
                  <td>{a.tipo_nombre}</td>
                  <td className="an-folio">{a.nombre}</td>
                  <td className="num">{tam(a.tam)}</td>
                  <td>{fechaHora(a.subido_en)}<div className="an-nota">{quien(d.nombres, a.subido_por)}</div></td>
                  <td className="ov-acc">
                    <button className="btn-mini" onClick={() => setVer(a)}>Ver</button>
                    <button className="btn-mini" onClick={async () => { try { const r = await api.adjLeer(a.id); api.descargar(a.nombre, a.mime, r.bytes) } catch (e) { toast(e.message, 'error') } }}>Descargar</button>
                    {ES_JEFE(rol) && <button className="btn-mini" onClick={() => quitar(a)} aria-label={`Eliminar ${a.nombre}`}>Eliminar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {permitidos.length > 0 && (
        <div className="ov-escaner-fila ov-adjuntar">
          <label className="an-campo">Adjuntar
            <select className="inp" value={tipo} onChange={e => { setTipo(e.target.value); setArch(null); setClave(k => k + 1) }}>
              {permitidos.map(t => <option key={t} value={t}>{TIPOS[t].nombre}</option>)}
            </select>
          </label>
          <label className="an-campo ov-escaner-cod">Archivo
            <input key={clave} type="file" className="inp" accept={tipo ? TIPOS[tipo].accept : undefined} onChange={e => setArch(e.target.files[0] || null)} />
          </label>
          <button className="btn-sec" disabled={!arch || env} onClick={subir}>{env ? 'Guardando...' : 'Guardar archivo'}</button>
        </div>
      )}
      {permitidos.length > 0 && lista && lista.some(a => a.tipo === tipo) && <p className="an-nota">Un archivo nuevo de este tipo reemplaza al anterior.</p>}
      {ver && <Visor adj={ver} onClose={() => setVer(null)} />}
    </section>
  )
}
