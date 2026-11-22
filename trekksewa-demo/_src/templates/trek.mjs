import { html, raw, jsonScript } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { profileHtml } from '../lib/profile.mjs';
import { ridgeStrip } from '../lib/landscape.mjs';
import { DIFFICULTY, STYLE_LABEL, MONTHS, metres, feet, km, hours, daysRange, signed, num, monthRanges } from '../lib/format.mjs';
import { RULES } from '../lib/altitude.mjs';
import { walkStats, helpOptions } from '../lib/plan.mjs';
import { trekCard, hueClass, grade, monthStrip, monthKey, note, permitCard, regionTag, channelOf, noticesBlock, noticesFor } from './partials.mjs';

const MODE_ICON = { flight: 'plane', bus: 'bus', jeep: 'car', drive: 'car', walk: 'footprints' };
const MODE_LABEL = { flight: 'Flight', bus: 'Bus', jeep: 'Jeep', drive: 'Drive', walk: 'Walk' };
// plain words, the same ones the planner uses
const KIND_LABEL = { acclimatization: 'Rest day to get used to the height', rest: 'Rest day', pass: 'Pass day', summit: 'High point day', transfer: 'Travel day', buffer: 'Spare day' };
const CONFIDENCE = {
  high: 'The stages on this route are well established.',
  medium: 'Stage plans on this route vary between operators; treat distances and times as approximate.',
  low: 'Published information on this route is limited. Treat every figure as approximate and confirm with a local operator.',
};
const GUIDE_LABEL = { required: 'Guide required', 'strongly-recommended': 'Guide strongly recommended', optional: 'Guide optional' };

const seedOf = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);

export function trekPage(ctx, t) {
  const { u, config, content } = ctx;
  const r = t.regionObj;
  const a = t.analysis;
  const [x0, x1] = t.xDomain;
  const span = x1 - x0;
  const step = span <= 13 ? 1 : span <= 26 ? 2 : 5;
  const xTicks = [];
  for (let d = Math.floor(x0) + 1; d <= x1; d++) if (d % step === 0 || step === 1) xTicks.push({ x: d, label: String(d) });
  const top = t.profile.reduce((m, p) => (p.y > m.y ? p : m), t.profile[0]);
  const chart = profileHtml({
    points: t.profile,
    xDomain: t.xDomain,
    xTicks,
    xTitle: 'End of day',
    labels: [{ x: top.x, y: top.y, text: `${top.name} ${num(top.y)} m` }],
  });
  const hoverPoints = t.profile.map((p) => ({
    x: p.x,
    y: p.y,
    l: p.kind === 'night' ? `Day ${p.day} · sleep at ${p.name}` : p.kind === 'start' ? `Start · ${p.name}` : `Day ${p.day} · ${p.name}`,
  }));

  // --- "Is this trek right for me?", in plain words
  const walk = walkStats(t.itinerary.map((d) => ({ h: d.hours, k: d.kind, m: d.mode !== 'walk' ? d.mode : undefined })));
  const topSleep = a.maxSleep ? a.maxSleep.alt : Math.max(...t.itinerary.map((d) => d.sleep));
  const campingOnly = t.style.includes('camping') && !t.style.includes('teahouse');
  const forMe = {
    walking: `${t.days} days in all. Most walking days are ${walk.typical[0] === walk.typical[1] ? `about ${walk.typical[0]}` : `${walk.typical[0]} to ${walk.typical[1]}`} hours on foot, and the longest is about ${walk.longest} hours. ${DIFFICULTY[t.difficulty].blurb}`,
    height:
      topSleep >= 5000
        ? `You sleep as high as ${num(topSleep)} m. That is very high. Only go if you have time for every rest day in the plan, and talk to your doctor first.`
        : topSleep >= 4000
          ? `You sleep as high as ${num(topSleep)} m. Most people feel the altitude at this height. The plan includes the rest days you need: do not shorten it.`
          : topSleep >= 3000
            ? t.itinerary.some((d) => d.level !== 'ok')
              ? `The highest night is at ${num(topSleep)} m, and the plan gains height quickly on the way. Many people feel it. The day-by-day plan marks where: take that day slowly, or split it.`
              : `The highest night is at ${num(topSleep)} m. You will notice the thinner air, but going slowly is usually enough.`
            : t.itinerary.some((d) => d.level !== 'ok')
              ? `You never sleep above ${num(topSleep)} m. One day does climb a long way to get there, and the day-by-day plan marks it.`
              : `You never sleep above ${num(topSleep)} m, so altitude is not a worry on this trek.`,
    sleep: campingOnly
      ? 'In tents. A crew carries the camp and cooks; there are no lodges on much of this route.'
      : t.style.includes('teahouse')
        ? `In lodges${t.style.includes('camping') ? ' on most nights, and in tents on a few' : ' every night'}: a simple twin room, a shared bathroom and hot meals in a warm dining room.`
        : 'In family homes in the villages, with simple rooms and home-cooked meals.',
    help: t.restricted
      ? 'This is a restricted area. A registered trekking company must arrange your permit, and a licensed guide walks with you.'
      : t.guide.rule === 'required'
        ? 'The rules require a licensed guide on this route. A porter to carry your bag is your choice.'
        : t.guide.rule === 'strongly-recommended'
          ? 'You may walk without a guide here, but we strongly recommend one, and a porter if you would rather not carry a full pack.'
          : 'A guide is optional here. Many people still take one for company, local knowledge and peace of mind.',
    cost: t.package ? `A guided trip with a trekking company usually costs USD ${num(t.package.low)} to ${num(t.package.high)} a person, going by the prices ${t.package.sampled || 'several'} companies published for ${content.sources.market ? content.sources.market.slice(0, 4) : 'this year'}.` : '',
  };
  // who may help on this route, with what each usually costs
  const dayRate = (key) => (content.facts?.[key]?.value || '').match(/USD\s*[\d,]+\s*[–-]\s*[\d,]+/)?.[0]?.replace(/[–-]/, ' to ').replace(/\s+/g, ' ') || '';
  const guideRate = dayRate('guideDailyRate');
  const porterRate = dayRate('porterDailyRate');
  const HELP_NAME = { agency: 'A trekking company that arranges everything', 'guide-porter': 'A guide, and a porter to carry your bag', guide: 'A guide', porter: 'A porter to carry your bag', self: 'On your own' };
  const helpRows = helpOptions({ ra: t.restricted ? 1 : 0, gr: t.guide.rule, cg: campingOnly ? 1 : 0 }).map((o) => ({
    label: HELP_NAME[o.id],
    blocked: o.blocked,
    cost: o.blocked
      ? ''
      : o.id === 'agency'
        ? t.package
          ? `Usually USD ${num(t.package.low)} to ${num(t.package.high)} a person for everything on the trek.`
          : 'One price for everything on the trek. Ask two or three companies.'
        : o.id === 'guide-porter'
          ? guideRate && porterRate
            ? `About ${guideRate} a day for the guide and ${porterRate} for the porter.`
            : ''
          : o.id === 'guide'
            ? guideRate && `About ${guideRate} a day.`
            : o.id === 'porter'
              ? porterRate && `About ${porterRate} a day.`
              : 'No daily cost, and nobody to turn to if something goes wrong.',
  }));
  const asking = channelOf(config) !== '';
  const stayLine = (d) => {
    const s = d.toPlace.services;
    if (!s || !s.stayCount || d.toPlace.type === 'city') return '';
    const names = s.stay.slice(0, 3).map((x) => x.n);
    return html`<p class="day-stay">${icon('bed-double', { size: 16 })}<span><strong>${s.stayCount} ${s.stayCount === 1 ? 'place' : 'places'} to stay</strong> in ${d.toPlace.name}${names.length ? `, such as ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]}` : ''}. <a href="${u(`places/${d.toPlace.slug}/#stay`)}">See them</a></span></p>`;
  };

  const flagged = t.itinerary.filter((d) => d.level !== 'ok');
  const atms = t.routePlaces.filter((p) => p.slug !== t.gateway && (p.facilities || []).includes('atm'));
  const placeLink = (p) => html`<a href="${u(`places/${p.slug}/`)}">${p.name}</a>`;
  const routeLine = (d) => {
    const stops = [d.fromPlace, ...d.viaPlaces, d.toPlace].filter((p, i, arr) => i === 0 || p.slug !== arr[i - 1].slug);
    if (stops.length === 1) return html`Based at ${placeLink(stops[0])}`;
    return stops.map((p, i) => html`${i ? raw(' <span aria-hidden="true">→</span><span class="sr-only"> to </span> ') : ''}${placeLink(p)}`);
  };

  const faqs = [
    [`How long does the ${t.name} trek take?`, `Most people take ${daysRange(t.daysRange)}. The itinerary on this page is ${t.days} days${t.restDays ? `, including ${t.restDays} ${t.restDays === 1 ? 'day' : 'days'} for rest and acclimatization` : ''}.`],
    [
      `How high does the ${t.name} trek go?`,
      `The highest point is ${t.maxPlace.name} at ${num(t.maxAlt.m)} m (${num(t.maxAlt.m * 3.28084)} ft).${a.maxSleep ? ` The highest place you sleep is ${a.maxSleep.label} at ${num(a.maxSleep.alt)} m.` : ''}`,
    ],
    [`How difficult is it?`, `We grade it ${DIFFICULTY[t.difficulty].label.toLowerCase()}. ${t.difficultyNote}`],
    [`Which permits do I need?`, t.permitObjs.length ? `${t.permitObjs.map((p) => p.short).join(', ')}. Fees and where to get each one are listed in the permits section above.` : 'No trekking permit is needed for this route.'],
    [`Do I need a guide?`, t.guide.note],
    [`When is the best time to go?`, `${monthRanges(t.seasons.best)} ${t.seasons.best.length > 1 ? 'are' : 'is'} best. ${t.seasons.note}`],
  ];

  const sections = [
    ['overview', 'Overview'],
    ['profile', 'Altitude'],
    ['itinerary', 'Day by day'],
    ['map', 'Map'],
    ['season', 'When to go'],
    ['permits', 'Permits'],
    ['access', 'Getting there'],
    ['safety', 'Hazards'],
    ['plan', 'Plan dates'],
  ];

  const body = html`
<article class="trek ${hueClass(r)}" data-trek-page="${t.slug}">
  <header class="page-head trek-head">
    <div class="wrap">
      <nav aria-label="Breadcrumb"><ol class="breadcrumb">
        <li><a href="${u()}">Home</a></li><li><a href="${u('treks/')}">Treks</a></li><li><a href="${u(`regions/${r.slug}/`)}">${r.name}</a></li><li aria-current="page">${t.name}</li>
      </ol></nav>
      <div class="cluster" style="--gap:.5rem;margin-bottom:.75rem">
        ${regionTag(ctx, r)}
        ${t.restricted ? html`<span class="badge badge-watch">${icon('shield-alert', { size: 14 })}Restricted area</span>` : ''}
        ${grade(t.difficulty)}
      </div>
      <h1>${t.name}</h1>
      <p class="lead">${t.summary}</p>
      <div class="cluster trek-actions no-print">
        <a class="btn btn-lg" href="${u(`plan/?trek=${t.slug}`)}">${icon('calendar-check', { size: 20 })}Plan this trek</a>
        <a class="btn btn-secondary" href="#itinerary">${icon('list', { size: 18 })}Day by day</a>
        <button type="button" class="btn btn-secondary" data-save="${t.slug}" aria-pressed="false">${icon('bookmark', { size: 18 })}<span data-save-label>Save</span></button>
        <button type="button" class="btn btn-secondary" data-share data-share-title="${t.name} trek · ${config.name}" data-share-text="${t.tagline}">${icon('share-2', { size: 18 })}Share</button>
        <button type="button" class="btn btn-secondary" data-offline hidden>${icon('download', { size: 18 })}Keep offline</button>
      </div>
    </div>
    ${raw(ridgeStrip({ seed: seedOf(t.slug) }))}
  </header>

  <nav class="subnav no-print" aria-label="On this page">
    <div class="wrap"><div class="tabs">${sections.map(([id, label]) => html`<a href="#${id}">${label}</a>`)}</div></div>
  </nav>

  <div class="wrap trek-layout">
    <div class="trek-main">
      ${noticesBlock(noticesFor(content, { trek: t.slug }))}
      ${t.photo
        ? html`<figure class="trek-photo-fig">
            <img src="${u(`photos/${t.photo.file}`)}" srcset="${u(`photos/${t.photo.small}`)} 720w, ${u(`photos/${t.photo.file}`)} ${t.photo.width}w" sizes="(max-width: 760px) 100vw, 52rem" alt="${t.photo.alt}" width="${t.photo.width}" height="${t.photo.height}" style="object-position:${t.photo.focus || '50% 50%'}" fetchpriority="high">
            <figcaption>${t.photo.caption} <span class="photo-credit">Photo: <a href="${t.photo.source}" rel="noopener">${t.photo.author}</a>, <a href="${t.photo.licenceUrl}" rel="noopener license">${t.photo.licence}</a></span></figcaption>
          </figure>`
        : ''}
      <dl class="stats trek-stats">
        <div><dt>Duration</dt><dd>${daysRange(t.daysRange)}</dd></div>
        <div><dt>Distance</dt><dd>${km(t.distanceKm)}<small>approximate</small></dd></div>
        <div><dt>Highest point</dt><dd>${metres(t.maxAlt.m)}<small>${t.maxPlace.name} · ${feet(t.maxAlt.m)}</small></dd></div>
        ${a.maxSleep ? html`<div><dt>Highest night</dt><dd>${metres(a.maxSleep.alt)}<small>${a.maxSleep.label}</small></dd></div>` : ''}
        <div><dt>Difficulty</dt><dd>${DIFFICULTY[t.difficulty].label}<small>${t.style.map((s) => STYLE_LABEL[s]).join(' · ')}</small></dd></div>
        <div><dt>Best months</dt><dd>${monthRanges(t.seasons.best)}</dd></div>
      </dl>

      <section class="forme card card-pad" aria-labelledby="forme-title">
        <h2 id="forme-title">Is this trek right for me?</h2>
        <ul class="forme-list">
          <li>${icon('footprints', { size: 26 })}<div><h3>The walking</h3><p>${forMe.walking}</p></div></li>
          <li>${icon('mountain', { size: 26 })}<div><h3>The height</h3><p>${forMe.height}</p></div></li>
          <li>${icon('bed-double', { size: 26 })}<div><h3>Where you sleep</h3><p>${forMe.sleep}</p></div></li>
          <li>${icon('signpost', { size: 26 })}<div><h3>The help you need</h3><p>${forMe.help}</p></div></li>
          ${forMe.cost ? html`<li>${icon('wallet', { size: 26 })}<div><h3>What it costs</h3><p>${forMe.cost}</p></div></li>` : ''}
        </ul>
        <div class="cluster no-print" style="--gap:.75rem">
          <a class="btn btn-lg" href="${u(`plan/?trek=${t.slug}`)}">${icon('calendar-check', { size: 20 })}Plan this trek</a>
          <a class="btn btn-lg btn-secondary" href="${u('plan/')}">Help me choose a different one</a>
        </div>
      </section>

      <section id="overview" class="trek-section">
        <h2>Overview</h2>
        <div class="prose">${t.intro.map((p) => html`<p>${p}</p>`)}</div>
        <h3>Highlights</h3>
        <ul class="ticks">${t.highlights.map((x) => html`<li>${x}</li>`)}</ul>
        <p class="small muted">${icon('gauge', { size: 15 })} <strong>${DIFFICULTY[t.difficulty].label}:</strong> ${t.difficultyNote}</p>
      </section>

      <section id="profile" class="trek-section">
        <h2>Altitude profile</h2>
        <p class="muted">Height at the end of each day, with the high points in between. Dots are the places you sleep.</p>
        <figure class="card card-pad profile-card" aria-label="Altitude by day for the ${t.name} trek. The same figures are listed in the day-by-day itinerary below.">
          ${raw(chart)}
          <script type="application/json" data-profile-points>${jsonScript(hoverPoints)}</script>
          <figcaption class="xsmall muted">Schematic: straight lines join known points, so climbs and descents within a day are not shown. Vehicle legs are drawn lighter.</figcaption>
        </figure>
        <div class="accl">
          <div class="accl-facts">
            <div><span>Nights above 3,000 m</span><strong>${a.nightsAbove3000}</strong></div>
            <div><span>Nights above 4,000 m</span><strong>${a.nightsAbove4000}</strong></div>
            <div><span>Biggest gain above 3,000 m</span><strong>${a.biggestGain ? html`${signed(a.biggestGain.counted)} m` : '—'}</strong>${a.biggestGain ? html`<small>to ${a.biggestGain.label}, day ${a.biggestGain.day}</small>` : ''}</div>
            <div><span>Rest days built in</span><strong>${t.restDays}</strong></div>
          </div>
          ${a.nightsAbove3000 === 0
            ? note('ok', html`<p><strong>Low altitude risk.</strong> You never sleep above 3,000 m on this itinerary, so altitude illness is unlikely. Mild headaches and breathlessness on the climbs are still normal.</p>`)
            : flagged.length === 0
              ? note('ok', html`<p><strong>The ascent rate is within the usual guideline</strong> of about ${RULES.dailyGain} m of sleeping altitude a day above ${num(RULES.startAlt)} m. People still differ, so watch for symptoms. <a href="${u(`safety/acclimatization/?trek=${t.slug}`)}">Open in the acclimatization checker</a>.</p>`)
              : note(
                  flagged.some((d) => d.level === 'high') ? 'danger' : 'warn',
                  html`<p><strong>${flagged.length} ${flagged.length === 1 ? 'night gains' : 'nights gain'} height faster than the usual guideline.</strong> That is common on standard itineraries, but it is where problems start. Check how you feel before each of these climbs.</p>
                    <ul>${flagged.map((d) => html`<li><a href="#day-${d.day}">Day ${d.day}, ${d.toPlace.name}</a>: ${d.reasons.join(' ')}</li>`)}</ul>
                    <p><a href="${u(`safety/acclimatization/?trek=${t.slug}`)}">Try adding a night in the acclimatization checker</a> · <a href="${u('safety/altitude-check/')}">Check your symptoms</a></p>`,
                )}
        </div>
      </section>

      <section id="itinerary" class="trek-section">
        <h2>Day by day</h2>
        <p class="muted">About ${hours(t.hoursTotal)} of walking in total. Times are for a steady pace with short breaks; add more for photos and tea.</p>
        <ol class="days">
          ${t.itinerary.map(
            (d) => html`<li class="day day-${d.kind}${d.level !== 'ok' ? ` day-${d.level}` : ''}" id="day-${d.day}">
              <div class="day-n"><span>Day</span><b>${d.day}</b><time data-plan-date hidden></time></div>
              <div class="day-body">
                <h3>${d.title}</h3>
                <p class="day-route">${d.mode !== 'walk' ? html`${icon(MODE_ICON[d.mode], { size: 15, label: MODE_LABEL[d.mode] })} ` : ''}${routeLine(d)}</p>
                <p>${d.note}</p>
                ${stayLine(d)}
                <div class="cluster" style="--gap:.4rem">
                  ${KIND_LABEL[d.kind] ? html`<span class="badge badge-info">${KIND_LABEL[d.kind]}</span>` : ''}
                  ${d.level !== 'ok' ? html`<span class="badge badge-${d.level}">${icon('triangle-alert', { size: 14 })}${d.level === 'high' ? 'Fast gain' : 'Watch this gain'}</span>` : ''}
                </div>
                ${d.level !== 'ok' ? html`<p class="xsmall muted day-reason">${d.reasons.join(' ')}</p>` : d.notes.length ? html`<p class="xsmall muted day-reason">${icon('info', { size: 13 })} ${d.notes.join(' ')}</p>` : ''}
              </div>
              <dl class="day-stats">
                <div><dt>${d.day === t.days && d.to !== t.gateway ? 'Walk ends at' : 'Sleep at'}</dt><dd>${metres(d.sleep)}</dd></div>
                <div><dt>Change</dt><dd class="${d.net > 0 ? 'up' : d.net < 0 ? 'down' : ''}">${signed(d.net)} m</dd></div>
                ${d.high ? html`<div><dt>High point</dt><dd>${metres(d.high)}</dd></div>` : ''}
                <div><dt>${d.mode === 'walk' ? 'Walking' : MODE_LABEL[d.mode]}</dt><dd>${hours(d.hours)}</dd></div>
                ${d.km ? html`<div><dt>Distance</dt><dd>${km(d.km)}</dd></div>` : ''}
              </dl>
            </li>`,
          )}
        </ol>
        ${t.variants && t.variants.length
          ? html`<h3>Ways to change it</h3>
            <div class="variants">${t.variants.map((v) => html`<details class="acc"><summary>${v.name}</summary><div><p>${v.text}</p></div></details>`)}</div>`
          : ''}
      </section>

      <section id="map" class="trek-section">
        <h2>Route map</h2>
        <div class="map" data-map>
          <div class="map-placeholder">
            ${icon('map', { size: 30 })}
            <p>The map loads when you scroll here. It needs a connection the first time; tiles you have viewed stay available offline.</p>
          </div>
        </div>
        <script type="application/json" data-map-data>${jsonScript({
          line: t.line,
          trail: t.trail,
          gaps: t.gaps,
          bounds: t.bounds,
          points: t.mapPlaces
            .map((p) => {
              const nights = t.itinerary.filter((d) => d.to === p.slug).map((d) => d.day);
              return { s: p.slug, n: p.name, a: p.alt, lat: p.lat, lon: p.lon, d: nights, k: p.slug === t.maxAlt.place ? 'high' : nights.length ? 'night' : p.slug === t.start ? 'start' : 'via', q: p.coordQuality };
            }),
        })}</script>
        <p class="map-note">${icon('info', { size: 14 })} ${t.trail.length
            ? html`The solid line follows footpaths mapped in OpenStreetMap${t.gaps.length ? '; dashed sections simply join two stops where no path is mapped' : ''}. It is a guide to where the route goes, not a navigation track: trails are rerouted after landslides, so follow the signs and people on the ground.`
            : 'The dashed line simply joins the stops in order; follow the trail on the map and on the ground, not the line.'} Marker positions come from OpenStreetMap where we could match a place, and from our own estimates elsewhere.${t.unmapped.length ? html` Not shown because we could not confirm ${t.unmapped.length === 1 ? 'its position' : 'their positions'}: ${t.unmapped.map((p) => p.name).join(', ')}.` : ''}</p>
        ${t.trail.length
          ? html`<p class="trail-file no-print"><a class="btn btn-secondary" href="${u(`treks/${t.slug}/${t.slug}.gpx`)}" download>${icon('download', { size: 18 })}Download the trail for a map app</a> <span class="small muted">A GPX file with ${num(t.trailKm)} km of mapped path and every stop${t.gaps.length ? '; sections with no mapped path are left out' : ''}. It opens in free apps such as Organic Maps.</span></p>`
          : ''}
        <div class="chips route-places">${t.routePlaces.map((p) => html`<a class="chip" href="${u(`places/${p.slug}/`)}">${p.name}<span class="muted xsmall">${num(p.alt)} m</span></a>`)}</div>
      </section>

      <section id="season" class="trek-section">
        <h2>When to go</h2>
        ${monthStrip(t.seasons, { large: true })}
        ${monthKey()}
        <p style="margin-top:1rem">${t.seasons.note}</p>
        <p class="small"><a class="link-arrow" href="${u('conditions/')}">See this month's conditions and forecasts${icon('arrow-right', { size: 16 })}</a></p>
      </section>

      <section id="permits" class="trek-section">
        <h2>Permits and guide rules</h2>
        ${note(t.guide.rule === 'required' ? 'warn' : 'info', html`<p><strong>${GUIDE_LABEL[t.guide.rule]}.</strong> ${t.guide.note}</p>`, { iconName: 'signpost' })}
        ${t.permitObjs.length
          ? html`<div class="grid grid-2 permit-grid">${t.permitObjs.map(permitCard)}</div>
            <p class="small muted">${content.permits.disclaimer} Last reviewed ${config.contentReviewed}. <a href="${u('permits/')}">All permits and fees</a></p>`
          : html`<p>No trekking permit is needed for this route.</p>`}
      </section>

      <section id="access" class="trek-section">
        <h2>Getting there</h2>
        <p>${t.access.summary}</p>
        ${t.access.options && t.access.options.length
          ? html`<ul class="access-list">
              ${t.access.options.map(
                (o) => html`<li>
                  <span class="access-icon">${icon(MODE_ICON[o.mode], { size: 20 })}</span>
                  <div><strong>${MODE_LABEL[o.mode]}: ${content.placeMap.get(o.from).name} to ${content.placeMap.get(o.to).name}</strong><span class="muted"> · ${o.time}</span>${o.note ? html`<p class="small muted">${o.note}</p>` : ''}</div>
                </li>`,
              )}
            </ul>`
          : ''}
        <dl class="kv">
          <dt>Gateway</dt><dd>${placeLink(t.gatewayPlace)}</dd>
          <dt>Walk starts</dt><dd>${placeLink(t.startPlace)} · ${metres(t.startPlace.alt)}</dd>
          <dt>Walk ends</dt><dd>${placeLink(t.endPlace)} · ${metres(t.endPlace.alt)}</dd>
        </dl>
      </section>

      <section id="safety" class="trek-section">
        <h2>Hazards on this route</h2>
        <div class="hazards">
          ${t.hazards.map((h) => html`<div class="hazard">${icon('triangle-alert', { size: 20 })}<div><h3>${h.title}</h3><p>${h.text}</p></div></div>`)}
        </div>
        <h3>Practical tips</h3>
        <ul class="ticks">${t.tips.map((x) => html`<li>${x}</li>`)}</ul>
        <p class="small cash-note">${icon('banknote', { size: 16 })} ${atms.length
          ? html`<strong>Cash machines on the route:</strong> ${atms.map((p, i) => html`${i ? ', ' : ''}<a href="${u(`places/${p.slug}/`)}">${p.name}</a>`)}. They run out of cash and go offline, so carry what you need from ${t.gatewayPlace.name}.`
          : html`<strong>We know of no cash machines on this route.</strong> Carry all the rupees you need from ${t.gatewayPlace.name}.`} <a href="${u(`tools/budget/?trek=${t.slug}`)}">Work out how much</a>.</p>
        <div class="cluster" style="--gap:.6rem;margin-top:1.25rem">
          <a class="btn btn-secondary btn-sm" href="${u('safety/altitude-check/')}">${icon('heart-pulse', { size: 16 })}Altitude sickness check</a>
          <a class="btn btn-secondary btn-sm" href="${u('safety/emergency/')}">${icon('siren', { size: 16 })}Emergency numbers</a>
        </div>
      </section>

      <section id="plan" class="trek-section no-print" data-plan="${t.slug}">
        <div class="plan-cta card card-pad">
          <div>
            <h2>Plan this trek</h2>
            <p>Choose your dates and see the whole trip on one page: where you sleep each night, who can help you, what it may cost and the papers you need. Then ask for a price.</p>
            <p class="plan-cta-saved" data-plan-saved hidden></p>
          </div>
          <a class="btn btn-lg" href="${u(`plan/?trek=${t.slug}`)}" data-plan-open>${icon('calendar-check')}<span>Plan this trek</span></a>
        </div>
        <h3 class="plan-tools-h">More tools for this trek</h3>
        <div class="grid grid-3" style="margin-top:1rem">
          <a class="card card-pad card-link feature" href="${u(`tools/packing/?trek=${t.slug}`)}"><span class="feature-icon">${icon('list-checks', { size: 22 })}</span><h3>Packing list</h3><p>Built for ${num(t.maxAlt.m)} m and ${STYLE_LABEL[t.style[0]].toLowerCase()}.</p></a>
          <a class="card card-pad card-link feature" href="${u(`tools/budget/?trek=${t.slug}`)}"><span class="feature-icon">${icon('calculator', { size: 22 })}</span><h3>Budget</h3><p>Permits, guide, porter, food and lodging for ${t.days} days.</p></a>
          <a class="card card-pad card-link feature" href="${u(`safety/acclimatization/?trek=${t.slug}`)}"><span class="feature-icon">${icon('trending-up', { size: 22 })}</span><h3>Acclimatization</h3><p>Adjust the nights and see how the risk changes.</p></a>
          <a class="card card-pad card-link feature" href="${u(`safety/insurance/?trek=${t.slug}`)}"><span class="feature-icon">${icon('shield-check', { size: 22 })}</span><h3>Insurance</h3><p>What your policy must cover up to ${num(t.maxAlt.m)} m.</p></a>
          <a class="card card-pad card-link feature" href="${u(`tools/compare/?t=${t.slug}${t.relatedTreks[0] ? ',' + t.relatedTreks[0].slug : ''}`)}"><span class="feature-icon">${icon('scale', { size: 22 })}</span><h3>Compare</h3><p>Set this route beside another one.</p></a>
        </div>
      </section>

      <section id="people" class="trek-section">
        <h2>Who can help you on this trek</h2>
        <p>${forMe.help}</p>
        <ul class="help-rows">
          ${helpRows.map(
            (r) => html`<li class="${r.blocked ? 'is-off' : ''}">
              ${icon(r.blocked ? 'x' : 'check', { size: 20 })}
              <div><strong>${r.label}</strong>${r.cost ? html`<span>${r.cost}</span>` : ''}${r.blocked ? html`<span>${r.blocked}</span>` : ''}</div>
            </li>`,
          )}
        </ul>
        <div class="cluster" style="--gap:.75rem;margin-top:1.25rem">
          <a class="btn" href="${u(`plan/?trek=${t.slug}`)}">${icon('send', { size: 18 })}${asking ? 'Plan this trek and ask us for help' : 'Plan this trek and ask for a price'}</a>
          <a class="btn btn-secondary" href="${u('services/')}">What each of them does</a>
        </div>
        <p class="small muted" style="margin-top:1rem">Do you work on the ${t.name} route as a guide, porter or company? <a href="${u(`partners/?trek=${t.slug}`)}">Join ${config.name}</a>.</p>
      </section>

      <section id="faq" class="trek-section">
        <h2>Quick answers</h2>
        ${faqs.map(([q, ans]) => html`<details class="acc"><summary>${q}</summary><div><p>${ans}</p></div></details>`)}
      </section>

      <p class="small muted trek-foot">${icon('info', { size: 14 })} ${CONFIDENCE[t.confidence]} Reviewed ${config.contentReviewed}. Trails, lodges and rules change; confirm locally before you rely on any detail. <a href="${u('support/#corrections')}">Report a correction</a>.</p>
    </div>

    <aside class="trek-side no-print" aria-label="At a glance">
      <div class="card card-pad glance">
        <h2>At a glance</h2>
        <dl class="kv">
          <dt>Region</dt><dd><a href="${u(`regions/${r.slug}/`)}">${r.long}</a></dd>
          <dt>Starts</dt><dd>${t.startPlace.name}</dd>
          <dt>Ends</dt><dd>${t.endPlace.name}</dd>
          <dt>Walking</dt><dd>${hours(t.hoursTotal)} over ${t.walkingDays} days</dd>
          <dt>Sleeping</dt><dd>${t.style.map((s) => STYLE_LABEL[s]).join(', ')}</dd>
          <dt>Guide</dt><dd>${GUIDE_LABEL[t.guide.rule].replace('Guide ', '').replace(/^./, (c) => c.toUpperCase())}</dd>
          <dt>Permits</dt><dd>${t.permitObjs.length ? t.permitObjs.map((p) => p.short).join(', ') : 'None'}</dd>
        </dl>
        <a class="btn btn-block" href="#plan">${icon('calendar-days', { size: 18 })}Plan dates</a>
      </div>
      <div class="card card-pad glance-safety">
        <h2>Feeling rough up high?</h2>
        <p class="small">A headache plus one other symptom above 2,500 m is altitude sickness until proven otherwise.</p>
        <a class="btn btn-secondary btn-block btn-sm" href="${u('safety/altitude-check/')}">${icon('heart-pulse', { size: 16 })}Check symptoms</a>
      </div>
    </aside>
  </div>

  ${t.relatedTreks.length
    ? html`<section class="section section-alt">
        <div class="wrap">
          <div class="section-head"><h2>Similar treks</h2><a class="link-arrow" href="${u(`regions/${r.slug}/`)}">More in ${r.name}${icon('arrow-right', { size: 18 })}</a></div>
          <div class="trek-grid">${t.relatedTreks.slice(0, 4).map((x) => trekCard(ctx, x))}</div>
        </div>
      </section>`
    : ''}
</article>`;

  return {
    title: t.name.length > 26 ? `${t.name}: ${t.days}-Day Itinerary & Permits` : `${t.name} Trek: ${t.days}-Day Itinerary, Altitude & Permits`,
    description: t.summary,
    section: 'treks',
    scripts: ['trek'],
    styles: ['map'],
    ogType: 'article',
    crumbs: [['treks/', 'Treks'], [`regions/${r.slug}/`, r.name], [null, t.name]],
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'TouristTrip',
        name: `${t.name} Trek`,
        description: t.summary,
        touristType: 'Trekking',
        url: `${config.siteUrl}/treks/${t.slug}/`,
        itinerary: {
          '@type': 'ItemList',
          numberOfItems: t.days,
          itemListElement: t.itinerary.map((d) => ({ '@type': 'ListItem', position: d.day, name: d.title })),
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(([q, ans]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: ans } })),
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------

const DAY_BUCKETS = [
  ['short', 'Up to 5 days', (t) => t.daysRange[0] <= 5],
  ['week', '6–10 days', (t) => t.daysRange[0] <= 10 && t.daysRange[1] >= 6],
  ['fortnight', '11–15 days', (t) => t.daysRange[0] <= 15 && t.daysRange[1] >= 11],
  ['long', '16 days or more', (t) => t.daysRange[1] >= 16],
];
const ALT_BUCKETS = [
  ['low', 'Below 3,500 m', (t) => t.maxAlt.m < 3500],
  ['mid', '3,500–5,000 m', (t) => t.maxAlt.m >= 3500 && t.maxAlt.m < 5000],
  ['high', 'Above 5,000 m', (t) => t.maxAlt.m >= 5000],
];

export function treksIndexPage(ctx) {
  const { u, content } = ctx;
  const treks = content.treks;
  const chip = (name, value, label) => html`<label class="chip"><input type="checkbox" name="${name}" value="${value}">${label}</label>`;

  const body = html`
<header class="page-head">
  <div class="wrap">
    <nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="${u()}">Home</a></li><li aria-current="page">Treks</li></ol></nav>
    <h1>Treks in Nepal</h1>
    <p class="lead">${treks.length} routes with day-by-day stages, sleeping altitudes, permits and honest notes on what makes each one hard.</p>
  </div>
  ${raw(ridgeStrip({ seed: 3 }))}
</header>
<div class="wrap section-tight">
  <form class="filters card card-pad" data-filters hidden aria-label="Filter treks">
    <div class="filters-top">
      <div class="field filters-search">
        <label class="sr-only" for="f-q">Search treks</label>
        <input class="input" type="search" id="f-q" name="q" placeholder="Search by name, e.g. Annapurna" autocomplete="off">
      </div>
      <div class="field">
        <label class="sr-only" for="f-month">Month</label>
        <select class="select" id="f-month" name="month"><option value="">Any month</option>${MONTHS.map((m, i) => html`<option value="${i + 1}">Good in ${m}</option>`)}</select>
      </div>
      <div class="field">
        <label class="sr-only" for="f-sort">Sort</label>
        <select class="select" id="f-sort" name="sort">
          <option value="">Sort: popular first</option><option value="days">Shortest first</option><option value="days-desc">Longest first</option>
          <option value="alt">Lowest first</option><option value="alt-desc">Highest first</option><option value="name">A to Z</option>
        </select>
      </div>
    </div>
    <details class="filters-more" data-filters-more>
      <summary>${icon('sliders-horizontal', { size: 18 })}Filters <span class="badge badge-info" data-filter-count hidden></span></summary>
      <div class="filters-groups">
        <fieldset><legend>Region</legend><div class="chips">${content.regions.filter((r) => r.treks.length).map((r) => chip('region', r.slug, r.name))}</div></fieldset>
        <fieldset><legend>Length</legend><div class="chips">${DAY_BUCKETS.map(([v, l]) => chip('days', v, l))}</div></fieldset>
        <fieldset><legend>Difficulty</legend><div class="chips">${Object.entries(DIFFICULTY).map(([v, d]) => chip('grade', v, d.label))}</div></fieldset>
        <fieldset><legend>Highest point</legend><div class="chips">${ALT_BUCKETS.map(([v, l]) => chip('alt', v, l))}</div></fieldset>
        <fieldset><legend>Style</legend><div class="chips">${chip('style', 'teahouse', 'Teahouse lodges')}${chip('style', 'camping', 'Camping')}${chip('style', 'homestay', 'Homestays')}${chip('open', '1', 'No restricted-area permit')}</div></fieldset>
      </div>
    </details>
    <div class="filters-status">
      <p aria-live="polite" data-filter-status>${treks.length} treks</p>
      <button type="reset" class="btn btn-ghost btn-sm" data-filter-reset hidden>Clear filters</button>
    </div>
  </form>

  <div class="trek-grid" data-trek-list>
    ${treks.map((t, i) => {
      const card = trekCard(ctx, t, { heading: 'h2' });
      const data = {
        slug: t.slug,
        name: `${t.name} ${(t.aka || []).join(' ')} ${t.regionObj.long}`.toLowerCase(),
        region: t.region,
        grade: t.difficulty,
        days: DAY_BUCKETS.filter(([, , f]) => f(t)).map(([v]) => v).join(' '),
        alt: ALT_BUCKETS.find(([, , f]) => f(t))[0],
        months: [...t.seasons.best, ...t.seasons.good].join(' '),
        best: t.seasons.best.join(' '),
        style: t.style.join(' '),
        open: t.restricted ? '0' : '1',
        d: t.daysRange[0],
        m: t.maxAlt.m,
        i,
      };
      return html`<div class="trek-cell" ${raw(Object.entries(data).map(([k, v]) => `data-${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' '))}>${card}</div>`;
    })}
  </div>
  <div class="empty" data-filter-empty hidden>
    <h3>No trek matches all of those</h3>
    <p>Try removing a filter, or widen the length or altitude range.</p>
    <button type="button" class="btn btn-secondary" data-filter-reset-2>Clear filters</button>
  </div>
</div>`;

  return {
    title: 'Treks in Nepal: Routes, Itineraries & Altitude Profiles',
    description: `${treks.length} Nepal trekking routes with day-by-day itineraries, altitude profiles, permits, seasons and difficulty. Filter by length, region and month.`,
    section: 'treks',
    scripts: ['treks'],
    crumbs: [[null, 'Treks']],
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Treks in Nepal',
        numberOfItems: treks.length,
        itemListElement: treks.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${ctx.config.siteUrl}/treks/${t.slug}/` })),
      },
    ],
  };
}
