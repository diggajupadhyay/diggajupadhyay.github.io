// Trek listing: filter and sort the server-rendered cards. State lives in the URL so a
// filtered view can be shared or bookmarked.

import { $, $$ } from '../lib/dom.js';

const form = $('[data-filters]');
const list = $('[data-trek-list]');
if (form && list) {
  const cells = $$('.trek-cell', list);
  const status = $('[data-filter-status]');
  const empty = $('[data-filter-empty]');
  const reset = $('[data-filter-reset]');
  const more = $('[data-filters-more]');
  const countBadge = $('[data-filter-count]');
  const MULTI = ['region', 'days', 'grade', 'alt', 'style'];
  form.hidden = false;
  if (window.matchMedia('(min-width: 900px)').matches) more.open = true;

  // ----- read state from the URL
  const params = new URLSearchParams(location.search);
  for (const key of [...MULTI, 'open']) {
    const values = params.getAll(key).flatMap((v) => v.split(','));
    for (const input of $$(`input[name="${key}"]`, form)) input.checked = values.includes(input.value);
  }
  form.elements.q.value = params.get('q') || '';
  form.elements.month.value = params.get('month') || '';
  form.elements.sort.value = params.get('sort') || '';

  const checked = (name) => $$(`input[name="${name}"]:checked`, form).map((i) => i.value);

  function apply({ push = true } = {}) {
    const q = form.elements.q.value.trim().toLowerCase();
    const month = form.elements.month.value;
    const sort = form.elements.sort.value;
    const state = Object.fromEntries(MULTI.map((k) => [k, checked(k)]));
    const open = checked('open').length > 0;
    let shown = 0;

    for (const cell of cells) {
      const d = cell.dataset;
      let ok = true;
      if (q && !d.name.includes(q)) ok = false;
      if (ok && month && !d.months.split(' ').includes(month)) ok = false;
      if (ok && state.region.length && !state.region.includes(d.region)) ok = false;
      if (ok && state.grade.length && !state.grade.includes(d.grade)) ok = false;
      if (ok && state.alt.length && !state.alt.includes(d.alt)) ok = false;
      if (ok && state.days.length && !state.days.some((v) => d.days.split(' ').includes(v))) ok = false;
      if (ok && state.style.length && !state.style.some((v) => d.style.split(' ').includes(v))) ok = false;
      if (ok && open && d.open !== '1') ok = false;
      cell.hidden = !ok;
      if (ok) shown++;
    }

    const by = {
      '': (a, b) => a.dataset.i - b.dataset.i,
      days: (a, b) => a.dataset.d - b.dataset.d,
      'days-desc': (a, b) => b.dataset.d - a.dataset.d,
      alt: (a, b) => a.dataset.m - b.dataset.m,
      'alt-desc': (a, b) => b.dataset.m - a.dataset.m,
      name: (a, b) => a.dataset.slug.localeCompare(b.dataset.slug),
    }[sort];
    // when a month is chosen, treks at their best that month come first
    const bestFirst = (a, b) => (month ? Number(b.dataset.best.split(' ').includes(month)) - Number(a.dataset.best.split(' ').includes(month)) : 0);
    [...cells].sort((a, b) => bestFirst(a, b) || by(a, b)).forEach((c) => list.append(c));

    const active = MULTI.reduce((n, k) => n + state[k].length, 0) + (open ? 1 : 0);
    const any = active > 0 || q || month;
    status.textContent = shown === cells.length ? `${shown} treks` : `${shown} of ${cells.length} treks`;
    empty.hidden = shown > 0;
    list.hidden = shown === 0;
    reset.hidden = !any;
    countBadge.hidden = active === 0;
    countBadge.textContent = String(active);

    if (push) {
      const next = new URLSearchParams();
      if (q) next.set('q', q);
      if (month) next.set('month', month);
      if (sort) next.set('sort', sort);
      for (const k of MULTI) if (state[k].length) next.set(k, state[k].join(','));
      if (open) next.set('open', '1');
      const qs = next.toString();
      history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
    }
  }

  form.addEventListener('input', () => apply());
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('reset', () => setTimeout(() => apply(), 0));
  $('[data-filter-reset-2]')?.addEventListener('click', () => {
    form.reset();
    setTimeout(() => apply(), 0);
  });
  apply({ push: false });
}
