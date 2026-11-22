// Planning tools: GPX viewer, trek planner, packing list, budget estimator.

import { html, raw, jsonScript } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { ridgeStrip } from '../lib/landscape.mjs';
import { MONTHS } from '../lib/format.mjs';
import { FOOD_PER_DAY, NPR_PER_USD } from '../lib/plan.mjs';
import { note } from './partials.mjs';

const head = (ctx, { crumbs, title, lead, seed }) => html`<header class="page-head">
  <div class="wrap">
    <nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="${ctx.u()}">Home</a></li>${crumbs.map(([href, label]) => (href ? html`<li><a href="${ctx.u(href)}">${label}</a></li>` : html`<li aria-current="page">${label}</li>`))}</ol></nav>
    <h1>${title}</h1>
    <p class="lead">${lead}</p>
  </div>
  ${raw(ridgeStrip({ seed }))}
</header>`;

const trekSelect = (content, { id, label, attr, empty = 'Choose a trek…' }) => html`<div class="field">
  <label for="${id}">${label}</label>
  <select class="select" id="${id}" ${raw(attr)}>
    <option value="">${empty}</option>
    ${content.regions.filter((r) => r.treks.length).map((r) => html`<optgroup label="${r.long}">${r.treks.map((t) => html`<option value="${t.slug}">${t.name}</option>`)}</optgroup>`)}
  </select>
</div>`;

const needsJs = () => html`<noscript>${note('warn', html`<p>This tool needs JavaScript.</p>`)}</noscript>`;

// ------------------------------------------------------------------ hub

export function toolsHubPage(ctx) {
  const { u } = ctx;
  const tools = [
    ['tools/compare/', 'scale', 'Compare treks', 'Two or three routes side by side: length, altitude, difficulty, season and permits.'],
    ['plan/', 'calendar-days', 'Plan my trek', 'Step by step: pick a trek, set your dates, see where you sleep each night, what it costs and who can help.'],
    ['tools/packing/', 'list-checks', 'Packing list', 'A checklist built for your trek, month and altitude, with what to rent in Nepal marked.'],
    ['tools/budget/', 'calculator', 'Budget estimator', 'Permits, guide, porter, food, lodging and transport added up, with every assumption editable.'],
    ['tools/gpx/', 'route', 'GPX viewer', 'Load a track to see its distance, climb and profile, follow it on a map and get off-track alerts.'],
    ['safety/acclimatization/', 'trending-up', 'Acclimatization checker', 'Test an itinerary against altitude guidelines and see where to add a night.'],
    ['safety/altitude-check/', 'heart-pulse', 'Altitude sickness check', 'Score your symptoms and get a clear next step.'],
    ['permits/', 'ticket', 'Permit finder', 'Which permits a trek needs, what they cost and where to get them.'],
    ['safety/insurance/', 'shield-check', 'Insurance check', 'What your policy has to cover for the trek you have chosen.'],
    ['safety/emergency/', 'siren', 'Emergency & SOS', 'Rescue numbers, location sharing, whistle and light signal.'],
  ];
  const body = html`
${head(ctx, { crumbs: [[null, 'Tools']], title: 'Planning tools', lead: 'Small, free tools for the decisions that shape a trek. They run in your browser, keep your data on your device and work offline once opened.', seed: 71 })}
<div class="wrap section-tight">
  <div class="grid grid-4">
    ${tools.map(([href, ic, title, text]) => html`<a class="card card-pad card-link feature" href="${u(href)}"><span class="feature-icon">${icon(ic, { size: 22 })}</span><h2 class="h3">${title}</h2><p>${text}</p></a>`)}
  </div>
</div>`;
  return {
    title: 'Trek Planning Tools: Planner, Packing List, Budget & GPX Viewer',
    description: 'Free trek planning tools for Nepal: dated itineraries, packing lists, a budget estimator, a GPX viewer with off-track alerts and altitude safety checks.',
    section: 'tools',
    crumbs: [[null, 'Tools']],
    body,
  };
}

// ------------------------------------------------------------------ GPX viewer

export function gpxPage(ctx) {
  const { u } = ctx;
  const body = html`
${head(ctx, {
  crumbs: [['tools/', 'Tools'], [null, 'GPX viewer']],
  title: 'GPX viewer',
  lead: 'Open a GPX track from your guide, your agency or another app. See how far and how high it goes, follow it on a map and get a warning if you wander off it.',
  seed: 73,
})}
<div class="wrap section-tight gpx" data-gpx>
  <div class="card card-pad gpx-load">
    <label class="dropzone" data-gpx-drop>
      <input type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" data-gpx-file class="sr-only">
      ${icon('upload', { size: 28 })}
      <strong>Choose a GPX file</strong>
      <span class="small muted">or drop one here. The file is read on your device and never uploaded.</span>
    </label>
    <p class="small muted" data-gpx-status role="status">No track loaded.</p>
    <div class="cluster" style="--gap:.5rem">
      <button type="button" class="btn btn-secondary btn-sm" data-gpx-restore hidden>${icon('route', { size: 16 })}Reopen my last track</button>
      <button type="button" class="btn btn-ghost btn-sm" data-gpx-clear hidden>Remove track</button>
    </div>
  </div>

  <div class="gpx-view" data-gpx-view hidden>
    <h2 data-gpx-name>Track</h2>
    <dl class="stats stats-4" data-gpx-stats></dl>
    <figure class="card card-pad profile-card" data-gpx-chart aria-label="Elevation along the track"></figure>
    <div class="map" data-gpx-map><div class="map-placeholder">${icon('map', { size: 30 })}<p>The map appears when a track is loaded.</p></div></div>
    <p class="map-note">${icon('info', { size: 14 })} Maps you have already looked at stay available offline. Pan along your route while you have Wi-Fi.</p>
  </div>

  <div class="grid grid-2 gpx-live" style="--gap:1rem">
    <section class="card card-pad" aria-labelledby="follow-title">
      <h2 id="follow-title" class="h3">${icon('locate-fixed', { size: 20 })} Follow the track</h2>
      <p class="small muted">Shows where you are and how far you are from the line, and warns you when you drift beyond the distance you set.</p>
      <div class="cluster" style="--gap:.6rem">
        <button type="button" class="btn btn-sm" data-follow aria-pressed="false">Start following</button>
        <label class="small">Warn at <select class="select select-inline" data-follow-limit><option value="50">50 m</option><option value="100" selected>100 m</option><option value="200">200 m</option><option value="500">500 m</option></select></label>
      </div>
      <p class="follow-readout" data-follow-readout role="status" aria-live="polite">Not following.</p>
    </section>
    <section class="card card-pad" aria-labelledby="rec-title">
      <h2 id="rec-title" class="h3">${icon('footprints', { size: 20 })} Record my way back</h2>
      <p class="small muted">Drops a breadcrumb trail as you walk so you can retrace it, and saves it as a GPX file.</p>
      <div class="cluster" style="--gap:.6rem">
        <button type="button" class="btn btn-sm" data-record aria-pressed="false">Start recording</button>
        <button type="button" class="btn btn-secondary btn-sm" data-record-save disabled>${icon('download', { size: 16 })}Save GPX</button>
        <button type="button" class="btn btn-ghost btn-sm" data-record-clear disabled>Clear</button>
      </div>
      <p class="follow-readout" data-record-readout role="status">Nothing recorded.</p>
    </section>
  </div>
  ${note(
    'plain',
    html`<p><strong>What a web page can and cannot do.</strong> Following and recording work only while this page is open and the screen is on; we keep the screen awake where the phone allows it. A browser cannot track you in your pocket with the screen off. For that, carry a dedicated GPS app or device, and a paper map either way.</p>`,
  )}
  ${needsJs()}
</div>`;
  return {
    title: 'GPX Viewer: Distance, Elevation Profile and Off-Track Alerts',
    description: 'Open any GPX file in your browser: distance, ascent, elevation profile and map, with live off-track warnings and breadcrumb recording. Nothing is uploaded.',
    section: 'tools',
    scripts: ['gpx'],
    styles: ['map'],
    crumbs: [['tools/', 'Tools'], [null, 'GPX viewer']],
    body,
  };
}

// ------------------------------------------------------------------ compare

export function comparePage(ctx) {
  const { u, content } = ctx;
  const pick = (n, def) => html`<div class="field">
    <label for="cmp-${n}">Trek ${n}</label>
    <select class="select" id="cmp-${n}" data-compare-select>
      <option value="">${n === 3 ? 'None' : 'Choose a trek…'}</option>
      ${content.regions.filter((r) => r.treks.length).map((r) => html`<optgroup label="${r.long}">${r.treks.map((t) => html`<option value="${t.slug}"${t.slug === def ? raw(' selected') : ''}>${t.name}</option>`)}</optgroup>`)}
    </select>
  </div>`;
  const [a, b] = content.treks;
  const body = html`
${head(ctx, {
  crumbs: [['tools/', 'Tools'], [null, 'Compare treks']],
  title: 'Compare treks',
  lead: 'Put two or three routes side by side: how long, how high, how hard, when to go and what paperwork each needs.',
  seed: 74,
})}
<div class="wrap section-tight compare" data-compare>
  <div class="card card-pad"><div class="form-grid">${pick(1, a?.slug)}${pick(2, b?.slug)}${pick(3, '')}</div></div>
  <div class="compare-out" data-compare-out aria-live="polite"></div>
  <p class="small muted">Profiles share one height scale, from sea level to 6,000 m, so their shapes can be compared directly. Each step along a profile is one night.</p>
  <script type="application/json" id="compare-data">${jsonScript({ permits: Object.fromEntries(content.permits.permits.map((p) => [p.id, p.short])), hues: Object.fromEntries(content.regions.map((r) => [r.slug, r.hue])) })}</script>
  ${needsJs()}
</div>`;
  return {
    title: 'Compare Nepal Treks Side by Side',
    description: 'Compare two or three Nepal treks side by side: days, distance, highest point, sleeping altitudes, difficulty, best months, permits and guide rules.',
    section: 'tools',
    scripts: ['compare'],
    crumbs: [['tools/', 'Tools'], [null, 'Compare treks']],
    body,
  };
}

// ------------------------------------------------------------------ packing list

export function packingPage(ctx) {
  const { u, content } = ctx;
  const body = html`
${head(ctx, {
  crumbs: [['tools/', 'Tools'], [null, 'Packing list']],
  title: 'Packing list',
  lead: 'Tell us the trek and the month and we will leave out what you do not need. Tick things off as you pack; the list is saved on this device.',
  seed: 77,
})}
<div class="wrap section-tight packing" data-packing>
  <form class="card card-pad packing-form" data-packing-form>
    <div class="form-grid">
      ${trekSelect(content, { id: 'pk-trek', label: 'Trek', attr: 'name="trek" data-packing-trek', empty: 'Any trek (set the altitude yourself)' })}
      <div class="field"><label for="pk-alt">Highest point <span class="muted">(m)</span></label><input class="input" type="number" id="pk-alt" name="alt" min="500" max="6500" step="50" value="4000" inputmode="numeric"></div>
      <div class="field"><label for="pk-month">Month</label><select class="select" id="pk-month" name="month">${MONTHS.map((m, i) => html`<option value="${i + 1}">${m}</option>`)}</select></div>
      <fieldset class="span-all"><legend>How you are travelling</legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" name="porter" value="1">A porter carries my main bag</label>
          <label class="chip"><input type="checkbox" name="camping" value="1">Camping, not lodges</label>
          <label class="chip"><input type="checkbox" name="remote" value="1">Remote route, days from a road</label>
          <label class="chip"><input type="checkbox" name="glacier" value="1">Crosses a glacier</label>
        </div>
      </fieldset>
    </div>
  </form>
  <div class="packing-bar no-print">
    <div><p class="packing-count" data-packing-count aria-live="polite"></p><div class="meter"><i data-packing-meter style="width:0%"></i></div></div>
    <div class="cluster" style="--gap:.5rem">
      <label class="chip"><input type="checkbox" data-packing-hide>Hide packed</label>
      <button type="button" class="btn btn-secondary btn-sm" data-print>${icon('printer', { size: 16 })}Print</button>
      <button type="button" class="btn btn-ghost btn-sm" data-packing-reset>Untick all</button>
    </div>
  </div>
  <div class="packing-groups" data-packing-groups></div>
  <p class="small muted">${icon('store', { size: 15 })} Items marked <span class="badge badge-ok">Rent</span> are easy to rent in Kathmandu or Pokhara. <a href="${u('gear/')}">What to rent, buy and bring</a></p>
  <script type="application/json" id="packing-data">${jsonScript({ groups: content.packing.groups })}</script>
  ${needsJs()}
</div>`;
  return {
    title: 'Trekking Packing List for Nepal, by Trek, Month and Altitude',
    description: 'A packing checklist for trekking in Nepal that adapts to your route, month and altitude, with rentable items marked. Saved on your device; prints cleanly.',
    section: 'tools',
    scripts: ['packing'],
    crumbs: [['tools/', 'Tools'], [null, 'Packing list']],
    body,
  };
}

// ------------------------------------------------------------------ budget

export function budgetPage(ctx) {
  const { u, content } = ctx;
  const permits = Object.fromEntries(content.permits.permits.map((p) => [p.id, { short: p.short, fees: p.fees, verified: p.verified !== false }]));
  const body = html`
${head(ctx, {
  crumbs: [['tools/', 'Tools'], [null, 'Budget estimator']],
  title: 'Budget estimator',
  lead: 'A rough, honest total for a trek once you are in Nepal: permits, people, food, beds and transport. Every figure can be changed to match the quotes you get.',
  seed: 79,
})}
<div class="wrap section-tight budget" data-budget>
  ${note('warn', html`<p><strong>Estimates, not prices.</strong> The default daily rates are typical figures from recent seasons that we have not been able to confirm for this one. Replace them with real quotes as soon as you have them. Permit fees are from our <a href="${u('permits/')}">permits page</a>.</p>`)}
  <div class="budget-layout">
    <form class="card card-pad budget-form" data-budget-form>
      <h2 class="h3">Your trek</h2>
      <div class="form-grid">
        ${trekSelect(content, { id: 'bg-trek', label: 'Trek', attr: 'name="trek" data-budget-trek' })}
        <div class="field"><label for="bg-days">Days on the trek</label><input class="input" type="number" id="bg-days" name="days" min="1" max="60" value="12" inputmode="numeric"></div>
        <div class="field"><label for="bg-people">Trekkers in the group</label><input class="input" type="number" id="bg-people" name="people" min="1" max="20" value="2" inputmode="numeric"></div>
        <div class="field"><label for="bg-guides">Guides</label><select class="select" id="bg-guides" name="guides"><option value="0">None</option><option value="1" selected>1</option><option value="2">2</option></select></div>
        <div class="field"><label for="bg-porters">Porters</label><select class="select" id="bg-porters" name="porters"><option value="0">None</option><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select><span class="hint">One porter normally carries for two trekkers.</span></div>
      </div>
      <h2 class="h3">Daily rates <span class="badge badge-soon">Typical, unconfirmed</span></h2>
      <div class="form-grid">
        <div class="field"><label for="bg-food">Food and lodging, per trekker per day <span class="muted">(USD)</span></label><input class="input" type="number" id="bg-food" name="food" min="0" max="500" step="1" value="35" inputmode="decimal"></div>
        <div class="field"><label for="bg-guide">Guide, per day <span class="muted">(USD)</span></label><input class="input" type="number" id="bg-guide" name="guideRate" min="0" max="500" step="1" value="32" inputmode="decimal"></div>
        <div class="field"><label for="bg-porter">Porter, per day <span class="muted">(USD)</span></label><input class="input" type="number" id="bg-porter" name="porterRate" min="0" max="500" step="1" value="22" inputmode="decimal"></div>
        <div class="field"><label for="bg-tip">Tips, as a share of staff wages <span class="muted">(%)</span></label><input class="input" type="number" id="bg-tip" name="tip" min="0" max="50" step="1" value="15" inputmode="numeric"></div>
      </div>
      <h2 class="h3">One-off costs, per trekker</h2>
      <div class="form-grid">
        <div class="field"><label for="bg-permits">Permits <span class="muted">(USD)</span></label><input class="input" type="number" id="bg-permits" name="permits" min="0" max="5000" step="1" value="0" inputmode="decimal"><span class="hint" data-budget-permit-hint>Choose a trek to fill this in.</span></div>
        <div class="field"><label for="bg-transport">Transport to and from the trail <span class="muted">(USD)</span></label><input class="input" type="number" id="bg-transport" name="transport" min="0" max="5000" step="1" value="60" inputmode="decimal"><span class="hint">Bus or shared jeep is cheap; a return Lukla flight is roughly USD 360–440.</span></div>
        <div class="field"><label for="bg-gear">Gear rental and purchases <span class="muted">(USD)</span></label><input class="input" type="number" id="bg-gear" name="gear" min="0" max="5000" step="1" value="40" inputmode="decimal"></div>
        <div class="field"><label for="bg-buffer">Contingency <span class="muted">(%)</span></label><input class="input" type="number" id="bg-buffer" name="buffer" min="0" max="50" step="1" value="10" inputmode="numeric"><span class="hint">Extra nights, hot showers, charging, a bad-weather day.</span></div>
        <div class="field"><label for="bg-rate">Exchange rate <span class="muted">(NPR per USD)</span></label><input class="input" type="number" id="bg-rate" name="rate" min="50" max="400" step="0.5" value="${NPR_PER_USD}" inputmode="decimal"><span class="hint">Check today's rate.</span></div>
      </div>
    </form>
    <aside class="budget-result card card-pad" data-budget-result aria-live="polite">
      <p class="eyebrow">Estimate</p>
      <p class="budget-total" data-budget-total>—</p>
      <p class="small muted" data-budget-per></p>
      <table class="budget-lines"><tbody data-budget-lines></tbody></table>
      <p class="budget-cash" data-budget-cash></p>
      <p class="xsmall muted">Not included: international flights, visa, insurance, hotels and meals in Kathmandu or Pokhara. Staff costs are shared across the group.</p>
      <button type="button" class="btn btn-secondary btn-sm btn-block no-print" data-print>${icon('printer', { size: 16 })}Print</button>
    </aside>
  </div>
  <script type="application/json" id="budget-data">${jsonScript({ permits, foodByRegion: FOOD_PER_DAY })}</script>
  ${needsJs()}
</div>`;
  return {
    title: 'Nepal Trek Budget Estimator: Permits, Staff, Food & Beds',
    description: 'Estimate what a Nepal trek costs on the ground: permits, guide and porter wages, food and lodging, transport and tips. Every assumption is editable.',
    section: 'tools',
    scripts: ['budget'],
    crumbs: [['tools/', 'Tools'], [null, 'Budget estimator']],
    body,
  };
}
