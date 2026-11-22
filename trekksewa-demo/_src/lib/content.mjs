// Loads everything in content/ and derives the figures the templates need
// (profile points, acclimatization analysis, which treks pass through which place, …).
// Content that cannot be used (bad JSON, unknown place) is skipped with a warning so one
// broken file never takes the whole site down; `strict` turns those warnings into errors.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { haversineKm, bounds } from './geo.mjs';
import { analyseNights, zoneFor, oxygenPercent } from './altitude.mjs';
import { NPR_PER_USD } from './plan.mjs';

export function loadContent(dir, { strict = false, featured = [] } = {}) {
  const warnings = [];
  const problem = (msg) => {
    if (strict) throw new Error(msg);
    warnings.push(msg);
  };
  const readJson = (file, fallback) => {
    if (!existsSync(file)) return fallback;
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      problem(`${basename(file)}: ${e.message}`);
      return fallback;
    }
  };

  const regions = readJson(join(dir, 'regions.json'), []);
  const regionMap = new Map(regions.map((r) => [r.slug, r]));
  const permitsDoc = readJson(join(dir, 'permits.json'), { permits: [] });
  const permitMap = new Map(permitsDoc.permits.map((p) => [p.id, p]));
  const emergency = readJson(join(dir, 'emergency.json'), null);
  const facts = readJson(join(dir, 'facts.json'), {});
  // data taken from open sources by the scripts in scripts/osm/, and from research
  const osmServices = readJson(join(dir, 'osm-services.json'), { places: {} });
  const osmTrails = readJson(join(dir, 'osm-trails.json'), { treks: {} });
  const osmHubs = readJson(join(dir, 'osm-hubs.json'), { hubs: {} });
  const photosDoc = readJson(join(dir, 'photos.json'), { photos: {}, regions: {}, home: [] });
  const market = readJson(join(dir, 'market.json'), { packages: [], fares: [] });
  const photoOf = (key) => (key && photosDoc.photos[key] ? { key, ...photosDoc.photos[key] } : null);
  // what it costs one person to reach the trail and get back, added up from researched fares
  const transportDoc = readJson(join(dir, 'transport.json'), { treks: {} });
  const fares = new Map((market.fares || []).map((f) => [f.id, f]));
  const transportFor = (slug) => {
    const def = transportDoc.treks?.[slug];
    if (!def) return null;
    let lo = Infinity;
    let hi = 0;
    for (const option of def.options) {
      let a = 0;
      let b = 0;
      let known = true;
      for (const [id, times, share = 1] of option) {
        const f = fares.get(id);
        if (!f) {
          known = false;
          problem('transport.json: ' + slug + ' uses unknown fare "' + id + '"');
          break;
        }
        const k = ((f.currency === 'NPR' ? 1 / NPR_PER_USD : 1) * times) / share;
        a += f.low * k;
        b += f.high * k;
      }
      if (!known) continue;
      lo = Math.min(lo, a);
      hi = Math.max(hi, b);
    }
    if (!hi) return null;
    const r5 = (v) => Math.round(v / 5) * 5;
    return { usd: [Math.max(5, r5(lo)), Math.max(10, r5(hi))], text: def.text, extra: def.extra || '' };
  };
  for (const r of regions) r.photo = photoOf(`region-${r.slug}`) || photoOf(photosDoc.regions?.[r.slug]);

  // ---- places
  const placeMap = new Map();
  const placesDir = join(dir, 'places');
  for (const name of readdirSync(placesDir).filter((f) => f.endsWith('.json')).sort()) {
    const list = readJson(join(placesDir, name), []);
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      if (!p || !p.slug || placeMap.has(p.slug)) {
        if (p && p.slug) problem(`places/${name}: duplicate slug "${p.slug}" ignored`);
        continue;
      }
      if (!regionMap.has(p.region) || typeof p.alt !== 'number' || typeof p.lat !== 'number' || typeof p.lon !== 'number') {
        problem(`places/${name}: "${p.slug}" is incomplete and was skipped`);
        continue;
      }
      placeMap.set(p.slug, { ...p, treks: [], zone: zoneFor(p.alt), oxygen: oxygenPercent(p.alt), services: p.coordQuality === 'uncertain' ? null : osmServices.places[p.slug] || null });
    }
  }

  // ---- treks
  const treks = [];
  const treksDir = join(dir, 'treks');
  for (const name of readdirSync(treksDir).filter((f) => f.endsWith('.json')).sort()) {
    const t = readJson(join(treksDir, name), null);
    if (!t) continue;
    const reason = trekProblem(t, placeMap, regionMap);
    if (reason) {
      problem(`treks/${name}: skipped — ${reason}`);
      continue;
    }
    treks.push({
      ...deriveTrek(t, placeMap, regionMap, permitMap, osmTrails.treks[t.slug]),
      photo: photoOf(t.slug),
      package: (market.packages || []).find((x) => x.trek === t.slug) || null,
      transport: transportFor(t.slug),
    });
  }

  const order = new Map(featured.map((s, i) => [s, i]));
  treks.sort((a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999) || a.name.localeCompare(b.name));
  const trekMap = new Map(treks.map((t) => [t.slug, t]));
  for (const t of treks) t.relatedTreks = (t.related || []).map((s) => trekMap.get(s)).filter(Boolean);

  // ---- place ↔ trek links
  for (const t of treks) {
    const seen = new Map();
    const note = (slug, role, day) => {
      const cur = seen.get(slug) || { roles: new Set(), days: [] };
      cur.roles.add(role);
      if (day && !cur.days.includes(day)) cur.days.push(day);
      seen.set(slug, cur);
    };
    note(t.start, 'start');
    note(t.end, 'end');
    for (const d of t.itinerary) {
      note(d.to, 'overnight', d.day);
      for (const v of d.via || []) note(v, 'via', d.day);
    }
    for (const [slug, info] of seen) {
      const p = placeMap.get(slug);
      if (p) p.treks.push({ slug: t.slug, name: t.name, roles: [...info.roles], days: info.days.sort((a, b) => a - b) });
    }
  }

  const places = [...placeMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const p of places) {
    p.located = p.coordQuality !== 'uncertain'; // uncertain places are never drawn on a map
    if (!p.located) {
      p.nearby = [];
      continue;
    }
    p.nearby = places
      .filter((q) => q.slug !== p.slug && q.coordQuality !== 'uncertain')
      .map((q) => ({ slug: q.slug, name: q.name, alt: q.alt, km: haversineKm(p, q) }))
      .filter((q) => q.km <= 12)
      .sort((a, b) => a.km - b.km)
      .slice(0, 6);
  }
  for (const r of regions) {
    r.treks = treks.filter((t) => t.region === r.slug);
    r.places = places.filter((p) => p.region === r.slug);
  }

  // where the map positions come from; the credits page and the map notes quote these
  const positions = { total: places.length, osm: 0, own: 0, hidden: 0 };
  for (const p of places) positions[!p.located ? 'hidden' : p.coordSource === 'osm' ? 'osm' : 'own']++;

  const sources = { services: osmServices.asOf || null, trails: osmTrails.asOf || null, hubs: osmHubs.asOf || null, photos: photosDoc.checked || null, market: market.checked || null };
  const photos = { all: Object.entries(photosDoc.photos || {}).map(([key, v]) => ({ key, ...v })), home: (photosDoc.home || []).map(photoOf).filter(Boolean) };
  return { regions, regionMap, places, placeMap, treks, trekMap, permits: permitsDoc, permitMap, emergency, facts, positions, market, photos, hubs: osmHubs.hubs || {}, sources, warnings };
}

function trekProblem(t, placeMap, regionMap) {
  if (!t.slug || !t.name) return 'missing slug or name';
  if (!regionMap.has(t.region)) return `unknown region "${t.region}"`;
  if (!Array.isArray(t.itinerary) || !t.itinerary.length) return 'no itinerary';
  const need = [t.start, t.end, t.gateway, t.maxAlt?.place];
  for (const d of t.itinerary) need.push(d.from, d.to, ...(d.via || []));
  const missing = [...new Set(need.filter((s) => !placeMap.has(s)))];
  if (missing.length) return `unknown place(s): ${missing.join(', ')}`;
  if (!t.seasons || !t.maxAlt || !t.access || !t.guide) return 'missing seasons, maxAlt, access or guide';
  return null;
}

const isWalk = (d) => !d.mode || d.mode === 'walk';

function deriveTrek(t, placeMap, regionMap, permitMap, mapped) {
  const P = (s) => placeMap.get(s);
  const days = t.itinerary;

  // --- the line on the map: mapped footpath where OpenStreetMap has one, a straight join elsewhere
  const routed = new Map((mapped?.legs || []).map((l) => [`${l.day}:${l.from}:${l.to}`, l]));
  const trail = [];
  const gaps = [];
  let trailKm = 0;
  let legCount = 0;
  for (const d of days) {
    if (!isWalk(d)) continue;
    const chain = [d.from, ...(d.via || []), d.to];
    for (let i = 1; i < chain.length; i++) {
      if (chain[i - 1] === chain[i]) continue;
      legCount++;
      const leg = routed.get(`${d.day}:${chain[i - 1]}:${chain[i]}`);
      const a = P(chain[i - 1]);
      const b = P(chain[i]);
      if (leg) {
        trail.push(leg.line);
        trailKm += leg.km;
      } else if (a.coordQuality !== 'uncertain' && b.coordQuality !== 'uncertain') gaps.push([[a.lat, a.lon], [b.lat, b.lon]]);
    }
  }

  // --- profile points: one x unit per day; vehicle days at either end are left off the chart
  let first = 0;
  let last = days.length - 1;
  while (first < last && !isWalk(days[first])) first++;
  while (last > first && !isWalk(days[last])) last--;
  const pts = [];
  const startPlace = P(days[first].from);
  pts.push({ x: days[first].day - 1, y: startPlace.alt, name: startPlace.name, slug: startPlace.slug, day: days[first].day, kind: 'start', marker: true });
  for (let i = first; i <= last; i++) {
    const d = days[i];
    const soft = !isWalk(d);
    const mids = soft ? [] : (d.via || []).map((s) => ({ y: P(s).alt, name: P(s).name, slug: s }));
    if (!soft && d.high && !mids.some((m) => Math.abs(m.y - d.high) <= 80)) {
      mids.splice(Math.ceil(mids.length / 2), 0, { y: d.high, name: 'High point of the day' });
    }
    mids.forEach((m, k) => pts.push({ x: d.day - 1 + (k + 1) / (mids.length + 1), y: m.y, name: m.name, slug: m.slug, day: d.day, kind: 'via', soft }));
    pts.push({ x: d.day, y: d.sleep, name: P(d.to).name, slug: d.to, day: d.day, kind: 'night', marker: true, soft, title: d.title });
  }

  // --- nights and acclimatization
  const analysis = analyseNights(
    days.map((d) => ({ alt: d.sleep, label: P(d.to).name, slug: d.to, day: d.day })),
    P(t.gateway).alt,
  );
  const nightByDay = new Map(analysis.nights.map((n) => [n.day, n]));

  // --- per-day figures
  let prevSleep = P(days[0].from).alt;
  const itinerary = days.map((d) => {
    const from = P(d.from);
    const to = P(d.to);
    const night = nightByDay.get(d.day);
    const out = {
      ...d,
      mode: d.mode || 'walk',
      fromPlace: from,
      toPlace: to,
      viaPlaces: (d.via || []).map(P),
      net: d.sleep - prevSleep,
      level: night?.level || 'ok',
      reasons: night?.reasons || [],
      notes: night?.notes || [],
    };
    prevSleep = d.sleep;
    return out;
  });

  const walkDays = itinerary.filter((d) => d.mode === 'walk');
  const hoursMin = walkDays.reduce((s, d) => s + d.hours[0], 0);
  const hoursMax = walkDays.reduce((s, d) => s + d.hours[1], 0);
  const order = [];
  const add = (s) => {
    if (s && !order.includes(s)) order.push(s);
  };
  add(t.start);
  for (const d of days) {
    add(d.from);
    (d.via || []).forEach(add);
    add(d.to);
  }
  const routePlaces = order.map(P);
  const walked = [];
  for (const d of days) {
    if (!isWalk(d)) continue;
    for (const s of [d.from, ...(d.via || []), d.to]) if (walked[walked.length - 1] !== s) walked.push(s);
  }

  const region = regionMap.get(t.region);
  const maxPlace = P(t.maxAlt.place);
  const mapPlaces = routePlaces.filter((p) => p.coordQuality !== 'uncertain' && (p.slug !== t.gateway || p.slug === t.start));
  return {
    ...t,
    itinerary,
    regionObj: region,
    startPlace: P(t.start),
    endPlace: P(t.end),
    gatewayPlace: P(t.gateway),
    maxPlace,
    profile: pts,
    xDomain: [days[first].day - 1, days[last].day],
    analysis: analysis.summary,
    hoursTotal: [hoursMin, hoursMax],
    walkingDays: walkDays.filter((d) => d.from !== d.to || d.kind !== 'rest').length,
    restDays: itinerary.filter((d) => d.kind === 'acclimatization' || d.kind === 'rest').length,
    routePlaces,
    // ordered walking line for the map (vehicle legs and places without a reliable position are left out)
    line: walked.filter((s) => P(s).coordQuality !== 'uncertain').map((s) => [P(s).lat, P(s).lon]),
    trail, // mapped footpath, one polyline per section
    gaps, // sections with no mapped path: drawn as straight dashes
    trailKm: Math.round(trailKm),
    trailShare: legCount ? trail.length / legCount : 0,
    bounds: bounds(mapPlaces.length > 1 ? mapPlaces : routePlaces),
    mapPlaces,
    unmapped: routePlaces.filter((p) => p.coordQuality === 'uncertain' && (p.slug !== t.gateway || p.slug === t.start)),
    permitObjs: (t.permits || []).map((id) => permitMap.get(id)).filter(Boolean),
    restricted: (t.permits || []).some((id) => id.startsWith('rap-')),
    loop: t.start === t.end,
  };
}
