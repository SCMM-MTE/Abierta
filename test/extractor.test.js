import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractHtmlFromMhtml, extractServices, extractServicesFromHtml } from '../src/extractor.js';
import { buildServicesPdf } from '../src/pdf.js';
import { createPdfFilename, formatMadridUploadDate } from '../src/filename.js';

test('genera el nombre solicitado con la fecha de Madrid', () => {
  const date = new Date('2026-07-22T18:30:00Z');
  assert.equal(formatMadridUploadDate(date), '22-07-2026 - 20-30-00');
  assert.equal(createPdfFilename(date), 'Equipos petición abierta - 22-07-2026 - 20-30-00.pdf');
});

test('extrae solamente los li.service de la lista disponible', () => {
  const html = `
    <ul class="menu"><li>Ignorar menú</li></ul>
    <ul id="dynamic" class="oreq-select-box-list-available-ul">
      <li class="empty-value">No hay datos</li>
      <li data-value="12" data-line="/1/" data-shift="M0600" class="service">L1  F  M0600  1-PINAR CHAMARTIN</li>
      <li class="service" data-value="13">L2 // L3  SU  T1300  2-C.CAMINOS // 3-MONCLOA</li>
    </ul>`;

  const services = extractServicesFromHtml(html);
  assert.equal(services.length, 2);
  assert.equal(services[0].text, 'L1  F  M0600  1-PINAR CHAMARTIN');
  assert.equal(services[0].shift, 'M0600');
  assert.equal(services[1].id, '13');
});

test('localiza y decodifica la parte HTML de un MHT', () => {
  const mht = `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="test-boundary"\r\n\r\n--test-boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n<ul class=3D"oreq-select-box-list-available-ul"><li class=3D"service">L4  F  T1400  4-ARG=C3=9CELLES</li></ul>\r\n--test-boundary--`;
  const html = extractHtmlFromMhtml(mht);
  const services = extractServicesFromHtml(html);
  assert.equal(services[0].text, 'L4  F  T1400  4-ARGÜELLES');
});

test('admite un EML con cabeceras anteriores a MIME-Version', () => {
  const eml = `Delivered-To: usuario@example.com\r\nMIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="eml-boundary"\r\n\r\n--eml-boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: binary\r\n\r\n<ul class="oreq-select-box-list-available-ul"><li class="service">L5  F  M0600  5-ALAMEDA OSUNA</li></ul>\r\n--eml-boundary--`;
  const services = extractServices(eml);
  assert.equal(services.length, 1);
  assert.equal(services[0].text, 'L5  F  M0600  5-ALAMEDA OSUNA');
});

test('el archivo abierta.mht conserva los 624 servicios esperados', async context => {
  let source;
  try {
    source = await readFile(new URL('../abierta.mht', import.meta.url), 'utf8');
  } catch {
    context.skip('El archivo de muestra local no está disponible');
    return;
  }

  const html = extractHtmlFromMhtml(source);
  const services = extractServicesFromHtml(html);
  assert.equal(services.length, 624);
  assert.equal(services[0].text, '(*) L1  F  F0600  1-DEPOSITO 12');
  assert.equal(services.at(-1).text, 'R%  T1500  RVA');

  const document = buildServicesPdf(services);
  assert.ok(document.getNumberOfPages() >= 19);
  assert.match(document.output(), /^%PDF-/);
});
