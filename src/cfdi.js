// Lee un XML de factura (CFDI) en el navegador, solo para mostrar un resumen antes de registrarla.
export function parsearCFDI(xmlTexto) {
    if (typeof DOMParser === 'undefined') throw new Error('Este navegador no puede leer XML.');
    var doc = new DOMParser().parseFromString(String(xmlTexto || '').replace(/^\uFEFF/, ''), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('El XML está dañado o no es un XML válido.');
    var porNombre = function (nombre) {
      var todos = doc.getElementsByTagName('*');
      for (var i = 0; i < todos.length; i++) { var n = todos[i].localName || todos[i].nodeName.split(':').pop(); if (n === nombre) return todos[i]; }
      return null;
    };
    var comp = porNombre('Comprobante');
    if (!comp) throw new Error('El archivo no parece un XML de factura (CFDI).');
    var timbre = porNombre('TimbreFiscalDigital'), em = porNombre('Emisor'), re = porNombre('Receptor');
    var a = function (el, k) { return el ? (el.getAttribute(k) || '').trim() : ''; };
    return {
      uuid: a(timbre, 'UUID').toUpperCase(), serie: a(comp, 'Serie'), folio: a(comp, 'Folio'), fecha: a(comp, 'Fecha'),
      total: parseFloat(a(comp, 'Total')) || 0, moneda: a(comp, 'Moneda'), version: a(comp, 'Version') || a(comp, 'version'),
      rfc_emisor: a(em, 'Rfc'), nombre_emisor: a(em, 'Nombre'), rfc_receptor: a(re, 'Rfc'), nombre_receptor: a(re, 'Nombre')
    };
  }
