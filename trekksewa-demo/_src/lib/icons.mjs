// SVG icons from the lucide-static package (ISC licence).
//
// Pages do not carry the icon drawings themselves. Each icon is a tiny <svg><use> that points
// into one sprite file, which the browser downloads once and caches. The build collects the
// icons that were actually used, writes the sprite, and swaps SPRITE_TOKEN for its address.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { raw } from './html.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'lucide-static', 'icons');
const cache = new Map();
const used = new Set();

export const SPRITE_TOKEN = '%%ICON_SPRITE%%';

function inner(name) {
  if (cache.has(name)) return cache.get(name);
  const file = join(dir, `${name}.svg`);
  if (!existsSync(file)) throw new Error(`Unknown icon "${name}" (not in lucide-static)`);
  const svg = readFileSync(file, 'utf8');
  const body = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s*\n\s*/g, '')
    .trim();
  cache.set(name, body);
  return body;
}

/** icon('mountain') -> decorative icon; pass a label to make it meaningful to screen readers. */
export function icon(name, { size = 20, label = '', cls = '' } = {}) {
  inner(name); // fail the build early if the icon does not exist
  used.add(name);
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  // stroke, fill and line caps come from the `svg.icon` rule in base.css
  return raw(`<svg class="icon${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" ${a11y}><use href="${SPRITE_TOKEN}#${name}"/></svg>`);
}

/** The sprite file: one <symbol> per icon used anywhere on the site. */
export function spriteSvg() {
  const symbols = [...used].sort().map((name) => `<symbol id="${name}" viewBox="0 0 24 24">${inner(name)}</symbol>`);
  return `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>\n`;
}

/** Raw path markup for an icon, for use inside client-side templates. */
export const iconBody = (name) => inner(name);
