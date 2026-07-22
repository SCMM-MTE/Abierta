import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/archive-pdf.js';

function mockResponse() {
  return {
    statusCode: 200,
    payload: undefined,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };
}

test('archiva un PDF válido en la carpeta configurada de GitHub', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnvironment = {
    token: process.env.GITHUB_ARCHIVE_TOKEN,
    repository: process.env.GITHUB_ARCHIVE_REPO,
    origins: process.env.ALLOWED_UPLOAD_ORIGINS,
  };
  const requests = [];

  process.env.GITHUB_ARCHIVE_TOKEN = 'test-token';
  process.env.GITHUB_ARCHIVE_REPO = 'SCMM-MTE/Abierta';
  process.env.ALLOWED_UPLOAD_ORIGINS = 'https://abierta-limpia.vercel.app';
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (!options.method) return new Response('{}', { status: 404 });
    return Response.json({ content: { html_url: 'https://github.test/pdf' } });
  };

  try {
    const response = mockResponse();
    const content = Buffer.from('%PDF-1.7\nprueba').toString('base64');
    await handler({ method: 'POST', headers: { origin: 'https://abierta-limpia.vercel.app' }, body: { content } }, response);

    assert.equal(response.statusCode, 200);
    assert.match(response.payload.fileName, /^Equipos petición abierta - \d{2}-\d{2}-\d{4} - \d{2}-\d{2}-\d{2}\.pdf$/);
    assert.equal(response.payload.url, 'https://github.test/pdf');
    assert.equal(requests.length, 2);
    assert.match(requests[1].url, /pdf-generados\/Equipos%20petici%C3%B3n%20abierta/);
    assert.equal(JSON.parse(requests[1].options.body).content, content);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnvironment.token === undefined) delete process.env.GITHUB_ARCHIVE_TOKEN;
    else process.env.GITHUB_ARCHIVE_TOKEN = originalEnvironment.token;
    if (originalEnvironment.repository === undefined) delete process.env.GITHUB_ARCHIVE_REPO;
    else process.env.GITHUB_ARCHIVE_REPO = originalEnvironment.repository;
    if (originalEnvironment.origins === undefined) delete process.env.ALLOWED_UPLOAD_ORIGINS;
    else process.env.ALLOWED_UPLOAD_ORIGINS = originalEnvironment.origins;
  }
});

test('rechaza solicitudes de otros orígenes', async () => {
  const previousOrigins = process.env.ALLOWED_UPLOAD_ORIGINS;
  process.env.ALLOWED_UPLOAD_ORIGINS = 'https://abierta-limpia.vercel.app';

  try {
    const response = mockResponse();
    await handler({ method: 'POST', headers: { origin: 'https://example.com' }, body: {} }, response);
    assert.equal(response.statusCode, 403);
  } finally {
    if (previousOrigins === undefined) delete process.env.ALLOWED_UPLOAD_ORIGINS;
    else process.env.ALLOWED_UPLOAD_ORIGINS = previousOrigins;
  }
});
