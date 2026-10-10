// AM Premify - Premium Panel
// Jalankan: node server.js  (butuh Node.js 18+, tanpa npm install)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8112;
const UPSTREAM = process.env.UPSTREAM || 'https://am.noxxyrorr.biz.id';

// Pakai folder public/ jika ada, kalau tidak pakai folder yang sama dengan server.js
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : __dirname;
const BLOCKED = ['server.js', 'package.json', 'package-lock.json'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function proxyUpstream(req, res, pathname) {
  try {
    const body = await readBody(req);
    const r = await fetch(UPSTREAM + pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const text = await r.text();
    res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json; charset=utf-8' });
    res.end(text);
  } catch (err) {
    sendJson(res, 502, { success: false, error: err.message });
  }
}

function serveStatic(res, pathname) {
  let file = pathname === '/' ? '/index.html' : pathname;
  file = path.normalize(decodeURIComponent(file)).replace(/^(\.\.[\/\\])+/, '');
  const full = path.join(PUBLIC_DIR, file);
  const base = path.basename(full);

  if (!full.startsWith(PUBLIC_DIR) || BLOCKED.includes(base) || base.startsWith('.')) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }
  fs.readFile(full, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'Not Found' });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'POST' && (pathname === '/api/send-link' || pathname === '/api/verify-link')) {
    return proxyUpstream(req, res, pathname);
  }
  if (req.method === 'GET') return serveStatic(res, pathname);
  sendJson(res, 404, { error: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`[AM Premify] Panel aktif di: http://localhost:${PORT}`);
  console.log(`[AM Premify] Upstream: ${UPSTREAM}`);
});
