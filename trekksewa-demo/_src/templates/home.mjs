import { html, raw, jsonScript } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { heroLandscape } from '../lib/landscape.mjs';
import { numberWord } from '../lib/format.mjs';
import { DAY_CHOICES } from '../lib/plan.mjs';
import { trekCard, sectionHead, arrowLink, hueClass, photoFigure } from './partials.mjs';

export function homePage(ctx) {
  const { u, content, config } = ctx;
  const featured = content.treks.slice(0, 8);
  const seasons = content.seasons || [];

  const body = html`
<section class="hero">
  <div class="wrap hero-inner">
    <div class="hero-copy">
      <p class="eyebrow"><span lang="ne">नमस्ते</span> · Trekking in Nepal</p>
      <h1>Trek Nepal, <em>well looked after</em></h1>
      <p class="lead">Tell us how long you have and how far you like to walk. We suggest a trek, plan it day by day, show where you sleep each night and who can help you.</p>
      <div class="cluster hero-cta">
        <a class="btn btn-lg" href="${u('plan/')}">${icon('calendar-check')}Plan my trek</a>
        <a class="btn btn-lg btn-secondary" href="${u('treks/')}">${icon('mountain-snow')}See all ${content.treks.length} treks</a>
      </div>
      <ul class="hero-points">
        <li>${icon('check', { size: 18 })}Every trek planned day by day</li>
        <li>${icon('check', { size: 18 })}Places to stay at every stop</li>
        <li>${icon('check', { size: 18 })}Free. No account needed.</li>
      </ul>
    </div>
    <nav class="starter card" aria-labelledby="starter-title">
      <p class="starter-step">Start here</p>
      <h2 id="starter-title">How many days would you like to walk?</h2>
      <div class="starter-choices">
        ${DAY_CHOICES.map(
          (c) => html`<a class="choice" href="${u(`plan/?step=level&days=${c.id}`)}"><span class="choice-text"><strong>${c.label}</strong><span>${c.sub}</span></span>${icon('chevron-right', { size: 24 })}</a>`,
        )}
      </div>
    </nav>
  </div>
  <div class="hero-art">${raw(heroLandscape({ seed: 11 }))}</div>
</section>

<section class="section how" aria-labelledby="how-title">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'How it works', title: html`<span id="how-title">Three steps from "I would like to" to "I am going"</span>` })}
    <ol class="how-steps">
      <li>${icon('message-circle-question', { size: 30 })}<h3><span class="how-n">1</span>Answer three questions</h3><p>How many days, how much walking, and which month. That is all we need to suggest treks that suit you.</p></li>
      <li>${icon('map', { size: 30 })}<h3><span class="how-n">2</span>Get your plan</h3><p>Each day set out in plain words: where you walk, how long it takes, where you sleep, and what it is likely to cost.</p></li>
      <li>${icon('handshake', { size: 30 })}<h3><span class="how-n">3</span>Go with good people</h3><p>Send the plan to arrange a guide, a porter or a whole trip. Print it, save it, or share it with your family.</p></li>
    </ol>
    <a class="btn btn-lg" href="${u('plan/')}">${icon('calendar-check')}Start planning</a>
  </div>
</section>

${content.photos.home.length
  ? html`<section class="section-tight looks" aria-labelledby="looks-title">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'In pictures', title: html`<span id="looks-title">What a trek in Nepal is like</span>`, text: 'You walk from village to village on old footpaths with a small bag on your back, and sleep in a family-run lodge each night.' })}
    <div class="looks-grid">${content.photos.home.slice(0, 3).map((p) => photoFigure(ctx, p, { cls: 'looks-fig', size: 'small' }))}</div>
  </div>
</section>`
  : ''}

<section class="band section-tight safety-band" aria-labelledby="safety-title">
  <div class="wrap">
    <div class="section-head">
      <div>
        <p class="eyebrow">${icon('wifi-off', { size: 15 })}Works without signal</p>
        <h2 id="safety-title">Safety tools for the days that count</h2>
        <p>Open them once while you have a connection and they stay on your phone, ready above the last cell tower.</p>
      </div>
      <a class="btn btn-outline-band" href="${u('safety/')}">All safety tools</a>
    </div>
    <div class="grid grid-4">
      <a class="tool-tile" href="${u('safety/altitude-check/')}">
        ${icon('heart-pulse', { size: 26 })}
        <h3>Altitude sickness check</h3>
        <p>Score your symptoms with the Lake Louise scale and get a clear next step: carry on, rest, or go down.</p>
      </a>
      <a class="tool-tile" href="${u('safety/acclimatization/')}">
        ${icon('trending-up', { size: 26 })}
        <h3>Acclimatization checker</h3>
        <p>See which nights of an itinerary gain height too fast, and where an extra night helps most.</p>
      </a>
      <a class="tool-tile tool-tile-sos" href="${u('safety/emergency/')}">
        ${icon('siren', { size: 26 })}
        <h3>Emergency &amp; SOS</h3>
        <p>Share your exact position by SMS, call rescue numbers, sound a whistle or flash a signal.</p>
      </a>
      <a class="tool-tile" href="${u('tools/gpx/')}">
        ${icon('route', { size: 26 })}
        <h3>GPX viewer</h3>
        <p>Load a track, see its climb and distance, and get a warning when you drift off the line.</p>
      </a>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="popular-title">
  <div class="wrap">
    ${sectionHead({
      eyebrow: 'Route guides',
      title: html`<span id="popular-title">Start with the classics</span>`,
      text: 'Every guide gives the day-by-day stages, sleeping altitudes, permits, the best months and the specific hazards of that route.',
      action: arrowLink(u('treks/'), `All ${content.treks.length} treks`),
    })}
    <div class="trek-grid">${featured.map((t) => trekCard(ctx, t))}</div>
  </div>
</section>

<section class="section section-alt" aria-labelledby="regions-title">
  <div class="wrap">
    ${sectionHead({
      eyebrow: 'Where to go',
      title: html`<span id="regions-title">${numberWord(content.regions.length)} regions, very different mountains</span>`,
      text: 'From a weekend ridge above Kathmandu to three weeks on the Tibetan border.',
      action: arrowLink(u('regions/'), 'Compare regions'),
    })}
    <div class="region-grid">
      ${content.regions.map(
        (r) => html`<a class="region-card ${hueClass(r)}${r.photo ? ' has-photo' : ''}" href="${u(`regions/${r.slug}/`)}">
          ${r.photo ? html`<img class="region-photo" src="${u(`photos/${r.photo.small}`)}" alt="" loading="lazy" width="720" height="${Math.round((720 * r.photo.height) / r.photo.width)}" style="object-position:${r.photo.focus || '50% 50%'}">` : ''}
          <span class="region-swatch" aria-hidden="true"></span>
          <h3>${r.long}</h3>
          <p>${r.tagline}</p>
          <span class="small muted">${r.treks.length} ${r.treks.length === 1 ? 'trek' : 'treks'} · ${r.places.length} places</span>
        </a>`,
      )}
    </div>
  </div>
</section>

<section class="section" aria-labelledby="now-title">
  <div class="wrap now-grid">
    <div>
      <p class="eyebrow">${icon('cloud-sun', { size: 15 })}<span data-season-eyebrow>Conditions</span></p>
      <h2 id="now-title" data-season-title>What the season is doing</h2>
      <p class="lead" data-season-text>Weather decides more in Nepal than fitness does. See what this month usually brings, live forecasts for trailheads and passes, and which roads and flights tend to cause delays.</p>
      <div class="cluster" style="--gap:.75rem;margin-top:1.25rem">
        <a class="btn" href="${u('conditions/')}">See trail conditions</a>
        <a class="btn btn-ghost" href="${u('permits/')}">Permits &amp; fees</a>
      </div>
    </div>
    <div class="card card-pad now-card">
      <h3 data-season-list-title>Treks in season</h3>
      <ul class="now-list" data-season-list>
        ${featured.slice(0, 5).map((t) => html`<li><a href="${u(`treks/${t.slug}/`)}">${t.name}</a><span class="muted small">${t.regionObj.name}</span></li>`)}
      </ul>
      <a class="link-arrow small" href="${u('treks/')}" data-season-more>Browse all treks${icon('arrow-right', { size: 16 })}</a>
    </div>
  </div>
  <script type="application/json" id="season-data">${jsonScript({
    seasons,
    treks: content.treks.map((t) => ({ s: t.slug, n: t.name, r: t.regionObj.name, b: t.seasons.best })),
  })}</script>
</section>

<section class="section section-alt sewa" aria-labelledby="sewa-title">
  <div class="wrap">
    <div class="section-head">
      <div>
        <p class="eyebrow"><span lang="ne">सेवा</span> · Service</p>
        <h2 id="sewa-title">The people who make a trek</h2>
        <p>A route guide gets you to the trailhead. People get you over the pass. Here is who can help you, what each of them costs, and how to ask.</p>
      </div>
      <a class="link-arrow" href="${u('services/')}">Which help do I need?${icon('arrow-right', { size: 18 })}</a>
    </div>
    <div class="grid grid-4">
      ${[
        ['services/agencies/', 'building-2', 'Trekking companies', 'They arrange everything: guide, porter, permits, transport and beds. The easy way for a first trek, and the law in restricted areas.'],
        ['services/guides/', 'signpost', 'Guides', 'A licensed guide finds the way, books the beds and watches how you cope with the height. What they cost and what to check.'],
        ['services/porters/', 'backpack', 'Porters', 'A porter carries your main bag, so you walk with a small one. How to hire one fairly, with a proper load, kit and insurance.'],
        ['gear/', 'store', 'Gear', 'What to bring from home, and what to rent or buy for a few dollars a day in Kathmandu and Pokhara.'],
      ].map(
        ([href, ic, title, text]) => html`<a class="card card-pad card-link feature" href="${u(href)}">
          <span class="feature-icon">${icon(ic, { size: 22 })}</span>
          <h3>${title}</h3>
          <p>${text}</p>
        </a>`,
      )}
    </div>
    <div class="pledge card">
      <div class="pledge-copy">
        <h3>Are you a guide, porter, agency or gear shop?</h3>
        <p>We are enrolling our founding partners now. Applying is free and takes about five minutes, in English or Nepali.</p>
      </div>
      <a class="btn btn-gold" href="${u('partners/')}">${icon('handshake')}Join TrekkSewa</a>
    </div>
  </div>
</section>

<section class="section-tight install band" aria-labelledby="install-title" data-install-section>
  <div class="wrap install-inner">
    <div>
      <h2 id="install-title">Keep it in your pocket</h2>
      <p>Add ${config.name} to your home screen. The safety tools, your saved treks and any page you have opened stay available when the signal drops.</p>
    </div>
    <div class="cluster" style="--gap:.75rem">
      <button class="btn btn-on-band" type="button" data-install hidden>${icon('download')}Install the app</button>
      <a class="btn btn-outline-band" href="${u('support/#offline')}">How offline works</a>
    </div>
  </div>
</section>`;

  return {
    title: config.name,
    description: config.description,
    section: 'home',
    bodyClass: 'home',
    scripts: ['home'],
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: config.name,
        alternateName: config.nameNe,
        url: `${config.siteUrl}/`,
        description: config.description,
        inLanguage: 'en',
      },
    ],
  };
}
