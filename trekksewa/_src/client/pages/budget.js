// Budget estimator. All arithmetic is visible in the breakdown; every input is editable.

import { $, h, on } from '../lib/dom.js';
import { url } from '../lib/site.js';
import * as store from '../lib/store.js';
import { num } from '../../lib/format.mjs';

const root = $('[data-budget]');
if (root) {
  const form = $('[data-budget-form]', root);
  const { permits, foodByRegion } = JSON.parse($('#budget-data').textContent);
  const hint = $('[data-budget-permit-hint]', root);
  let treks = null;

  const val = (name) => Math.max(0, Number(form.elements[name].value) || 0);
  const usd = (v) => `USD ${num(Math.round(v))}`;

  /** "NPR 3,000" / "USD 50" -> { cur, amount } for the first figure in the text. */
  function parseAmount(text) {
    const m = String(text).match(/(NPR|USD)\s*([\d,]+(?:\.\d+)?)/i);
    return m ? { cur: m[1].toUpperCase(), amount: Number(m[2].replace(/,/g, '')) } : null;
  }

  /**
   * Best-effort permit total per trekker in USD. Fees quoted per day or per week are scaled
   * by the length of the trek, which overstates them slightly: that is the safe direction.
   */
  function permitTotal(ids, days, rate) {
    let total = 0;
    const parts = [];
    for (const id of ids) {
      const p = permits[id];
      if (!p) continue;
      // foreign-national fee where there is one, otherwise the dearest season
      const fee = p.fees.find((f) => /foreign/i.test(f.who)) || p.fees[0];
      const base = parseAmount(fee.amount);
      if (!base) continue;
      let amount = base.amount;
      const per = `${fee.per || ''} ${fee.amount}`.toLowerCase();
      if (/per day|a day\b/.test(per) && !/first|then/.test(per)) amount = base.amount * days;
      else if (/per week/.test(per) && !/first \d+ days/.test(per)) amount = base.amount * Math.ceil(days / 7);
      else {
        const first = per.match(/first (\d+) days/);
        const extra = per.match(/then (?:npr|usd)\s*([\d,]+) a day/);
        if (first && extra && days > Number(first[1])) amount += (days - Number(first[1])) * Number(extra[1].replace(/,/g, ''));
      }
      const inUsd = base.cur === 'NPR' ? amount / rate : amount;
      total += inUsd;
      parts.push(`${p.short} ${base.cur} ${num(amount)}${p.verified ? '' : ' (unconfirmed)'}`);
    }
    return { total, parts };
  }

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
    const { total, parts } = permitTotal(t.p, t.d, Math.max(1, val('rate')));
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
