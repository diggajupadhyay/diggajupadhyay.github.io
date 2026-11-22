// Saved page: list the treks and plans kept on this device.

import { $, h } from '../lib/dom.js';
import { url } from '../lib/site.js';
import * as store from '../lib/store.js';
import { num, daysRange } from '../../lib/format.mjs';

const root = $('[data-saved]');
if (root) {
  const grid = $('[data-saved-treks]', root);
  const empty = $('[data-saved-empty]', root);
  const plansBox = $('[data-saved-plans-box]', root);
  const plansList = $('[data-saved-plans]', root);
  let treks = [];

  function paint() {
    const saved = store.savedTreks();
    const list = saved.map((s) => treks.find((t) => t.s === s)).filter(Boolean);
    empty.hidden = saved.length > 0;
    grid.replaceChildren(
      ...(list.length
        ? list.map((t) =>
            h(
              'article',
              { class: 'trek-card' },
              h(
                'div',
                { class: 'trek-body' },
                h('h3', {}, h('a', { href: url(`treks/${t.s}/`) }, t.n)),
                h('p', {}, `${t.rn} · ${daysRange(t.dr)} · ${num(t.max)} m`),
                h('div', { class: 'trek-meta' }, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', style: 'position:relative;z-index:2', onclick: () => (store.toggleSaved(t.s), paint()) }, 'Remove')),
              ),
            ),
          )
        : // offline before the trek list was ever loaded: still show links by slug
          saved.map((s) => h('article', { class: 'trek-card' }, h('div', { class: 'trek-body' }, h('h3', {}, h('a', { href: url(`treks/${s}/`) }, s.replace(/-/g, ' ')))))))
    );

    const plans = Object.entries(store.get('plans', {})).filter(([, p]) => p && p.start);
    plansBox.hidden = plans.length === 0;
    const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    plansList.replaceChildren(
      ...plans.map(([slug, p]) => {
        const [y, m, d] = p.start.split('-').map(Number);
        return h(
          'li',
          {},
          h('div', {}, h('strong', {}, p.name || slug), h('span', { class: 'muted small' }, `${fmt.format(new Date(y, m - 1, d))} · ${p.days} days`)),
          h('a', { class: 'btn btn-secondary btn-sm', href: url(`plan/?trek=${slug}&start=${p.start}${p.people ? `&people=${p.people}` : ''}${p.help ? `&help=${p.help}` : ''}${p.spare !== undefined && p.spare !== 1 ? `&spare=${p.spare}` : ''}`) }, 'Open plan'),
        );
      }),
    );
  }

  fetch(url('data/treks.json'))
    .then((r) => r.json())
    .then((data) => {
      treks = data;
    })
    .catch(() => {})
    .finally(paint);
  window.addEventListener('ts:store', paint);
}
