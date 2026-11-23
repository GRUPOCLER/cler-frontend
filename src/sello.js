// Sello de impresion: dice en la hoja si es la impresion original o una reimpresion,
// cuando se imprimio y quien lo hizo. Lo que se ve es lo registrado por el servidor.

// 06/11/2026 13:38, hora de America/Mexico_City
function fmt(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map(x => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

// veces: total de impresiones registradas (1 = original, 2 = primera reimpresion...)
export function textoSello({ veces, ultima, por, primera }) {
  if (!veces || veces < 1) return null
  const cuando = fmt(ultima)
  const quien = por ? ` | ${por}` : ''
  if (veces === 1) return `IMPRESION ORIGINAL | ${cuando}${quien}`
  const orig = primera ? ` | Original: ${fmt(primera)}` : ''
  return `REIMPRESION No. ${veces - 1} | ${cuando}${quien}${orig}`
}
