import dns from 'node:dns/promises';
import net from 'node:net';
import { extractServices } from '../src/extractor.js';

const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;
const MAX_REDIRECTS = 4;

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const parts = address.split('.').map(Number);
    return parts[0] === 10
      || parts[0] === 127
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || parts[0] === 0;
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1'
      || normalized === '::'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe8')
      || normalized.startsWith('fe9')
      || normalized.startsWith('fea')
      || normalized.startsWith('feb');
  }

  return true;
}

async function validateUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('La URL no es válida.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('La URL debe comenzar por http:// o https://.');
  if (url.username || url.password) throw new Error('La URL no puede contener credenciales.');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) throw new Error('Ese destino no está permitido.');

  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(result => isPrivateAddress(result.address))) {
    throw new Error('Ese destino no está permitido.');
  }

  return url;
}

async function download(urlValue) {
  let currentUrl = await validateUrl(urlValue);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: 'text/html,application/xhtml+xml,message/rfc822,*/*;q=0.5',
        'User-Agent': 'AbiertaLimpia/1.0',
      },
    });

    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      if (redirect === MAX_REDIRECTS) throw new Error('La URL tiene demasiadas redirecciones.');
      currentUrl = await validateUrl(new URL(response.headers.get('location'), currentUrl).href);
      continue;
    }

    if (!response.ok) {
      if ([401, 403].includes(response.status)) {
        throw new Error('La página requiere una sesión iniciada. Descárgala como MHT y súbela desde la otra opción.');
      }
      throw new Error(`La página respondió con el estado ${response.status}.`);
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (declaredLength > MAX_RESPONSE_BYTES) throw new Error('El documento supera el límite de 12 MB.');

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_BYTES) throw new Error('El documento supera el límite de 12 MB.');
    return new TextDecoder('utf-8').decode(buffer);
  }

  throw new Error('No se pudo completar la descarga.');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const url = typeof request.body?.url === 'string' ? request.body.url.trim() : '';
    if (!url) return response.status(400).json({ error: 'Indica una URL.' });
    const source = await download(url);
    const services = extractServices(source);
    return response.status(200).json({ services });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo procesar la URL.';
    return response.status(422).json({ error: message });
  }
}

