// My trips: the trek plans and the treks kept on this device.
// A removal is never final straight away: the row turns into "Removed. Put it back".

import { $, h } from '../lib/dom.js';
import { url } from '../lib/site.js';
import * as store from '../lib/store.js';
import { num, daysRange } from '../../lib/format.mjs';
import { DAY_CHOICES, parseDate, addDays } from '../../lib/plan.mjs';

const root = $('[data-saved]');
if (root) {
  const grid = $('[data-saved-treks]', root);
  const empty = $('[data-saved-empty]', root);
  const plansList = $('[data-saved-plans]', root);
  const plansEmpty = $('[data-plans-empty]', root);
  const plansMore = $('[data-plans-more]', root);
  const draftBox = $('[data-trips-draft]', root);
  const iconBank = $('[data-trips-icons]', root).content;
  const ic = (name, size = 20) => {
    const svg = iconBank.querySelector(`[data-i="${name}"] svg`).cloneNode(true);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    return svg;
  };
  const WITH = { agency: 'with a trekking company', 'guide-porter': 'with a guide and a porter', guide: 'with a guide', porter: 'with a porter', self: 'on your own' };
  const longFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });
  let treks = [];
  // what was just removed, so it can be put back: { plans: { slug: plan }, treks: [slug] }
  const undone = { plans: {}, treks: [] };

  const planLink = (slug, p) => url(`plan/?trek=${slug}&start=${p.start}${p.people ? `&people=${p.people}` : ''}${p.help ? `&help=${p.help}` : ''}${p.spare !== undefined && p.spare !== 1 ? `&spare=${p.spare}` : ''}`);

  /** "Starts in 46 days", "Day 3 of 10", "Finished on …" */
  function countdown(start, days) {
    const today = new Date();
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const until = Math.round((start - now) / 86400000);
    if (until > 1) return { text: until > 60 ? `Starts in about ${Math.round(until / 7)} weeks` : `Starts in ${until} days`, tone: 'ahead' };
    if (until === 1) return { text: 'Starts tomorrow', tone: 'soon' };
    if (until === 0) return { text: 'Starts today', tone: 'soon' };
    if (-until < days) return { text: `Day ${-until + 1} of ${days}`, tone: 'soon' };
    return { text: `Finished on ${longFmt.format(addDays(start, days - 1))}`, tone: 'past' };
  }

  function planCard(slug, p) {
    const start = parseDate(p.start);
    const days = Number(p.days) || 1;
    const end = addDays(start, days - 1);
    const t = treks.find((x) => x.s === slug);
    const when = countdown(start, days);
    const sameYear = start.getFullYear() === end.getFullYear();
    return h(
      'li',
      { class: 'trip' },
      t && t.ph ? h('img', { class: 'trip-photo', src: url(`photos/${t.ph.f}`), alt: '', loading: 'lazy', width: '720', height: '480', style: `object-position:${t.ph.o || '50% 50%'}` }) : h('div', { class: 'trip-photo trip-photo-none', 'aria-hidden': 'true' }, ic('mountain', 40)),
      h(
        'div',
        { class: 'trip-body' },
        h('p', { class: `trip-count trip-${when.tone}` }, when.text),
        h('h3', {}, p.name || slug.replace(/-/g, ' ')),
        h('p', { class: 'trip-when' }, ic('calendar-days', 20), h('span', {}, `${(sameYear ? shortFmt : longFmt).format(start)} to ${longFmt.format(end)}`)),
        h('p', { class: 'trip-meta' }, ic('users', 20), h('span', {}, [`${days} days`, p.people ? `${p.people} ${Number(p.people) === 1 ? 'person' : 'people'}` : '', WITH[p.help] || ''].filter(Boolean).join(' · '))),
        h(
          'div',
          { class: 'trip-actions' },
          h('a', { class: 'btn', href: planLink(slug, p) }, 'Open my plan', ic('arrow-right', 20)),
          h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => removePlan(slug) }, ic('trash-2', 18), 'Remove'),
        ),
      ),
    );
  }

  const removedRow = (label, back) =>
    h('li', { class: 'trip trip-removed', role: 'status' }, h('p', {}, `Removed: ${label}.`), h('button', { type: 'button', class: 'btn btn-secondary', onclick: back }, ic('undo-2', 18), 'Put it back'));

  function removePlan(slug) {
    const plans = store.get('plans', {});
    if (!plans[slug]) return;
    undone.plans[slug] = plans[slug];
    delete plans[slug];
    store.set('plans', plans);
  }
  function restorePlan(slug) {
    const plans = store.get('plans', {});
    plans[slug] = undone.plans[slug];
    delete undone.plans[slug];
    store.set('plans', plans);
  }
  function removeTrek(slug) {
    if (!store.isSaved(slug)) return;
    undone.treks.push(slug);
    store.toggleSaved(slug);
  }
  function restoreTrek(slug) {
    undone.treks = undone.treks.filter((s) => s !== slug);
    if (!store.isSaved(slug)) store.toggleSaved(slug);
    else paint();
  }

  function trekCard(slug) {
    const t = treks.find((x) => x.s === slug);
    const name = t ? t.n : slug.replace(/-/g, ' ');
    return h(
      'article',
      { class: 'trek-card saved-card' },
      t && t.ph
        ? h('div', { class: 'trek-art has-photo' }, h('img', { class: 'trek-photo', src: url(`photos/${t.ph.f}`), alt: '', loading: 'lazy', width: '720', height: '480', style: `object-position:${t.ph.o || '50% 50%'}` }), h('span', { class: 'tag' }, t.rn))
        : null,
      h(
        'div',
        { class: 'trek-body' },
        h('h3', {}, h('a', { href: url(`treks/${slug}/`) }, name)),
        // offline before the trek list was ever loaded there is only the name to show
        t ? h('p', {}, `${t.rn} · ${daysRange(t.dr)} · highest point ${num(t.max)} m`) : null,
        h(
          'div',
          { class: 'saved-actions' },
          h('a', { class: 'btn btn-sm', href: url(`plan/?trek=${slug}`) }, 'Plan this trek'),
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => removeTrek(slug) }, ic('trash-2', 16), 'Remove'),
        ),
      ),
    );
  }

  /** Answers given in the planner without finishing: offer to carry on. */
  function draftCard(hasPlans) {
    const draft = store.get('plan-draft', {});
    const days = DAY_CHOICES.find((c) => c.id === draft.days);
    if (hasPlans || !days || !draft.level) return null;
    const q = new URLSearchParams({ step: draft.month ? 'choose' : 'month', days: draft.days, level: draft.level });
    if (draft.month) q.set('month', draft.month);
    return h(
      'div',
      { class: 'trips-draft' },
      h('div', {}, h('h3', {}, 'Carry on where you stopped'), h('p', {}, `You were looking for ${days.id === 'any' ? 'a trek' : `${days.label.toLowerCase()} (${days.sub})`} at a ${draft.level} pace.`)),
      h('a', { class: 'btn btn-lg', href: url(`plan/?${q}`) }, 'Carry on', ic('arrow-right', 22)),
    );
  }

  function paint() {
    const plans = Object.entries(store.get('plans', {}))
      .filter(([, p]) => p && /^\d{4}-\d{2}-\d{2}$/.test(p.start || ''))
      .sort((a, b) => a[1].start.localeCompare(b[1].start));
    const gone = Object.entries(undone.plans);
    plansList.replaceChildren(...plans.map(([slug, p]) => planCard(slug, p)), ...gone.map(([slug, p]) => removedRow(`your plan for ${p.name || slug}`, () => restorePlan(slug))));
    plansList.hidden = plans.length + gone.length === 0;
    plansEmpty.hidden = plans.length + gone.length > 0;
    plansMore.hidden = plans.length === 0;
    const draft = draftCard(plans.length > 0);
    draftBox.replaceChildren(...(draft ? [draft] : []));
    draftBox.hidden = !draft;

    const saved = store.savedTreks();
    const nameOf = (slug) => treks.find((x) => x.s === slug)?.n || slug.replace(/-/g, ' ');
    grid.replaceChildren(...saved.map(trekCard), ...undone.treks.map((slug) => h('div', { class: 'trip trip-removed', role: 'status' }, h('p', {}, `Removed: ${nameOf(slug)}.`), h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => restoreTrek(slug) }, ic('undo-2', 18), 'Put it back'))));
    grid.hidden = saved.length + undone.treks.length === 0;
    empty.hidden = saved.length + undone.treks.length > 0;
  }

  fetch(url('data/treks.json'))
    .then((r) => r.json())
    .then((data) => {
      treks = data;
    })
    .catch(() => {})
    .finally(paint);
  window.addEventListener('ts:store', paint);
  // a plan saved in another tab shows up without a reload
  window.addEventListener('storage', paint);
}
