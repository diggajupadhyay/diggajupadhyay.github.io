// About, help, legal, credits, saved treks, offline and not-found pages, and the journal.

import { html, raw } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { ridgeStrip } from '../lib/landscape.mjs';
import { longDate, num } from '../lib/format.mjs';
import { note, arrowLink, channelOf } from './partials.mjs';

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
      <li><strong><a href="${u('plan/')}">A step-by-step planner</a></strong>: a few plain questions, then your trek day by day, with where you sleep, who can help, what it may cost and the papers you need.</li>
      <li><strong>${content.treks.length} route guides</strong> with day-by-day stages, the footpath on a map, places to stay at each stop and a check of how fast each plan gains height.</li>
      <li><strong>${content.places.length} places</strong> with altitude, lodges, facilities and a live forecast.</li>
      <li><strong>Safety tools</strong> that work offline: an altitude sickness check, an acclimatization checker and an emergency toolkit.</li>
      <li><strong>Plain guidance on guides, porters and trekking companies</strong>: what each does, what they cost, how to ask for a price and what to check before you pay.</li>
    </ul>
    <h2>What comes next</h2>
    <p>The second half of the name is the harder half. We are enrolling licensed guides, porters, registered agencies and gear shops so that trekkers can reach them directly, with their credentials in view and a shared set of <a href="${u('services/#standards')}">fair-trek standards</a> behind every listing. Nobody is listed until their papers have been checked. If that is you, <a href="${u('partners/')}">applications are open</a>.</p>
    <h2>How we handle information</h2>
    <ul>
      <li>Everything is written for ${config.name}. We do not copy other sites or guidebooks.</li>
      <li>Where a figure is uncertain we say so, and each trek shows how well established its details are.</li>
      <li>Fees and rules carry the date we last reviewed them. This content was last reviewed in ${longDate(config.contentReviewed)}.</li>
      <li>Trails, lodges and photographs come from open sources and are credited. Prices are what companies list online, and are labelled as estimates.</li>
      <li>Notices about roads and trails show the day they were reported and the day we last checked. A stale report is worse than none.</li>
      <li>We do not show invented businesses, reviews or statistics.</li>
    </ul>
    <h2>What this is not</h2>
    <p>${config.name} is a planning aid. It is not a guide, a rescue service, a medical service or a substitute for a map and your own judgement. Mountains change faster than websites.</p>
    <p><a href="${u('support/')}">Help and common questions</a> · <a href="${u('credits/')}">Data and credits</a> · <a href="${u('privacy/')}">Privacy</a></p>
  </div>
</div>`;
  return { title: `About ${config.name}`, description: `${config.name} is a trekking companion for Nepal: a step-by-step trek planner, honest route guides, offline safety tools and plain advice on guides, porters and trekking companies.`, section: 'about', crumbs: [[null, 'About']], body };
}

// ------------------------------------------------------------------ support / FAQ

export function supportPage(ctx) {
  const { u, config, content } = ctx;
  const asking = channelOf(config) !== '';
  // plain meanings for the words a first-time trekker meets on these pages
  const words = [
    ['Trek', 'A walk of several days from village to village, sleeping somewhere new each night. No climbing skill is needed.'],
    ['Teahouse or lodge', 'A simple family-run guesthouse on the trail. You get a small twin room, a shared bathroom, and meals in a dining room with a stove.'],
    ['Guide', 'A licensed person who walks with you, knows the way, books the beds and looks after your safety.'],
    ['Porter', 'A person who carries your main bag from lodge to lodge, so that you walk with only a small day bag.'],
    ['Trekking company or agency', 'A registered business that arranges the whole trip for you: guide, porter, permits, transport and beds.'],
    ['Permit', 'A paper you pay for that allows you into a national park, a conservation area or a restricted area. It is checked on the trail.'],
    ['TIMS card', 'A registration card for trekkers, arranged through a trekking company. It records who is on which trail.'],
    ['Restricted area', 'A border region where foreigners may only trek with a registered company and a licensed guide, on a special permit.'],
    ['Altitude sickness', 'Feeling ill because the air is thin: headache, nausea, tiredness, poor sleep. It is common above 2,500 m and passes if you stop climbing. If it gets worse, you must go down.'],
    ['Acclimatization', 'Giving your body time to get used to the height, by climbing slowly and taking rest days. It is the single best protection against altitude sickness.'],
    ['Rest day', 'A day when you sleep at the same height for a second night. You usually take a short walk higher and come back down.'],
    ['Pass, or "La"', 'The low point of a ridge where the trail crosses from one valley to the next. Often the highest point of a trek.'],
    ['Base camp', 'The place at the foot of a big mountain where climbers start. On a trek it is a viewpoint, not a climb.'],
    ['Dal bhat', 'Rice with lentil soup and vegetables: the everyday meal of Nepal, filling, freshly cooked and refilled for free.'],
    ['Namaste', 'The greeting you will hear all day, said with palms together. It means "I greet you".'],
  ];
  const groups = [
    [
      'Planning a trek',
      [
        ['I have never trekked before. Where do I start?', `Open Plan my trek. It asks three simple questions (how many days, how much walking, which month), suggests treks that suit you, and then lays out a plan day by day.`],
        ['How fit do I need to be?', 'For a gentle trek you should be comfortable walking four hours a day for several days in a row, with some hills. Plenty of people trek in their sixties and seventies. Walk regularly for a few months beforehand, and choose a route that stays below about 3,500 m for your first time.'],
        ['I am over sixty. Is trekking in Nepal sensible?', 'Yes, with the right route and enough time. Talk to your doctor first, especially about your heart, lungs and any medicines. Take a guide, hire a porter, add rest days, and buy insurance that covers trekking to the height you will reach and rescue by helicopter.'],
        [
          'Can I book a guide, a porter or a trekking company here?',
          asking
            ? html`Yes, you can ask. <a href="${u('plan/')}">Make a plan</a>, press <strong>Get help arranging it</strong> and tick what you would like. Your request comes to our team, and we reply by email or WhatsApp. Asking is free.`
            : html`You can do everything except the booking itself. <a href="${u('plan/')}">Make a plan</a>, then press <strong>Share</strong> or <strong>Print</strong> and send it to two or three trekking companies or guides to ask for a price. Our own booking desk is not open yet; <a href="${u('services/agencies/')}">here is how to check that a company is registered</a>.`,
        ],
        ['Where will I sleep?', 'On most treks, in lodges (also called teahouses) in the villages along the trail. The planner and each place page list the lodges that are mapped at every stop.'],
        ['What will it cost?', 'The planner gives a range for your trek, your group and the help you choose. As a rough guide, a week on a popular lodge trek with a guide and a porter costs about USD 500 to 900 a person, not counting flights to Nepal.'],
      ],
    ],
    [
      'Using the site',
      [
        ['How do I make the text bigger?', 'Press the "Aa" button at the top of any page. Each press makes everything larger, and the third press returns to normal. Your choice is remembered. On a phone you will also find it under More.'],
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
        ['How do I get listed?', 'Fill in the application on the partners page. It takes about five minutes and can be completed in English or Nepali.'],
        ['Does it cost anything to apply?', 'No.'],
      ],
    ],
  ];
  const body = html`
${head(ctx, { crumbs: [[null, 'Help']], title: 'Help and common questions', lead: 'How to plan a trek with this site, what the words mean, and how far to trust what you read here.', seed: 83 })}
<div class="wrap wrap-narrow section-tight">
  <div class="who-cta card card-pad help-start">
    <div>
      <h2 class="h3">New to trekking?</h2>
      <p>Start with the planner. It asks three simple questions and builds your trek day by day.</p>
    </div>
    <a class="btn btn-lg" href="${u('plan/')}">${icon('calendar-check')}Plan my trek</a>
  </div>
  <section class="faq-group" id="words">
    <h2>Trekking words explained</h2>
    <dl class="words">
      ${words.map(([term, meaning]) => html`<div><dt>${term}</dt><dd>${meaning}</dd></div>`)}
    </dl>
  </section>
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
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: groups.flatMap(([, items]) => items).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: String(a).replace(/<[^>]+>/g, '') } })) }],
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
  <p>Guides, porters, agencies and shops that ${config.name} lists, or puts you in touch with after you ask for help with a plan, are independent of us. Any agreement you make is between you and them. We check the credentials partners give us, but a listing or an introduction is not a guarantee of their conduct or of the outcome of your trek.</p>
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
  const legs = content.treks.reduce((s, t) => ({ mapped: s.mapped + t.trail.length, total: s.total + t.trail.length + t.gaps.length }), { mapped: 0, total: 0 });
  const withStay = content.places.filter((p) => p.services && p.services.stayCount);
  const stays = { places: withStay.length, count: withStay.reduce((s, p) => s + p.services.stayCount, 0) };
  const photos = content.photos.all;
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
  <h2 id="trails">Trails and places to stay</h2>
  <p>The footpath drawn on each trek map, the route file you can download, and the lists of lodges, health posts, cash machines and water points all come from OpenStreetMap, read from the Protomaps daily build of ${longDate(content.sources.trails || content.sources.services || '')}. ${num(legs.mapped)} of the walking sections in our itineraries follow a mapped path. The remaining ${num(legs.total - legs.mapped)} that we can place are drawn as dashes that simply join two stops, and a section is left off the map altogether where we could not confirm where a stop is. Lodges are listed for ${num(stays.places)} places, ${num(stays.count)} in all.</p>
  <p>This data is © ${ext('https://www.openstreetmap.org/copyright', 'OpenStreetMap contributors')} and is available under the Open Database Licence. It is made by volunteers: a lodge may have closed, a new one may be missing, and a path may have moved since it was mapped. If you spot a mistake, the best fix is to ${ext('https://www.openstreetmap.org/fixthemap', 'correct it in OpenStreetMap')}, where everyone benefits.</p>
  ${content.sources.hubs ? html`<p>The counts of outdoor shops, cash machines and pharmacies on the <a href="${ctx.u('gear/')}">gear page</a> are counts of what was mapped around Thamel, Lakeside and Namche Bazaar on ${longDate(content.sources.hubs)}. A shop counts as an outdoor shop when it is mapped as one, or when it is mapped as a clothes, sports, shoe or bag shop with a name that says trekking or mountain gear.</p>` : ''}
  <h2 id="prices">Prices</h2>
  <p>The package price ranges and transport fares used by the planner are list prices that trekking companies, booking sites and operators showed online${content.sources.market ? html`, gathered on ${longDate(content.sources.market)}` : ''}. Nothing was confirmed with a company, airline or ticket counter. They are there to help you budget and to recognise a fair offer, not as a quote.</p>
  <h2>Maps</h2>
  <ul>
    <li>Map data © ${ext('https://www.openstreetmap.org/copyright', 'OpenStreetMap contributors')}, available under the Open Database Licence.</li>
    <li>Topographic map style © ${ext('https://opentopomap.org/', 'OpenTopoMap')} (CC-BY-SA), with elevation data from SRTM.</li>
    <li>Map display by ${ext('https://leafletjs.com/', 'Leaflet')} (BSD 2-Clause licence).</li>
  </ul>
  <h2>Weather</h2>
  <p>Forecasts by ${ext('https://open-meteo.com/', 'Open-Meteo')}, licensed under CC BY 4.0, from national weather service models. Open-Meteo's free service is for non-commercial use.</p>
  ${photos.length
    ? html`<h2 id="photos">Photographs</h2>
        <p>The photographs come from Wikimedia Commons and are used under the licences shown beside each one. Each was made smaller for the web, and a few were converted to the colour space screens expect; what was done is noted after each one. Nothing else was changed, and our copies are offered under the same licences.</p>
        <ul class="photo-credits">
          ${photos.map((p) => html`<li><a href="${p.source}" rel="noopener">${p.caption || p.title}</a>, by ${p.author}. <a href="${p.licenceUrl}" rel="noopener license">${p.licence}</a>. Changes: ${p.changes || 'resized'}.</li>`)}
        </ul>`
    : ''}
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
    <li>The mountain artwork and the height profiles are drawn by our own code.${photos.length ? ' The photographs are credited above.' : ' No photographs or third-party illustrations are used.'}</li>
  </ul>
</div></div>`;
  return { title: 'Data and Credits', description: `Sources, licences and medical references behind ${config.name}.`, section: 'about', crumbs: [[null, 'Data and credits']], body };
}

// ------------------------------------------------------------------ saved, offline, 404

export function savedPage(ctx) {
  const { u } = ctx;
  const body = html`
${head(ctx, { crumbs: [[null, 'My trips']], title: 'My trips', lead: 'Your trek plans and the treks you saved. They are kept on this phone or computer only, and you can open them without a connection.', seed: 91 })}
<div class="wrap section-tight trips" data-saved>
  <section aria-labelledby="trips-plans">
    <h2 id="trips-plans">My trek plans</h2>
    <div data-trips-draft hidden></div>
    <ul class="trip-list" data-saved-plans></ul>
    <div class="empty" data-plans-empty>
      <h3>You have not saved a plan yet</h3>
      <p>Answer a few simple questions and we lay out your trek day by day: where you walk, where you sleep, who can help you and what it may cost. Press <strong>Save</strong> on the plan and it will wait for you here.</p>
      <a class="btn btn-lg" href="${u('plan/')}">${icon('route', { size: 22 })}Plan my trek</a>
    </div>
    <p class="trips-more" data-plans-more hidden><a class="btn btn-secondary" href="${u('plan/')}">${icon('plus', { size: 20 })}Plan another trek</a></p>
  </section>
  <section aria-labelledby="trips-treks">
    <h2 id="trips-treks">Treks I saved</h2>
    <div class="trek-grid" data-saved-treks></div>
    <div class="empty" data-saved-empty>
      <h3>No treks saved yet</h3>
      <p>Press <strong>Save</strong> on any trek page to keep it here. A saved trek can be read without a connection.</p>
      <a class="btn btn-secondary" href="${u('treks/')}">See all ${ctx.content.treks.length} treks</a>
    </div>
  </section>
  <section aria-labelledby="trips-also">
    <h2 id="trips-also">Also kept on this device</h2>
    <ul class="trips-also">
      <li><a href="${u('safety/emergency/')}">${icon('siren', { size: 22 })}<span><strong>My emergency card</strong><span>Numbers to call and your own details</span></span></a></li>
      <li><a href="${u('tools/packing/')}">${icon('backpack', { size: 22 })}<span><strong>My packing list</strong><span>What you have ticked off so far</span></span></a></li>
      <li><a href="${u('safety/altitude-check/')}">${icon('heart-pulse', { size: 22 })}<span><strong>My altitude checks</strong><span>How you felt, day by day</span></span></a></li>
    </ul>
    <p class="small muted">Nothing on this page is sent to us. If you clear this site's data in your browser settings, everything here is removed.</p>
  </section>
  <template data-trips-icons>${['arrow-right', 'calendar-days', 'users', 'trash-2', 'undo-2', 'mountain', 'route'].map((n) => html`<span data-i="${n}">${icon(n, { size: 22 })}</span>`)}</template>
  <noscript>${note('warn', html`<p>Your saved plans and treks need JavaScript to show.</p>`)}</noscript>
</div>`;
  return { title: 'My Trips', description: 'Your trek plans and saved treks, kept on this device and available offline.', section: 'saved', scripts: ['saved'], noindex: true, crumbs: [[null, 'My trips']], body };
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
    <a class="card card-pad card-link" href="${u('saved/')}"><strong>${icon('bookmark', { size: 18 })} My trips</strong><p class="small muted">Your plans and the treks you saved.</p></a>
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
