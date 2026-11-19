const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const port = Number(process.env.PORT || 3000);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
function safePath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); } catch { return null; }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  return target.startsWith(root + path.sep) || target === root ? target : null;
}
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, {'Allow':'GET, HEAD'}); return res.end(); }
  const target = safePath(req.url || '/');
  if ((req.url || '').split('?')[0] === '/health') { res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end('{"ok":true}'); }
  if (!target) { res.writeHead(400); return res.end('Bad Request'); }
  let file = target;
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch {}
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    if (!path.extname(file)) file = path.join(root, 'index.html');
    else { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Not Found'); }
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'});
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
});
server.listen(port, '0.0.0.0', () => console.log(`MilEX EDU preview listening on 0.0.0.0:${port}`));
