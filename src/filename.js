export function formatMadridUploadDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.day}-${values.month}-${values.year} - ${values.hour}-${values.minute}-${values.second}`;
}

export function createPdfFilename(date = new Date()) {
  return `Equipos petición abierta - ${formatMadridUploadDate(date)}.pdf`;
}
