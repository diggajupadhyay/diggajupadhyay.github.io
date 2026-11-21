// Trek planner: dated itinerary for any trek, saved plans, calendar export.

import { $, h, on } from '../lib/dom.js';
import { url } from '../lib/site.js';
import * as store from '../lib/store.js';
import { toast, download } from '../lib/ui.js';
import { num, hours } from '../../lib/format.mjs';

const root = $('[data-planner]');
if (root) {
  const trekSel = $('[data-planner-trek]', root);
  const dateIn = $('[data-planner-date]', root);
  const extraSel = $('[data-planner-extra]', root);
  const out = $('[data-planner-out]', root);
  const rows = $('[data-planner-rows]', root);
  const savedBox = $('[data-saved-plans]', root);
  const savedList = $('[data-plan-list]', root);
  let treks = null;
  let plan = null; // { trek, start, days: [...] }

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtLong = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  dateIn.min = iso(new Date());

  async function load() {
    if (treks) return treks;
    try {
      treks = await (await fetch(url('data/treks.json'))).json();
    } catch {
      treks = null;
      toast('The itineraries need a connection the first time.');
    }
    return treks;
  }

  async function render() {
    const slug = trekSel.value;
    if (!slug || !dateIn.value) {
      out.hidden = true;
      return;
    }
    const list = await load();
    const t = list?.find((x) => x.s === slug);
    if (!t) return;
    const start = parse(dateIn.value);
    const extra = Number(extraSel.value) || 0;
    const days = [...t.it.map((d) => ({ title: d.t, to: d.to, alt: d.a, h: d.h, mode: d.m, kind: d.k })), ...Array.from({ length: extra }, () => ({ title: 'Spare day', to: '', alt: null, h: null, kind: 'buffer' }))];
    plan = { trek: t, start: dateIn.value, extra, days };
    const end = addDays(start, days.length - 1);
    $('[data-planner-title]', root).textContent = `${t.n}: ${days.length} days`;
    $('[data-planner-sub]', root).textContent = `${fmtLong.format(start)} to ${fmtLong.format(end)}`;
    rows.replaceChildren(
      ...days.map((d, i) =>
        h(
          'tr',
          { class: d.kind === 'buffer' ? 'is-buffer' : '' },
          h('td', { class: 'num' }, String(i + 1)),
          h('td', { class: 'nowrap' }, fmt.format(addDays(start, i))),
          h('td', {}, h('strong', {}, d.title), d.to ? h('span', { class: 'muted small' }, ` · sleep at ${d.to}`) : null),
          h('td', { class: 'num' }, d.alt ? `${num(d.alt)} m` : '—'),
          h('td', { class: 'num' }, d.h ? `${hours(d.h)}${d.mode ? ` (${d.mode})` : ''}` : '—'),
        ),
      ),
    );
    const month = start.getMonth() + 1;
    const fit = t.best.includes(month) ? 'one of the best months for this trek' : t.good.includes(month) ? 'a workable month for this trek' : 'a difficult month for this trek';
    $('[data-planner-links]', root).replaceChildren(
      h('p', { class: t.best.includes(month) || t.good.includes(month) ? 'small' : 'small plan-warn' }, `You are starting in ${start.toLocaleDateString('en-GB', { month: 'long' })}, ${fit}.`),
      h(
        'div',
        { class: 'cluster', style: '--gap:.5rem' },
        h('a', { class: 'btn btn-secondary btn-sm', href: url(`treks/${t.s}/`) }, 'Open the trek guide'),
        h('a', { class: 'btn btn-secondary btn-sm', href: url(`tools/packing/?trek=${t.s}&month=${month}`) }, 'Packing list'),
        h('a', { class: 'btn btn-secondary btn-sm', href: url(`tools/budget/?trek=${t.s}`) }, 'Budget'),
        h('a', { class: 'btn btn-secondary btn-sm', href: url(`safety/acclimatization/?trek=${t.s}`) }, 'Check acclimatization'),
      ),
    );
    out.hidden = false;
    history.replaceState(null, '', `?trek=${slug}&start=${dateIn.value}`);
  }

  function paintSaved() {
    const plans = store.get('plans', {});
    const entries = Object.entries(plans).filter(([, p]) => p && p.start);
    savedBox.hidden = entries.length === 0;
    savedList.replaceChildren(
      ...entries
        .sort((a, b) => a[1].start.localeCompare(b[1].start))
        .map(([slug, p]) => {
          const start = parse(p.start);
          const daysTo = Math.round((start - new Date(new Date().toDateString())) / 86400000);
          const when = daysTo > 1 ? `in ${daysTo} days` : daysTo === 1 ? 'tomorrow' : daysTo === 0 ? 'today' : 'started';
          return h(
            'li',
            {},
            h('div', {}, h('strong', {}, p.name || slug), h('span', { class: 'muted small' }, `${fmtLong.format(start)} · ${p.days} days · ${when}`)),
            h(
              'div',
              { class: 'cluster', style: '--gap:.4rem' },
              h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onclick: () => open(slug, p.start) }, 'Open'),
              h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => remove(slug), 'aria-label': `Remove the plan for ${p.name || slug}` }, 'Remove'),
            ),
          );
        }),
    );
  }
  function open(slug, start) {
    trekSel.value = slug;
    dateIn.value = start;
    render();
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function remove(slug) {
    const plans = store.get('plans', {});
    delete plans[slug];
    store.set('plans', plans);
    paintSaved();
  }

  on(root, 'click', '[data-planner-save]', () => {
    if (!plan) return;
    const plans = store.get('plans', {});
    plans[plan.trek.s] = { start: plan.start, name: plan.trek.n, days: plan.days.length };
    store.set('plans', plans);
    paintSaved();
    toast('Plan saved on this device');
  });
  on(root, 'click', '[data-planner-ics]', () => {
    if (!plan) return;
    const start = parse(plan.start);
    const d8 = (d) => iso(d).replace(/-/g, '');
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const events = plan.days.map((d, i) => {
      const day = addDays(start, i);
      const desc = [d.to ? `Sleep at ${d.to}${d.alt ? ` (${d.alt} m)` : ''}` : '', d.h ? `About ${hours(d.h)}` : '', url(`treks/${plan.trek.s}/#day-${i + 1}`)].filter(Boolean).join('\n');
      return ['BEGIN:VEVENT', `UID:${plan.trek.s}-${i + 1}-${d8(day)}@trekksewa`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d8(day)}`, `DTEND;VALUE=DATE:${d8(addDays(day, 1))}`, `SUMMARY:${esc(`${plan.trek.n} day ${i + 1}: ${d.title}`)}`, `DESCRIPTION:${esc(desc)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT'].join('\r\n');
    });
    download(`${plan.trek.s}.ics`, ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TrekkSewa//Trek planner//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n'), 'text/calendar');
    toast('Calendar file downloaded');
  });
  on(document, 'click', '[data-print]', () => window.print());
  for (const el of [trekSel, dateIn, extraSel]) el.addEventListener('change', render);

  // ---------- initial state from the URL
  const params = new URLSearchParams(location.search);
  const wanted = params.get('trek');
  if (wanted && [...trekSel.options].some((o) => o.value === wanted)) trekSel.value = wanted;
  const start = params.get('start') || (wanted && store.get('plans', {})[wanted]?.start);
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) dateIn.value = start;
  paintSaved();
  render();
}
