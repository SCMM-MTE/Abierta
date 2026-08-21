import { jsPDF } from 'jspdf';

const POINTS_PER_MM = 72 / 25.4;
const PDF_TITLE = 'Petición Abierta';

export function buildServicesPdf(services) {
  const document = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  document.setProperties({
    title: PDF_TITLE,
    subject: `Servicios disponibles de ${PDF_TITLE}`,
    creator: PDF_TITLE,
  });

  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const leftMargin = 10 * POINTS_PER_MM;
  const rightMargin = 10 * POINTS_PER_MM;
  const topMargin = 25.4 * POINTS_PER_MM;
  const bottomMargin = 25.4 * POINTS_PER_MM;
  const fontSize = 11;
  const wrappedLineHeight = 13.25;
  const paragraphHeight = 22.5;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  let cursorY = topMargin + fontSize;

  document.setFont('helvetica', 'normal');
  document.setFontSize(fontSize);
  document.setTextColor(0, 0, 0);

  for (const service of services) {
    const lines = document.splitTextToSize(service.text, contentWidth);
    const blockHeight = (lines.length - 1) * wrappedLineHeight + paragraphHeight;

    if (cursorY + blockHeight - paragraphHeight > pageHeight - bottomMargin) {
      document.addPage();
      cursorY = topMargin + fontSize;
    }

    document.text(lines, leftMargin, cursorY, { lineHeightFactor: wrappedLineHeight / fontSize });
    cursorY += blockHeight;
  }

  return document;
}
