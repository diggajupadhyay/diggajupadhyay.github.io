#!/usr/bin/env node
// Pulls what OpenStreetMap knows about the area around every place in content/places/.
//
//   NODE_USE_ENV_PROXY=1 node scripts/osm/extract.mjs candidates
//       named villages, lodges, passes and peaks near each place whose position is not yet
//       settled, written where scripts/verify-coordinates.mjs picks them up as candidates
//   NODE_USE_ENV_PROXY=1 node scripts/osm/extract.mjs services
//       lodges, health posts, cash machines, water and the rest around every place,
//       written to content/osm-services.json for the site to show
//   NODE_USE_ENV_PROXY=1 node scripts/osm/extract.mjs hubs
//       how many outdoor shops, travel offices, cash machines and so on are mapped in the
//       three places trekkers shop and book (Thamel, Lakeside, Namche), written to
//       content/osm-hubs.json
//
// Source: the Protomaps daily build of OpenStreetMap (see tiles.mjs). © OpenStreetMap
// contributors, Open Database Licence.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineKm } from '../../lib/geo.mjs';
import { CACHE, eachTile, layerFeatures, owns, tilesAround, uniqueTiles } from './tiles.mjs';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLACES = join(SRC, 'content', 'places');
const mode = process.argv[2];

function loadPlaces() {
  const out = [];
  for (const file of readdirSync(PLACES).filter((f) => f.endsWith('.json')).sort()) out.push(...JSON.parse(readFileSync(join(PLACES, file), 'utf8')));
  return out;
}

/** Every spelling a feature carries, Latin-script ones first. */
function namesOf(props) {
  const out = [];
  const add = (v) => {
    for (const part of String(v || '').split(';')) if (part.trim() && !out.includes(part.trim())) out.push(part.trim());
  };
  add(props['name:en']);
  add(props.name);
  for (const [k, v] of Object.entries(props)) if (k.startsWith('name:') || k.startsWith('pgf:name')) add(v);
  return out;
}
const latin = (names) => names.find((n) => /[A-Za-z]/.test(n)) || names[0] || '';

async function collect(wanted, layers) {
  const tiles = uniqueTiles(wanted.map((w) => tilesAround(w.lat, w.lon, w.radius)));
  console.log(`${wanted.length} places, ${tiles.length} map tiles`);
  const points = [];
  const build = await eachTile(
    tiles,
    (t, vt) => {
      for (const layer of layers) {
        for (const f of layerFeatures(vt, layer, t)) {
          if (f.type !== 1) continue;
          const [lon, lat] = f.lines[0][0];
          if (!owns(t, lon, lat)) continue; // the same point also sits in a neighbour's margin
          const names = namesOf(f.props);
          points.push({ layer, kind: f.props.kind, detail: f.props.kind_detail || null, names, lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)), ele: Number(f.props.elevation) || null });
        }
      }
    },
    { log: console.log },
  );
  return { points, build };
}

// ------------------------------------------------------------------ candidates

// how a tile feature reads in the terms verify-coordinates.mjs already understands
const LODGING = new Set(['hotel', 'guest_house', 'hostel', 'motel', 'chalet']);
const HUTS = new Set(['alpine_hut', 'wilderness_hut', 'camp_site']);
function asLookupRow(p) {
  let category = null;
  let type = p.kind;
  if (p.layer === 'places') {
    category = 'place';
    type = p.detail || p.kind;
  } else if (LODGING.has(p.kind) || HUTS.has(p.kind) || p.kind === 'viewpoint') category = 'tourism';
  else if (p.kind === 'peak' || p.kind === 'saddle' || p.kind === 'volcano') category = 'natural';
  else if (['place_of_worship', 'monastery'].includes(p.kind)) category = 'amenity';
  else if (['restaurant', 'cafe', 'shelter', 'bus_station'].includes(p.kind)) category = 'amenity';
  else if (p.kind === 'aerodrome' || p.kind === 'helipad') category = 'aeroway';
  if (!category || !p.names.length) return null;
  return { lat: p.lat, lon: p.lon, names: p.names, category, type, ele: p.ele, from: 'tiles' };
}

async function candidates() {
  const places = loadPlaces();
  // settled places get a tight look (their match may be confirmed or improved);
  // unsettled ones a wide one, because the estimate may be a few kilometres out
  const wanted = places.map((p) => ({ ...p, radius: p.coordSource === 'osm' && p.coordQuality === 'good' ? 1.2 : 4 }));
  const { points, build } = await collect(wanted, ['places', 'pois']);
  const rows = points.map(asLookupRow).filter(Boolean);
  const out = {};
  for (const p of wanted) out[p.slug] = rows.filter((r) => haversineKm(p, r) <= p.radius + 0.3);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(join(CACHE, 'osm-tile-lookups.json'), JSON.stringify(out));
  const n = Object.values(out).reduce((a, v) => a + v.length, 0);
  console.log(`candidates: ${rows.length} named features from build ${build}; ${n} within reach of a place`);
  console.log('Now run: node scripts/verify-coordinates.mjs heights && node scripts/verify-coordinates.mjs decide');
}

// ------------------------------------------------------------------ services

const GROUPS = {
  stay: new Set(['hotel', 'guest_house', 'hostel', 'motel', 'chalet', 'alpine_hut', 'wilderness_hut', 'camp_site']),
  eat: new Set(['restaurant', 'cafe', 'fast_food', 'bakery', 'food_court']),
  health: new Set(['hospital', 'clinic', 'doctors', 'pharmacy', 'health_post']),
  cash: new Set(['atm', 'bank', 'bureau_de_change']),
  water: new Set(['drinking_water', 'water_point']),
  toilets: new Set(['toilets']),
  police: new Set(['police']),
  shop: new Set(['convenience', 'supermarket', 'general', 'outdoor', 'sports']),
};
const STAY_LABEL = { hotel: 'Hotel', guest_house: 'Guest house', hostel: 'Hostel', motel: 'Motel', chalet: 'Chalet', alpine_hut: 'Mountain hut', wilderness_hut: 'Basic hut', camp_site: 'Campsite' };
const reach = (type) => (type === 'city' ? 0 : type === 'town' ? 1.2 : 0.8); // km; cities have far too much to list

async function services() {
  const places = loadPlaces().filter((p) => p.coordQuality !== 'uncertain');
  const wanted = places.filter((p) => reach(p.type) > 0).map((p) => ({ ...p, radius: reach(p.type) }));
  const { points, build } = await collect(wanted, ['pois']);
  const out = {};
  const blank = () => ({ stay: [], stayCount: 0, eat: 0, health: [], cash: { atm: 0, bank: 0 }, water: 0, toilets: 0, police: 0, shop: 0 });
  for (const pt of points) {
    const group = Object.keys(GROUPS).find((g) => GROUPS[g].has(pt.kind));
    if (!group) continue;
    // each feature belongs to the nearest place only, so neighbouring hamlets do not share a lodge
    let best = null;
    for (const p of wanted) {
      const km = haversineKm(p, pt);
      if (km <= p.radius && (!best || km < best.km)) best = { p, km };
    }
    if (!best) continue;
    const s = (out[best.p.slug] ??= blank());
    const name = latin(pt.names);
    if (group === 'stay') {
      s.stayCount++;
      if (name && !s.stay.some((x) => x.n.toLowerCase() === name.toLowerCase())) s.stay.push({ n: name, k: STAY_LABEL[pt.kind], m: Math.round(best.km * 1000) });
    } else if (group === 'health') {
      if (name && !s.health.some((x) => x.n.toLowerCase() === name.toLowerCase())) s.health.push({ n: name, k: pt.kind });
      else if (!name) s.health.push({ n: '', k: pt.kind });
    } else if (group === 'cash') {
      if (pt.kind === 'atm') s.cash.atm++;
      else if (pt.kind === 'bank') s.cash.bank++;
    } else s[group]++;
  }
  for (const s of Object.values(out)) {
    s.stay.sort((a, b) => a.m - b.m);
    s.stay = s.stay.slice(0, 40).map(({ n, k }) => ({ n, k }));
    s.health = s.health.filter((h, i, arr) => h.n || arr.findIndex((x) => !x.n && x.k === h.k) === i);
  }
  const date = `${build.slice(0, 4)}-${build.slice(4, 6)}-${build.slice(6, 8)}`;
  const file = join(SRC, 'content', 'osm-services.json');
  writeFileSync(file, `${JSON.stringify({ source: 'OpenStreetMap contributors, Open Database Licence, through the Protomaps daily build', asOf: date, places: Object.fromEntries(Object.entries(out).sort()) }, null, 0)}\n`);
  const withStay = Object.values(out).filter((s) => s.stayCount).length;
  console.log(`services: ${Object.keys(out).length} places have something mapped nearby; ${withStay} have somewhere to stay (${Object.values(out).reduce((a, s) => a + s.stayCount, 0)} lodges in all)`);
  console.log(`written: ${file}`);
}

// ------------------------------------------------------------------ hubs

// The places where trekkers shop and book before they walk. Counted, not listed: the numbers
// say where the choice is without recommending any business nobody here has visited.
// tilesAround() takes its radius in kilometres.
const HUBS = [
  { id: 'thamel', name: 'Thamel', city: 'Kathmandu', lat: 27.7154, lon: 85.3123, radius: 0.9 },
  { id: 'lakeside', name: 'Lakeside', city: 'Pokhara', lat: 28.2096, lon: 83.9595, radius: 1.5 },
  { id: 'namche', name: 'Namche Bazaar', city: 'Everest region', lat: 27.8056, lon: 86.714, radius: 0.7 },
];
// a shop mapped as clothes, sports, shoes or bags still counts when its name says trekking
const GEAR_NAME = /trek|outdoor|mountain|climb|expedition|gear|equipment/i;
const GEAR_MAYBE = new Set(['clothes', 'sports', 'shoes', 'bag']);

async function hubs() {
  const { points, build } = await collect(HUBS, ['pois']);
  const out = {};
  for (const hub of HUBS) {
    const near = points.filter((pt) => haversineKm(hub, pt) <= hub.radius);
    const count = (test) => near.filter(test).length;
    out[hub.id] = {
      name: hub.name,
      city: hub.city,
      lat: hub.lat,
      lon: hub.lon,
      radiusM: Math.round(hub.radius * 1000),
      outdoor: count((pt) => pt.kind === 'outdoor' || (GEAR_MAYBE.has(pt.kind) && pt.names.some((n) => GEAR_NAME.test(n)))),
      agencies: count((pt) => pt.kind === 'travel_agency'),
      stay: count((pt) => GROUPS.stay.has(pt.kind)),
      atm: count((pt) => pt.kind === 'atm'),
      exchange: count((pt) => pt.kind === 'bureau_de_change'),
      pharmacy: count((pt) => pt.kind === 'pharmacy'),
    };
    console.log(`${hub.name}: ${JSON.stringify(out[hub.id])}`);
  }
  const date = `${build.slice(0, 4)}-${build.slice(4, 6)}-${build.slice(6, 8)}`;
  const file = join(SRC, 'content', 'osm-hubs.json');
  writeFileSync(file, `${JSON.stringify({ source: 'OpenStreetMap contributors, Open Database Licence, through the Protomaps daily build', asOf: date, hubs: out }, null, 2)}\n`);
  console.log(`written: ${file}`);
}

const STEPS = { candidates, services, hubs };
if (!STEPS[mode]) {
  console.log('usage: NODE_USE_ENV_PROXY=1 node scripts/osm/extract.mjs candidates | services | hubs');
  process.exit(1);
}
await STEPS[mode]();
