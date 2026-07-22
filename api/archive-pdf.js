import crypto from 'node:crypto';
import { createPdfFilename } from '../src/filename.js';

const MAX_PDF_BYTES = 4 * 1024 * 1024;

function safeEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual ?? '', 'utf8');
  const expectedBuffer = Buffer.from(expected ?? '', 'utf8');
  return actualBuffer.length === expectedBuffer.length
    && actualBuffer.length > 0
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'AbiertaLimpia/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function encodeGithubPath(path) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

async function archiveOnGithub(content, fileName) {
  const token = process.env.GITHUB_ARCHIVE_TOKEN;
  const repository = process.env.GITHUB_ARCHIVE_REPO ?? 'SCMM-MTE/Abierta';
  const branch = process.env.GITHUB_ARCHIVE_BRANCH ?? 'main';
  const directory = (process.env.GITHUB_ARCHIVE_DIR ?? 'pdf-generados').replace(/^\/+|\/+$/g, '');

  if (!token) throw new Error('El archivo automático de GitHub aún no está configurado.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('El repositorio de archivo no está bien configurado.');

  const path = `${directory}/${fileName}`;
  const endpoint = `https://api.github.com/repos/${repository}/contents/${encodeGithubPath(path)}`;
  const headers = githubHeaders(token);
  const currentResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
  let sha;

  if (currentResponse.ok) {
    const current = await currentResponse.json();
    sha = current.sha;
  } else if (currentResponse.status !== 404) {
    if ([401, 403].includes(currentResponse.status)) throw new Error('GitHub ha rechazado las credenciales de archivo.');
    throw new Error('No se pudo comprobar el archivo existente en GitHub.');
  }

  const body = {
    message: `${sha ? 'Actualiza' : 'Archiva'} ${fileName}`,
    content,
    branch,
    ...(sha ? { sha } : {}),
  };
  const uploadResponse = await fetch(endpoint, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!uploadResponse.ok) {
    if ([401, 403].includes(uploadResponse.status)) throw new Error('GitHub ha rechazado las credenciales de archivo.');
    throw new Error('GitHub no pudo guardar el PDF.');
  }

  const result = await uploadResponse.json();
  return result.content?.html_url ?? `https://github.com/${repository}/tree/${branch}/${encodeGithubPath(directory)}`;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Método no permitido.' });
  }

  const expectedKey = process.env.PDF_UPLOAD_SECRET;
  if (!expectedKey) return response.status(503).json({ error: 'El archivo automático todavía no está configurado.' });
  if (!safeEqual(request.headers?.['x-upload-key'], expectedKey)) {
    return response.status(401).json({ error: 'La clave de archivo no es correcta.' });
  }

  try {
    const content = typeof request.body?.content === 'string' ? request.body.content : '';
    if (!content || !/^[a-z\d+/]+=*$/i.test(content)) throw new Error('El contenido del PDF no es válido.');

    const pdf = Buffer.from(content, 'base64');
    if (!pdf.length || pdf.length > MAX_PDF_BYTES) throw new Error('El PDF supera el límite permitido de 4 MB.');
    if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('El archivo generado no es un PDF válido.');

    const fileName = createPdfFilename();
    const url = await archiveOnGithub(content, fileName);
    return response.status(200).json({ fileName, url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo archivar el PDF.';
    return response.status(422).json({ error: message });
  }
}

