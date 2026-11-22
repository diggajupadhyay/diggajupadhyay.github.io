import { html, raw, jsonScript } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { heroLandscape } from '../lib/landscape.mjs';
import { MONTHS, numberWord } from '../lib/format.mjs';
import { trekCard, sectionHead, arrowLink, hueClass, comingSoon } from './partials.mjs';

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
      <p class="lead">Honest route guides, altitude and emergency tools that work without signal, and a growing network of licensed guides, fairly paid porters and registered agencies.</p>
      <div class="cluster hero-cta">
        <a class="btn btn-lg" href="${u('treks/')}">${icon('mountain-snow')}Find a trek</a>
        <a class="btn btn-lg btn-secondary" href="${u('safety/altitude-check/')}">${icon('heart-pulse')}Check altitude symptoms</a>
      </div>
      <ul class="hero-points">
        <li>${icon('check', { size: 16 })}${content.treks.length} routes, day by day</li>
        <li>${icon('check', { size: 16 })}${content.places.length} places with altitude and weather</li>
        <li>${icon('check', { size: 16 })}Free, and usable offline</li>
      </ul>
    </div>
    <form class="finder card" action="${u('treks/')}" method="get" aria-labelledby="finder-title">
      <h2 id="finder-title">Find a trek that fits</h2>
      <fieldset>
        <legend>How long do you have?</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="days" value="short">Up to 5 days</label>
          <label class="chip"><input type="radio" name="days" value="week">6–10 days</label>
          <label class="chip"><input type="radio" name="days" value="fortnight">11–15 days</label>
          <label class="chip"><input type="radio" name="days" value="long">16 days or more</label>
        </div>
      </fieldset>
      <fieldset>
        <legend>How hard?</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="grade" value="easy">Easy</label>
          <label class="chip"><input type="radio" name="grade" value="moderate">Moderate</label>
          <label class="chip"><input type="radio" name="grade" value="challenging">Challenging</label>
          <label class="chip"><input type="radio" name="grade" value="strenuous">Strenuous</label>
        </div>
      </fieldset>
      <div class="field">
        <label for="finder-month">When are you going?</label>
        <select class="select" id="finder-month" name="month">
          <option value="">Any time</option>
          ${MONTHS.map((m, i) => html`<option value="${i + 1}">${m}</option>`)}
        </select>
      </div>
      <button class="btn btn-block" type="submit">Show matching treks${icon('arrow-right', { size: 18 })}</button>
    </form>
  </div>
  <div class="hero-art">${raw(heroLandscape({ seed: 11 }))}</div>
</section>

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
        (r) => html`<a class="region-card ${hueClass(r)}" href="${u(`regions/${r.slug}/`)}">
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
        <p>A route guide gets you to the trailhead. People get you over the pass. We are building one place to find the ones you can trust, and to make sure they are treated fairly.</p>
      </div>
      ${comingSoon()}
    </div>
    <div class="grid grid-4">
      ${[
        ['services/guides/', 'signpost', 'Guides', 'Licensed trekking guides, listed with their licence number, languages, first-aid training and the routes they know best.'],
        ['services/porters/', 'backpack', 'Porters', 'Experienced porters with fair daily wages, insurance, proper clothing and loads kept within recognised limits.'],
        ['services/agencies/', 'building-2', 'Agencies', 'Government-registered trekking companies for restricted-area permits, logistics and full-service trips.'],
        ['gear/', 'store', 'Gear', 'Sleeping bags, down jackets, boots and safety gear to rent or buy from shops in Kathmandu and Pokhara.'],
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

<section class="section" aria-labelledby="how-title">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Plan in an afternoon', title: html`<span id="how-title">From idea to itinerary</span>` })}
    <ol class="steps">
      <li><span class="step-n">1</span><h3>Pick a route that fits</h3><p>Filter by days, difficulty, altitude and month. Compare the altitude profiles side by side.</p></li>
      <li><span class="step-n">2</span><h3>Check the climb</h3><p>Every itinerary is tested against altitude guidelines, with risky nights flagged before you book.</p></li>
      <li><span class="step-n">3</span><h3>Sort the paperwork</h3><p>See exactly which permits your trek needs, what they cost and where to get them.</p></li>
      <li><span class="step-n">4</span><h3>Pack and budget</h3><p>Build a packing list for your season and altitude, and estimate what the trip will really cost.</p></li>
    </ol>
    <div class="cluster" style="--gap:.75rem;margin-top:1.75rem">
      <a class="btn btn-secondary" href="${u('tools/planner/')}">${icon('calendar-days')}Trek planner</a>
      <a class="btn btn-secondary" href="${u('tools/packing/')}">${icon('list-checks')}Packing list</a>
      <a class="btn btn-secondary" href="${u('tools/budget/')}">${icon('calculator')}Budget estimator</a>
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
