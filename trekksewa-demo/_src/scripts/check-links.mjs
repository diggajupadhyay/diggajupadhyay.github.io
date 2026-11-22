#!/usr/bin/env node
// Checks the built site for broken internal links, missing assets and missing #anchors.
// Run after `npm run build`. Exits 1 if anything is broken.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIP_DIRS = new Set(['_src', 'node_modules', '.git']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = walk(OUT);
const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    idCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idCache.get(file);
}

const problems = [];
let checked = 0;
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const rel = relative(OUT, file).split(sep).join('/');
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  for (const ref of new Set(refs)) {
    if (!ref || /^(https?:|mailto:|tel:|sms:|data:|javascript:)/i.test(ref)) continue;
    checked++;
    const [pathPart, hash] = ref.split('#');
    const path = pathPart.split('?')[0];
    let target = file;
    if (path) {
      target = resolve(dirname(file), decodeURIComponent(path));
      if (!target.startsWith(OUT)) {
        problems.push(`${rel}: link leaves the site: ${ref}`);
        continue;
      }
      if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
      if (!existsSync(target)) {
        problems.push(`${rel}: broken link ${ref}`);
        continue;
      }
    }
    if (hash && target.endsWith('.html') && !idsOf(target).has(decodeURIComponent(hash))) problems.push(`${rel}: missing anchor #${hash} in ${relative(OUT, target).split(sep).join('/')}`);
  }
}

console.log(`${pages.length} pages, ${checked} internal references checked`);
if (problems.length) {
  const shown = problems.slice(0, 60);
  for (const p of shown) console.log(`  ✖ ${p}`);
  if (problems.length > shown.length) console.log(`  … and ${problems.length - shown.length} more`);
  console.log(`${problems.length} problem(s)`);
  process.exit(1);
}
console.log('No broken links.');
