// Trail conditions: what the season is doing, live forecasts for key points, and the
// roads, flights and passes that most often cause delays. Nothing here claims to be a live
// trail status: the only live data is the weather forecast, and that is labelled as a model.

import { html, raw, jsonScript } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { ridgeStrip } from '../lib/landscape.mjs';
import { MONTHS, MONTHS_SHORT, num, monthRanges } from '../lib/format.mjs';
import { hueClass, note, noticesBlock } from './partials.mjs';

const KIND_ICON = { flight: 'plane', road: 'bus', pass: 'mountain', river: 'waves' };

export function conditionsPage(ctx) {
  const { u, content } = ctx;
  const c = content.conditions || {};
  const P = (slug) => content.placeMap.get(slug);
  const watch = (c.watch || []).filter((w) => P(w.place)).map((w) => ({ ...w, p: P(w.place) }));
  const passes = (c.passes || []).filter((x) => P(x.place)).map((x) => ({ ...x, p: P(x.place) })).sort((a, b) => b.p.alt - a.p.alt);
  const access = c.access || [];
  const sources = c.sources || [];

  const body = html`
<header class="page-head">
  <div class="wrap">
    <nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="${u()}">Home</a></li><li aria-current="page">Conditions</li></ol></nav>
    <h1>Trail and trailhead conditions</h1>
    <p class="lead">What the season usually brings, a live forecast for the places where weather decides your day, and the roads, flights and passes that most often hold people up.</p>
  </div>
  ${raw(ridgeStrip({ seed: 41 }))}
</header>

<div class="wrap section-tight">
  ${(content.notices || []).length
    ? html`<section class="current-notices" aria-labelledby="cn-title">
        <h2 id="cn-title">Current notices</h2>
        <p class="muted">Major damage we know about that changes how you reach or walk a route. This is not a complete list, and it is only as fresh as the date on each notice.</p>
        ${noticesBlock(content.notices)}
      </section>`
    : ''}
  <section class="season-now card card-pad" aria-labelledby="sn-title" data-season>
    <p class="eyebrow">${icon('calendar-days', { size: 15 })}<span data-season-eyebrow>The trekking year</span></p>
    <h2 id="sn-title" data-season-title>Month by month</h2>
    <p class="lead" data-season-text>Pick a month to see what it usually brings.</p>
    <div class="chips season-months" role="group" aria-label="Month">
      ${MONTHS_SHORT.map((m, i) => html`<button type="button" class="chip" data-season-month="${i + 1}" aria-pressed="false">${m}</button>`)}
    </div>
    <div class="season-treks" data-season-treks hidden>
      <h3>At their best this month</h3>
      <div class="chips" data-season-list></div>
    </div>
    <script type="application/json" id="season-data">${jsonScript({
      seasons: content.seasons,
      treks: content.treks.map((t) => ({ s: t.slug, n: t.name, b: t.seasons.best })),
    })}</script>
    <noscript>
      ${content.seasons.map((s) => html`<details class="acc"><summary>${MONTHS[s.month - 1]}: ${s.title}</summary><div><p>${s.text}</p></div></details>`)}
    </noscript>
  </section>
</div>

${watch.length
  ? html`<section class="section-tight section-alt" aria-labelledby="wx-title">
      <div class="wrap">
        <div class="section-head">
          <div>
            <p class="eyebrow">${icon('cloud-sun', { size: 15 })}Live forecast</p>
            <h2 id="wx-title">Weather watch</h2>
            <p>Three-day outlook for trailheads, airstrips and high points. Heavy rain, snow and strong wind are flagged automatically.</p>
          </div>
          <p class="small muted" data-watch-status aria-live="polite"></p>
        </div>
        <div class="watch-grid" data-watch>
          ${watch.map((w) => {
            const r = content.regionMap.get(w.p.region);
            return html`<article class="card watch-card ${hueClass(r)}" data-watch-point data-lat="${w.p.lat}" data-lon="${w.p.lon}" data-alt="${w.p.alt}">
              <header>
                <h3><a href="${u(`places/${w.p.slug}/`)}">${w.p.name}</a></h3>
                <span class="small muted">${num(w.p.alt)} m · ${r.name}</span>
              </header>
              <p class="small watch-why">${w.why}</p>
              <div class="watch-body" data-watch-body><p class="small muted">Forecast loads when you are online.</p></div>
            </article>`;
          })}
        </div>
        <p class="xsmall muted" style="margin-top:1rem">Model forecasts from <a href="https://open-meteo.com/" rel="noopener" target="_blank">Open-Meteo</a> for each point and altitude. A model cannot see a valley cloud bank or a wind funnel. Ask the lodge owner, and look at the sky.</p>
      </div>
    </section>`
  : ''}

${access.length
  ? html`<section class="section-tight" aria-labelledby="ac-title">
      <div class="wrap">
        <div class="section-head"><div>
          <h2 id="ac-title">Roads and flights that cause delays</h2>
          <p>The usual pattern for each route in and out, so you know where to put your spare days. This is background, not today's status.</p>
        </div></div>
        <div class="access-grid">
          ${access.map(
            (a) => html`<article class="card card-pad access-card">
              <div class="access-head"><span class="access-icon">${icon(KIND_ICON[a.kind] || 'bus', { size: 20 })}</span><div><h3>${a.name}</h3><span class="small muted">${a.serves}</span></div></div>
              <p class="small">${a.text}</p>
              ${a.worst && a.worst.length ? html`<p class="small"><span class="badge badge-watch">${icon('triangle-alert', { size: 14 })}Most trouble: ${monthRanges(a.worst)}</span></p>` : ''}
              ${a.buffer ? html`<p class="xsmall muted"><strong>Spare time to allow:</strong> ${a.buffer}</p>` : ''}
            </article>`,
          )}
        </div>
      </div>
    </section>`
  : ''}

${passes.length
  ? html`<section class="section-tight section-alt" aria-labelledby="ps-title">
      <div class="wrap">
        <div class="section-head"><div>
          <h2 id="ps-title">High passes</h2>
          <p>When each pass is normally crossable. Fresh snow can close any of them for days inside the open season, and none has an official open or closed status.</p>
        </div></div>
        <div class="table-wrap">
          <table class="pass-table">
            <thead><tr><th>Pass</th><th class="num">Altitude</th><th>Usually crossable</th><th>What stops people</th></tr></thead>
            <tbody>
              ${passes.map(
                (x) => html`<tr>
                  <td><a href="${u(`places/${x.p.slug}/`)}"><strong>${x.p.name}</strong></a><br><span class="small muted">${content.regionMap.get(x.p.region).name}</span></td>
                  <td class="num">${num(x.p.alt)} m</td>
                  <td>${monthRanges(x.open)}</td>
                  <td class="small">${x.note}</td>
                </tr>`,
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>`
  : ''}

<section class="section-tight" aria-labelledby="src-title">
  <div class="wrap grid grid-2" style="--gap:2.5rem">
    <div>
      <h2 id="src-title">Check on the day</h2>
      <p class="muted">These are the offices that issue forecasts, warnings and closures in Nepal. Look at them the evening before a road journey, a flight or a pass.</p>
      <ul class="source-list">
        ${sources.map((s) => html`<li><a href="${s.url}" rel="noopener" target="_blank">${s.name}${icon('external-link', { size: 14 })}</a><span class="small muted">${s.what}</span></li>`)}
      </ul>
    </div>
    <div class="card card-pad reports-soon">
      <h2 class="h3">Where our notices come from</h2>
      <p>The notices at the top of this page come from news reports and official statements. Each one shows the day it was reported and the day we last looked for something newer.</p>
      <p>The people who know whether a bridge is out this week are the guides and lodge owners walking the trail. Ask yours the evening before, and believe them over any website, this one included.</p>
      <a class="btn btn-secondary btn-sm" href="${u('partners/')}">${icon('handshake', { size: 16 })}Guide or lodge owner? Send us your reports</a>
    </div>
  </div>
</section>`;

  return {
    title: 'Nepal Trail Conditions: Season, Weather, Passes & Roads',
    description: 'What each month brings on Nepal’s trails, live forecasts for trailheads and high passes, and the roads and flights that most often cause delays.',
    section: 'conditions',
    scripts: ['conditions'],
    crumbs: [[null, 'Conditions']],
    body,
  };
}
