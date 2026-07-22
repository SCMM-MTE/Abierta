import './styles.css';
import { extractServices } from './extractor.js';
import { createPdfFilename } from './filename.js';
import { buildServicesPdf } from './pdf.js';

const elements = {
  fileTab: document.querySelector('#file-tab'),
  urlTab: document.querySelector('#url-tab'),
  filePanel: document.querySelector('#file-panel'),
  urlPanel: document.querySelector('#url-panel'),
  dropZone: document.querySelector('#drop-zone'),
  fileInput: document.querySelector('#file-input'),
  urlForm: document.querySelector('#url-form'),
  urlInput: document.querySelector('#url-input'),
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
  archiveStatus: document.querySelector('#archive-status'),
};

let services = [];

function selectSource(source) {
  const fileSelected = source === 'file';
  elements.fileTab.classList.toggle('is-active', fileSelected);
  elements.urlTab.classList.toggle('is-active', !fileSelected);
  elements.fileTab.setAttribute('aria-selected', String(fileSelected));
  elements.urlTab.setAttribute('aria-selected', String(!fileSelected));
  elements.filePanel.hidden = !fileSelected;
  elements.urlPanel.hidden = fileSelected;
}

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
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const document = buildServicesPdf(services);
  const pdfBuffer = document.output('arraybuffer');
  let fileName = createPdfFilename();

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

    fileName = data.fileName || fileName;
    showArchiveStatus(`${fileName} se ha guardado en GitHub.`, 'success', data.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar el PDF en GitHub.';
    showArchiveStatus(`${message} Se descargará una copia local.`, 'error');
  } finally {
    downloadPdf(pdfBuffer, fileName);
    elements.downloadButton.disabled = false;
    elements.downloadButtonText.textContent = 'Guardar y descargar PDF';
  }
}

function showError(error) {
  const message = error instanceof Error ? error.message : 'No se pudo procesar el documento.';
  showStatus(message, 'error');
}

async function processFile(file) {
  if (!file) return;
  if (!/\.(?:mht|mhtml)$/i.test(file.name)) {
    showError(new Error('Selecciona un archivo con extensión .mht o .mhtml.'));
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

async function processUrl(url) {
  showStatus('Descargando y analizando la página…');
  elements.results.hidden = true;

  try {
    const response = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo descargar esa URL.');
    showResults(data.services, new URL(url).hostname);
  } catch (error) {
    showError(error);
  }
}

elements.fileTab.addEventListener('click', () => selectSource('file'));
elements.urlTab.addEventListener('click', () => selectSource('url'));
elements.fileInput.addEventListener('change', event => processFile(event.target.files?.[0]));
elements.searchInput.addEventListener('input', renderServices);
elements.downloadButton.addEventListener('click', archiveAndDownload);

elements.urlForm.addEventListener('submit', event => {
  event.preventDefault();
  processUrl(elements.urlInput.value.trim());
});

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
