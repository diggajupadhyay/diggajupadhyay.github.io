// Insurance check: works out the altitude cover a trek needs and keeps the checklist ticks.

import { $, $$, h, on } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { num } from '../../lib/format.mjs';

const root = $('[data-insurance]');
if (root) {
  const select = $('[data-ins-trek]', root);
  const result = $('[data-ins-result]', root);
  const boxes = $$('[data-ins-list] input', root);
  const countEl = $('[data-ins-count]', root);
  const TIERS = [3000, 4000, 4500, 5000, 5500, 6000];
  const ticked = new Set(store.get('insurance-checks', []));

  function paintTrek() {
    const o = select.selectedOptions[0];
    const max = Number(o?.dataset.max);
    for (const el of $$('[data-ins-tier]', root)) el.textContent = max ? `${num(TIERS.find((t) => t >= max) || Math.ceil(max / 500) * 500)} m` : 'the highest point of your route';
    // the glacier and rope line only matters on technical routes
    const technical = o && (o.dataset.grade === 'strenuous' || (o.dataset.style || '').includes('camping') || max >= 5300);
    for (const li of $$('[data-ins-flag="technical"]', root)) li.hidden = Boolean(o && o.value) && !technical;
    if (!o || !o.value) {
      result.hidden = true;
      return paintCount();
    }
    const tier = TIERS.find((t) => t >= max);
    const sleep = Number(o.dataset.sleep);
    const lines = [
      h('p', { class: 'ins-need' }, 'Your policy must cover trekking to at least ', h('strong', {}, tier ? `${num(tier)} m` : `${num(Math.ceil(max / 500) * 500)} m`), '.'),
      h('p', { class: 'small' }, `The highest point on ${o.textContent} is ${o.dataset.place} at ${num(max)} m${sleep ? `, and the highest place you sleep is at ${num(sleep)} m` : ''}. Insurers set their limit by the highest point reached.`),
      max >= 5500 ? h('p', { class: 'small' }, 'Above 5,500 m some insurers treat the trip as mountaineering. Ask them in writing whether a trekking viewpoint or pass at this height is covered.') : null,
    ];
    result.replaceChildren(...lines.filter(Boolean)); // replaceChildren would print a null as text
    result.hidden = false;
    history.replaceState(null, '', `?trek=${o.value}`);
    paintCount();
  }

  function paintCount() {
    const visible = boxes.filter((b) => !b.closest('li').hidden);
    const done = visible.filter((b) => b.checked).length;
    countEl.textContent = done === visible.length ? 'Every line checked. Keep the policy number where you can reach it.' : `${done} of ${visible.length} checked`;
  }

  for (const b of boxes) {
    b.checked = ticked.has(b.value);
    b.addEventListener('change', () => {
      if (b.checked) ticked.add(b.value);
      else ticked.delete(b.value);
      store.set('insurance-checks', [...ticked]);
      paintCount();
    });
  }
  $('[data-ins-reset]', root).addEventListener('click', () => {
    ticked.clear();
    store.set('insurance-checks', []);
    for (const b of boxes) b.checked = false;
    paintCount();
  });
  on(document, 'click', '[data-print]', () => window.print());
  select.addEventListener('change', paintTrek);
  const wanted = new URLSearchParams(location.search).get('trek');
  if (wanted && [...select.options].some((o) => o.value === wanted)) select.value = wanted;
  paintTrek();
}
