#!/usr/bin/env node
// Builds the TrekkSewa site: reads content/, bundles CSS and JS with esbuild, renders every
// page to static HTML and writes the result into the parent directory (the folder GitHub
// Pages serves). Run with `npm run build`. Flags: --strict (fail on any content problem).

import { build as esbuild } from 'esbuild';
import { marked } from 'marked';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, relative, sep, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from './lib/content.mjs';
import { layout, makeCtx } from './templates/layout.mjs';
import { allPages } from './templates/pages.mjs';
import { buildData } from './lib/data.mjs';
import { routeGpx } from './lib/gpx.mjs';
import { spriteSvg, SPRITE_TOKEN } from './lib/icons.mjs';

const SRC = dirname(fileURLToPath(import.meta.url));
const OUT = join(SRC, '..');
const MANIFEST = join(SRC, '.build-files.json');
const strict = process.argv.includes('--strict');
const started = Date.now();

const config = JSON.parse(readFileSync(join(SRC, 'site.config.json'), 'utf8'));
// Optional, uncommitted overrides for local testing (for example a staging backend).
const localConfig = join(SRC, 'site.config.local.json');
if (existsSync(localConfig)) {
  const local = JSON.parse(readFileSync(localConfig, 'utf8'));
  for (const [k, v] of Object.entries(local)) config[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...config[k], ...v } : v;
  console.log('Using overrides from site.config.local.json');
}
const written = new Map(); // relative path -> content hash
const sha = (buf) => createHash('sha1').update(buf).digest('hex');
const posix = (p) => p.split(sep).join('/');

function emit(relPath, content) {
  const file = join(OUT, relPath);
  const buf = typeof content === 'string' ? Buffer.from(content) : content;
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file) || !readFileSync(file).equals(buf)) writeFileSync(file, buf);
  written.set(posix(relPath), sha(buf));
}

// ---------------------------------------------------------------- content
const content = loadContent(join(SRC, 'content'), { strict, featured: config.featuredTreks || [] });
const readJson = (name, fallback) => {
  const f = join(SRC, 'content', name);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback;
};
content.seasons = readJson('seasons.json', []);
content.gear = readJson('gear.json', { categories: [] });
content.faq = readJson('faq.json', []);
content.conditions = readJson('conditions.json', {});
content.packing = readJson('packing.json', { groups: [] });
content.notices = readJson('notices.json', []);

// Journal articles: Markdown files with a small "key: value" header between --- lines.
content.articles = [];
const articlesDir = join(SRC, 'content', 'articles');
if (existsSync(articlesDir)) {
  for (const file of readdirSync(articlesDir).filter((f) => f.endsWith('.md')).sort()) {
    const text = readFileSync(join(articlesDir, file), 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) {
      content.warnings.push(`articles/${file}: missing front matter, skipped`);
      continue;
    }
    const meta = Object.fromEntries(m[1].split('\n').filter((l) => l.includes(':')).map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
    const words = m[2].split(/\s+/).length;
    content.articles.push({
      slug: basename(file, '.md'),
      title: meta.title,
      summary: meta.summary,
      tags: (meta.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
      reviewed: meta.reviewed,
      order: Number(meta.order) || 0,
      minutes: Math.max(2, Math.round(words / 220)),
      html: marked.parse(m[2], { mangle: false, headerIds: false }),
    });
  }
  content.articles.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

// ---------------------------------------------------------------- assets
const darkAuto = {
  name: 'dark-auto',
  setup(b) {
    // dark.css is written once for the theme toggle; this emits the same rules for
    // visitors whose system is in dark mode and who have not chosen a theme.
    b.onResolve({ filter: /dark-auto\.css$/ }, (a) => ({ path: join(a.resolveDir, 'dark.css'), namespace: 'dark-auto' }));
    b.onLoad({ filter: /.*/, namespace: 'dark-auto' }, (a) => {
      const body = readFileSync(a.path, 'utf8').replace(/:root\[data-theme='dark'\]/g, ":root:not([data-theme='light'])");
      return { contents: `@media (prefers-color-scheme: dark) {\n${body}\n}`, loader: 'css', resolveDir: dirname(a.path) };
    });
  },
};

const common = { absWorkingDir: SRC, bundle: true, minify: true, metafile: true, write: false, logLevel: 'warning', legalComments: 'none' };
const cssResult = await esbuild({
  ...common,
  entryPoints: { app: 'styles/app.css', map: 'styles/map.css' },
  outdir: join(OUT, 'assets'),
  entryNames: '[name]-[hash]',
  assetNames: 'media/[name]-[hash]',
  loader: { '.woff2': 'file', '.png': 'file', '.svg': 'file' },
  target: ['chrome90', 'firefox90', 'safari14'],
  plugins: [darkAuto],
});
const pageEntries = Object.fromEntries(
  readdirSync(join(SRC, 'client', 'pages'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => [basename(f, '.js'), `client/pages/${f}`]),
);
const jsResult = await esbuild({
  ...common,
  entryPoints: { main: 'client/main.js', ...pageEntries },
  outdir: join(OUT, 'assets', 'js'),
  entryNames: '[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  format: 'esm',
  splitting: true,
  target: ['es2020'],
  loader: { '.png': 'file', '.svg': 'text' },
  assetNames: '../media/[name]-[hash]',
  // only the public backend settings reach the browser; never put a service-role key in the config
  define: {
    __BACKEND__: JSON.stringify({ provider: config.backend?.provider || 'none', supabaseUrl: config.backend?.supabaseUrl || '', supabaseAnonKey: config.backend?.supabaseAnonKey || '' }),
    // where a trekker's request for help goes when there is no database: WhatsApp first, then email
    __CONTACT__: JSON.stringify({ email: config.contact?.email || '', whatsapp: config.contact?.whatsapp || '' }),
  },
});

const assets = { css: '', styles: {}, js: {}, fonts: [], all: [] };
for (const result of [cssResult, jsResult]) {
  for (const file of result.outputFiles) {
    const rel = posix(relative(OUT, file.path));
    emit(rel, Buffer.from(file.contents));
    assets.all.push(rel);
  }
  for (const [outPath, meta] of Object.entries(result.metafile.outputs)) {
    if (!meta.entryPoint) continue;
    const rel = posix(relative(OUT, join(SRC, outPath)));
    const name = basename(meta.entryPoint, extname(meta.entryPoint));
    if (rel.endsWith('.css')) {
      if (name === 'app') assets.css = rel;
      else assets.styles[name] = rel;
    } else if (rel.endsWith('.js')) assets.js[name] = rel;
  }
}
assets.fonts = assets.all.filter((f) => f.endsWith('.woff2'));

// ---------------------------------------------------------------- static files
function copyDir(from, to) {
  if (!existsSync(from)) return;
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    if (statSync(src).isDirectory()) copyDir(src, join(to, name));
    else emit(posix(relative(OUT, join(to, name))), readFileSync(src));
  }
}
copyDir(join(SRC, 'static'), OUT);
assets.favicon = 'assets/img/favicon.svg';
assets.icon192 = 'assets/img/icon-192.png';
assets.icon512 = 'assets/img/icon-512.png';
assets.iconMaskable = 'assets/img/icon-maskable-512.png';
assets.appleIcon = 'assets/img/apple-touch-icon.png';
assets.og = 'assets/img/og.png';

// ---------------------------------------------------------------- pages
const shared = { config, assets, content };
const pages = allPages(shared);
const sitemap = [];
const rendered = [];
for (const { path, render } of pages) {
  const ctx = makeCtx(path, shared);
  const page = render(ctx);
  const file = path.endsWith('.html') ? path : `${path}index.html`;
  rendered.push({ file, root: ctx.root, html: layout(ctx, page) });
  if (!page.noindex) sitemap.push({ path, priority: page.priority ?? (path === '' ? 1 : path.split('/').length <= 2 ? 0.8 : 0.6) });
}
// Every icon used above goes into one sprite file; pages only point at it.
const sprite = spriteSvg();
assets.icons = `assets/icons-${sha(sprite).slice(0, 8)}.svg`;
emit(assets.icons, sprite);
assets.all.push(assets.icons);
for (const r of rendered) emit(r.file, r.html.replaceAll(SPRITE_TOKEN, r.root + assets.icons));

// ---------------------------------------------------------------- data, sitemap, manifest
for (const [file, data] of Object.entries(buildData(shared, pages))) emit(file, JSON.stringify(data));

// A route file for each trek whose path is mapped: stops as waypoints, the footpath as a track.
for (const t of content.treks) {
  if (!t.trail.length) continue;
  emit(
    `treks/${t.slug}/${t.slug}.gpx`,
    routeGpx({
      name: `${t.name} (${config.name})`,
      desc: `Footpath geometry from OpenStreetMap contributors (Open Database Licence), ${content.sources.trails || ''}. A guide to where the route goes, not a survey: trails are rerouted after landslides. ${t.gaps.length ? 'Sections with no mapped path are left out.' : ''}`.trim(),
      link: `${config.siteUrl}/treks/${t.slug}/`,
      waypoints: t.mapPlaces.map((p) => ({ lat: p.lat, lon: p.lon, ele: p.alt, name: p.name, desc: `${p.alt} m` })),
      segments: t.trail,
    }),
  );
}

emit(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
    .map((p) => `  <url><loc>${config.siteUrl}/${p.path}</loc><priority>${p.priority}</priority></url>`)
    .join('\n')}\n</urlset>\n`,
);

emit(
  'manifest.webmanifest',
  JSON.stringify(
    {
      name: `${config.name} — ${config.strapline}`,
      short_name: config.name,
      description: config.description,
      lang: 'en',
      start_url: './?source=pwa',
      scope: './',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#fbf8f1',
      theme_color: config.themeColor.light,
      categories: ['travel', 'navigation', 'health'],
      icons: [
        { src: assets.icon192, sizes: '192x192', type: 'image/png' },
        { src: assets.icon512, sizes: '512x512', type: 'image/png' },
        { src: assets.iconMaskable, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Plan my trek', short_name: 'Plan', url: './plan/' },
        { name: 'Emergency & SOS', short_name: 'SOS', url: './safety/emergency/' },
        { name: 'Altitude sickness check', short_name: 'AMS check', url: './safety/altitude-check/' },
        { name: 'Find a trek', short_name: 'Treks', url: './treks/' },
      ],
    },
    null,
    2,
  ),
);

// ---------------------------------------------------------------- service worker
// Precache the shell and the safety tools so they open with no connection at all.
const precachePages = ['', 'offline/', 'plan/', 'safety/', 'safety/emergency/', 'safety/altitude-check/', 'safety/acclimatization/', 'safety/insurance/', 'saved/'].filter((p) => pages.some((x) => x.path === p));
const pageScripts = new Set(['main', 'home', 'plan', 'safety', 'emergency', 'ams', 'acclimatization', 'insurance', 'saved']);
const precacheAssets = assets.all.filter((f) => {
  if (f === assets.css || f === assets.icons || f.endsWith('.woff2')) return true;
  if (f.includes('/chunks/')) return !/leaflet|map/.test(f);
  const name = Object.entries(assets.js).find(([, v]) => v === f)?.[0];
  return name ? pageScripts.has(name) : false;
});
// the planner's questions and suggestions work with no signal; a chosen trek's details are kept once opened
const precache = [...precachePages.map((p) => `./${p}`), ...precacheAssets.map((a) => `./${a}`), `./${assets.favicon}`, `./${assets.icon192}`, './manifest.webmanifest', './data/treks.json', './data/plan.json'];
const version = sha([...written.entries()].sort().map(([k, v]) => `${k}:${v}`).join('\n')).slice(0, 10);
const sw = await esbuild({
  ...common,
  entryPoints: ['client/sw.js'],
  format: 'iife',
  target: ['es2020'],
  define: { __VERSION__: JSON.stringify(version), __PRECACHE__: JSON.stringify(precache) },
});
emit('sw.js', Buffer.from(sw.outputFiles[0].contents));

// ---------------------------------------------------------------- clean up stale output
let previous = [];
try {
  previous = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch {
  /* first build */
}
const now = [...written.keys()].sort();
const keep = new Set(now);
const dirs = new Set();
for (const rel of previous) {
  if (keep.has(rel) || rel.startsWith('_src/') || rel.includes('..')) continue;
  const file = join(OUT, rel);
  if (existsSync(file)) rmSync(file);
  dirs.add(dirname(file));
}
for (const dir of [...dirs].sort((a, b) => b.length - a.length)) {
  let d = dir;
  while (d.startsWith(OUT) && d !== OUT) {
    try {
      rmdirSync(d); // only succeeds when empty
    } catch {
      break;
    }
    d = dirname(d);
  }
}
writeFileSync(MANIFEST, JSON.stringify(now, null, 0) + '\n');

// ---------------------------------------------------------------- report
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const size = (f) => statSync(join(OUT, f)).size;
console.log(`TrekkSewa build ${version}`);
console.log(`  ${pages.length} pages · ${content.treks.length} treks · ${content.places.length} places · ${content.regions.length} regions`);
console.log(`  css ${kb(size(assets.css))} · main js ${kb(size(assets.js.main))} · fonts ${kb(assets.fonts.reduce((s, f) => s + size(f), 0))}`);
console.log(`  ${now.length} files in ${Date.now() - started} ms`);
if (content.warnings.length) {
  console.log(`\n  ${content.warnings.length} content warning(s):`);
  for (const w of content.warnings) console.log(`   - ${w}`);
}
