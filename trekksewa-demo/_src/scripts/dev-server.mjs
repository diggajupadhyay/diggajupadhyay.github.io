#!/usr/bin/env node
// Local preview. Serves the repository root so the site sits under its folder name exactly as
// it does on GitHub Pages. `npm run dev` then open http://localhost:4173/trekksewa-demo/
// Pass --watch to rebuild whenever a source file changes.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { basename, dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(SRC, '..', '..');
const BASE = `/${basename(join(SRC, '..'))}/`; // the folder the site is published in
const PORT = Number(process.env.PORT || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.gpx': 'application/gpx+xml', '.ico': 'image/x-icon',
};

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') {
    res.writeHead(302, { Location: BASE });
    return res.end();
  }
  let file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end();
  }
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith('/')) {
      res.writeHead(301, { Location: path + '/' });
      return res.end();
    }
    file = join(file, 'index.html');
  }
  if (!existsSync(file)) {
    const notFound = join(ROOT, '404.html');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return existsSync(notFound) ? createReadStream(notFound).pipe(res) : res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`TrekkSewa preview: http://localhost:${PORT}${BASE}`));

if (process.argv.includes('--watch')) {
  let timer;
  let running = false;
  const rebuild = () => {
    if (running) return;
    running = true;
    const p = spawn(process.execPath, [join(SRC, 'build.mjs')], { stdio: 'inherit' });
    p.on('exit', () => {
      running = false;
    });
  };
  for (const dir of ['content', 'templates', 'lib', 'client', 'styles', 'static']) {
    watch(join(SRC, dir), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(rebuild, 150);
    });
  }
  rebuild();
}
