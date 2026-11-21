#!/usr/bin/env node
// Draws the favicon, app icons and the social-sharing image into static/assets/img/.
// Only needed when the logo or the brand colours change; the results are committed.
// Requires Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`).

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { heroLandscape } from '../lib/landscape.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(SRC, 'static', 'assets', 'img');
mkdirSync(OUT, { recursive: true });

const TEAL = '#0b5d5e';
const peaks = (a, b, sun) =>
  `<circle cx="47.5" cy="15.5" r="6.5" fill="${sun}"/>` +
  `<path d="M29.5 9.5c-1 0-1.9.5-2.5 1.4L4.600 50.4C3.4 52.5 4.9 55 7.3 55h20.200c1.700 0 3-1.3 3-3V11c0-.8-.4-1.5-1-1.5z" fill="${a}"/>` +
  `<path d="M35 24.5c0-1.5 1.9-2.1 2.8-.9l21 26.600c1.500 1.900.1 4.800-2.300 4.800H38c-1.700 0-3-1.300-3-3z" fill="${b}"/>`;

// scale = how much of the tile the mark fills; maskable icons keep it inside the safe zone
const tile = (scale, radius) => {
  const pad = (64 - 64 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${radius}" fill="${TEAL}"/><g transform="translate(${pad} ${pad + 0.5}) scale(${scale})">${peaks('#ffffff', '#a9dcd6', '#f1b540')}</g></svg>`;
};

writeFileSync(join(OUT, 'favicon.svg'), tile(0.72, 14));
writeFileSync(join(OUT, 'logo.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${peaks(TEAL, '#17898a', '#e9a31b')}</svg>`);

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function png(name, size, svg) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: join(OUT, name), omitBackground: true });
  console.log('wrote', name);
}
await png('icon-192.png', 192, tile(0.72, 14));
await png('icon-512.png', 512, tile(0.72, 14));
await png('icon-maskable-512.png', 512, tile(0.56, 0));
await png('apple-touch-icon.png', 180, tile(0.7, 0));

// ----- social image, 1200 × 630
const vars = `--sky-top:#fbf8f1;--sky-low:#f9ecd6;--sky-glow:#f6ddb8;--sun:#f1b540;--star:transparent;--haze:#f6e6cb;--snow:#fff;--ridge-far-top:#eef4f4;--ridge-far:#bcd3d7;--ridge-4:#97babd;--ridge-3:#5d999b;--ridge-2:#277073;--ridge-1:#0a4b4d;--chorten:#fbf7ec;--chorten-shade:#ddd5c1;--flag-line:#4d4036;--flag-blue:#2f6db5;--flag-white:#fdfbf4;--flag-red:#c2253a;--flag-green:#2f8f5b;--flag-yellow:#e9a31b`;
await page.setViewportSize({ width: 1200, height: 630 });
const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(join(SRC, 'node_modules', '@fontsource-variable', pkg, 'files', file)).toString('base64')}`;
await page.setContent(`<!doctype html><style>
  @font-face{font-family:F;src:url('${font('fraunces', 'fraunces-latin-wght-normal.woff2')}');font-weight:400 800}
  @font-face{font-family:FI;src:url('${font('fraunces', 'fraunces-latin-wght-italic.woff2')}');font-weight:400 800;font-style:italic}
  @font-face{font-family:G;src:url('${font('figtree', 'figtree-latin-wght-normal.woff2')}');font-weight:300 900}
  html,body{margin:0}
  body{width:1200px;height:630px;position:relative;overflow:hidden;background:#fbf8f1;${vars}}
  .art{position:absolute;inset:auto 0 0 0;height:400px}
  .art svg{width:100%;height:100%;display:block}
  .copy{position:absolute;left:72px;top:56px;right:72px}
  .brand{display:flex;align-items:center;gap:14px;font:650 40px/1 F;color:#16232b;letter-spacing:-.02em}
  .brand b{color:#0b5d5e;font-weight:inherit}
  .brand svg{width:52px;height:52px}
  h1{font:600 70px/1.04 F;letter-spacing:-.025em;color:#16232b;margin:38px 0 0;white-space:nowrap}
  h1 em{font:italic 500 70px/1.04 FI;color:#0b5d5e}
  p{font:500 28px/1.35 G;color:#3b4a53;margin:18px 0 0}
</style>
<div class="art">${heroLandscape({ seed: 11 })}</div>
<div class="copy">
  <div class="brand"><svg viewBox="0 0 64 64">${peaks(TEAL, '#17898a', '#e9a31b')}</svg><span>Trekk<b>Sewa</b></span></div>
  <h1>Trek Nepal, <em>well looked after</em></h1>
  <p>Route guides, altitude tools and trekking services for Nepal.</p>
</div>`);
await page.waitForTimeout(400);
await page.screenshot({ path: join(OUT, 'og.png') });
console.log('wrote og.png');
await browser.close();
