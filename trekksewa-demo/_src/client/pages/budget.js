// Budget estimator. All arithmetic is visible in the breakdown; every input is editable.

import { $, h, on } from '../lib/dom.js';
import { url } from '../lib/site.js';
import * as store from '../lib/store.js';
import { num } from '../../lib/format.mjs';
import { permitTotal } from '../../lib/plan.mjs';

const root = $('[data-budget]');
if (root) {
  const form = $('[data-budget-form]', root);
  const { permits, foodByRegion } = JSON.parse($('#budget-data').textContent);
  const hint = $('[data-budget-permit-hint]', root);
  let treks = null;

  const val = (name) => Math.max(0, Number(form.elements[name].value) || 0);
  const usd = (v) => `USD ${num(Math.round(v))}`;

  function render() {
    const days = Math.max(1, val('days'));
    const people = Math.max(1, val('people'));
    const guides = val('guides');
    const porters = val('porters');
    const staffWages = (guides * val('guideRate') + porters * val('porterRate')) * days;
    const tips = (staffWages * val('tip')) / 100;
    const food = val('food') * days * people;
    const once = (val('permits') + val('transport') + val('gear')) * people;
    const subtotal = staffWages + tips + food + once;
    const buffer = (subtotal * val('buffer')) / 100;
    const total = subtotal + buffer;
    const perPerson = total / people;
    const rate = Math.max(1, val('rate'));

    $('[data-budget-total]', root).textContent = usd(perPerson);
    $('[data-budget-per]', root).textContent = `per trekker, about NPR ${num(Math.round((perPerson * rate) / 100) * 100)} · ${usd(total)} for the group of ${people} · ${usd(perPerson / days)} a day each`;
    const line = (label, amount, detail) => h('tr', {}, h('td', {}, label, detail ? h('small', {}, detail) : null), h('td', { class: 'num' }, usd(amount)));
    $('[data-budget-lines]', root).replaceChildren(
      line('Food and lodging', food, `${people} × ${days} days × USD ${val('food')}`),
      guides ? line(guides > 1 ? 'Guides' : 'Guide', guides * val('guideRate') * days, `${guides} × ${days} days × USD ${val('guideRate')}`) : null,
      porters ? line(porters > 1 ? 'Porters' : 'Porter', porters * val('porterRate') * days, `${porters} × ${days} days × USD ${val('porterRate')}`) : null,
      staffWages ? line('Tips', tips, `${val('tip')}% of wages`) : null,
      line('Permits', val('permits') * people, `${people} × USD ${val('permits')}`),
      line('Transport', val('transport') * people, `${people} × USD ${val('transport')}`),
      line('Gear', val('gear') * people, `${people} × USD ${val('gear')}`),
      line('Contingency', buffer, `${val('buffer')}%`),
      h('tr', { class: 'budget-sum' }, h('td', {}, 'Total for the group'), h('td', { class: 'num' }, usd(total))),
    );
    // what has to be in your pocket on the trail: lodges and tips are paid in rupees, in cash
    const cashEach = ((food + tips) / people) * (1 + val('buffer') / 100) * rate;
    $('[data-budget-cash]', root).textContent = `Cash to carry on the trail: about NPR ${num(Math.round(cashEach / 1000) * 1000)} each for food, beds, tips and the contingency. Cash machines are rare and unreliable beyond the gateway town.`;
    store.set('budget-form', Object.fromEntries(new FormData(form).entries()));
  }

  async function applyTrek(slug) {
    if (!slug) {
      hint.textContent = 'Choose a trek to fill this in.';
      return;
    }
    try {
      treks ??= await (await fetch(url('data/treks.json'))).json();
    } catch {
      hint.textContent = 'The trek list needs a connection the first time. Enter the permit cost yourself.';
      return;
    }
    const t = treks.find((x) => x.s === slug);
    if (!t) return;
    form.elements.days.value = t.d;
    form.elements.food.value = foodByRegion[t.r] ?? 35;
    const { total, parts: fees } = permitTotal(t.p, t.d, Math.max(1, val('rate')), permits);
    const parts = fees.map((f) => f.short + ' ' + f.cur + ' ' + num(f.amount) + (f.verified ? '' : ' (unconfirmed)'));
    form.elements.permits.value = Math.round(total);
    hint.replaceChildren(parts.length ? `${parts.join(' + ')}. ` : 'No trekking permit is needed. ', h('a', { href: url(`permits/?trek=${slug}`) }, 'See the fees'));
    if (t.ra === 1 && Number(form.elements.guides.value) === 0) form.elements.guides.value = '1';
  }

  form.addEventListener('input', render);
  form.addEventListener('change', async (e) => {
    if (e.target.name === 'trek') await applyTrek(e.target.value);
    render();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  on(document, 'click', '[data-print]', () => window.print());

  (async () => {
    const saved = store.get('budget-form', {});
    for (const [k, v] of Object.entries(saved)) if (form.elements[k] && k !== 'trek') form.elements[k].value = v;
    const slug = new URLSearchParams(location.search).get('trek') || '';
    if (slug && [...form.elements.trek.options].some((o) => o.value === slug)) {
      form.elements.trek.value = slug;
      await applyTrek(slug);
    } else if (saved.trek && [...form.elements.trek.options].some((o) => o.value === saved.trek)) form.elements.trek.value = saved.trek;
    render();
  })();
}
