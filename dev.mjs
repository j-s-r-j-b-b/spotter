// Local dev server: serves static files and routes /api/<name> to api/<name>.js, mirroring vercel.json.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
process.chdir(root);
for (const f of ['.env.local', '.env']) {
  try { fs.readFileSync(path.join(root, f), 'utf8').split(/\r?\n/).forEach((l) => { const m = l.match(/^\s*([\w]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); } catch {}
}
const PORT = Number(process.env.PORT) || 5200;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const SPA = [/^\/app(\/.*)?$/, /^\/c\/[^/]+$/, /^\/login$/, /^\/signup$/, /^\/$/];

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    let apiName = null;
    const mcp = url.pathname.match(/^\/mcp(?:\/([^/]+))?\/?$/);
    if (mcp) { apiName = 'mcp'; if (mcp[1]) { url.searchParams.set('key', mcp[1]); req.url = '/api/mcp?' + url.searchParams; } }
    else if (url.pathname.startsWith('/api/')) apiName = url.pathname.slice(5).replace(/[^\w-]/g, '');
    if (apiName) {
      const mod = await import(pathToFileURL(path.join(root, 'api', apiName + '.js')).href + '?t=' + Date.now());
      return await mod.default(req, res);
    }
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root) || /^\/(\.data|node_modules|api)/.test(url.pathname)) { res.statusCode = 403; return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (!SPA.some((r) => r.test(url.pathname))) { res.statusCode = 404; return res.end('Not found'); }
      file = path.join(root, 'index.html');
    }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e); res.statusCode = 500; res.end(String(e.message));
  }
}).listen(PORT, () => console.log(`Spotter running on http://localhost:${PORT}`));
