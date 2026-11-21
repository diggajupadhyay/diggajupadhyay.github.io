// JSON files the browser loads on demand (search index, trek list for filters and tools).

import { PLACE_TYPE_LABEL, num, daysRange } from './format.mjs';

const TOOLS = [
  ['safety/altitude-check/', 'Altitude sickness check', 'Lake Louise AMS self-check', 'ams acute mountain sickness headache symptoms hace hape'],
  ['safety/acclimatization/', 'Acclimatization checker', 'Test an itinerary against ascent guidelines', 'ascent rate sleeping altitude rest day'],
  ['safety/emergency/', 'Emergency & SOS', 'Rescue numbers, location sharing, whistle and signal', 'sos rescue helicopter police ambulance help'],
  ['tools/gpx/', 'GPX viewer', 'Load a track, see the profile, get off-track alerts', 'gps map track route import'],
  ['tools/compare/', 'Compare treks', 'Two or three routes side by side', 'versus vs difference which trek choose'],
  ['safety/insurance/', 'Insurance check', 'What your policy must cover for your trek', 'travel insurance helicopter evacuation cover altitude limit'],
  ['tools/planner/', 'Trek planner', 'Put dates on an itinerary and export a calendar', 'dates calendar schedule plan'],
  ['tools/packing/', 'Packing list', 'A checklist built for your trek, season and altitude', 'gear kit equipment checklist what to pack'],
  ['tools/budget/', 'Budget estimator', 'What a trek really costs, item by item', 'cost price money permits guide porter'],
  ['permits/', 'Permits & fees', 'Every trekking permit in Nepal, with current fees', 'tims acap national park restricted area permit cost'],
  ['conditions/', 'Trail conditions', 'Season outlook and live trailhead forecasts', 'weather forecast road flight monsoon snow'],
  ['services/guides/', 'Guides', 'Licensed trekking guides', 'hire guide licence'],
  ['services/porters/', 'Porters', 'Fairly paid, insured porters', 'hire porter load wage'],
  ['services/agencies/', 'Agencies', 'Registered trekking companies', 'agency company operator taan'],
  ['gear/', 'Gear marketplace', 'Rent or buy trekking gear in Nepal', 'rent buy sleeping bag down jacket boots thamel'],
  ['partners/', 'Join as a partner', 'List your services on TrekkSewa', 'register enroll apply guide porter agency shop'],
];

export function buildData({ content }, pages) {
  const featured = new Set(content.treks.slice(0, 8).map((t) => t.slug));
  const search = [
    ...content.treks.map((t) => ({
      k: 'trek',
      n: t.name,
      a: (t.aka || []).join(' '),
      u: `treks/${t.slug}/`,
      s: `${t.regionObj.name} · ${daysRange(t.daysRange)} · ${num(t.maxAlt.m)} m`,
      ...(featured.has(t.slug) ? { f: 1 } : {}),
    })),
    ...content.regions.map((r) => ({ k: 'region', n: r.long, a: r.name, u: `regions/${r.slug}/`, s: `${r.treks.length} treks` })),
    ...TOOLS.map(([u, n, s, a]) => ({ k: 'tool', n, a, u, s })),
    ...content.places.map((p) => ({
      k: 'place',
      n: p.name,
      a: [...(p.aka || []), p.ne || ''].join(' '),
      u: `places/${p.slug}/`,
      s: `${PLACE_TYPE_LABEL[p.type] || 'Place'} · ${num(p.alt)} m · ${content.regionMap.get(p.region).name}`,
    })),
    ...(content.articles || []).map((a) => ({ k: 'article', n: a.title, a: (a.tags || []).join(' '), u: `journal/${a.slug}/`, s: 'Journal' })),
  ].filter((e) => pages.some((p) => p.path === e.u));

  // compact trek list for filters, the planner, the acclimatization checker and the budget tool
  const treks = content.treks.map((t) => ({
    s: t.slug,
    n: t.name,
    r: t.region,
    rn: t.regionObj.name,
    d: t.days,
    dr: t.daysRange,
    km: t.distanceKm,
    max: t.maxAlt.m,
    g: t.difficulty,
    st: t.style,
    best: t.seasons.best,
    good: t.seasons.good,
    p: t.permits,
    ra: t.restricted ? 1 : 0,
    gr: t.guide.rule,
    gw: t.gatewayPlace.alt,
    it: t.itinerary.map((d) => ({ t: d.title, to: d.toPlace.name, a: d.sleep, h: d.hours, k: d.kind, m: d.mode === 'walk' ? undefined : d.mode })),
  }));

  // positions we could not confirm are not published; src says where a position comes from
  // ("osm" = OpenStreetMap, under the Open Database Licence; "own" = our estimate)
  const places = content.places.map((p) => ({ s: p.slug, n: p.name, r: p.region, t: p.type, a: p.alt, ...(p.located ? { lat: p.lat, lon: p.lon, src: p.coordSource === 'osm' ? 'osm' : 'own' } : {}) }));

  return {
    'data/search.json': search,
    'data/treks.json': treks,
    'data/places.json': places,
  };
}
