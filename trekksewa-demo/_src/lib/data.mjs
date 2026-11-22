// JSON files the browser loads on demand (search index, trek list for filters and tools).

import { PLACE_TYPE_LABEL, num, daysRange } from './format.mjs';
import { FOOD_PER_DAY, NPR_PER_USD, insuranceTier } from './plan.mjs';

const TOOLS = [
  ['safety/altitude-check/', 'Altitude sickness check', 'Lake Louise AMS self-check', 'ams acute mountain sickness headache symptoms hace hape'],
  ['safety/acclimatization/', 'Acclimatization checker', 'Test an itinerary against ascent guidelines', 'ascent rate sleeping altitude rest day'],
  ['safety/emergency/', 'Emergency & SOS', 'Rescue numbers, location sharing, whistle and signal', 'sos rescue helicopter police ambulance help'],
  ['tools/gpx/', 'GPX viewer', 'Load a track, see the profile, get off-track alerts', 'gps map track route import'],
  ['tools/compare/', 'Compare treks', 'Two or three routes side by side', 'versus vs difference which trek choose'],
  ['safety/insurance/', 'Insurance check', 'What your policy must cover for your trek', 'travel insurance helicopter evacuation cover altitude limit'],
  ['plan/', 'Plan my trek', 'Step by step: choose a trek, set dates, see where you sleep and what it costs', 'planner plan dates calendar schedule itinerary book guide porter agency lodge hotel help choose which trek'],
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

/** "About USD 25–40 a day" -> [25, 40]; falls back when the wording has no dollar range. */
function usdRange(fact, fallback) {
  const m = String(fact?.value || '').match(/USD\s*(\d+)\s*[–-]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : fallback;
}

/** Where you can sleep at a stop, in a form small enough to ship for every night of a trek. */
function stayAt(place) {
  const s = place.services;
  const fac = place.facilities || [];
  if (s && s.stayCount) return { c: s.stayCount, n: s.stay.slice(0, 6).map((x) => x.n) };
  if (place.type === 'city') return { city: 1 };
  if (fac.includes('lodges') || fac.includes('homestays')) return { some: fac.includes('lodges') ? 'lodges' : 'homestays' };
  if (fac.includes('camping')) return { camp: 1 };
  return null;
}

export function buildData({ content, config }, pages) {
  const featuredRank = new Map((config?.featuredTreks || []).map((s, i) => [s, i + 1]));
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
    // for the step-by-step planner
    tag: t.tagline,
    hi: t.analysis.maxSleep ? t.analysis.maxSleep.alt : Math.max(...t.itinerary.map((d) => d.sleep)),
    ...(t.itinerary.some((d) => d.mode === 'flight') ? { fl: 1 } : {}),
    ...(t.itinerary.some((d) => d.level && d.level !== 'ok') ? { up: t.itinerary.filter((d) => d.level && d.level !== 'ok').length } : {}),
    ...(t.style.includes('camping') && !t.style.includes('teahouse') ? { cg: 1 } : {}),
    ...(featuredRank.has(t.slug) ? { f: featuredRank.get(t.slug) } : {}),
    ...(t.photo ? { ph: { f: t.photo.small, o: t.photo.focus, a: t.photo.alt } } : {}),
    ...(t.package ? { pk: [t.package.low, t.package.high] } : {}),
  }));

  // one file per trek with everything the plan summary shows: loaded only for the chosen trek
  const permitFee = (p) => {
    const fee = p.fees.find((f) => /foreign/i.test(f.who)) || p.fees[0];
    return fee ? `${fee.amount}${fee.per ? ` per ${fee.per.replace(/^per\s+/i, '')}` : ''}` : '';
  };
  // a clinic or pharmacy by its name when the map has one in Latin script, else by what it is
  const HEALTH_KIND = { hospital: 'a hospital', clinic: 'a clinic', doctors: 'a doctor', pharmacy: 'a pharmacy', health_post: 'a health post' };
  const healthName = (x) => (x.n && /[A-Za-z]/.test(x.n) ? x.n : HEALTH_KIND[x.k] || 'a health post');
  // how people get from Kathmandu to a trek's gateway city, in words, from the researched fares
  const hop = (city) => {
    const ways = (content.market.fares || []).filter((f) => f.from === 'Kathmandu' && f.to === city);
    if (!ways.length) return '';
    const said = ways.map((f) => (f.mode === 'flight' ? `by air (${f.time})` : `by ${f.mode} (${f.time})`));
    const text = said.length > 1 ? `${said.slice(0, -1).join(', ')} or ${said[said.length - 1]}` : said[0];
    return `${text[0].toUpperCase()}${text.slice(1)}.`;
  };
  const detail = Object.fromEntries(
    content.treks.map((t) => [
      `data/trek/${t.slug}.json`,
      {
        s: t.slug,
        n: t.name,
        rn: t.regionObj.name,
        sum: t.summary,
        gateway: t.gatewayPlace.name,
        reach: t.gatewayPlace.name === 'Kathmandu' ? '' : hop(t.gatewayPlace.name),
        start: t.startPlace.name,
        end: t.endPlace.name,
        max: { m: t.maxAlt.m, name: t.maxPlace.name },
        maxSleep: t.analysis.maxSleep ? { m: t.analysis.maxSleep.alt, name: t.analysis.maxSleep.label } : null,
        insure: insuranceTier(t.maxAlt.m),
        food: FOOD_PER_DAY[t.region] ?? 34,
        guide: t.guide,
        access: t.access.summary,
        photo: t.photo ? { f: t.photo.file, sm: t.photo.small, w: t.photo.width, h: t.photo.height, o: t.photo.focus, a: t.photo.alt, c: t.photo.caption, by: t.photo.author, l: t.photo.licence, lu: t.photo.licenceUrl, src: t.photo.source } : null,
        pkg: t.package ? { low: t.package.low, high: t.package.high, days: t.package.days, includes: t.package.includes || [], sampled: t.package.sampled || 0 } : null,
        permits: t.permitObjs.map((p) => ({ id: p.id, name: p.name, short: p.short, fee: permitFee(p), fees: p.fees, where: p.where, verified: p.verified !== false })),
        transport: t.transport ? t.transport.usd : null,
        transportText: t.transport ? t.transport.text : '',
        transportExtra: t.transport ? t.transport.extra : '',
        cash: t.routePlaces.filter((p) => p.slug !== t.gateway && (p.facilities || []).includes('atm')).map((p) => p.name),
        tips: (t.tips || []).slice(0, 5),
        days: t.itinerary.map((d, i, all) => {
          // every itinerary ends with the ride back to the gateway city, so on the last day
          // the night is spent there, not at the roadhead the walk comes out at
          const back = i === all.length - 1 && d.to !== t.gateway;
          return {
          d: d.day,
          t: d.title,
          f: d.fromPlace.name,
          to: d.toPlace.name,
          ts: d.to,
          a: d.sleep,
          h: d.hours,
          k: d.kind,
          ...(d.mode !== 'walk' ? { m: d.mode } : {}),
          ...(d.km ? { km: d.km } : {}),
          note: d.note || '',
          lvl: d.level,
          why: d.reasons || [],
          stay: back ? { city: 1 } : stayAt(d.toPlace),
          ...(back ? { back: 1 } : {}),
          ...(!back && d.toPlace.services?.health?.length ? { med: [...new Set(d.toPlace.services.health.slice(0, 3).map(healthName))].slice(0, 2) } : {}),
          };
        }),
      },
    ]),
  );

  // figures every plan needs: daily rates, visa, who to call, where requests go
  const plan = {
    npr: NPR_PER_USD,
    rates: { guide: usdRange(content.facts.guideDailyRate, [25, 40]), porter: usdRange(content.facts.porterDailyRate, [18, 25]) },
    ratesVerified: content.facts.guideDailyRate?.verified === true && content.facts.porterDailyRate?.verified === true,
    visa: content.facts.touristVisa?.value || '',
    rescue: content.facts.helicopterRescueCost?.value || '',
    emergency: (content.emergency?.national || []).slice(0, 3).map((n) => ({ name: n.name, number: n.number })),
    contact: { email: config?.contact?.email || '', whatsapp: config?.contact?.whatsapp || '' },
    asOf: { market: content.sources.market, lodges: content.sources.services },
  };

  // positions we could not confirm are not published; src says where a position comes from
  // ("osm" = OpenStreetMap, under the Open Database Licence; "own" = our estimate)
  const places = content.places.map((p) => ({ s: p.slug, n: p.name, r: p.region, t: p.type, a: p.alt, ...(p.located ? { lat: p.lat, lon: p.lon, src: p.coordSource === 'osm' ? 'osm' : 'own' } : {}) }));

  return {
    'data/search.json': search,
    'data/treks.json': treks,
    'data/places.json': places,
    'data/plan.json': plan,
    ...detail,
  };
}
