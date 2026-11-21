// Packing list: filters a master list by trek, month and style, and remembers what is packed.

import { $, $$, h, on } from '../lib/dom.js';
import { url } from '../lib/site.js';
import * as store from '../lib/store.js';

const root = $('[data-packing]');
if (root) {
  const form = $('[data-packing-form]', root);
  const groupsEl = $('[data-packing-groups]', root);
  const countEl = $('[data-packing-count]', root);
  const meter = $('[data-packing-meter]', root);
  const hideBox = $('[data-packing-hide]', root);
  const { groups } = JSON.parse($('#packing-data').textContent);
  let treks = null;
  let packed = new Set(store.get('packed', []));

  const COLD_MONTHS = [11, 12, 1, 2, 3];
  const WET_MONTHS = [6, 7, 8, 9];
  const SNOW_MONTHS = [12, 1, 2, 3];
  const keyOf = (groupId, text) => `${groupId}:${text}`;

  function context() {
    const fd = new FormData(form);
    const alt = Number(fd.get('alt')) || 0;
    const month = Number(fd.get('month')) || new Date().getMonth() + 1;
    return {
      alt,
      month,
      cold: COLD_MONTHS.includes(month) || alt >= 4500,
      wet: WET_MONTHS.includes(month),
      snow: (SNOW_MONTHS.includes(month) && alt >= 3000) || alt >= 5000,
      porter: fd.get('porter') === '1',
      camping: fd.get('camping') === '1',
      remote: fd.get('remote') === '1',
      glacier: fd.get('glacier') === '1',
    };
  }

  function wanted(item, c) {
    if (item.alt && c.alt < item.alt) return false;
    if (item.maxAlt && c.alt > item.maxAlt) return false;
    for (const flag of ['cold', 'wet', 'snow', 'porter', 'camping', 'remote', 'glacier']) if (item[flag] && !c[flag]) return false;
    if (item.noPorter && c.porter) return false;
    return true;
  }

  function render() {
    const c = context();
    let total = 0;
    let done = 0;
    const sections = [];
    for (const g of groups) {
      const items = g.items.filter((it) => wanted(it, c));
      if (!items.length) continue;
      const lis = items.map((it) => {
        const key = keyOf(g.id, it.t);
        const isPacked = packed.has(key);
        total++;
        if (isPacked) done++;
        const box = h('input', { type: 'checkbox', 'data-key': key });
        box.checked = isPacked;
        return h(
          'li',
          { class: isPacked ? 'is-packed' : '' },
          h('label', { class: 'check' }, box, h('span', {}, h('span', { class: 'pk-text' }, it.t), it.rent ? h('span', { class: 'badge badge-ok' }, 'Rent') : null, it.n ? h('small', {}, it.n) : null)),
        );
      });
      const left = items.filter((it) => !packed.has(keyOf(g.id, it.t))).length;
      sections.push(h('section', { class: 'card card-pad packing-group' }, h('h2', {}, g.name, h('span', { class: 'muted small' }, left ? ` ${left} to go` : ' all packed')), h('ul', {}, lis)));
    }
    groupsEl.replaceChildren(...sections);
    groupsEl.classList.toggle('hide-packed', hideBox.checked);
    countEl.textContent = `${done} of ${total} packed`;
    meter.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
    store.set('packing-form', Object.fromEntries(new FormData(form).entries()));
  }

  async function applyTrek(slug) {
    if (!slug) return;
    try {
      treks ??= await (await fetch(url('data/treks.json'))).json();
    } catch {
      return;
    }
    const t = treks.find((x) => x.s === slug);
    if (!t) return;
    form.elements.alt.value = t.max;
    form.elements.camping.checked = t.st.includes('camping') && !t.st.includes('teahouse');
    form.elements.remote.checked = t.g === 'strenuous' || t.ra === 1;
  }

  on(groupsEl, 'change', 'input[type="checkbox"]', (e, box) => {
    if (box.checked) packed.add(box.dataset.key);
    else packed.delete(box.dataset.key);
    store.set('packed', [...packed]);
    render();
  });
  form.addEventListener('change', async (e) => {
    if (e.target.name === 'trek') await applyTrek(e.target.value);
    render();
  });
  form.addEventListener('input', (e) => {
    if (e.target.name === 'alt') render();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  hideBox.addEventListener('change', render);
  $('[data-packing-reset]', root).addEventListener('click', () => {
    packed = new Set();
    store.set('packed', []);
    render();
  });
  on(document, 'click', '[data-print]', () => window.print());

  // ---------- initial state: URL first, then the last form, then this month
  (async () => {
    const params = new URLSearchParams(location.search);
    const saved = store.get('packing-form', {});
    form.elements.month.value = String(params.get('month') || saved.month || new Date().getMonth() + 1);
    const slug = params.get('trek') || '';
    if (slug && [...form.elements.trek.options].some((o) => o.value === slug)) {
      form.elements.trek.value = slug;
      await applyTrek(slug);
    } else if (saved.alt) {
      form.elements.alt.value = saved.alt;
      if (saved.trek && [...form.elements.trek.options].some((o) => o.value === saved.trek)) form.elements.trek.value = saved.trek;
      for (const name of ['porter', 'camping', 'remote', 'glacier']) form.elements[name].checked = saved[name] === '1';
    }
    render();
  })();
}
