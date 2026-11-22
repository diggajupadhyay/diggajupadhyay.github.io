#!/usr/bin/env node
// Validates everything in content/ against the rules in content/SCHEMA.md.
// Usage: node scripts/validate-content.mjs [--only <substring>] [--quiet]
// Exits 1 when there is at least one error. Warnings never fail the run.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const quiet = args.includes('--quiet');

const PLACE_TYPES = ['city', 'town', 'village', 'settlement', 'camp', 'base-camp', 'pass', 'peak', 'viewpoint', 'lake', 'monastery', 'trailhead', 'airstrip'];
const FACILITIES = ['lodges', 'camping', 'homestays', 'shops', 'atm', 'bank', 'health-post', 'hospital', 'pharmacy', 'rescue-post', 'wifi', 'charging', 'hot-shower', 'bakery', 'gear-shops', 'permit-check', 'police', 'airstrip', 'helipad', 'bus', 'jeep', 'monastery', 'viewpoint'];
const DIFFICULTY = ['easy', 'moderate', 'challenging', 'strenuous'];
const STYLES = ['teahouse', 'camping', 'homestay'];
const KINDS = ['trek', 'acclimatization', 'rest', 'pass', 'summit', 'transfer', 'buffer'];
const MODES = ['walk', 'flight', 'drive', 'jeep', 'bus'];
const ACCESS_MODES = ['flight', 'bus', 'jeep', 'drive'];
const GUIDE_RULES = ['required', 'strongly-recommended', 'optional'];
const CONFIDENCE = ['high', 'medium', 'low'];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DEVANAGARI = /^[ऀ-ॿ‌‍\s().-]+$/;
// Generous box around Nepal; catches swapped or mistyped coordinates.
const BBOX = { latMin: 26.3, latMax: 30.5, lonMin: 80.0, lonMax: 88.25 };

const problems = []; // { file, level, msg }
const err = (file, msg) => problems.push({ file, level: 'error', msg });
const warn = (file, msg) => problems.push({ file, level: 'warn', msg });

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    err(rel(file), `not valid JSON: ${e.message}`);
    return null;
  }
}
const rel = (file) => file.replace(root + '/', '');
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- regions & permits ----------
const regions = readJson(join(root, 'regions.json')) || [];
const regionSlugs = new Set(regions.map((r) => r.slug));
const permitsDoc = readJson(join(root, 'permits.json')) || { permits: [] };
const permitIds = new Set(permitsDoc.permits.map((p) => p.id));
{
  const seen = new Set();
  for (const p of permitsDoc.permits) {
    if (!isStr(p.id) || !SLUG.test(p.id)) err('permits.json', `bad permit id "${p.id}"`);
    if (seen.has(p.id)) err('permits.json', `duplicate permit id "${p.id}"`);
    seen.add(p.id);
    for (const f of ['name', 'short', 'kind', 'authority', 'where']) if (!isStr(p[f])) err('permits.json', `${p.id}: missing "${f}"`);
    if (!Array.isArray(p.fees) || p.fees.length === 0) err('permits.json', `${p.id}: needs at least one fee`);
  }
}

// ---------- places ----------
const places = new Map(); // slug -> place (+ _file)
const placesDir = join(root, 'places');
for (const name of readdirSync(placesDir).filter((f) => f.endsWith('.json')).sort()) {
  const file = join(placesDir, name);
  const list = readJson(file);
  const f = rel(file);
  if (!list) continue;
  if (!Array.isArray(list)) {
    err(f, 'must be a JSON array of places');
    continue;
  }
  for (const p of list) {
    const id = p && p.slug ? p.slug : '(no slug)';
    const e = (m) => err(f, `${id}: ${m}`);
    const w = (m) => warn(f, `${id}: ${m}`);
    if (!p || typeof p !== 'object') { err(f, 'entry is not an object'); continue; }
    if (!isStr(p.slug) || !SLUG.test(p.slug)) { e('slug must be lowercase kebab-case'); continue; }
    if (places.has(p.slug)) e(`duplicate slug (already defined in ${places.get(p.slug)._file})`);
    if (!isStr(p.name)) e('missing name');
    if (p.ne !== undefined && (!isStr(p.ne) || !DEVANAGARI.test(p.ne))) e('"ne" must be Devanagari text');
    if (p.aka !== undefined && (!Array.isArray(p.aka) || !p.aka.every(isStr))) e('"aka" must be an array of strings');
    if (!regionSlugs.has(p.region)) e(`unknown region "${p.region}"`);
    if (!PLACE_TYPES.includes(p.type)) e(`unknown type "${p.type}"`);
    if (!isInt(p.alt) || p.alt < 50 || p.alt > 8849) e(`alt must be an integer between 50 and 8849 (got ${p.alt})`);
    if (!isNum(p.lat) || !isNum(p.lon)) e('lat and lon must be numbers');
    else if (p.lat < BBOX.latMin || p.lat > BBOX.latMax || p.lon < BBOX.lonMin || p.lon > BBOX.lonMax) e(`coordinates ${p.lat}, ${p.lon} are outside Nepal (lat/lon swapped?)`);
    if (!['good', 'approx', 'uncertain'].includes(p.coordQuality)) e('coordQuality must be "good", "approx" or "uncertain"');
    if (p.coordSource !== undefined && !['osm', 'estimate', 'terrain-fit'].includes(p.coordSource)) e('coordSource must be "osm", "estimate" or "terrain-fit"');
    if (!isStr(p.blurb)) e('missing blurb');
    else if (p.blurb.length < 60 || p.blurb.length > 260) e(`blurb must be 60–260 characters (is ${p.blurb.length})`);
    if (p.facilities !== undefined) {
      if (!Array.isArray(p.facilities)) e('facilities must be an array');
      else for (const x of p.facilities) if (!FACILITIES.includes(x)) e(`unknown facility "${x}"`);
    }
    if (p.tip !== undefined && !isStr(p.tip)) e('tip must be a non-empty string');
    if (p.coordPinned !== undefined && p.coordPinned !== true) e('coordPinned can only be true (leave it out otherwise)');
    const known = ['slug', 'name', 'ne', 'aka', 'region', 'type', 'alt', 'lat', 'lon', 'coordQuality', 'coordSource', 'coordPinned', 'blurb', 'facilities', 'tip'];
    for (const k of Object.keys(p)) if (!known.includes(k)) w(`unknown field "${k}"`);
    places.set(p.slug, { ...p, _file: f });
  }
}

// ---------- treks ----------
const treksDir = join(root, 'treks');
const trekFiles = existsSync(treksDir) ? readdirSync(treksDir).filter((f) => f.endsWith('.json')).sort() : [];
const trekSlugs = new Set(trekFiles.map((f) => basename(f, '.json')));
const treks = [];

for (const name of trekFiles) {
  const file = join(treksDir, name);
  const t = readJson(file);
  const f = rel(file);
  if (!t) continue;
  treks.push(t);
  const e = (m) => err(f, m);
  const w = (m) => warn(f, m);
  const place = (slug, what) => {
    if (!isStr(slug)) { e(`${what}: missing place slug`); return null; }
    const p = places.get(slug);
    if (!p) e(`${what}: unknown place "${slug}"`);
    return p || null;
  };

  if (t.slug !== basename(name, '.json')) e(`slug "${t.slug}" must match the file name`);
  if (!isStr(t.name)) e('missing name');
  if (t.aka !== undefined && (!Array.isArray(t.aka) || !t.aka.every(isStr))) e('"aka" must be an array of strings');
  if (!regionSlugs.has(t.region)) e(`unknown region "${t.region}"`);
  if (!isStr(t.tagline)) e('missing tagline');
  else {
    if (t.tagline.length > 80) e(`tagline must be ≤ 80 characters (is ${t.tagline.length})`);
    if (/[.!]$/.test(t.tagline)) e('tagline must not end with punctuation');
  }
  if (!isStr(t.summary)) e('missing summary');
  else if (t.summary.length < 90 || t.summary.length > 200) e(`summary must be 90–200 characters (is ${t.summary.length})`);
  if (!Array.isArray(t.intro) || t.intro.length < 2 || t.intro.length > 3) e('intro must be an array of 2–3 paragraphs');
  else t.intro.forEach((p, i) => {
    if (!isStr(p) || p.length < 250 || p.length > 700) e(`intro paragraph ${i + 1} must be 250–700 characters (is ${isStr(p) ? p.length : 0})`);
  });
  if (!Array.isArray(t.itinerary) || t.itinerary.length === 0) { e('missing itinerary'); continue; }
  if (t.days !== t.itinerary.length) e(`days (${t.days}) must equal the number of itinerary entries (${t.itinerary.length})`);
  if (!Array.isArray(t.daysRange) || t.daysRange.length !== 2 || !t.daysRange.every(isInt) || t.daysRange[0] > t.daysRange[1]) e('daysRange must be [min, max]');
  else if (t.days < t.daysRange[0] || t.days > t.daysRange[1]) e(`days (${t.days}) must fall inside daysRange [${t.daysRange}]`);
  if (!isNum(t.distanceKm) || t.distanceKm < 3 || t.distanceKm > 600) e('distanceKm must be a number between 3 and 600');
  if (!DIFFICULTY.includes(t.difficulty)) e(`difficulty must be one of ${DIFFICULTY.join(', ')}`);
  if (!isStr(t.difficultyNote)) e('missing difficultyNote');
  if (!Array.isArray(t.style) || t.style.length === 0 || !t.style.every((s) => STYLES.includes(s))) e(`style must be an array of ${STYLES.join(', ')}`);
  const startP = place(t.start, 'start');
  const endP = place(t.end, 'end');
  place(t.gateway, 'gateway');
  if (!t.access || !isStr(t.access.summary)) e('access.summary is required');
  if (t.access && t.access.options !== undefined) {
    if (!Array.isArray(t.access.options)) e('access.options must be an array');
    else t.access.options.forEach((o, i) => {
      if (!ACCESS_MODES.includes(o.mode)) e(`access.options[${i}].mode must be one of ${ACCESS_MODES.join(', ')}`);
      place(o.from, `access.options[${i}].from`);
      place(o.to, `access.options[${i}].to`);
      if (!isStr(o.time)) e(`access.options[${i}].time is required`);
    });
  }
  // seasons: each month exactly once
  if (!t.seasons || !['best', 'good', 'hard'].every((k) => Array.isArray(t.seasons[k]))) e('seasons needs best, good and hard arrays');
  else {
    const all = [...t.seasons.best, ...t.seasons.good, ...t.seasons.hard];
    const sorted = [...all].sort((a, b) => a - b).join(',');
    if (sorted !== '1,2,3,4,5,6,7,8,9,10,11,12') e(`seasons must list every month 1–12 exactly once (got ${sorted})`);
    if (!isStr(t.seasons.note)) e('seasons.note is required');
    if (t.seasons.best.length === 0) e('seasons.best must not be empty');
  }
  if (!Array.isArray(t.permits)) e('permits must be an array');
  else for (const id of t.permits) if (!permitIds.has(id)) e(`unknown permit id "${id}"`);
  if (!t.guide || !GUIDE_RULES.includes(t.guide.rule) || !isStr(t.guide.note)) e(`guide needs rule (${GUIDE_RULES.join(' | ')}) and note`);
  if (!Array.isArray(t.highlights) || t.highlights.length < 4 || t.highlights.length > 6 || !t.highlights.every(isStr)) e('highlights must have 4–6 strings');
  if (!Array.isArray(t.hazards) || t.hazards.length < 2 || t.hazards.length > 5 || !t.hazards.every((h) => h && isStr(h.title) && isStr(h.text))) e('hazards must have 2–5 { title, text } objects');
  if (!Array.isArray(t.tips) || t.tips.length < 3 || t.tips.length > 6 || !t.tips.every(isStr)) e('tips must have 3–6 strings');
  if (t.variants !== undefined && (!Array.isArray(t.variants) || !t.variants.every((v) => v && isStr(v.name) && isStr(v.text)))) e('variants must be { name, text } objects');
  if (t.related !== undefined) {
    if (!Array.isArray(t.related)) e('related must be an array');
    else for (const r of t.related) {
      if (r === t.slug) e('related must not include the trek itself');
      else if (!trekSlugs.has(r)) w(`related trek "${r}" does not exist (yet)`);
    }
  }
  if (!CONFIDENCE.includes(t.confidence)) e(`confidence must be one of ${CONFIDENCE.join(', ')}`);
  const knownTop = ['slug', 'name', 'aka', 'region', 'tagline', 'summary', 'intro', 'days', 'daysRange', 'distanceKm', 'maxAlt', 'difficulty', 'difficultyNote', 'style', 'start', 'end', 'gateway', 'access', 'seasons', 'permits', 'guide', 'highlights', 'itinerary', 'hazards', 'tips', 'variants', 'related', 'confidence'];
  for (const k of Object.keys(t)) if (!knownTop.includes(k)) w(`unknown field "${k}"`);

  // itinerary
  let highest = 0;
  let prevTo = null;
  let prevSleep = null;
  t.itinerary.forEach((d, i) => {
    const tag = `day ${d.day ?? i + 1}`;
    if (d.day !== i + 1) e(`${tag}: day numbers must run 1..n without gaps (expected ${i + 1})`);
    if (!isStr(d.title)) e(`${tag}: missing title`);
    else if (d.title.length > 70) e(`${tag}: title must be ≤ 70 characters (is ${d.title.length})`);
    const from = place(d.from, `${tag} from`);
    const to = place(d.to, `${tag} to`);
    if (prevTo !== null && d.from !== prevTo) e(`${tag}: "from" (${d.from}) must equal the previous day's "to" (${prevTo})`);
    prevTo = d.to;
    const via = [];
    if (d.via !== undefined) {
      if (!Array.isArray(d.via) || d.via.length === 0 || d.via.length > 4) e(`${tag}: via must list 1–4 place slugs`);
      else for (const v of d.via) { const p = place(v, `${tag} via`); if (p) via.push(p); }
    }
    if (!isInt(d.sleep)) e(`${tag}: sleep altitude is required`);
    else if (to && Math.abs(d.sleep - to.alt) > 60) e(`${tag}: sleep ${d.sleep} m does not match ${to.slug} (${to.alt} m)`);
    if (!KINDS.includes(d.kind)) e(`${tag}: kind must be one of ${KINDS.join(', ')}`);
    const mode = d.mode ?? 'walk';
    if (!MODES.includes(mode)) e(`${tag}: mode must be one of ${MODES.join(', ')}`);
    if (!Array.isArray(d.hours) || d.hours.length !== 2 || !d.hours.every(isNum) || d.hours[0] <= 0 || d.hours[0] > d.hours[1] || d.hours[1] > 14) e(`${tag}: hours must be [min, max] with 0 < min ≤ max ≤ 14`);
    if (d.km !== undefined && (!isNum(d.km) || d.km <= 0 || d.km > 45)) e(`${tag}: km must be between 0 and 45`);
    if (!isStr(d.note)) e(`${tag}: missing note`);
    else if (d.note.length < 60 || d.note.length > 320) e(`${tag}: note must be 60–320 characters (is ${d.note.length})`);
    const ends = [from, to].filter(Boolean).map((p) => p.alt);
    const viaMax = via.length ? Math.max(...via.map((p) => p.alt)) : 0;
    if (d.high !== undefined) {
      if (!isInt(d.high)) e(`${tag}: high must be an integer`);
      else {
        if (ends.length && d.high <= Math.max(...ends)) e(`${tag}: high (${d.high}) must be above both ends of the day`);
        if (via.length && Math.abs(d.high - viaMax) > 80 && viaMax > Math.max(...ends, 0)) w(`${tag}: high (${d.high}) differs from the highest via point (${viaMax})`);
      }
    } else if (via.length && ends.length && viaMax > Math.max(...ends) + 60) {
      e(`${tag}: via point at ${viaMax} m is above both ends — add "high": ${viaMax}`);
    }
    highest = Math.max(highest, d.high ?? 0, ...ends, viaMax);

    // geographic sanity for walking days
    if (mode === 'walk' && from && to) {
      const pts = [from, ...via, to];
      let straight = 0;
      for (let k = 1; k < pts.length; k++) straight += haversineKm(pts[k - 1], pts[k]);
      const approx = pts.some((p) => p.coordQuality !== 'good');
      const slack = pts.some((p) => p.coordQuality === 'uncertain') ? 6 : approx ? 3 : 1.2;
      if (d.km !== undefined && straight > d.km * 1.08 + slack) e(`${tag}: straight-line distance through the listed points is ${straight.toFixed(1)} km but km says ${d.km} — check coordinates or km`);
      if (d.km === undefined && straight > 32) e(`${tag}: ${straight.toFixed(1)} km in a straight line is too far for one walking day — check coordinates`);
      if (d.km !== undefined && d.from !== d.to && straight > 0.5 && d.km > straight * 4.5 + 6) w(`${tag}: km (${d.km}) is much longer than the straight-line distance (${straight.toFixed(1)} km)`);
      const maxH = d.hours?.[1] ?? 0;
      if (d.km !== undefined && maxH > 0 && d.km / maxH > 5.5) w(`${tag}: ${d.km} km in ${maxH} h is unusually fast for mountain walking`);
      // gain check
      if (prevSleep !== null && isInt(d.sleep) && d.sleep > 3000 && d.sleep - prevSleep > 900) w(`${tag}: sleeping altitude rises ${d.sleep - prevSleep} m in one day above 3,000 m`);
    }
    if (isInt(d.sleep)) prevSleep = d.sleep;
    const knownDay = ['day', 'title', 'from', 'to', 'via', 'sleep', 'high', 'hours', 'km', 'kind', 'mode', 'note'];
    for (const k of Object.keys(d)) if (!knownDay.includes(k)) w(`${tag}: unknown field "${k}"`);
  });

  const first = t.itinerary[0];
  const last = t.itinerary[t.itinerary.length - 1];
  if (first && startP && ![t.start, t.gateway].includes(first.from)) e(`day 1 must start from the trek start (${t.start}) or the gateway (${t.gateway})`);
  if (last && endP && ![t.end, t.gateway].includes(last.to)) e(`the last day must end at the trek end (${t.end}) or the gateway (${t.gateway})`);

  if (!t.maxAlt || !isInt(t.maxAlt.m)) e('maxAlt.m is required');
  else {
    const mp = place(t.maxAlt.place, 'maxAlt.place');
    if (mp && Math.abs(mp.alt - t.maxAlt.m) > 60) e(`maxAlt.m (${t.maxAlt.m}) does not match ${mp.slug} (${mp.alt} m)`);
    if (highest > t.maxAlt.m + 60) e(`itinerary reaches ${highest} m, above maxAlt.m (${t.maxAlt.m})`);
    if (highest < t.maxAlt.m - 60) e(`maxAlt.m is ${t.maxAlt.m} but the itinerary only reaches ${highest} m — add the high point as a via/high`);
  }
}

// places that no trek uses are fine, but worth knowing about
const used = new Set();
for (const t of treks) {
  for (const s of [t.start, t.end, t.gateway, t.maxAlt?.place]) used.add(s);
  for (const d of t.itinerary || []) { used.add(d.from); used.add(d.to); (d.via || []).forEach((v) => used.add(v)); }
  for (const o of t.access?.options || []) { used.add(o.from); used.add(o.to); }
}
for (const r of regions) for (const g of r.gateways || []) if (!places.has(g)) warn('regions.json', `${r.slug}: gateway "${g}" is not defined in places/ (yet)`);

// ---------- photographs ----------
// A photograph is only used when its licence allows it and the credit is complete, so every
// gap here is an error, not a warning.
const photosFile = join(root, 'photos.json');
if (existsSync(photosFile)) {
  const doc = readJson(photosFile) || {};
  const photoDir = join(root, '..', 'static', 'photos');
  const FREE = /^(CC0|CC BY(-SA)? [1-4]\.\d|Public domain)/i;
  const entries = Object.entries(doc.photos || {});
  for (const [key, p] of entries) {
    const e = (m) => err('photos.json', `${key}: ${m}`);
    if (!p || typeof p !== 'object') { e('entry is not an object'); continue; }
    for (const f of ['file', 'small', 'alt', 'caption', 'author', 'licence', 'licenceUrl', 'source']) if (!isStr(p[f])) e(`missing "${f}"`);
    for (const f of ['file', 'small']) if (isStr(p[f]) && !existsSync(join(photoDir, p[f]))) e(`static/photos/${p[f]} does not exist`);
    if (!isInt(p.width) || !isInt(p.height) || p.width < 600 || p.height < 300) e('needs "width" and "height" in pixels');
    if (isStr(p.licence) && !FREE.test(p.licence)) e(`licence "${p.licence}" is not one that allows reuse with credit (CC0, CC BY, CC BY-SA or public domain)`);
    for (const f of ['licenceUrl', 'source']) if (isStr(p[f]) && !/^https:\/\//.test(p[f])) e(`"${f}" must be an https address`);
    if (isStr(p.focus) && !/^\d{1,3}% \d{1,3}%$/.test(p.focus)) e(`"focus" should look like "50% 40%"`);
    const isRegion = key.startsWith('region-') && regionSlugs.has(key.slice(7));
    if (!trekSlugs.has(key) && !isRegion && !(doc.home || []).includes(key) && !Object.values(doc.regions || {}).includes(key)) warn('photos.json', `${key}: is not a trek, a region or a home picture, so nothing shows it`);
  }
  for (const [slug, key] of Object.entries(doc.regions || {})) {
    if (!regionSlugs.has(slug)) err('photos.json', `regions: "${slug}" is not a region`);
    if (!(doc.photos || {})[key]) err('photos.json', `regions.${slug}: no photo called "${key}"`);
  }
  for (const key of doc.home || []) if (!(doc.photos || {})[key]) err('photos.json', `home: no photo called "${key}"`);
  if (entries.length && !/^\d{4}-\d{2}-\d{2}$/.test(doc.checked || '')) err('photos.json', 'needs "checked": the day the licences were read, as YYYY-MM-DD');
}

// ---------- report ----------
const shown = problems.filter((p) => !only || p.file.includes(only));
const errors = shown.filter((p) => p.level === 'error');
const warnings = shown.filter((p) => p.level === 'warn');
const byFile = new Map();
for (const p of shown) {
  if (!byFile.has(p.file)) byFile.set(p.file, []);
  byFile.get(p.file).push(p);
}
for (const [file, list] of byFile) {
  const errs = list.filter((p) => p.level === 'error');
  const warns = list.filter((p) => p.level === 'warn');
  if (quiet && errs.length === 0) continue;
  console.log(`\n${file}`);
  for (const p of errs) console.log(`  ✖ ${p.msg}`);
  if (!quiet) for (const p of warns) console.log(`  ⚠ ${p.msg}`);
}
const unused = [...places.keys()].filter((s) => !used.has(s));
console.log(`\n${treks.length} treks, ${places.size} places (${unused.length} not on any itinerary), ${permitIds.size} permits`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s)${only ? ` in files matching "${only}"` : ''}`);
process.exit(errors.length ? 1 : 0);
