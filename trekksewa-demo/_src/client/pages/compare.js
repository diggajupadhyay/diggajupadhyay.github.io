// Compare two or three treks side by side. The selection lives in the URL (?t=a,b,c).

import { $, $$, h } from '../lib/dom.js';
import { url } from '../lib/site.js';
import { analyseNights } from '../../lib/altitude.mjs';
import { profileMini } from '../../lib/profile.mjs';
import { DIFFICULTY, STYLE_LABEL, MONTHS, MONTHS_SHORT, num, daysRange, monthRanges } from '../../lib/format.mjs';

const root = $('[data-compare]');
if (root) {
  const selects = $$('[data-compare-select]', root);
  const out = $('[data-compare-out]', root);
  const { permits, hues } = JSON.parse($('#compare-data').textContent);
  const GUIDE = { required: 'Required', 'strongly-recommended': 'Strongly recommended', optional: 'Optional' };
  let treks = null;

  const wanted = (new URLSearchParams(location.search).get('t') || '').split(',').filter(Boolean);
  if (wanted.length) selects.forEach((s, i) => (s.value = [...s.options].some((o) => o.value === wanted[i]) ? wanted[i] : ''));

  function months(t) {
    const now = new Date().getMonth() + 1;
    return h(
      'ol',
      { class: 'months' },
      MONTHS.map((name, i) => {
        const m = i + 1;
        const k = t.best.includes(m) ? 'best' : t.good.includes(m) ? 'good' : 'hard';
        return h('li', { class: `m-${k}${m === now ? ' m-now' : ''}` }, h('span', { 'aria-hidden': 'true' }, MONTHS_SHORT[i][0]), h('span', { class: 'sr-only' }, `${name}: ${k === 'best' ? 'best time' : k === 'good' ? 'good' : 'difficult'}`));
      }),
    );
  }

  function column(t) {
    const nights = analyseNights(
      t.it.map((d, i) => ({ alt: d.a, day: i + 1 })),
      t.gw,
    );
    const s = nights.summary;
    const flagged = s.watch + s.high;
    const pts = [{ x: 0, y: t.it[0].a }, ...t.it.map((d, i) => ({ x: i + 1, y: d.a }))];
    const art = h('div', { class: `compare-art hue-${hues[t.r] || 'slate'}` });
    art.innerHTML = profileMini(pts); // generated from numbers only
    const row = (label, value, sub) => h('div', { class: 'compare-row' }, h('dt', {}, label), h('dd', {}, value, sub ? h('small', {}, sub) : null));
    return h(
      'article',
      { class: 'card compare-col' },
      art,
      h(
        'div',
        { class: 'compare-body' },
        h('p', { class: 'small muted' }, t.rn),
        h('h2', {}, h('a', { href: url(`treks/${t.s}/`) }, t.n)),
        h(
          'dl',
          {},
          row('Duration', daysRange(t.dr), `${t.d} days in our itinerary`),
          row('Distance', `${num(t.km)} km`, 'approximate'),
          row('Highest point', `${num(t.max)} m`),
          row('Highest night', s.maxSleep ? `${num(s.maxSleep.alt)} m` : '—', `${s.nightsAbove4000} ${s.nightsAbove4000 === 1 ? 'night' : 'nights'} above 4,000 m`),
          row('Difficulty', DIFFICULTY[t.g].label, DIFFICULTY[t.g].blurb),
          row('Altitude check', flagged ? `${flagged} ${flagged === 1 ? 'night' : 'nights'} to watch` : s.nightsAbove3000 ? 'Within the guideline' : 'Low altitude risk'),
          row('Sleeping', t.st.map((x) => STYLE_LABEL[x]).join(', ')),
          row('Best months', monthRanges(t.best)),
          h('div', { class: 'compare-row compare-months' }, h('dt', { class: 'sr-only' }, 'Month by month'), h('dd', {}, months(t))),
          row('Permits', t.p.length ? t.p.map((id) => permits[id] || id).join(', ') : 'None'),
          row('Guide', GUIDE[t.gr] || '—', t.ra ? 'Restricted area: agency required' : null),
        ),
        h('a', { class: 'btn btn-secondary btn-sm btn-block', href: url(`treks/${t.s}/`) }, 'Open the guide'),
      ),
    );
  }

  async function render() {
    try {
      treks ??= await (await fetch(url('data/treks.json'))).json();
    } catch {
      out.replaceChildren(h('p', { class: 'muted' }, 'The trek list needs a connection the first time.'));
      return;
    }
    const chosen = selects.map((s) => treks.find((t) => t.s === s.value)).filter(Boolean);
    const unique = chosen.filter((t, i) => chosen.findIndex((x) => x.s === t.s) === i);
    out.className = `compare-out compare-${unique.length}`;
    out.replaceChildren(...(unique.length ? unique.map(column) : [h('div', { class: 'empty' }, h('h3', {}, 'Choose two treks to compare'))]));
    history.replaceState(null, '', unique.length ? `?t=${unique.map((t) => t.s).join(',')}` : location.pathname);
  }
  selects.forEach((s) => s.addEventListener('change', render));
  render();
}
