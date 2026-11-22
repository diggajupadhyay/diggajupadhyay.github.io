#!/usr/bin/env node
// Checks the coordinates in content/places/ against OpenStreetMap and a terrain model.
//
//   node scripts/verify-coordinates.mjs lookup    ask OpenStreetMap for every place by name (one request a second;
//                                                  add a number to stop after that many places)
//   node scripts/verify-coordinates.mjs lookup --unmatched   ask again about places the last report could not match
//   node scripts/verify-coordinates.mjs heights   terrain height at every estimate and every candidate
//   node scripts/verify-coordinates.mjs decide    weigh the evidence and write a report
//   node scripts/verify-coordinates.mjs apply     write the accepted positions into content/places/
//   node scripts/verify-coordinates.mjs fetch     lookup, heights and decide in one go
//   node scripts/verify-coordinates.mjs terrain   last resort for places OpenStreetMap does not know
//
// Every step keeps what it learns in scripts/.cache, so a step that is cut short (both services
// limit how much one address may ask in a day) can simply be run again.
//
// How a position is accepted:
//   1. Nominatim (OpenStreetMap's place-name search) is asked for the place by name, limited
//      to a box around our current estimate.
//   2. A result is only a candidate if its name really matches and it is the right kind of
//      thing: a village for a village, a saddle for a pass, never a shop or a district boundary.
//   3. A candidate's height has to agree with the altitude we state for the place. The height
//      comes from the terrain model (Open-Meteo elevation API, Copernicus 90 m) or, failing that,
//      from the elevation mapped in OpenStreetMap. That rules out a different village with the
//      same name, and markers on the wrong side of a valley.
//   4. A candidate with no height evidence is accepted only when name and position leave no
//      real doubt: it is close to an estimate that already fits the terrain, or it is the only
//      exact match anywhere near.
// A place with no acceptable match keeps our estimate, marked "approx". If the estimate also
// disagrees with the terrain, the place is marked "uncertain" and the site draws no pin for it.
// A place with "coordPinned": true was corrected by hand and is left exactly as it is.
//
// Coordinates taken from OpenStreetMap are © OpenStreetMap contributors (ODbL).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineKm } from '../lib/geo.mjs';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLACES = join(SRC, 'content', 'places');
const CACHE_DIR = join(SRC, 'scripts', '.cache');
const LOOKUPS = join(CACHE_DIR, 'osm-lookups.json');
const TILE_LOOKUPS = join(CACHE_DIR, 'osm-tile-lookups.json'); // written by scripts/osm/extract.mjs candidates
const HEIGHTS = join(CACHE_DIR, 'terrain-base.json');
const SAMPLES = join(CACHE_DIR, 'terrain-samples.json');
const REPORT = join(CACHE_DIR, 'coordinate-report.json');
const UA = 'trek-gazetteer-check/0.2 (one-off coordinate verification)';
const mode = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
const saveJson = (file, value) => {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(value));
};

/**
 * Everything OpenStreetMap offered for each place, from both routes: the name search
 * (Nominatim) and the named features read straight from map tiles around the estimate.
 */
function allLookups() {
  const byName = readJson(LOOKUPS, {});
  const byTile = readJson(TILE_LOOKUPS, {});
  const out = {};
  for (const slug of new Set([...Object.keys(byName), ...Object.keys(byTile)])) out[slug] = [...(byName[slug] || []), ...(byTile[slug] || [])];
  return out;
}

const HIGH = new Set(['pass', 'peak', 'viewpoint']); // the terrain model smooths ridges and summits
const limitFor = (type) => (HIGH.has(type) ? 400 : 220);
const heightKey = (c) => `${Number(c.lat)},${Number(c.lon)}`;

function loadPlaces() {
  const out = [];
  for (const file of readdirSync(PLACES).filter((f) => f.endsWith('.json')).sort()) {
    for (const p of JSON.parse(readFileSync(join(PLACES, file), 'utf8'))) out.push({ ...p, _file: file });
  }
  return out;
}

function curlJson(url) {
  const body = execFileSync('curl', ['-sS', '-m', '40', '-A', UA, '-H', 'Accept-Language: en', url], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(body);
}

// ------------------------------------------------------------------ names

const plain = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(?\b\d[\d,.]*\s*m?\b\)?/g, ' '); // heights written into a name: "Deurali (3200)", "Tiplyang 1,040m"
const squash = (s) => s.replace(/[^a-z0-9]/g, '');
/** The whole name, letters only: "Yak Kharka" -> "yakkharka". */
const full = (s) => squash(plain(s));
// words that say what kind of thing a place is, not which one
const GENERIC = /\b(village|gaun|gaon|bazaar|bazar|pass|viewpoint|view point|hotel|lodge|guest ?house|lake|tal|base camp|camp|danda|peak|kharka|phedi|bhanjyang|gompa|gumba|monastery)\b/g;
// kind-words that mean the same thing
const FAMILY = { village: 'settle', gaun: 'settle', gaon: 'settle', bazaar: 'settle', bazar: 'settle', gompa: 'monastery', gumba: 'monastery', hotel: 'lodge', guesthouse: 'lodge', 'guest house': 'lodge', tal: 'lake', 'view point': 'viewpoint' };
const kindWords = (s) => new Set((plain(s).match(GENERIC) || []).map((w) => FAMILY[w] || w));
/** The distinctive part of a name: "Namche Bazaar" -> "namche". Empty when nothing distinctive is left. */
const core = (s) => squash(plain(s).replace(GENERIC, ' '));
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const ourNames = (place) => [place.name, ...(place.aka || [])];
/** Does a map feature carry exactly one of our names, kind-word and all? */
function sameFullName(place, osmNames) {
  const mine = new Set(ourNames(place).map(full).filter(Boolean));
  return osmNames.some((n) => (place.ne && n.trim() === place.ne.trim()) || mine.has(full(n)));
}
/**
 * 0..1: how well any of a map feature's names matches one of ours.
 * Whole names are compared first. The distinctive parts are compared only when both are at
 * least five letters long, so "Danda Kharka" never matches "Thule Kharka" on "kharka" alone
 * and "Yak Kharka" never matches "Yak Hotel" on "yak".
 */
function similarity(place, osmNames) {
  if (sameFullName(place, osmNames)) return 1;
  let best = 0;
  for (const raw of osmNames) {
    const bf = full(raw);
    const bc = core(raw);
    for (const n of ourNames(place)) {
      const af = full(n);
      const ac = core(n);
      if (!af || !bf) continue;
      if (ac && ac === bc) {
        // a short shared core counts only with the same kind-word ("Luri Gompa" and "Luri Gompa
        // Monastery"), or when the only extra word is village or bazaar ("Yara" and "Yara Gaon")
        const ka = kindWords(n);
        const kb = kindWords(raw);
        if (ac.length >= 5 || [...ka].some((k) => kb.has(k)) || [...ka, ...kb].every((k) => k === 'settle')) best = 1;
      } else if (ac.length >= 5 && bc.length >= 5) {
        if ((ac.includes(bc) || bc.includes(ac)) && Math.min(ac.length, bc.length) * 2 >= Math.max(ac.length, bc.length)) best = Math.max(best, 0.85);
        else if (lev(ac, bc) <= 1) best = Math.max(best, 0.8);
        else if (ac.length >= 7 && lev(ac, bc) <= 2) best = Math.max(best, 0.7);
      }
      if (af.length >= 5 && bf.length >= 4 && lev(af, bf) <= 1) best = Math.max(best, 0.8);
      else if (af.length >= 7 && lev(af, bf) <= 2) best = Math.max(best, 0.7);
    }
  }
  return best;
}

// ------------------------------------------------------------------ kinds of map feature

const HUTS = new Set(['camp_site', 'alpine_hut', 'wilderness_hut']);
const LODGING = new Set(['guest_house', 'hotel', 'hostel', 'chalet', 'motel']);
function featureClass(c) {
  if (c.category === 'place') return 'settlement';
  if (c.category === 'landuse' && c.type === 'residential') return 'built-up'; // a village drawn as an outline
  if (c.category === 'tourism' && HUTS.has(c.type)) return 'camp';
  if (c.category === 'tourism' && LODGING.has(c.type)) return 'landmark';
  if (c.category === 'amenity' && ['restaurant', 'cafe', 'shelter', 'bus_station'].includes(c.type)) return 'landmark'; // a teahouse or bus stop named after the place
  if (c.category === 'highway' && c.type === 'bus_stop') return 'landmark';
  if (c.category === 'boundary' && c.type === 'administrative') return 'admin';
  if (c.category === 'tourism' && c.type === 'viewpoint') return 'summit';
  if (c.category === 'natural' && ['peak', 'hill', 'ridge', 'volcano'].includes(c.type)) return 'summit';
  if (c.category === 'natural' && c.type === 'saddle') return 'pass';
  if (c.category === 'mountain_pass') return 'pass';
  if ((c.category === 'natural' && c.type === 'water') || c.category === 'water') return 'water';
  if (c.category === 'amenity' && ['place_of_worship', 'monastery'].includes(c.type)) return 'worship';
  if (c.category === 'historic') return 'worship';
  if (c.category === 'aeroway') return 'air';
  return 'other';
}
// which kinds of map feature may stand for each kind of place, strongest first
const ALLOWED = {
  village: ['settlement', 'built-up', 'camp', 'landmark'],
  town: ['settlement', 'built-up', 'admin'],
  city: ['settlement', 'admin'],
  trailhead: ['settlement', 'built-up', 'camp', 'landmark'],
  settlement: ['settlement', 'built-up', 'camp', 'landmark'],
  camp: ['camp', 'settlement', 'landmark'],
  'base-camp': ['camp', 'settlement', 'built-up', 'landmark'],
  viewpoint: ['summit', 'settlement', 'landmark'],
  peak: ['summit'],
  pass: ['pass', 'settlement'],
  lake: ['water', 'settlement'],
  monastery: ['worship', 'settlement'],
  airstrip: ['air', 'settlement'],
};
// A lodge, teahouse or bus stop that carries a place's name shows roughly where the place is,
// but only beside our own estimate: on its own it is never proof ("Hotel Annapurna" stands in
// a dozen towns).
const WEAK = new Set(['landmark']);

/** Mappers in Nepal often write the height into the name: "Deurali (3200)", "Khopra Danda 3600m". */
function heightInNames(names) {
  for (const n of names) {
    const m = /\((\d,?\d{3}|\d{3})\s*m?\)/.exec(n) || /\b(\d,?\d{3}|\d{3})\s*m\b/i.exec(n);
    const v = m ? Number(m[1].replace(',', '')) : 0;
    if (v >= 300 && v < 9000) return v;
  }
  return null;
}

/** The candidates worth weighing for one place, best name match first. */
function candidatesFor(place, lookups) {
  const allowed = ALLOWED[place.type] || ['settlement'];
  const seen = new Map();
  for (const raw of lookups[place.slug] || []) {
    const c = { lat: Number(Number(raw.lat).toFixed(5)), lon: Number(Number(raw.lon).toFixed(5)), name: raw.names[0] || '', category: raw.category, type: raw.type, ele: raw.ele ?? heightInNames(raw.names) };
    c.kind = featureClass(c);
    c.sim = similarity(place, raw.names);
    c.km = haversineKm(place, c);
    if (c.sim < 0.7 || c.km > 25 || !allowed.includes(c.kind)) continue;
    if (c.type === 'peak' && c.sim < 1) continue; // "Phoksundo Ri" is not the Phoksundo viewpoint
    if (c.kind === 'landmark' && allowed[0] !== 'settlement' && c.sim < 1) continue; // nor is a hotel with "view point" in its name
    // a village may stand for a viewpoint, pass, lake or monastery only when it carries the very same name
    // (the locality "Poon Hill" yes; the village of Ringmo for "Ringmo viewpoint" no)
    if (c.kind === 'settlement' && allowed[0] !== 'settlement' && allowed[0] !== 'camp' && !sameFullName(place, raw.names)) continue;
    if (c.kind === 'admin' && c.km > 3) continue; // a municipality's label sits on the town; a district's centre does not
    const key = `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`; // one feature mapped twice (node and outline) counts once
    const had = seen.get(key);
    if (!had || c.sim > had.sim || (c.sim === had.sim && allowed.indexOf(c.kind) < allowed.indexOf(had.kind))) seen.set(key, c);
  }
  return [...seen.values()];
}

// ------------------------------------------------------------------ lookup

const NAME_KEYS = ['name', 'name:en', 'int_name', 'alt_name', 'alt_name:en', 'official_name', 'official_name:en', 'loc_name', 'short_name', 'old_name', 'name:ne'];
function slim(row) {
  const names = new Set();
  if (row.name) names.add(row.name);
  for (const k of NAME_KEYS) for (const v of String(row.namedetails?.[k] || '').split(';')) if (v.trim()) names.add(v.trim());
  if (!names.size && row.display_name) names.add(String(row.display_name).split(',')[0]);
  const ele = Number(String(row.extratags?.ele ?? '').replace(/[^\d.-]/g, ''));
  return { lat: Number(row.lat), lon: Number(row.lon), names: [...names], category: row.category, type: row.type, ele: row.extratags?.ele && Number.isFinite(ele) && ele > 0 && ele < 9000 ? Math.round(ele) : null };
}

async function lookup() {
  const cache = readJson(LOOKUPS, {});
  const places = loadPlaces();
  if (process.argv.includes('--unmatched')) {
    // ask again, with every spelling we know, about the places the last report could not match
    const unmatched = readJson(REPORT, []).filter((r) => r.action !== 'move');
    for (const r of unmatched) delete cache[r.slug];
    console.log(`lookup: asking again about ${unmatched.length} unmatched places`);
  }
  const cap = Number(process.argv[3]) || Infinity; // optional: only this many places in one run
  const todo = places.filter((p) => !cache[p.slug]).slice(0, cap);
  console.log(`lookup: asking about ${todo.length} of ${places.length} places`);
  let asked = 0;
  let failures = 0;
  for (const [i, p] of todo.entries()) {
    const names = [...new Set([p.name, ...(p.aka || [])].map((n) => n.replace(/\(.*?\)/g, '').trim()).filter(Boolean))].slice(0, 4);
    const found = [];
    let answered = true;
    for (const name of names) {
      const box = [p.lon - 0.32, p.lat + 0.27, p.lon + 0.32, p.lat - 0.27].map((v) => v.toFixed(4)).join(',');
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=12&bounded=1&namedetails=1&extratags=1&viewbox=${box}&q=${encodeURIComponent(name)}`;
      let rows = null;
      for (let t = 0; t < 3 && rows === null; t++) {
        try {
          const json = curlJson(url);
          if (Array.isArray(json)) rows = json;
        } catch {
          /* retry below */
        }
        if (rows === null) await sleep(5000 * (t + 1));
      }
      asked++;
      await sleep(1150); // Nominatim's limit is one request a second
      if (rows === null) {
        answered = false;
        break;
      }
      const slimmed = rows.map(slim);
      found.push(...slimmed);
      if (slimmed.some((r) => similarity(p, r.names) >= 0.8)) break; // good enough, skip the alias
    }
    if (!answered) {
      // never record a failure as "nothing found"
      if (++failures >= 4) {
        console.log('lookup: the name search stopped answering. Run "lookup" again later to finish.');
        break;
      }
      continue;
    }
    failures = 0;
    cache[p.slug] = found;
    if ((i + 1) % 20 === 0) {
      saveJson(LOOKUPS, cache);
      console.log(`lookup: ${i + 1}/${todo.length}`);
    }
  }
  saveJson(LOOKUPS, cache);
  console.log(`lookup: ${Object.keys(cache).length} of ${places.length} places answered`);
}

// ------------------------------------------------------------------ heights

class LimitError extends Error {}

async function elevations(coords) {
  const out = [];
  for (let i = 0; i < coords.length; i += 100) {
    const batch = coords.slice(i, i + 100);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${batch.map((c) => c.lat).join(',')}&longitude=${batch.map((c) => c.lon).join(',')}`;
    let got = null;
    for (let t = 0; t < 4 && !got; t++) {
      let wait = 4000 + t * 4000;
      try {
        const json = curlJson(url);
        if (Array.isArray(json.elevation) && json.elevation.length === batch.length) got = json.elevation;
        else if (/daily|hourly/i.test(json.reason || '')) throw new LimitError(json.reason);
        else if (/minutely/i.test(json.reason || '')) wait = 65000;
      } catch (e) {
        if (e instanceof LimitError) throw e;
      }
      if (!got) await sleep(wait);
    }
    if (!got) throw new Error('The elevation service did not answer.');
    out.push(...got);
    await sleep(1200);
  }
  return out;
}

async function heights() {
  const places = loadPlaces();
  const lookups = allLookups();
  const known = readJson(HEIGHTS, {});
  const want = new Map();
  for (const p of places) {
    want.set(heightKey(p), p);
    for (const c of candidatesFor(p, lookups)) want.set(heightKey(c), c);
  }
  const todo = [...want.entries()].filter(([k]) => !(k in known));
  if (!todo.length) return console.log('heights: nothing new to fetch');
  console.log(`heights: ${todo.length} points to fetch`);
  try {
    for (let i = 0; i < todo.length; i += 100) {
      const part = todo.slice(i, i + 100);
      const got = await elevations(part.map(([, c]) => c));
      part.forEach(([k], n) => (known[k] = Math.round(got[n])));
      saveJson(HEIGHTS, known);
    }
    console.log('heights: done');
  } catch (e) {
    console.log(`heights: stopped early (${e.message}) Run "heights" again later. "decide" works with what is cached.`);
  }
}

// ------------------------------------------------------------------ decide

function decide() {
  const places = loadPlaces();
  const lookups = allLookups();
  const known = readJson(HEIGHTS, {});
  const report = [];
  for (const p of places) {
    const limit = limitFor(p.type);
    const here = known[heightKey(p)];
    const gapHere = here == null ? null : Math.round(Math.abs(p.alt - here));
    const fits = gapHere != null && gapHere <= limit; // our current position agrees with the terrain
    const looked = p.slug in lookups;

    const cands = candidatesFor(p, lookups).map((c) => {
      const terrain = known[heightKey(c)];
      const height = terrain ?? c.ele;
      return { ...c, height: height ?? null, basis: terrain != null ? 'terrain' : c.ele != null ? 'osm-height' : 'name', gap: height == null ? null : Math.round(Math.abs(p.alt - height)) };
    });
    // strongest kind first: a mapped village beats a lodge named after it
    const order = ALLOWED[p.type] || ['settlement'];
    const kindRank = (c) => order.indexOf(c.kind);
    const apart = (a, b) => haversineKm(a, b) > 2;
    const proven = cands.filter((c) => c.gap != null && c.gap <= limit);
    // a 90 m terrain model is rough on steep ground: an exact name whose height is only a little out is still evidence
    const nearlyProven = cands.filter((c) => c.gap != null && c.gap > limit && c.gap <= limit + 150 && c.sim === 1 && !WEAK.has(c.kind));
    const unproven = cands.filter((c) => c.gap == null && c.sim >= 0.8).sort((a, b) => WEAK.has(a.kind) - WEAK.has(b.kind) || a.km - b.km || kindRank(a) - kindRank(b));

    /** The best-named, strongest-kind group among some candidates, best height first. */
    const lead = (list) => {
      if (!list.length) return [];
      const sim = Math.max(...list.map((c) => c.sim));
      const top = list.filter((c) => c.sim === sim);
      const kind = Math.min(...top.map(kindRank));
      return top.filter((c) => kindRank(c) === kind).sort((a, b) => a.gap - b.gap || a.km - b.km);
    };

    let pick = null;
    let why = '';
    let soft = false;
    const top = lead(proven);
    if (top.length) {
      const rivals = top.filter((c) => apart(c, top[0]));
      const near = top.filter((c) => c.km <= 6).sort((a, b) => a.km - b.km);
      if (!rivals.length && (top[0].km <= 6 || (!fits && top[0].sim === 1))) {
        pick = top[0];
        why = 'the name and the height agree';
      } else if (rivals.length && near.length && near[0].km <= 3 && top.every((c) => c === near[0] || !apart(c, near[0]) || c.km >= near[0].km * 2)) {
        pick = near[0];
        why = 'several places share the name; this one is beside our estimate and its height agrees';
      } else {
        why = rivals.length ? 'several places with this name fit the height' : 'the only match with the right height is far from our estimate';
      }
    }
    if (!pick) {
      const nearly = lead(nearlyProven);
      if (nearly.length && !nearly.some((c) => apart(c, nearly[0])) && nearly[0].km <= (fits ? 3 : 12)) {
        pick = nearly[0];
        soft = true;
        why = 'the exact name, with a height that nearly agrees';
      }
    }
    if (!pick && unproven.length) {
      const strong = unproven.filter((c) => !WEAK.has(c.kind));
      // 1. beside our estimate (a lodge or teahouse counts only when the estimate itself is off)
      const close = unproven.filter((c) => c.km <= 3 && (!WEAK.has(c.kind) || !fits));
      // 2. the one place of exactly this name in the area, however many times it is mapped
      //    When our estimate already fits the terrain, only the same kind of feature may move it
      //    (a monastery must not jump to the town that shares its name).
      const exact = strong
        .filter((c) => c.sim === 1 && c.km <= (fits ? 6 : 12) && (!fits || c.kind === order[0]))
        .sort((a, b) => kindRank(a) - kindRank(b) || a.km - b.km);
      if (close.length && !strong.some((c) => c !== close[0] && apart(c, close[0]) && c.km < close[0].km * 2)) {
        pick = close[0];
        why = WEAK.has(pick.kind) ? 'a lodge, teahouse or stop named after the place, close to our estimate' : fits ? 'the same name beside an estimate that fits the terrain' : 'the same name close to our estimate';
      } else if (exact.length && !strong.some((c) => apart(c, exact[0]))) {
        pick = exact[0];
        why = 'the only place with exactly this name in the area';
      } else if (!why) {
        why = 'a name match without height evidence, and not clear-cut';
      }
    }

    let action;
    let quality;
    if (pick) {
      action = 'move';
      if (pick.basis === 'name') quality = fits && pick.km <= 1.5 && pick.sim >= 0.85 && !WEAK.has(pick.kind) ? 'good' : 'approx';
      else quality = !soft && pick.gap <= 150 && !WEAK.has(pick.kind) ? 'good' : !soft && pick.gap <= 150 && pick.km <= 1.5 ? 'good' : 'approx';
    } else if (gapHere == null) {
      action = 'unchecked';
    } else if (fits) {
      action = 'keep';
      quality = 'approx';
    } else {
      action = 'uncertain';
      quality = 'uncertain';
    }
    report.push({
      slug: p.slug,
      name: p.name,
      file: p._file,
      type: p.type,
      alt: p.alt,
      source: p.coordSource || 'estimate',
      here: { lat: p.lat, lon: p.lon, terrain: here ?? null, gap: gapHere },
      looked,
      candidates: cands.length,
      action,
      quality,
      why: why || (looked ? (cands.length ? 'no candidate passed' : 'OpenStreetMap has no match by this name nearby') : 'not looked up yet'),
      pick: pick && { lat: Number(pick.lat.toFixed(5)), lon: Number(pick.lon.toFixed(5)), name: pick.name, osm: `${pick.category}=${pick.type}`, kind: pick.kind, sim: pick.sim, km: Number(pick.km.toFixed(2)), basis: pick.basis, height: pick.height, gap: pick.gap },
    });
  }
  // Two of our places must never claim the same map feature (Upper and Lower Pisang both
  // matching "Pisang"). The better-founded claim keeps it; the other falls back to its estimate.
  const moved = report.filter((r) => r.pick).sort((a, b) => b.pick.sim - a.pick.sim || (a.pick.gap ?? 999) - (b.pick.gap ?? 999) || a.pick.km - b.pick.km);
  const taken = [];
  for (const r of moved) {
    const clash = taken.find((t) => haversineKm(t.pick, r.pick) < 0.15);
    if (!clash) {
      taken.push(r);
      continue;
    }
    const limit = limitFor(r.type);
    r.why = `the match "${r.pick.name}" fits ${clash.name} better`;
    r.pick = null;
    r.action = r.here.gap == null ? 'unchecked' : r.here.gap <= limit ? 'keep' : 'uncertain';
    r.quality = r.action === 'keep' ? 'approx' : r.action === 'uncertain' ? 'uncertain' : undefined;
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(REPORT, JSON.stringify(report, null, 1));
  const count = (f) => report.filter(f).length;
  console.log(`decide: ${report.length} places`);
  console.log(`  ${count((r) => r.action === 'move')} matched in OpenStreetMap (${count((r) => r.pick?.basis === 'terrain')} height-checked against terrain, ${count((r) => r.pick?.basis === 'osm-height')} against a mapped elevation, ${count((r) => r.pick?.basis === 'name')} on name and position)`);
  console.log(`  ${count((r) => r.action === 'keep')} keep our estimate, which fits the terrain`);
  console.log(`  ${count((r) => r.action === 'uncertain')} uncertain: no match, and the estimate does not fit the terrain`);
  console.log(`  ${count((r) => r.action === 'unchecked')} not checked against the terrain yet`);
  console.log(`report: ${REPORT}`);
}

// ------------------------------------------------------------------ apply

const ORDER = ['slug', 'name', 'ne', 'aka', 'region', 'type', 'alt', 'lat', 'lon', 'coordQuality', 'coordSource', 'coordPinned', 'blurb', 'facilities', 'tip'];
function formatPlaces(list) {
  const lines = list.map((p) => {
    const keys = [...ORDER.filter((k) => k in p), ...Object.keys(p).filter((k) => !ORDER.includes(k))];
    const body = keys.map((k) => `    ${JSON.stringify(k)}: ${Array.isArray(p[k]) ? `[${p[k].map((v) => JSON.stringify(v)).join(', ')}]` : JSON.stringify(p[k])}`);
    return `  {\n${body.join(',\n')}\n  }`;
  });
  return `[\n${lines.join(',\n')}\n]\n`;
}

function apply() {
  if (!existsSync(REPORT)) throw new Error('Run "decide" first.');
  const report = new Map(JSON.parse(readFileSync(REPORT, 'utf8')).map((r) => [r.slug, r]));
  const tally = { osm: 0, estimate: 0, uncertain: 0, untouched: 0 };
  for (const file of readdirSync(PLACES).filter((f) => f.endsWith('.json')).sort()) {
    const list = JSON.parse(readFileSync(join(PLACES, file), 'utf8'));
    for (const p of list) {
      const r = report.get(p.slug);
      // a position somebody corrected by hand ("coordPinned": true) is never moved or relabelled
      if (!r || r.action === 'unchecked' || p.coordPinned === true) {
        tally.untouched++;
        continue;
      }
      if (r.action === 'move') {
        const same = haversineKm(p, r.pick) < 0.05;
        p.lat = r.pick.lat;
        p.lon = r.pick.lon;
        // a second run with less evidence must not talk down an earlier, better-founded label
        if (!(same && p.coordSource === 'osm' && r.pick.basis === 'name')) p.coordQuality = r.quality;
        p.coordSource = 'osm';
        tally.osm++;
      } else if (r.action === 'keep') {
        if (p.coordSource !== 'osm' && p.coordSource !== 'terrain-fit') p.coordSource = 'estimate';
        if (p.coordSource !== 'osm') p.coordQuality = 'approx';
        tally.estimate++;
      } else {
        p.coordQuality = 'uncertain';
        if (!p.coordSource) p.coordSource = 'estimate';
        tally.uncertain++;
      }
    }
    writeFileSync(join(PLACES, file), formatPlaces(list));
  }
  console.log(`apply: ${tally.osm} from OpenStreetMap, ${tally.estimate} estimates kept, ${tally.uncertain} marked uncertain, ${tally.untouched} untouched`);
  console.log('Now run: npm run check');
}

// ------------------------------------------------------------------ terrain

/**
 * Terrain-only fallback for places OpenStreetMap could not settle.
 * Where our estimate sits on ground far above or below the place's known altitude, nearby
 * points are sampled and the marker is moved to the closest one at the right height. That
 * rescues a marker stranded on a cliff or a ridge; it cannot fix an error along the valley,
 * so moved places stay "approx" and are labelled "terrain-fit".
 */
async function terrain() {
  const places = loadPlaces();
  const known = readJson(HEIGHTS, {});
  const RADII = [0.5, 1.1, 1.9];
  const BEARINGS = 8;
  const ring = (p) =>
    RADII.flatMap((r, k) =>
      Array.from({ length: BEARINGS }, (_, b) => {
        const ang = ((b + (k % 2) * 0.5) / BEARINGS) * 2 * Math.PI;
        return { lat: Number((p.lat + (r / 111.32) * Math.cos(ang)).toFixed(5)), lon: Number((p.lon + (r / (111.32 * Math.cos((p.lat * Math.PI) / 180))) * Math.sin(ang)).toFixed(5)), r };
      }),
    );
  const off = places.filter((p) => p.coordSource !== 'osm' && heightKey(p) in known && Math.abs(p.alt - known[heightKey(p)]) > limitFor(p.type));
  const samples = readJson(SAMPLES, {});
  const pending = off.filter((p) => !(p.slug in samples));
  console.log(`terrain: ${off.length} estimates disagree with the terrain; ${pending.length} still to sample`);
  // go slowly and save as we go: the service allows only so many points a minute and a day
  for (let i = 0; i < pending.length; i += 4) {
    const group = pending.slice(i, i + 4);
    try {
      const got = await elevations(group.flatMap((p) => ring(p)));
      group.forEach((p, g) => (samples[p.slug] = ring(p).map((pt, k) => ({ ...pt, dem: Math.round(got[g * RADII.length * BEARINGS + k]) }))));
      saveJson(SAMPLES, samples);
      console.log(`terrain: sampled ${Math.min(i + 4, pending.length)}/${pending.length}`);
    } catch (e) {
      console.log(`terrain: stopped early (${e.message}) Run "terrain" again later to finish.`);
      break;
    }
    await sleep(11000);
  }

  const fitted = new Map();
  for (const p of off) {
    const tolerance = HIGH.has(p.type) ? 200 : 110;
    const fit = (samples[p.slug] || []).filter((s) => Math.abs(p.alt - s.dem) <= tolerance).sort((a, b) => a.r - b.r || Math.abs(p.alt - a.dem) - Math.abs(p.alt - b.dem))[0];
    if (fit) fitted.set(p.slug, fit);
  }
  let moved = 0;
  let left = 0;
  for (const file of readdirSync(PLACES).filter((f) => f.endsWith('.json')).sort()) {
    const list = JSON.parse(readFileSync(join(PLACES, file), 'utf8'));
    for (const p of list) {
      const fit = fitted.get(p.slug);
      if (fit) {
        p.lat = Number(fit.lat.toFixed(4));
        p.lon = Number(fit.lon.toFixed(4));
        p.coordQuality = 'approx';
        p.coordSource = 'terrain-fit';
        known[heightKey(p)] = fit.dem;
        moved++;
      } else if (off.some((o) => o.slug === p.slug)) {
        p.coordQuality = 'uncertain';
        if (!p.coordSource) p.coordSource = 'estimate';
        left++;
      }
    }
    writeFileSync(join(PLACES, file), formatPlaces(list));
  }
  saveJson(HEIGHTS, known);
  console.log(`terrain: ${moved} moved onto ground at the right height, ${left} left uncertain`);
  console.log('Now run: npm run check');
}

// ------------------------------------------------------------------ run

const STEPS = { lookup, heights, decide, apply, terrain, fetch: async () => (await lookup(), await heights(), decide()) };
if (!STEPS[mode]) {
  console.log('usage: node scripts/verify-coordinates.mjs lookup | heights | decide | apply | fetch | terrain');
  process.exit(1);
}
await STEPS[mode]();
