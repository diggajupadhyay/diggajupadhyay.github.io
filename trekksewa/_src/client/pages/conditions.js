// Conditions page: month picker and the multi-point weather watch.

import { $, $$, h } from '../lib/dom.js';
import { url } from '../lib/site.js';
import { getForecasts, toDays, describe, dayAlerts, iconEl, deg, dayName, failureText } from '../lib/weather.js';
import { MONTHS } from '../../lib/format.mjs';

// ---------- month by month ----------
const box = $('[data-season]');
if (box) {
  const { seasons, treks } = JSON.parse($('#season-data').textContent);
  const buttons = $$('[data-season-month]', box);
  const show = (m) => {
    const s = seasons.find((x) => x.month === m);
    if (!s) return;
    const now = new Date().getMonth() + 1;
    $('[data-season-eyebrow]', box).textContent = m === now ? `${MONTHS[m - 1]} · this month` : MONTHS[m - 1];
    $('[data-season-title]', box).textContent = s.title;
    $('[data-season-text]', box).textContent = s.text;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.seasonMonth) === m)));
    const best = treks.filter((t) => t.b.includes(m));
    const wrap = $('[data-season-treks]', box);
    wrap.hidden = best.length === 0;
    wrap.querySelector('h3').textContent = `At their best in ${MONTHS[m - 1]}`;
    const chips = best.slice(0, 14).map((t) => h('a', { class: 'chip', href: url(`treks/${t.s}/`) }, t.n));
    if (best.length > 14) chips.push(h('a', { class: 'chip', href: url(`treks/?month=${m}`) }, `+${best.length - 14} more`));
    $('[data-season-list]', box).replaceChildren(...chips);
  };
  buttons.forEach((b) => b.addEventListener('click', () => show(Number(b.dataset.seasonMonth))));
  show(new Date().getMonth() + 1);
}

// ---------- weather watch ----------
const cards = $$('[data-watch-point]');
const status = $('[data-watch-status]');
if (cards.length) {
  const points = cards.map((c) => ({ lat: Number(c.dataset.lat), lon: Number(c.dataset.lon), alt: Number(c.dataset.alt) }));
  getForecasts(points)
    .then(({ list, fetchedAt, stale }) => {
      let flagged = 0;
      cards.forEach((card, i) => {
        const days = toDays(list[i]);
        const alerts = days.flatMap((d, k) => dayAlerts(d).map((a) => ({ ...a, text: `${dayName(d.date, k)}: ${a.text}` })));
        if (alerts.length) flagged++;
        const worst = alerts.some((a) => a.level === 'high') ? 'high' : alerts.length ? 'watch' : 'ok';
        card.dataset.level = worst;
        const dayItems = days.map((d, k) => {
          const w = describe(d.code);
          const wet = d.snow >= 1 ? `${Math.round(d.snow)} cm snow` : d.rain >= 1 ? `${Math.round(d.rain)} mm rain` : 'Dry';
          return h('li', {}, h('span', { class: 'wx-day' }, dayName(d.date, k)), iconEl(w.icon, 22), h('span', { class: 'sr-only' }, w.label), h('span', { class: 'wx-range' }, h('b', {}, deg(d.max)), ' ', h('span', {}, deg(d.min))), h('span', { class: 'wx-wet' }, wet));
        });
        const alertBox = alerts.length
          ? h(
              'ul',
              { class: 'wx-alerts' },
              alerts.slice(0, 3).map((a) => h('li', { class: `badge badge-${a.level}` }, a.text)),
            )
          : h('p', { class: 'badge badge-ok watch-ok' }, 'Nothing flagged for three days');
        $('[data-watch-body]', card).replaceChildren(h('ol', { class: 'watch-days' }, dayItems), alertBox);
      });
      const when = new Date(fetchedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const flaggedText = flagged ? `${flagged} of ${cards.length} points flagged` : 'nothing flagged';
      status.textContent = `${stale ? 'Offline: forecast saved' : 'Updated'} ${when} · ${flaggedText}`;
      // flagged points first
      const order = { high: 0, watch: 1, ok: 2 };
      const grid = $('[data-watch]');
      [...cards].sort((a, b) => order[a.dataset.level] - order[b.dataset.level]).forEach((c) => grid.append(c));
    })
    .catch((e) => {
      status.textContent = failureText(e);
      for (const card of cards) $('[data-watch-body]', card).replaceChildren(h('p', { class: 'small muted' }, 'No forecast to show yet.'));
    });
}
