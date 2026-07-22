const TARGET_LIST_CLASS = 'oreq-select-box-list-available-ul';

function parseHeaders(value) {
  const result = {};
  const unfolded = value.replace(/\r?\n[\t ]+/g, ' ');

  for (const line of unfolded.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    result[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
  }

  return result;
}

function bytesToText(bytes, charset = 'utf-8') {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

function decodeBase64(value, charset) {
  const compact = value.replace(/\s/g, '');
  let bytes;

  if (typeof Buffer !== 'undefined') {
    bytes = Uint8Array.from(Buffer.from(compact, 'base64'));
  } else {
    const binary = atob(compact);
    bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  }

  return bytesToText(bytes, charset);
}

function decodeQuotedPrintable(value, charset) {
  const joined = value.replace(/=\r?\n/g, '');
  const bytes = [];

  for (let index = 0; index < joined.length; index += 1) {
    if (joined[index] === '=' && /^[0-9a-f]{2}$/i.test(joined.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(joined.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      const codePoint = joined.codePointAt(index);
      if (codePoint <= 255) {
        bytes.push(codePoint);
      } else {
        bytes.push(...new TextEncoder().encode(String.fromCodePoint(codePoint)));
        if (codePoint > 0xffff) index += 1;
      }
    }
  }

  return bytesToText(Uint8Array.from(bytes), charset);
}

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, token) => {
    if (token[0] !== '#') return namedEntities[token.toLowerCase()] ?? entity;
    const hexadecimal = token[1]?.toLowerCase() === 'x';
    const number = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
  });
}

function fixMojibake(value) {
  if (!/[ÃÂâ€]/.test(value)) return value;

  try {
    const bytes = Uint8Array.from([...value].map(character => character.charCodeAt(0)));
    const repaired = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return repaired.includes('\ufffd') ? value : repaired;
  } catch {
    return value;
  }
}

function extractAttribute(attributes, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = attributes.match(new RegExp(`(?:^|\\s)${escapedName}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] ?? '';
}

function cleanVisibleText(value) {
  return fixMojibake(
    decodeHtmlEntities(
      value
        .replace(/<br\s*\/?\s*>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[\u200b-\u200d\ufeff]/g, '')
        .trim(),
    ),
  );
}

export function extractHtmlFromMhtml(source) {
  const headerEnd = source.search(/\r?\n\r?\n/);
  if (headerEnd < 0) return source;

  const rawHeaders = source.slice(0, headerEnd);
  const headers = parseHeaders(rawHeaders);
  const boundaryMatch = headers['content-type']?.match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) return source;

  const parts = source.split(`--${boundary}`);
  for (const rawPart of parts) {
    const part = rawPart.replace(/^\r?\n/, '');
    const partHeaderEnd = part.search(/\r?\n\r?\n/);
    if (partHeaderEnd < 0) continue;

    const partHeaders = parseHeaders(part.slice(0, partHeaderEnd));
    if (!/^text\/html\b/i.test(partHeaders['content-type'] ?? '')) continue;

    let body = part.slice(partHeaderEnd).replace(/^\r?\n\r?\n/, '').replace(/\r?\n$/, '');
    const charset = partHeaders['content-type']?.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1] ?? 'utf-8';
    const transferEncoding = partHeaders['content-transfer-encoding']?.toLowerCase();

    if (transferEncoding === 'base64') body = decodeBase64(body, charset);
    if (transferEncoding === 'quoted-printable') body = decodeQuotedPrintable(body, charset);
    return body;
  }

  throw new Error('El MHT no contiene una sección HTML reconocible.');
}

export function extractServicesFromHtml(html) {
  const listPattern = new RegExp(
    `<ul\\b(?=[^>]*\\bclass\\s*=\\s*["'][^"']*\\b${TARGET_LIST_CLASS}\\b[^"']*["'])[^>]*>`,
    'i',
  );
  const openingList = listPattern.exec(html);

  if (!openingList) {
    throw new Error('No se encontró la lista de servicios disponibles en el documento.');
  }

  const listStart = openingList.index + openingList[0].length;
  const listEnd = html.slice(listStart).search(/<\/ul\s*>/i);
  if (listEnd < 0) throw new Error('La lista de servicios está incompleta.');

  const listHtml = html.slice(listStart, listStart + listEnd);
  const services = [];
  const itemPattern = /<li\b([^>]*)>([\s\S]*?)<\/li\s*>/gi;
  let match;

  while ((match = itemPattern.exec(listHtml)) !== null) {
    const className = extractAttribute(match[1], 'class');
    if (!className.split(/\s+/).includes('service')) continue;

    const text = cleanVisibleText(match[2]);
    if (!text) continue;

    services.push({
      text,
      id: extractAttribute(match[1], 'data-value'),
      line: extractAttribute(match[1], 'data-line'),
      location: extractAttribute(match[1], 'data-location'),
      typePosition: extractAttribute(match[1], 'data-typeposition'),
      shift: extractAttribute(match[1], 'data-shift'),
      serviceType: extractAttribute(match[1], 'data-servicetype'),
      ml: extractAttribute(match[1], 'data-ml'),
      lar: extractAttribute(match[1], 'data-lar'),
      sdf: extractAttribute(match[1], 'data-sdf'),
      coincidente: extractAttribute(match[1], 'data-coincidente'),
    });
  }

  if (!services.length) throw new Error('La lista existe, pero no contiene servicios disponibles.');
  return services;
}

export function extractServices(source) {
  const sourceHeaders = source.slice(0, 8192);
  const isMimeDocument = /^\s*(?:From:|MIME-Version:|Snapshot-Content-Location:)/i.test(source)
    || (/\bMIME-Version\s*:/i.test(sourceHeaders) && /\bContent-Type\s*:\s*multipart\//i.test(sourceHeaders));
  const html = isMimeDocument
    ? extractHtmlFromMhtml(source)
    : source;
  return extractServicesFromHtml(html);
}
