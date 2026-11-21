// Acclimatization checker: an editable list of nights, analysed live.

import { $, h } from '../lib/dom.js';
import { url } from '../lib/site.js';
import * as store from '../lib/store.js';
import { analyseNights, RULES } from '../../lib/altitude.mjs';
import { profileHtml } from '../../lib/profile.mjs';
import { attach } from '../lib/profile-hover.js';
import { num, signed } from '../../lib/format.mjs';

const root = $('[data-accl]');
if (root) {
  const trekSel = $('[data-accl-trek]', root);
  const startInput = $('[data-accl-start]', root);
  const rowsEl = $('[data-accl-rows]', root);
  const chartEl = $('[data-accl-chart]', root);
  const summaryEl = $('[data-accl-summary]', root);
  const DEFAULT = [
    { label: 'Night 1', alt: 2600 },
    { label: 'Night 2', alt: 3400 },
    { label: 'Night 3', alt: 3400 },
    { label: 'Night 4', alt: 3900 },
  ];
  let nights = [];
  let treks = null;
  let original = null;

  const LEVEL = { ok: ['badge-ok', 'Fine'], watch: ['badge-watch', 'Watch'], high: ['badge-high', 'Too fast'] };

  function persist() {
    store.set('accl', { trek: trekSel.value, start: Number(startInput.value) || 0, nights });
  }

  function render() {
    const start = Number(startInput.value) || 0;
    const valid = nights.filter((n) => Number.isFinite(n.alt) && n.alt > 0);
    const { nights: analysed, summary } = analyseNights(
      nights.map((n, i) => ({ alt: Number.isFinite(n.alt) ? n.alt : 0, label: n.label, day: i + 1 })),
      start,
    );

    // ----- table
    rowsEl.replaceChildren(
      ...analysed.map((n, i) => {
        const [cls, word] = LEVEL[n.level];
        const labelInput = h('input', { class: 'input input-sm', value: nights[i].label, 'aria-label': `Place for night ${i + 1}` });
        labelInput.addEventListener('change', () => {
          nights[i].label = labelInput.value;
          persist();
          render();
        });
        const altInput = h('input', { class: 'input input-sm num', type: 'number', inputmode: 'numeric', min: '0', max: '8848', step: '10', value: nights[i].alt || '', 'aria-label': `Sleeping altitude for night ${i + 1}` });
        altInput.addEventListener('change', () => {
          nights[i].alt = Number(altInput.value);
          persist();
          render();
        });
        return h(
          'tr',
          { class: `lvl-${n.level}` },
          h('td', { class: 'num' }, String(i + 1)),
          h('td', {}, labelInput),
          h('td', { class: 'num' }, altInput),
          h('td', { class: 'num' }, `${signed(n.gain)} m`),
          h('td', {}, h('span', { class: `badge ${cls}` }, word), n.reasons.length || n.notes.length ? h('small', { class: 'accl-why' }, [...n.reasons, ...n.notes].join(' ')) : null),
          h(
            'td',
            { class: 'accl-row-actions' },
            h('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: 'Add a rest night here', 'aria-label': `Add a rest night after night ${i + 1}`, onclick: () => addAfter(i) }, '+ night'),
            h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': `Remove night ${i + 1}`, onclick: () => removeAt(i) }, '✕'),
          ),
        );
      }),
    );

    // ----- chart
    if (valid.length >= 1) {
      const pts = [{ x: 0, y: start, marker: true }, ...analysed.map((n, i) => ({ x: i + 1, y: n.alt, marker: true }))];
      const step = pts.length <= 14 ? 1 : pts.length <= 28 ? 2 : 5;
      const top = analysed.reduce((m, n) => (n.alt > m.alt ? n : m), analysed[0]);
      chartEl.innerHTML =
        profileHtml({
          points: pts,
          xDomain: [0, analysed.length],
          xTicks: analysed.map((_, i) => ({ x: i + 1, label: String(i + 1) })).filter((t) => t.x % step === 0 || step === 1),
          xTitle: 'Night',
          labels: [{ x: top.day, y: top.alt, text: `${top.label || `Night ${top.day}`} ${num(top.alt)} m` }],
        }) + '<figcaption class="xsmall muted">Sleeping altitude each night. Only where you sleep counts for acclimatization.</figcaption>';
      const pf = chartEl.querySelector('[data-profile]');
      if (pf)
        attach(pf, [
          { x: 0, y: start, l: 'Where you set out from' },
          ...analysed.map((n, i) => ({ x: i + 1, y: n.alt, l: `Night ${i + 1} · ${n.label || ''}`, s: n.reasons[0] || `${signed(n.gain)} m from the night before` })),
        ]);
    } else chartEl.replaceChildren();

    // ----- summary
    const flagged = analysed.filter((n) => n.level !== 'ok');
    const tone = summary.high ? 'note-danger' : summary.watch ? 'note-warn' : 'note-ok';
    const title = summary.nightsAbove3000 === 0 ? 'Low altitude risk' : flagged.length === 0 ? 'Within the usual guideline' : `${flagged.length} ${flagged.length === 1 ? 'night needs' : 'nights need'} attention`;
    const text =
      summary.nightsAbove3000 === 0
        ? 'You never sleep above 3,000 m, so altitude illness is unlikely on this plan.'
        : flagged.length === 0
          ? `Every night stays within about ${RULES.dailyGain} m of gain above ${num(RULES.startAlt)} m, with rest nights where they are needed.`
          : 'Add a rest night before each marked climb, or split the climb with a stop lower down, then see how the plan looks.';
    const tips = flagged.slice(0, 4).map((n) => {
      const prev = analysed[n.day - 2];
      const where = `Night ${n.day}${n.label ? ` (${n.label})` : ''}`;
      if (n.counted > RULES.bigGain || !prev) return h('li', {}, `${where}: too big a step for one day. Break it with a night part-way up.`);
      if (n.counted > RULES.balancedGain) return h('li', {}, `${where}: a large step. Sleep part-way up if there is somewhere to stop, and keep a rest night either side.`);
      return h('li', {}, `${where}: add a rest night at ${prev.label || `${num(prev.alt)} m`} before this climb, or stay two nights once you arrive.`);
    });
    summaryEl.replaceChildren(
      h(
        'div',
        { class: `note ${tone}` },
        h('span', { 'aria-hidden': 'true', class: 'accl-dot' }),
        h('div', {}, h('p', {}, h('strong', {}, `${title}. `), text), tips.length ? h('ul', {}, tips) : null),
      ),
      h(
        'dl',
        { class: 'accl-mini' },
        h('div', {}, h('dt', {}, 'Highest night'), h('dd', {}, summary.maxSleep ? `${num(summary.maxSleep.alt)} m` : '—')),
        h('div', {}, h('dt', {}, 'Nights above 3,000 m'), h('dd', {}, String(summary.nightsAbove3000))),
        h('div', {}, h('dt', {}, 'Nights above 4,000 m'), h('dd', {}, String(summary.nightsAbove4000))),
        h('div', {}, h('dt', {}, 'Biggest gain'), h('dd', {}, summary.biggestGain ? `${signed(summary.biggestGain.counted)} m` : '—')),
      ),
      trekSel.value ? h('p', { class: 'small' }, h('a', { href: url(`treks/${trekSel.value}/`) }, 'Open the full trek guide')) : null,
    );
  }

  function addAfter(i) {
    const n = nights[i];
    nights.splice(i + 1, 0, { label: n.label ? `${n.label} (rest)`.replace(' (rest) (rest)', ' (rest)') : '', alt: n.alt });
    persist();
    render();
  }
  function removeAt(i) {
    if (nights.length <= 1) return;
    nights.splice(i, 1);
    persist();
    render();
  }

  async function loadTrek(slug) {
    try {
      treks ??= await (await fetch(url('data/treks.json'))).json();
    } catch {
      summaryEl.replaceChildren(h('div', { class: 'note note-warn' }, h('span', {}), h('div', {}, h('p', {}, 'The itineraries need a connection the first time. You can still type in your own nights.'))));
      return false;
    }
    const t = treks.find((x) => x.s === slug);
    if (!t) return false;
    nights = t.it.map((d) => ({ label: d.to, alt: d.a }));
    startInput.value = t.gw;
    original = JSON.stringify(nights);
    return true;
  }

  trekSel.addEventListener('change', async () => {
    if (trekSel.value) await loadTrek(trekSel.value);
    else {
      nights = DEFAULT.map((n) => ({ ...n }));
      original = null;
    }
    history.replaceState(null, '', trekSel.value ? `?trek=${trekSel.value}` : location.pathname);
    persist();
    render();
  });
  startInput.addEventListener('change', () => {
    persist();
    render();
  });
  $('[data-accl-add]', root).addEventListener('click', () => {
    const last = nights[nights.length - 1];
    nights.push({ label: `Night ${nights.length + 1}`, alt: last ? last.alt : 2500 });
    persist();
    render();
  });
  $('[data-accl-reset]', root).addEventListener('click', async () => {
    if (trekSel.value && original) nights = JSON.parse(original);
    else nights = DEFAULT.map((n) => ({ ...n }));
    persist();
    render();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-print]')) window.print();
  });

  // ----- initial state: ?trek=… wins, then whatever was being edited last time
  (async () => {
    const wanted = new URLSearchParams(location.search).get('trek');
    const saved = store.get('accl');
    if (wanted && [...trekSel.options].some((o) => o.value === wanted)) {
      trekSel.value = wanted;
      if (saved && saved.trek === wanted && Array.isArray(saved.nights) && saved.nights.length) {
        await loadTrek(wanted); // sets `original` for Reset
        nights = saved.nights;
        startInput.value = saved.start;
      } else if (!(await loadTrek(wanted))) nights = DEFAULT.map((n) => ({ ...n }));
    } else if (saved && Array.isArray(saved.nights) && saved.nights.length) {
      nights = saved.nights;
      startInput.value = saved.start ?? 1400;
      if (saved.trek && [...trekSel.options].some((o) => o.value === saved.trek)) trekSel.value = saved.trek;
    } else nights = DEFAULT.map((n) => ({ ...n }));
    render();
  })();
}
