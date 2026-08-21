import './styles.css';
import { extractServices } from './extractor.js';
import { createPdfFilename } from './filename.js';
import { buildServicesPdf } from './pdf.js';

const elements = {
  dropZone: document.querySelector('#drop-zone'),
  fileInput: document.querySelector('#file-input'),
  status: document.querySelector('#status'),
  results: document.querySelector('#results'),
  count: document.querySelector('#service-count'),
  sourceName: document.querySelector('#source-name'),
  searchInput: document.querySelector('#search-input'),
  visibleCount: document.querySelector('#visible-count'),
  serviceList: document.querySelector('#service-list'),
  emptyFilter: document.querySelector('#empty-filter'),
  downloadButton: document.querySelector('#download-button'),
  downloadButtonText: document.querySelector('#download-button span'),
  shareButton: document.querySelector('#share-button'),
  shareButtonText: document.querySelector('#share-button span'),
  downloadFallback: document.querySelector('#download-fallback'),
  archiveStatus: document.querySelector('#archive-status'),
};

let services = [];
let activeDownloadUrl = '';
let downloadCleanupTimer;

function showStatus(message, type = 'loading') {
  elements.status.hidden = false;
  elements.status.className = `status status--${type}`;
  elements.status.innerHTML = type === 'loading'
    ? `<span class="spinner" aria-hidden="true"></span><span>${message}</span>`
    : `<span>${message}</span>`;
}

function hideStatus() {
  elements.status.hidden = true;
}

function searchableText(service) {
  return Object.values(service).join(' ').toLocaleLowerCase('es');
}

function renderServices() {
  const query = elements.searchInput.value.trim().toLocaleLowerCase('es');
  const visible = query ? services.filter(service => searchableText(service).includes(query)) : services;
  const fragment = document.createDocumentFragment();

  for (const service of visible) {
    const item = document.createElement('li');
    item.textContent = service.text;
    fragment.append(item);
  }

  elements.serviceList.replaceChildren(fragment);
  elements.emptyFilter.hidden = visible.length > 0;
  elements.visibleCount.textContent = query ? `${visible.length} de ${services.length}` : `${services.length} visibles`;
}

function showResults(extractedServices, sourceName) {
  services = extractedServices;
  elements.searchInput.value = '';
  elements.count.textContent = new Intl.NumberFormat('es-ES').format(services.length);
  elements.sourceName.textContent = sourceName;
  renderServices();
  elements.results.hidden = false;
  elements.archiveStatus.hidden = true;
  hideStatus();
  elements.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

function downloadPdf(buffer, fileName) {
  const blob = new Blob([buffer], { type: 'application/pdf' });

  if (typeof navigator.msSaveOrOpenBlob === 'function') {
    navigator.msSaveOrOpenBlob(blob, fileName);
    return;
  }

  if (activeDownloadUrl) URL.revokeObjectURL(activeDownloadUrl);
  clearTimeout(downloadCleanupTimer);

  const url = URL.createObjectURL(blob);
  activeDownloadUrl = url;
  elements.downloadFallback.href = url;
  elements.downloadFallback.download = fileName;
  elements.downloadFallback.hidden = false;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  if (!('download' in link)) link.target = '_blank';
  document.body.append(link);
  link.click();
  link.remove();

  downloadCleanupTimer = setTimeout(() => {
    if (activeDownloadUrl !== url) return;
    URL.revokeObjectURL(url);
    activeDownloadUrl = '';
    elements.downloadFallback.hidden = true;
    elements.downloadFallback.removeAttribute('href');
  }, 120000);
}

function createPdfFile() {
  const document = buildServicesPdf(services);
  const buffer = document.output('arraybuffer');
  const fileName = createPdfFilename();
  const file = new File([buffer], fileName, { type: 'application/pdf' });
  return { buffer, file, fileName };
}

function showArchiveStatus(message, type, url = '') {
  elements.archiveStatus.hidden = false;
  elements.archiveStatus.className = `archive-status archive-status--${type}`;
  elements.archiveStatus.replaceChildren(document.createTextNode(message));

  if (url) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Ver en GitHub';
    elements.archiveStatus.append(' ', link);
  }
}

async function archiveAndDownload() {
  elements.downloadButton.disabled = true;
  elements.downloadButtonText.textContent = 'Guardando…';
  elements.archiveStatus.hidden = true;

  const { buffer: pdfBuffer, fileName } = createPdfFile();
  downloadPdf(pdfBuffer, fileName);

  try {
    const response = await fetch('/api/archive-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: arrayBufferToBase64(pdfBuffer) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo guardar el PDF en GitHub.');

    const archivedFileName = data.fileName || fileName;
    showArchiveStatus(`${archivedFileName} se ha guardado en GitHub.`, 'success', data.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar el PDF en GitHub.';
    showArchiveStatus(`${message} El PDF se ha descargado localmente.`, 'error');
  } finally {
    elements.downloadButton.disabled = false;
    elements.downloadButtonText.textContent = 'Guardar y descargar PDF';
  }
}

async function sharePdf() {
  elements.shareButton.disabled = true;
  elements.shareButtonText.textContent = 'Preparando…';

  const { buffer, file, fileName } = createPdfFile();
  const canSharePdf = typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });

  if (!canSharePdf) {
    downloadPdf(buffer, fileName);
    showArchiveStatus(
      'Este navegador no permite adjuntar el PDF directamente. Se ha descargado para que puedas enviarlo como documento desde WhatsApp.',
      'error',
    );
    elements.shareButton.disabled = false;
    elements.shareButtonText.textContent = 'Compartir por WhatsApp';
    return;
  }

  try {
    await navigator.share({
      files: [file],
      title: 'Petición Abierta',
      text: 'PDF de servicios de Petición Abierta',
    });
    showArchiveStatus('PDF compartido correctamente.', 'success');
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      showArchiveStatus('No se pudo abrir el menú para compartir el PDF.', 'error');
    }
  } finally {
    elements.shareButton.disabled = false;
    elements.shareButtonText.textContent = 'Compartir por WhatsApp';
  }
}

function showError(error) {
  const message = error instanceof Error ? error.message : 'No se pudo procesar el documento.';
  showStatus(message, 'error');
}

async function processFile(file) {
  if (!file) return;
  if (!/\.(?:mht|mhtml|html|htm|eml|txt)$/i.test(file.name)) {
    showError(new Error('Selecciona un archivo MHT, MHTML, HTML, HTM, EML o TXT.'));
    return;
  }

  showStatus(`Analizando ${file.name}…`);
  elements.results.hidden = true;

  try {
    const source = await file.text();
    showResults(extractServices(source), file.name);
  } catch (error) {
    showError(error);
  }
}

elements.fileInput.addEventListener('change', event => processFile(event.target.files?.[0]));
elements.searchInput.addEventListener('input', renderServices);
elements.downloadButton.addEventListener('click', archiveAndDownload);
elements.shareButton.addEventListener('click', sharePdf);

for (const eventName of ['dragenter', 'dragover']) {
  elements.dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    elements.dropZone.classList.add('is-dragging');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  elements.dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    elements.dropZone.classList.remove('is-dragging');
  });
}

elements.dropZone.addEventListener('drop', event => processFile(event.dataTransfer?.files?.[0]));
