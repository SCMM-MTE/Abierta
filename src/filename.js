export function formatMadridDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.day}-${values.month}-${values.year}`;
}

export function createPdfFilename(date = new Date()) {
  return `Equipos petición abierta - ${formatMadridDate(date)}.pdf`;
}

