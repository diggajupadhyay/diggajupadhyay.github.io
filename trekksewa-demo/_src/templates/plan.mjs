// "Plan my trek": the guided path from "I would like to trek" to a dated plan with places to
// sleep, people to help, costs and paperwork. The page is a shell; client/pages/plan.js draws
// one step at a time into it.

import { html, raw } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { daysRange } from '../lib/format.mjs';

// icons the browser script clones (they have to pass through icon() to reach the sprite)
const ICONS = [
  'arrow-left', 'arrow-right', 'bed-double', 'bookmark', 'calendar-days', 'calendar-plus', 'check', 'chevron-right', 'circle-check', 'clock', 'copy', 'footprints',
  'heart-pulse', 'info', 'list-checks', 'mail', 'map', 'message-circle', 'minus', 'mountain', 'pencil', 'plus', 'printer', 'send', 'share-2', 'shield-check', 'ticket',
  'triangle-alert', 'users', 'wallet', 'bus', 'plane', 'car', 'stethoscope', 'refresh-cw',
];

export function planPage(ctx) {
  const { u, content, config } = ctx;
  const featured = content.treks.slice(0, 12);
  const body = html`
<div class="wrap plan" data-plan>
  <div class="plan-live sr-only" aria-live="polite" data-plan-live></div>
  <div data-plan-view>
    <div class="plan-step">
      <p class="plan-progress">Plan my trek</p>
      <h1>Let us plan your trek, one step at a time</h1>
      <p class="lead">A few simple questions, then a day-by-day plan: where you walk, where you sleep, who can help you and what it may cost.</p>
      <p class="plan-loading" data-plan-loading>${icon('refresh-cw', { size: 18 })} Getting things ready…</p>
    </div>
  </div>
  <noscript>
    <div class="note note-plain"><p>The step-by-step planner needs JavaScript. You can still read every trek guide:</p></div>
    <ul class="plain-list">
      ${featured.map((t) => html`<li><a href="${u(`treks/${t.slug}/`)}">${t.name}</a> · ${daysRange(t.daysRange)}</li>`)}
      <li><a href="${u('treks/')}">All ${content.treks.length} treks</a></li>
    </ul>
  </noscript>
  <template data-plan-icons>${ICONS.map((n) => html`<span data-i="${n}">${icon(n, { size: 22 })}</span>`)}</template>
</div>`;
  return {
    title: 'Plan My Trek in Nepal, Step by Step',
    description: `Answer three simple questions and get a day-by-day Nepal trek plan: where you walk and sleep each night, who can guide you, what it costs and which permits you need. Free, from ${config.name}.`,
    section: 'plan',
    bodyClass: 'plan-page',
    scripts: ['plan'],
    priority: 0.9,
    body,
  };
}

/** The old address of the date planner now leads here. */
export function plannerRedirectPage(ctx) {
  const { u } = ctx;
  return {
    title: 'Trek planner',
    description: 'The trek planner has moved to Plan my trek.',
    section: 'plan',
    noindex: true,
    head: raw(`<meta http-equiv="refresh" content="0; url=${u('plan/')}"><script>location.replace(${JSON.stringify(u('plan/'))} + location.search)</script>`),
    body: html`<div class="wrap section"><h1>The planner has moved</h1><p class="lead"><a href="${u('plan/')}">Open Plan my trek</a></p></div>`,
  };
}
