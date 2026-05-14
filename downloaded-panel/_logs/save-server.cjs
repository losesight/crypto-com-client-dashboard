#!/usr/bin/env node
// Tiny CORS-enabled HTTP receiver that writes posted HTML/PNG bodies to disk under downloaded-panel/.
// Usage: node downloaded-panel/_logs/save-server.js  (listens on http://localhost:8765)
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SAFE_PREFIX = path.join(ROOT, 'downloaded-panel') + path.sep;
const PORT = 8765;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age',       '86400');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'POST')    { res.writeHead(405); return res.end('POST only'); }

  const url  = new URL(req.url, `http://localhost:${PORT}`);
  const rel  = url.searchParams.get('path');
  if (!rel) { res.writeHead(400); return res.end('missing ?path'); }

  const out = path.resolve(ROOT, 'downloaded-panel', rel);
  if (!out.startsWith(SAFE_PREFIX)) {
    res.writeHead(400); return res.end('refused: out of jail');
  }

  const chunks = [];
  req.on('data',  c => chunks.push(c));
  req.on('error', e => { res.writeHead(500); res.end(String(e)); });
  req.on('end', () => {
    try {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const body = Buffer.concat(chunks);
      fs.writeFileSync(out, body);
      console.log(`[save] ${body.length}B -> ${path.relative(ROOT, out)}`);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, path: rel, bytes: body.length }));
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
});

server.listen(PORT, () => console.log(`save-server listening on http://localhost:${PORT}/save?path=...`));
