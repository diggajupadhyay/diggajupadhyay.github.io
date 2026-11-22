// Regions, places and permits.

import { html, raw, jsonScript } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { ridgeStrip } from '../lib/landscape.mjs';
import { PLACE_TYPE_LABEL, FACILITY_LABEL, metres, feet, num, monthRanges, daysRange, numberWord, longDate } from '../lib/format.mjs';
import { boilingPointC } from '../lib/altitude.mjs';
import { formatCoord } from '../lib/geo.mjs';
import { trekCard, hueClass, regionTag, note, permitCard, grade, noticesBlock, noticesFor, photoFigure } from './partials.mjs';

const seedOf = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
const TYPE_ICON = { city: 'building-2', town: 'building-2', village: 'house', settlement: 'bed', camp: 'tent', 'base-camp': 'tent', pass: 'mountain', peak: 'mountain-snow', viewpoint: 'binoculars', lake: 'waves', monastery: 'landmark', trailhead: 'signpost', airstrip: 'plane' };
const FACILITY_ICON = { lodges: 'bed', camping: 'tent', homestays: 'house', shops: 'store', atm: 'banknote', bank: 'landmark', 'health-post': 'heart-pulse', hospital: 'heart-pulse', pharmacy: 'heart-pulse', 'rescue-post': 'life-buoy', wifi: 'wifi', charging: 'zap', 'hot-shower': 'droplets', bakery: 'utensils', 'gear-shops': 'backpack', 'permit-check': 'ticket', police: 'shield-check', airstrip: 'plane', helipad: 'plane', bus: 'bus', jeep: 'car', monastery: 'landmark', viewpoint: 'binoculars' };

const crumbsNav = (ctx, items) => html`<nav aria-label="Breadcrumb"><ol class="breadcrumb">
  <li><a href="${ctx.u()}">Home</a></li>
  ${items.map(([href, label]) => (href ? html`<li><a href="${ctx.u(href)}">${label}</a></li>` : html`<li aria-current="page">${label}</li>`))}
</ol></nav>`;

const mapBlock = (data, text = 'The map loads when you scroll here.') => html`<div class="map" data-map>
    <div class="map-placeholder">${icon('map', { size: 30 })}<p>${text}</p></div>
  </div>
  <script type="application/json" data-map-data>${jsonScript(data)}</script>`;

const placePoint = (p) => ({ s: p.slug, n: p.name, a: p.alt, lat: p.lat, lon: p.lon, t: PLACE_TYPE_LABEL[p.type] });
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** How far to trust a marker, in a few plain words. */
const positionNote = (p) =>
  p.coordSource === 'osm'
    ? p.coordQuality === 'good'
      ? 'position from OpenStreetMap'
      : 'position from OpenStreetMap, but the match is less certain, so treat it as approximate'
    : 'our own estimate; the marker may be a kilometre or more from the lodges';

// ------------------------------------------------------------------ regions

export function regionsIndexPage(ctx) {
  const { u, content } = ctx;
  const body = html`
<header class="page-head">
  <div class="wrap">
    ${crumbsNav(ctx, [[null, 'Regions']])}
    <h1>Trekking regions of Nepal</h1>
    <p class="lead">Where you go decides how you get there, how high you sleep, which permits you need and how many people you share the trail with.</p>
  </div>
  ${raw(ridgeStrip({ seed: 5 }))}
</header>
<div class="wrap section-tight">
  <div class="region-list">
    ${content.regions.map((r) => {
      const alts = r.treks.map((t) => t.maxAlt.m);
      const best = [...new Set(r.treks.flatMap((t) => t.seasons.best))];
      return html`<article class="card region-row ${hueClass(r)}">
        <div class="region-row-main">
          <span class="region-swatch" aria-hidden="true"></span>
          <h2><a href="${u(`regions/${r.slug}/`)}">${r.long}</a> ${r.ne ? html`<span class="ne" lang="ne">${r.ne}</span>` : ''}</h2>
          <p>${r.tagline}.</p>
          <p class="small muted">${r.overview[0]}</p>
        </div>
        <dl class="region-row-facts">
          <div><dt>Treks</dt><dd>${r.treks.length}</dd></div>
          <div><dt>High points</dt><dd>${alts.length ? html`${num(Math.min(...alts))}–${metres(Math.max(...alts))}` : '—'}</dd></div>
          <div><dt>Best months</dt><dd>${best.length ? monthRanges(best) : '—'}</dd></div>
          <div><dt>Gateways</dt><dd>${r.gateways.map((g) => content.placeMap.get(g)?.name).filter(Boolean).join(', ') || '—'}</dd></div>
        </dl>
        <a class="link-arrow" href="${u(`regions/${r.slug}/`)}">Explore ${r.name}${icon('arrow-right', { size: 18 })}</a>
      </article>`;
    })}
  </div>
</div>`;
  return {
    title: 'Trekking Regions of Nepal: Everest, Annapurna, Langtang & More',
    description: 'Compare Nepal’s trekking regions by altitude, season, access and permits, and find the routes in each one.',
    section: 'regions',
    crumbs: [[null, 'Regions']],
    body,
  };
}

export function regionPage(ctx, r) {
  const { u, content } = ctx;
  const permits = [...new Set(r.treks.flatMap((t) => t.permits))].map((id) => content.permitMap.get(id)).filter(Boolean);
  const best = [...new Set(r.treks.flatMap((t) => t.seasons.best))];
  const high = r.places.reduce((m, p) => (p.alt > (m?.alt ?? 0) ? p : m), null);
  const sorted = [...r.places].sort((a, b) => b.alt - a.alt);
  const body = html`
<div class="${hueClass(r)}">
<header class="page-head region-head">
  <div class="wrap">
    ${crumbsNav(ctx, [['regions/', 'Regions'], [null, r.name]])}
    <h1>${r.long} ${r.ne ? html`<span class="ne" lang="ne">${r.ne}</span>` : ''}</h1>
    <p class="lead">${r.tagline}.</p>
  </div>
  ${raw(ridgeStrip({ seed: seedOf(r.slug) }))}
</header>
<div class="wrap section-tight">
  ${noticesBlock(noticesFor(content, { region: r.slug }))}
  ${r.photo ? photoFigure(ctx, r.photo, { cls: 'trek-photo-fig region-photo-fig', eager: true }) : ''}
  <dl class="stats stats-4">
    <div><dt>Treks</dt><dd>${r.treks.length}</dd></div>
    <div><dt>Places</dt><dd>${r.places.length}</dd></div>
    <div><dt>Best months</dt><dd>${best.length ? monthRanges(best) : '—'}</dd></div>
    <div><dt>Highest place listed</dt><dd>${high ? metres(high.alt) : '—'}${high ? html`<small>${high.name}</small>` : ''}</dd></div>
  </dl>
  <div class="region-intro">
    <div class="prose">${r.overview.map((p) => html`<p>${p}</p>`)}</div>
    <div class="stack" style="--stack:.75rem">
      <div class="card card-pad"><h2 class="mini-h">${icon('calendar-days', { size: 16 })}When to go</h2><p class="small">${r.seasonNote}</p></div>
      <div class="card card-pad"><h2 class="mini-h">${icon('bus', { size: 16 })}Getting there</h2><p class="small">${r.access}</p></div>
    </div>
  </div>
</div>

<section class="section-tight section-alt" aria-labelledby="r-treks">
  <div class="wrap">
    <div class="section-head"><h2 id="r-treks">Treks in ${r.name}</h2><a class="link-arrow" href="${u(`treks/?region=${r.slug}`)}">Filter these${icon('arrow-right', { size: 18 })}</a></div>
    ${r.treks.length
      ? html`<div class="trek-grid">${r.treks.map((t) => trekCard(ctx, t, { heading: 'h3' }))}</div>`
      : html`<div class="empty"><h3>Route guides are on the way</h3><p>We are still writing the treks for this region.</p></div>`}
  </div>
</section>

${r.places.length
  ? html`<section class="section-tight" aria-labelledby="r-map">
      <div class="wrap">
        <div class="section-head"><h2 id="r-map">Places in ${r.name}</h2></div>
        ${mapBlock({ center: r.center, zoom: r.zoom, points: r.places.filter((p) => p.located).map(placePoint), fit: true })}
        <p class="map-note">${icon('info', { size: 14 })} Marker positions come from OpenStreetMap where we could match a place, and from our own estimates elsewhere. Treat them as a guide, not as survey points.${r.places.some((p) => !p.located) ? ` ${capital(numberWord(r.places.filter((p) => !p.located).length))} ${r.places.filter((p) => !p.located).length === 1 ? 'place whose position we could not confirm is' : 'places whose position we could not confirm are'} listed below but not drawn.` : ''}</p>
        <div class="table-wrap">
          <table class="place-table">
            <thead><tr><th>Place</th><th>Type</th><th class="num">Altitude</th><th>On treks</th></tr></thead>
            <tbody>
              ${sorted.map(
                (p) => html`<tr>
                  <td><a href="${u(`places/${p.slug}/`)}">${p.name}</a></td>
                  <td>${PLACE_TYPE_LABEL[p.type]}</td>
                  <td class="num">${metres(p.alt)}</td>
                  <td class="muted">${p.treks.length ? p.treks.slice(0, 3).map((t) => t.name).join(', ') + (p.treks.length > 3 ? ` +${p.treks.length - 3}` : '') : '—'}</td>
                </tr>`,
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>`
  : ''}

${permits.length
  ? html`<section class="section-tight section-alt" aria-labelledby="r-permits">
      <div class="wrap">
        <div class="section-head"><h2 id="r-permits">Permits used in ${r.name}</h2><a class="link-arrow" href="${u('permits/')}">All permits${icon('arrow-right', { size: 18 })}</a></div>
        <div class="grid grid-2">${permits.map(permitCard)}</div>
      </div>
    </section>`
  : ''}
</div>`;
  return {
    title: `${r.long} Treks: Routes, Permits & Season`,
    description: `${r.tagline}. ${r.treks.length} trek ${r.treks.length === 1 ? 'guide' : 'guides'}, ${r.places.length} places with altitudes, permits and the best months to go.`,
    section: 'regions',
    scripts: ['places'],
    styles: ['map'],
    crumbs: [['regions/', 'Regions'], [null, r.name]],
    body,
  };
}

// ------------------------------------------------------------------ places

export function placesIndexPage(ctx) {
  const { u, content } = ctx;
  const places = [...content.places].sort((a, b) => b.alt - a.alt);
  const types = [...new Set(places.map((p) => p.type))].sort((a, b) => PLACE_TYPE_LABEL[a].localeCompare(PLACE_TYPE_LABEL[b]));
  const body = html`
<header class="page-head">
  <div class="wrap">
    ${crumbsNav(ctx, [[null, 'Places']])}
    <h1>Places and altitudes</h1>
    <p class="lead">${places.length} villages, lodges, passes, lakes and viewpoints on Nepal's trekking routes, each with its altitude, what you will find there and a live forecast.</p>
  </div>
  ${raw(ridgeStrip({ seed: 8 }))}
</header>
<div class="wrap section-tight">
  <form class="filters card card-pad" data-place-filters hidden aria-label="Filter places">
    <div class="filters-top">
      <div class="field"><label class="sr-only" for="pf-q">Search places</label><input class="input" type="search" id="pf-q" name="q" placeholder="Search by name, e.g. Namche" autocomplete="off"></div>
      <div class="field"><label class="sr-only" for="pf-region">Region</label><select class="select" id="pf-region" name="region"><option value="">All regions</option>${content.regions.filter((r) => r.places.length).map((r) => html`<option value="${r.slug}">${r.long}</option>`)}</select></div>
      <div class="field"><label class="sr-only" for="pf-type">Type</label><select class="select" id="pf-type" name="type"><option value="">All types</option>${types.map((t) => html`<option value="${t}">${PLACE_TYPE_LABEL[t]}</option>`)}</select></div>
    </div>
    <div class="filters-status">
      <p aria-live="polite" data-place-status>${places.length} places</p>
      <div class="segmented" role="group" aria-label="Sort">
        <label><input type="radio" name="sort" value="alt" checked>Highest first</label>
        <label><input type="radio" name="sort" value="name">A to Z</label>
      </div>
    </div>
  </form>
  <ul class="place-list" data-place-list>
    ${places.map((p) => {
      const r = content.regionMap.get(p.region);
      return html`<li class="${hueClass(r)}" data-name="${`${p.name} ${(p.aka || []).join(' ')} ${p.ne || ''}`.toLowerCase()}" data-region="${p.region}" data-type="${p.type}" data-alt="${p.alt}">
        <a href="${u(`places/${p.slug}/`)}">
          <span class="place-ic">${icon(TYPE_ICON[p.type] || 'map-pin', { size: 18 })}</span>
          <span class="place-name"><strong>${p.name}</strong><small>${PLACE_TYPE_LABEL[p.type]} · ${r.name}${p.treks.length ? html` · ${p.treks.length} ${p.treks.length === 1 ? 'trek' : 'treks'}` : ''}</small></span>
          <span class="place-alt">${num(p.alt)}<small> m</small></span>
        </a>
      </li>`;
    })}
  </ul>
  <div class="empty" data-place-empty hidden><h3>No place matches</h3><p>Check the spelling, or clear the region and type filters.</p></div>
</div>`;
  return {
    title: 'Places on Nepal’s Trekking Routes: Altitude & Weather',
    description: `Altitude, facilities and live weather for ${places.length} villages, passes, lakes and base camps on Nepal's trekking routes.`,
    section: 'places',
    scripts: ['places'],
    crumbs: [[null, 'Places']],
    body,
  };
}

/** Lodges and services mapped around a place (OpenStreetMap, see scripts/osm/extract.mjs). */
const HEALTH_KIND = { hospital: 'Hospital', clinic: 'Clinic', doctors: 'Doctor', pharmacy: 'Pharmacy', health_post: 'Health post' };

function staySection(ctx, p) {
  const s = p.services;
  if (!s) return '';
  const { content, u } = ctx;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const here = [
    s.eat ? ['utensils', plural(s.eat, 'place to eat', 'places to eat')] : null,
    // a clinic mapped only in Nepali script is named by what it is, with its own name after it
    ...s.health.filter((x) => x.n).map((x) => ['stethoscope', /[A-Za-z]/.test(x.n) ? x.n : html`${HEALTH_KIND[x.k] || 'Health post'} (<span lang="ne">${x.n}</span>)`]),
    s.health.some((x) => !x.n) && !s.health.some((x) => x.n) ? ['stethoscope', 'A health post or pharmacy'] : null,
    s.cash.atm ? ['banknote', plural(s.cash.atm, 'cash machine', 'cash machines')] : null,
    s.cash.bank ? ['landmark', plural(s.cash.bank, 'bank', 'banks')] : null,
    s.water ? ['droplets', plural(s.water, 'drinking-water point', 'drinking-water points')] : null,
    s.toilets ? ['door-open', plural(s.toilets, 'public toilet', 'public toilets')] : null,
    s.police ? ['shield', plural(s.police, 'police post', 'police posts')] : null,
    s.shop ? ['store', plural(s.shop, 'shop', 'shops')] : null,
  ].filter(Boolean);
  if (!s.stayCount && !here.length) return '';
  const unnamed = s.stayCount - s.stay.length;
  return html`<section class="place-section" id="stay" aria-labelledby="stay-title">
    <h2 id="stay-title">${s.stayCount ? 'Where to stay' : `What is at ${p.name}`}</h2>
    ${s.stayCount
      ? html`<p><strong>${plural(s.stayCount, 'place to stay is', 'places to stay are')} mapped</strong> within a short walk of ${p.name}${unnamed > 0 && s.stay.length ? `; ${s.stay.length} have a name on the map` : ''}.</p>
          ${s.stay.length ? html`<ul class="stay-list">${s.stay.map((x) => html`<li><strong>${x.n}</strong><span>${x.k}</span></li>`)}</ul>` : ''}`
      : ''}
    ${here.length ? html`<h3 class="h4">Also here</h3><ul class="facilities">${here.map(([ic, text]) => html`<li>${icon(ic, { size: 18 })}${text}</li>`)}</ul>` : ''}
    ${note(
      'plain',
      html`<p>This list comes from OpenStreetMap as it stood on ${longDate(content.sources.services)}. A name here is not a recommendation, and a lodge that is missing may simply not be mapped yet. Lodges also close for the winter higher up. You cannot book a bed through us yet: in October, November, March and April ask your guide or trekking company to phone ahead. <a href="${u('plan/')}">Plan a trek</a> to see the stops night by night.</p>`,
    )}
  </section>`;
}

export function placePage(ctx, p) {
  const { u, content, config } = ctx;
  const r = content.regionMap.get(p.region);
  const zoneBadge = { low: 'badge-ok', moderate: 'badge-ok', high: 'badge-info', 'very-high': 'badge-watch', extreme: 'badge-danger' }[p.zone.id];
  const roleText = (t) => {
    const parts = [];
    if (t.roles.includes('overnight')) parts.push(`overnight on day ${t.days.join(', ')}`);
    else if (t.roles.includes('via')) parts.push(`passed on day ${t.days.join(', ')}`);
    if (t.roles.includes('start')) parts.push('start of the walk');
    if (t.roles.includes('end') && !t.roles.includes('start')) parts.push('end of the walk');
    return parts.join(' · ');
  };
  const nearby = p.nearby.map((n) => content.placeMap.get(n.slug)).filter(Boolean);
  const body = html`
<article class="place ${hueClass(r)}">
<header class="page-head">
  <div class="wrap">
    ${crumbsNav(ctx, [['places/', 'Places'], [`regions/${r.slug}/`, r.name], [null, p.name]])}
    <div class="cluster" style="--gap:.5rem;margin-bottom:.75rem">${regionTag(ctx, r)}<span class="tag tag-plain">${icon(TYPE_ICON[p.type] || 'map-pin', { size: 14 })}${PLACE_TYPE_LABEL[p.type]}</span></div>
    <h1>${p.name} ${p.ne ? html`<span class="ne" lang="ne">${p.ne}</span>` : ''}</h1>
    <p class="lead">${p.blurb}</p>
    ${p.aka && p.aka.length ? html`<p class="small muted">Also written ${p.aka.join(', ')}</p>` : ''}
  </div>
  ${raw(ridgeStrip({ seed: seedOf(p.slug) }))}
</header>
<div class="wrap section-tight place-layout">
  <div class="place-main">
    <dl class="stats stats-4">
      <div><dt>Altitude</dt><dd>${metres(p.alt)}<small>${feet(p.alt)}</small></dd></div>
      <div><dt>Altitude zone</dt><dd class="stat-text"><span class="badge ${zoneBadge}">${p.zone.label}</span></dd></div>
      <div><dt>Oxygen per breath</dt><dd>${p.oxygen}%<small>of sea level, roughly</small></dd></div>
      <div><dt>Water boils at</dt><dd>${boilingPointC(p.alt)} °C</dd></div>
    </dl>
    ${p.alt >= 2500
      ? note(p.alt >= 3500 ? 'warn' : 'info', html`<p><strong>${p.zone.label}.</strong> ${p.zone.note} <a href="${u('safety/altitude-check/')}">Check your symptoms</a> if you have a headache here.</p>`, { iconName: 'heart-pulse' })
      : ''}

    <section class="place-section" aria-labelledby="wx-title">
      <h2 id="wx-title">Weather at ${p.name}</h2>
      <div class="card card-pad wx" data-weather data-lat="${p.lat}" data-lon="${p.lon}" data-alt="${p.alt}" data-name="${p.name}">
        <p class="muted wx-loading">${icon('cloud-sun', { size: 18 })} The forecast loads when you are online.</p>
      </div>
    </section>

    ${staySection(ctx, p)}

    ${p.facilities && p.facilities.length
      ? html`<section class="place-section" aria-labelledby="fac-title">
          <h2 id="fac-title">What you will find</h2>
          <ul class="facilities">${p.facilities.map((f) => html`<li>${icon(FACILITY_ICON[f] || 'check', { size: 18 })}${FACILITY_LABEL[f]}</li>`)}</ul>
          ${p.tip ? note('plain', html`<p><strong>Tip.</strong> ${p.tip}</p>`, { iconName: 'sparkles' }) : ''}
          <p class="xsmall muted">Services open and close with the season. Treat this as a guide, not a guarantee.</p>
        </section>`
      : p.tip
        ? html`<section class="place-section">${note('plain', html`<p><strong>Tip.</strong> ${p.tip}</p>`, { iconName: 'sparkles' })}</section>`
        : ''}

    ${p.treks.length
      ? html`<section class="place-section" aria-labelledby="pt-title">
          <h2 id="pt-title">Treks through ${p.name}</h2>
          <ul class="place-treks">
            ${p.treks.map((x) => {
              const t = content.trekMap.get(x.slug);
              return html`<li><a href="${u(`treks/${x.slug}/`)}"><strong>${x.name}</strong><span class="muted small">${roleText(x)}</span><span class="small">${daysRange(t.daysRange)} · ${grade(t.difficulty)}</span></a></li>`;
            })}
          </ul>
        </section>`
      : ''}

    <section class="place-section" aria-labelledby="pm-title">
      <h2 id="pm-title">Map</h2>
      ${p.located
        ? html`${mapBlock({ center: [p.lat, p.lon], zoom: 13, focus: p.slug, points: [placePoint(p), ...nearby.map(placePoint)] })}
            <p class="map-note">${icon('info', { size: 14 })} ${formatCoord(p.lat, p.lon)} — ${positionNote(p)}.</p>`
        : note('plain', html`<p><strong>Not on our maps yet.</strong> We have not been able to confirm the position of ${p.name}, so we do not draw a marker for it rather than show one in the wrong place. The altitude and the forecast for the surrounding area are unaffected.</p>`, { iconName: 'map-pin-off' })}
    </section>
  </div>

  <aside class="place-side" aria-label="Nearby">
    ${nearby.length
      ? html`<div class="card card-pad">
          <h2 class="mini-h">Nearby places</h2>
          <ul class="nearby">
            ${p.nearby.map((n) => html`<li><a href="${u(`places/${n.slug}/`)}">${n.name}</a><span class="muted small">${n.km < 1 ? '<1' : Math.round(n.km)} km · ${num(n.alt)} m${n.alt !== p.alt ? html` <span class="${n.alt > p.alt ? 'up' : 'down'}">(${n.alt > p.alt ? '+' : '−'}${num(Math.abs(n.alt - p.alt))})</span>` : ''}</span></li>`)}
          </ul>
          <p class="xsmall muted">Straight-line distances. Walking distance is always more.</p>
        </div>`
      : ''}
    <div class="card card-pad">
      <h2 class="mini-h">More in ${r.name}</h2>
      <p class="small">${r.tagline}.</p>
      <a class="link-arrow small" href="${u(`regions/${r.slug}/`)}">${r.long}${icon('arrow-right', { size: 16 })}</a>
    </div>
  </aside>
</div>
</article>`;
  return {
    title: `${p.name} (${num(p.alt)} m): Altitude, Weather & Treks`,
    description: `${p.name}, ${PLACE_TYPE_LABEL[p.type].toLowerCase()} at ${num(p.alt)} m in ${r.long}. ${p.blurb}`.slice(0, 200),
    section: 'places',
    scripts: ['places'],
    styles: ['map'],
    crumbs: [['places/', 'Places'], [`regions/${r.slug}/`, r.name], [null, p.name]],
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Place',
        name: p.name,
        ...(p.ne ? { alternateName: p.ne } : {}),
        description: p.blurb,
        url: `${config.siteUrl}/places/${p.slug}/`,
        geo: p.located ? { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lon, elevation: p.alt } : { '@type': 'GeoCoordinates', elevation: p.alt },
        containedInPlace: { '@type': 'Country', name: 'Nepal' },
      },
    ],
  };
}

// ------------------------------------------------------------------ permits

export function permitsPage(ctx) {
  const { u, content, config } = ctx;
  const groups = [
    ['registration', 'Registration', 'The trekker registration card used outside Khumbu and the restricted areas.'],
    ['national-park', 'National parks', 'Entry permits issued by the Department of National Parks and Wildlife Conservation.'],
    ['conservation-area', 'Conservation areas', 'Entry permits for areas managed by conservation trusts and local councils.'],
    ['local', 'Local permits', 'Entry fees charged by rural municipalities.'],
    ['restricted-area', 'Restricted areas', 'Special permits issued only through a registered trekking agency, for groups of at least two with a licensed guide.'],
  ];
  const all = content.permits.permits;
  const guideFact = content.facts?.guideRule;
  const body = html`
<header class="page-head">
  <div class="wrap">
    ${crumbsNav(ctx, [[null, 'Permits']])}
    <h1>Trekking permits and fees</h1>
    <p class="lead">Every trek in Nepal needs at least one piece of paper. Here is what each permit is, what it costs, and where you actually get it.</p>
  </div>
  ${raw(ridgeStrip({ seed: 21 }))}
</header>
<div class="wrap section-tight">
  ${note('warn', html`<p><strong>Check before you pay.</strong> ${content.permits.disclaimer} Last reviewed ${config.contentReviewed}.</p>`)}

  <section class="card card-pad permit-finder" aria-labelledby="pfind">
    <h2 id="pfind">Which permits does my trek need?</h2>
    <div class="field" style="max-width:26rem">
      <label for="permit-trek">Choose a trek</label>
      <select class="select" id="permit-trek" data-permit-trek>
        <option value="">Select a trek…</option>
        ${content.regions.filter((r) => r.treks.length).map((r) => html`<optgroup label="${r.long}">${r.treks.map((t) => html`<option value="${t.slug}" data-permits="${t.permits.join(' ')}" data-guide="${t.guide.rule}">${t.name}</option>`)}</optgroup>`)}
      </select>
    </div>
    <div data-permit-result hidden></div>
    <noscript><p class="small muted">Each trek page lists its own permits.</p></noscript>
  </section>

  ${guideFact
    ? html`<section class="permit-rule" aria-labelledby="grule"><h2 id="grule">Do I have to hire a guide?</h2>${note('info', html`<p><strong>${guideFact.value}</strong></p><p>${guideFact.detail}</p>`, { iconName: 'signpost' })}</section>`
    : ''}

  ${groups.map(([kind, title, text]) => {
    const list = all.filter((p) => p.kind === kind);
    if (!list.length) return '';
    return html`<section class="permit-group" aria-labelledby="pg-${kind}">
      <div class="section-head"><div><h2 id="pg-${kind}">${title}</h2><p>${text}</p></div></div>
      <div class="grid grid-2">${list.map(
        (p) => html`<div class="permit-wrap" data-permit="${p.id}">${permitCard(p)}${
          p.sources && p.sources.length
            ? html`<p class="xsmall muted permit-sources">Checked against: ${p.sources.slice(0, 3).map((s, i) => html`${i ? ', ' : ''}<a href="${s.url}" rel="noopener nofollow" target="_blank">${s.title}</a>`)}</p>`
            : ''
        }</div>`,
      )}</div>
    </section>`;
  })}
</div>`;
  return {
    title: 'Nepal Trekking Permits & Fees: TIMS, Parks, Restricted Areas',
    description: 'Every Nepal trekking permit explained: TIMS, national park and conservation area entry, and restricted-area permits, with fees and where to get them.',
    section: 'permits',
    scripts: ['permits'],
    crumbs: [[null, 'Permits']],
    body,
  };
}
