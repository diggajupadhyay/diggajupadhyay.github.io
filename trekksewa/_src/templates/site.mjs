// About, help, legal, credits, saved treks, offline and not-found pages, and the journal.

import { html, raw } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { ridgeStrip } from '../lib/landscape.mjs';
import { longDate, num } from '../lib/format.mjs';
import { note, arrowLink } from './partials.mjs';

const head = (ctx, { crumbs, title, lead, seed, eyebrow }) => html`<header class="page-head">
  <div class="wrap">
    <nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="${ctx.u()}">Home</a></li>${crumbs.map(([href, label]) => (href ? html`<li><a href="${ctx.u(href)}">${label}</a></li>` : html`<li aria-current="page">${label}</li>`))}</ol></nav>
    ${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ''}
    <h1>${title}</h1>
    ${lead ? html`<p class="lead">${lead}</p>` : ''}
  </div>
  ${raw(ridgeStrip({ seed }))}
</header>`;

// ------------------------------------------------------------------ about

export function aboutPage(ctx) {
  const { u, content, config } = ctx;
  const body = html`
${head(ctx, { crumbs: [[null, 'About']], title: html`About ${config.name} <span class="ne" lang="ne">${config.nameNe}</span>`, lead: 'A trekking companion for Nepal, built around two ideas: tell people the truth about a route, and treat the people who work on it fairly.', seed: 81 })}
<div class="wrap wrap-narrow section-tight">
  <div class="prose">
    <h2>Why we are building this</h2>
    <p><span lang="ne">सेवा</span> (sewa) means service. Trekking in Nepal depends on service at every step: the guide who notices you have gone quiet, the porter who reaches the lodge before you, the lodge owner who knows whether the pass will go tomorrow. Most of what a trekker needs to know lives in those people's heads, and most of what goes wrong happens when a visitor never gets to hear it.</p>
    <p>${config.name} puts the basics in one place and says them plainly: how long a route really takes, how high you sleep each night, which permits you need, what tends to go wrong, and what to do when it does.</p>
    <h2>What is here today</h2>
    <ul>
      <li><strong>${content.treks.length} route guides</strong> with day-by-day stages, altitude profiles and an automatic acclimatization check.</li>
      <li><strong>${content.places.length} places</strong> with altitude, facilities and a live forecast.</li>
      <li><strong>Safety tools</strong> that work offline: an altitude sickness check, an acclimatization checker and an emergency toolkit.</li>
      <li><strong>Planning tools</strong> for dates, packing and budget, and a GPX viewer.</li>
    </ul>
    <h2>What comes next</h2>
    <p>The second half of the name is the harder half. We are enrolling licensed guides, porters, registered agencies and gear shops so that trekkers can find and contact them directly, with their credentials in view and a shared set of <a href="${u('services/#standards')}">fair-trek standards</a> behind every listing. If that is you, <a href="${u('partners/')}">applications are open</a>.</p>
    <h2>How we handle information</h2>
    <ul>
      <li>Everything is written for ${config.name}. We do not copy other sites or guidebooks.</li>
      <li>Where a figure is uncertain we say so, and each trek shows how well established its details are.</li>
      <li>Fees and rules carry the date we last reviewed them. This content was last reviewed in ${longDate(config.contentReviewed)}.</li>
      <li>We do not publish trail status we cannot stand behind. A stale report is worse than none.</li>
      <li>We do not show invented businesses, reviews or statistics. Sample profiles are labelled as samples.</li>
    </ul>
    <h2>What this is not</h2>
    <p>${config.name} is a planning aid. It is not a guide, a rescue service, a medical service or a substitute for a map and your own judgement. Mountains change faster than websites.</p>
    <p><a href="${u('support/')}">Help and common questions</a> · <a href="${u('credits/')}">Data and credits</a> · <a href="${u('privacy/')}">Privacy</a></p>
  </div>
</div>`;
  return { title: `About ${config.name}`, description: `${config.name} is a trekking companion for Nepal: honest route guides, offline safety tools and a growing network of guides, porters, agencies and gear shops.`, section: 'about', crumbs: [[null, 'About']], body };
}

// ------------------------------------------------------------------ support / FAQ

export function supportPage(ctx) {
  const { u, config, content } = ctx;
  const groups = [
    [
      'Using the site',
      [
        ['Is it free?', `Yes. Reading the guides and using every tool is free and needs no account.`],
        ['Do I need to sign up?', 'No. Saved treks, plans, packing lists and your emergency card are stored in your browser on your own device. Nothing is sent to us.'],
        ['Will my saved things appear on my other phone or laptop?', 'No. Because they live in your browser, each device has its own. Clearing your browser data for this site removes them.'],
        ['Is there an app?', `${config.name} is a web app. On most phones you can add it to your home screen from the browser menu and it will open full-screen like any other app.`],
      ],
    ],
    [
      'Offline',
      [
        ['What works without a connection?', 'The safety tools (altitude check, acclimatization checker, emergency page), your saved treks, and every page you have already opened. Open the pages you will need while you still have Wi-Fi, or use the “Keep offline” button on a trek.'],
        ['Do the maps work offline?', 'Map tiles you have already looked at are kept, so pan and zoom along your route beforehand. We do not bulk-download maps, because the free map services we use do not allow it. For full offline mapping carry a dedicated app or a paper map.'],
        ['Does the forecast work offline?', 'No. You will see the last forecast you loaded, with its time, marked as saved.'],
        ['Does GPS work without signal?', 'Yes. Your phone finds its position from satellites, not the mobile network. Sending that position to someone does need signal or Wi-Fi.'],
      ],
    ],
    [
      'Accuracy',
      [
        ['How accurate are the route guides?', 'They are written from long familiarity with these routes and checked against published sources, but lodges close, trails move and rules change. Each trek states how well established its details are. Treat distances and times as approximate and confirm anything important locally.'],
        ['How accurate are the map markers?', (content.positions.osm * 2 > content.positions.total ? 'Most' : 'Many') + ' markers take their position from OpenStreetMap; the rest are our own estimates and are labelled approximate. Places we could not confirm are not drawn at all. The dashed line on a trek map simply joins the stops in order. Follow the trail on the map and on the ground, not the line.'],
        ['Are permit fees current?', `They were last reviewed in ${longDate(config.contentReviewed)}, and each permit shows whether we could confirm it. Fees change, sometimes mid-season, so check with the Nepal Tourism Board or your agency before you pay.`],
        ['Is the altitude sickness check a diagnosis?', 'No. It is an educational aid based on a standard scoring system. It cannot examine you. If someone is getting worse at altitude, descend.'],
      ],
    ],
    [
      'Guides, porters, agencies and gear',
      [
        ['Can I book a guide or porter through the site?', 'Not yet. We are enrolling partners now and will open the directory once there are enough verified profiles to be useful.'],
        ['How do I get listed?', 'Fill in the application on the partners page. It takes about five minutes and can be completed in English or Nepali.'],
        ['Does it cost anything to apply?', 'No.'],
      ],
    ],
  ];
  const body = html`
${head(ctx, { crumbs: [[null, 'Help']], title: 'Help and common questions', lead: 'How the site works, what it can and cannot do offline, and how far to trust it.', seed: 83 })}
<div class="wrap wrap-narrow section-tight">
  ${groups.map(
    ([title, items]) => html`<section class="faq-group" id="${title.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '')}">
      <h2>${title}</h2>
      ${items.map(([q, a]) => html`<details class="acc"><summary>${q}</summary><div><p>${a}</p></div></details>`)}
    </section>`,
  )}
  <section class="faq-group" id="corrections">
    <h2>Found a mistake?</h2>
    <p>If a stage, an altitude, a fee or a phone number is wrong, we want to know. Tell us which page, what is wrong and how you know.</p>
    ${config.contact.email
      ? html`<a class="btn" href="mailto:${config.contact.email}?subject=Correction">${icon('mail', { size: 18 })}Email a correction</a>`
      : note('plain', html`<p>A contact address for corrections will be published here when the partner network opens.</p>`)}
  </section>
  <section class="faq-group">
    <h2>In an emergency</h2>
    <p>This page cannot help you in an emergency. <a href="${u('safety/emergency/')}">Open the emergency toolkit</a>, or call Nepal Police on <a href="tel:100">100</a> or the Tourist Police on <a href="tel:1144">1144</a>.</p>
  </section>
</div>`;
  return {
    title: 'Help and Common Questions',
    description: `How ${config.name} works: what is free, what works offline, how accurate the guides, maps and fees are, and how guides, porters and agencies can join.`,
    section: 'about',
    crumbs: [[null, 'Help']],
    body,
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: groups.flatMap(([, items]) => items).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }],
  };
}

// ------------------------------------------------------------------ privacy & terms

export function privacyPage(ctx) {
  const { u, config } = ctx;
  const body = html`
${head(ctx, { crumbs: [[null, 'Privacy']], title: 'Privacy', lead: 'The short version: there are no accounts, no advertising and no tracking, and what you save stays on your device.', seed: 85 })}
<div class="wrap wrap-narrow section-tight"><div class="prose">
  <p class="small muted">Last updated ${longDate(config.contentReviewed)}.</p>
  <h2>What stays on your device</h2>
  <p>Saved treks, trek dates, packing lists, budget figures, altitude-check history, your emergency card, a loaded GPX track and any track you record are stored in your browser's own storage. They are never sent to ${config.name}. Clearing this site's data in your browser removes them.</p>
  <h2>Location</h2>
  <p>The emergency page and the GPX viewer ask for your position only when you press a button to use it. Your position is shown to you and placed in a message that you choose to send from your own phone. We do not receive or store it.</p>
  <h2>Requests your browser makes to others</h2>
  <ul>
    <li><strong>Weather.</strong> Forecasts come from Open-Meteo. Your browser sends the coordinates of the place you are looking at, not your own position, along with your IP address as with any web request.</li>
    <li><strong>Maps.</strong> Map images come from OpenStreetMap and OpenTopoMap tile servers, which see your IP address and which map areas you view.</li>
    <li><strong>Hosting.</strong> The site is served by GitHub Pages, which keeps standard server logs.</li>
  </ul>
  <p>We use no analytics, no advertising networks, no social-media trackers and no cookies of our own.</p>
  <h2>Partner applications</h2>
  <p>If you apply to be listed as a guide, porter, agency or shop, the details you submit are used only to review your application, contact you and, with your approval, publish your profile. We do not sell or share applicant details. You can ask for your application or profile to be corrected or deleted at any time.</p>
  <p>Until online applications are switched on, the application form keeps your answers on your device only.</p>
  <h2>Children</h2>
  <p>The site is not directed at children and does not knowingly collect information from them.</p>
  <h2>Changes</h2>
  <p>If the way we handle information changes, for example when partner accounts are introduced, this page will be updated before the change takes effect.</p>
  <p><a href="${u('terms/')}">Terms of use</a> · <a href="${u('credits/')}">Data and credits</a></p>
</div></div>`;
  return { title: 'Privacy', description: `How ${config.name} handles information: no accounts, no tracking, and saved data that stays on your device.`, section: 'about', crumbs: [[null, 'Privacy']], body };
}

export function termsPage(ctx) {
  const { u, config } = ctx;
  const body = html`
${head(ctx, { crumbs: [[null, 'Terms']], title: 'Terms of use', lead: 'Plain terms for a planning tool. Please read the safety section even if you skip the rest.', seed: 87 })}
<div class="wrap wrap-narrow section-tight"><div class="prose">
  <p class="small muted">Last updated ${longDate(config.contentReviewed)}.</p>
  <h2>Safety and your own judgement</h2>
  <p>Trekking at altitude is dangerous. ${config.name} provides general information to help you plan. It is not professional guiding, medical advice, a weather warning service or a rescue service, and nothing on it should be relied on as your only source for a decision that affects your safety.</p>
  <p>Trails, bridges, lodges, roads, flights, permits, fees and regulations change, sometimes overnight. Forecasts are model output and can be wrong. Map markers and lines are approximate. You are responsible for checking current conditions locally, for your choice of route, companions and equipment, and for turning back when that is the right call.</p>
  <p>The altitude tools are educational. They do not diagnose or treat any condition. If you or a companion are unwell at altitude, descend and seek medical help.</p>
  <h2>Accuracy</h2>
  <p>We work to keep the content correct and say where we are unsure, but we give no guarantee that any information is accurate, complete or current.</p>
  <h2>Services and partners</h2>
  <p>When the partner directory opens, guides, porters, agencies and shops listed on ${config.name} will be independent of us. Any agreement you make is between you and them. We check the credentials partners give us, but a listing is not a guarantee of their conduct or of the outcome of your trek.</p>
  <h2>Acceptable use</h2>
  <p>Do not misuse the site: no automated bulk copying of the content, no false partner applications, and no attempts to interfere with how it works.</p>
  <h2>Content and licence</h2>
  <p>The text, design and software of ${config.name} belong to ${config.name}. You may use the site for your own trips and share links to it. Map data is © OpenStreetMap contributors and is used under its own licence; see <a href="${u('credits/')}">Data and credits</a>.</p>
  <h2>Liability</h2>
  <p>To the extent the law allows, ${config.name} is provided as it is, and we are not liable for loss, injury or damage arising from use of the site or reliance on its content.</p>
  <h2>Changes</h2>
  <p>These terms will change as the service grows, in particular when bookings or partner accounts are introduced. The date above shows the latest version.</p>
  ${note('plain', html`<p>This page is a plain-language draft and has not yet been reviewed by a lawyer.</p>`)}
</div></div>`;
  return { title: 'Terms of Use', description: `Terms of use for ${config.name}, including the safety limits of a trek planning tool.`, section: 'about', crumbs: [[null, 'Terms']], body };
}

// ------------------------------------------------------------------ credits

export function creditsPage(ctx) {
  const { content, config } = ctx;
  const ext = (href, label) => html`<a href="${href}" rel="noopener" target="_blank">${label}</a>`;
  const permitSources = content.permits.permits.flatMap((p) => p.sources || []);
  const uniq = [...new Map([...permitSources, ...(content.emergency?.sources || [])].map((s) => [s.url, s])).values()];
  const pos = content.positions;
  const body = html`
${head(ctx, { crumbs: [[null, 'Data and credits']], title: 'Data and credits', lead: 'Where the information comes from, the open projects the site is built on, and the medical references behind the safety tools.', seed: 89 })}
<div class="wrap wrap-narrow section-tight"><div class="prose">
  <h2>Our own content</h2>
  <p>Route guides, place descriptions, hazard notes and articles are written for ${config.name}. Altitudes, stage plans and coordinates are compiled from general knowledge of the routes and cross-checked against published sources where we could.</p>
  <h2 id="positions">Place positions</h2>
  <p>The gazetteer holds ${num(pos.total)} places. Each started as our own estimate, which we then tested two ways: against OpenStreetMap, by looking the place up by name in the area around the estimate, and against a terrain elevation model (Copernicus DEM, through the Open-Meteo elevation service), where the ground height at the marker has to agree with the altitude we state.</p>
  <ul>
    <li><strong>${num(pos.osm)}</strong> take their position from OpenStreetMap. A match had to carry the right name and be the right kind of feature, and its height had to agree with ours wherever a height was mapped.</li>
    <li><strong>${num(pos.own)}</strong> keep our own estimate. OpenStreetMap gave no clear match, but the estimate sits on ground at the right height. These are labelled approximate.</li>
    <li><strong>${num(pos.hidden)}</strong> we could not confirm either way. They are listed with their altitude but are not drawn on any map, because a marker in the wrong place is worse than none.</li>
  </ul>
  <p>Positions are a planning aid and not survey data. Coordinates taken from OpenStreetMap are © ${ext('https://www.openstreetmap.org/copyright', 'OpenStreetMap contributors')} and remain under the Open Database Licence.</p>
  <h2>Maps</h2>
  <ul>
    <li>Map data © ${ext('https://www.openstreetmap.org/copyright', 'OpenStreetMap contributors')}, available under the Open Database Licence.</li>
    <li>Topographic map style © ${ext('https://opentopomap.org/', 'OpenTopoMap')} (CC-BY-SA), with elevation data from SRTM.</li>
    <li>Map display by ${ext('https://leafletjs.com/', 'Leaflet')} (BSD 2-Clause licence).</li>
  </ul>
  <h2>Weather</h2>
  <p>Forecasts by ${ext('https://open-meteo.com/', 'Open-Meteo')}, licensed under CC BY 4.0, from national weather service models. Open-Meteo's free service is for non-commercial use.</p>
  <h2 id="medical">Medical references</h2>
  <ul>
    <li>Roach RC, Hackett PH, Oelz O, et al. <em>The 2018 Lake Louise Acute Mountain Sickness Score.</em> High Altitude Medicine &amp; Biology, 2018. The scoring used in the altitude sickness check.</li>
    <li>Luks AM, Auerbach PS, Freer L, et al. <em>Wilderness Medical Society Clinical Practice Guidelines for the Prevention and Treatment of Acute Altitude Illness.</em> Wilderness &amp; Environmental Medicine. The ascent-rate thresholds used in the acclimatization checker.</li>
    <li>${ext('https://www.himalayanrescue.org/', 'Himalayan Rescue Association')} for practical guidance to trekkers in Nepal.</li>
    <li>${ext('https://ippg.net/', 'International Porter Protection Group')} for the porter welfare guidelines behind our fair-trek standards.</li>
  </ul>
  <p>The tools apply these references in simplified form for education. They are not medical devices.</p>
  <h2>Permit, fee and contact sources</h2>
  ${uniq.length ? html`<ul class="small">${uniq.slice(0, 60).map((s) => html`<li>${ext(s.url, s.title)}</li>`)}</ul>` : html`<p>Official notices of the Nepal Tourism Board, the Department of Immigration and the Department of National Parks and Wildlife Conservation.</p>`}
  <h2>Design and software</h2>
  <ul>
    <li>Typefaces: ${ext('https://fonts.google.com/specimen/Fraunces', 'Fraunces')} and ${ext('https://fonts.google.com/specimen/Figtree', 'Figtree')}, both under the SIL Open Font Licence.</li>
    <li>Icons: ${ext('https://lucide.dev/', 'Lucide')} (ISC licence).</li>
    <li>The mountain artwork is drawn by our own code. No photographs or third-party illustrations are used.</li>
  </ul>
</div></div>`;
  return { title: 'Data and Credits', description: `Sources, licences and medical references behind ${config.name}.`, section: 'about', crumbs: [[null, 'Data and credits']], body };
}

// ------------------------------------------------------------------ saved, offline, 404

export function savedPage(ctx) {
  const { u } = ctx;
  const body = html`
${head(ctx, { crumbs: [[null, 'Saved']], title: 'Saved on this device', lead: 'Your saved treks and plans. They live in this browser only and are available offline.', seed: 91 })}
<div class="wrap section-tight" data-saved>
  <section>
    <div class="section-head"><h2>Saved treks</h2><a class="link-arrow" href="${u('treks/')}">Browse treks${icon('arrow-right', { size: 18 })}</a></div>
    <div class="trek-grid" data-saved-treks></div>
    <div class="empty" data-saved-empty>
      <h3>Nothing saved yet</h3>
      <p>Tap <strong>Save</strong> on any trek to keep it here and make it available offline.</p>
      <a class="btn btn-secondary" href="${u('treks/')}">Find a trek</a>
    </div>
  </section>
  <section style="margin-top:2.5rem" data-saved-plans-box hidden>
    <div class="section-head"><h2>Planned dates</h2><a class="link-arrow" href="${u('tools/planner/')}">Trek planner${icon('arrow-right', { size: 18 })}</a></div>
    <ul class="plan-list" data-saved-plans></ul>
  </section>
  <section style="margin-top:2.5rem">
    <h2 class="h3">Also kept on this device</h2>
    <div class="cluster" style="--gap:.5rem">
      <a class="chip" href="${u('safety/emergency/')}">Emergency card</a>
      <a class="chip" href="${u('safety/altitude-check/')}">Altitude check history</a>
      <a class="chip" href="${u('tools/packing/')}">Packing list</a>
      <a class="chip" href="${u('tools/gpx/')}">GPX track</a>
    </div>
    <p class="small muted" style="margin-top:1rem">Clearing this site's data in your browser settings removes everything on this page.</p>
  </section>
  <noscript>${note('warn', html`<p>Saved treks need JavaScript.</p>`)}</noscript>
</div>`;
  return { title: 'Saved Treks', description: 'Your saved treks and plans, stored on this device and available offline.', section: 'saved', scripts: ['saved'], noindex: true, crumbs: [[null, 'Saved']], body };
}

export function offlinePage(ctx) {
  const { u } = ctx;
  const body = html`
<div class="wrap wrap-narrow section center status-page">
  <span class="status-icon">${icon('wifi-off', { size: 34 })}</span>
  <h1>You are offline</h1>
  <p class="lead" style="margin-inline:auto">This page has not been saved on your device yet. These always work without a connection:</p>
  <div class="grid grid-2" style="--gap:.75rem;text-align:left;margin-top:1.5rem">
    <a class="card card-pad card-link" href="${u('safety/emergency/')}"><strong>${icon('siren', { size: 18 })} Emergency &amp; SOS</strong><p class="small muted">Numbers, position, whistle and light.</p></a>
    <a class="card card-pad card-link" href="${u('safety/altitude-check/')}"><strong>${icon('heart-pulse', { size: 18 })} Altitude sickness check</strong><p class="small muted">Score your symptoms.</p></a>
    <a class="card card-pad card-link" href="${u('safety/acclimatization/')}"><strong>${icon('trending-up', { size: 18 })} Acclimatization checker</strong><p class="small muted">Test your itinerary.</p></a>
    <a class="card card-pad card-link" href="${u('saved/')}"><strong>${icon('bookmark', { size: 18 })} Saved treks</strong><p class="small muted">Everything you kept for offline.</p></a>
  </div>
  <p style="margin-top:1.5rem"><button type="button" class="btn btn-secondary" onclick="location.reload()">Try again</button></p>
</div>`;
  return { title: 'Offline', description: 'You are offline.', section: '', noindex: true, body };
}

export function notFoundPage(ctx) {
  const { u, content } = ctx;
  const body = html`
<div class="wrap wrap-narrow section center status-page">
  <span class="status-icon">${icon('signpost', { size: 34 })}</span>
  <h1>This trail does not go anywhere</h1>
  <p class="lead" style="margin-inline:auto">The page you asked for does not exist, or has moved. Try one of these instead.</p>
  <div class="cluster" style="justify-content:center;--gap:.6rem;margin-top:1.5rem">
    <a class="btn" href="${u('treks/')}">${icon('mountain-snow', { size: 18 })}All ${content.treks.length} treks</a>
    <a class="btn btn-secondary" href="${u('places/')}">Places</a>
    <a class="btn btn-secondary" href="${u('safety/')}">Safety tools</a>
    <button type="button" class="btn btn-secondary" data-search-open>${icon('search', { size: 18 })}Search</button>
  </div>
</div>`;
  return { title: 'Page Not Found', description: 'This page does not exist.', section: '', noindex: true, body };
}

// ------------------------------------------------------------------ journal

export function journalIndexPage(ctx) {
  const { u, content } = ctx;
  const body = html`
${head(ctx, { crumbs: [[null, 'Journal']], title: 'Journal', lead: 'Longer reads on how trekking in Nepal actually works, written for people planning a first or second trip.', seed: 93 })}
<div class="wrap section-tight">
  <div class="grid grid-3 article-grid">
    ${content.articles.map(
      (a) => html`<a class="card card-pad card-link article-card" href="${u(`journal/${a.slug}/`)}">
        <p class="eyebrow">${a.tags[0] || 'Guide'}</p>
        <h2 class="h3">${a.title}</h2>
        <p>${a.summary}</p>
        <span class="small muted">${a.minutes} min read</span>
      </a>`,
    )}
  </div>
</div>`;
  return { title: 'Journal: How Trekking in Nepal Works', description: 'Practical long reads on trekking in Nepal: teahouses, choosing a first trek, flights to Lukla, and going with or without a guide.', section: 'journal', crumbs: [[null, 'Journal']], body };
}

export function articlePage(ctx, a) {
  const { u, content, config } = ctx;
  const others = content.articles.filter((x) => x.slug !== a.slug).slice(0, 3);
  const body = html`
<article>
${head(ctx, { crumbs: [['journal/', 'Journal'], [null, a.title]], eyebrow: `${a.tags[0] || 'Guide'} · ${a.minutes} min read`, title: a.title, lead: a.summary, seed: 95 + a.slug.length })}
<div class="wrap wrap-narrow section-tight">
  <div class="prose article-body">${raw(a.html)}</div>
  <p class="small muted trek-foot">Reviewed ${longDate(a.reviewed || config.contentReviewed)}. Rules, fees and services change; confirm anything important before you rely on it.</p>
</div>
</article>
${others.length
  ? html`<section class="section-tight section-alt"><div class="wrap">
      <div class="section-head"><h2>Keep reading</h2>${arrowLink(u('journal/'), 'All articles')}</div>
      <div class="grid grid-3">${others.map((x) => html`<a class="card card-pad card-link article-card" href="${u(`journal/${x.slug}/`)}"><p class="eyebrow">${x.tags[0] || 'Guide'}</p><h3>${x.title}</h3><p>${x.summary}</p></a>`)}</div>
    </div></section>`
  : ''}`;
  return {
    title: a.title,
    description: a.summary,
    section: 'journal',
    ogType: 'article',
    crumbs: [['journal/', 'Journal'], [null, a.title]],
    body,
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.summary, dateModified: a.reviewed || config.contentReviewed, author: { '@type': 'Organization', name: config.name }, publisher: { '@type': 'Organization', name: config.name }, mainEntityOfPage: `${config.siteUrl}/journal/${a.slug}/` }],
  };
}
