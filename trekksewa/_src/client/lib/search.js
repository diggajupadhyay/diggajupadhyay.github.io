// Site search. The index is a small JSON file fetched the first time search is opened.

import { $, h } from './dom.js';
import { url } from './site.js';

const ICONS = {
  trek: 'M8 3l4 8 5-5 5 15H2L8 3z',
  place: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  region: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
  page: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
};
const KIND = { trek: 'Trek', place: 'Place', region: 'Region', page: 'Page', tool: 'Tool', article: 'Journal' };

const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ऀ-ॿ]+/g, ' ')
    .trim();

function score(entry, q, tokens) {
  const name = entry._n;
  if (name === q) return 100;
  let s = 0;
  if (name.startsWith(q)) s = 80;
  else if (name.includes(q)) s = 60;
  else if (entry._all.includes(q)) s = 40;
  else if (tokens.every((t) => entry._all.includes(t))) s = 30;
  else return 0;
  if (entry.k === 'trek') s += 6;
  if (entry.k === 'tool') s += 3;
  return s - Math.min(name.length, 40) / 40;
}

export async function initSearch(dialog) {
  const input = $('#search-input', dialog);
  const list = $('#search-results', dialog);
  let index = [];
  let active = -1;

  const empty = (text) => {
    list.replaceChildren(h('li', { class: 'search-empty' }, text));
  };
  empty('Loading…');

  try {
    const res = await fetch(url('data/search.json'));
    index = (await res.json()).map((e) => ({ ...e, _n: norm(e.n), _all: norm([e.n, e.a, e.s].filter(Boolean).join(' ')) }));
  } catch {
    empty('Search needs a connection the first time you use it.');
    throw new Error('search index unavailable');
  }

  function render() {
    const q = norm(input.value);
    active = -1;
    if (!q) {
      const starters = index.filter((e) => e.f).slice(0, 8);
      list.replaceChildren(...starters.map(item));
      return;
    }
    const tokens = q.split(' ');
    const hits = index
      .map((e) => [score(e, q, tokens), e])
      .filter(([s]) => s > 0)
      .sort((a, b) => b[0] - a[0])
      .slice(0, 12)
      .map(([, e]) => e);
    if (!hits.length) return empty(`Nothing found for “${input.value.trim()}”. Try a trek, village or pass name.`);
    list.replaceChildren(...hits.map(item));
  }

  function item(e) {
    const svg = `<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[e.k] || ICONS.page}"/></svg>`;
    const a = h('a', { href: url(e.u), role: 'option' });
    a.innerHTML = svg;
    a.append(h('span', {}, e.n, e.s ? h('small', {}, e.s) : null), h('span', { class: 'kind' }, KIND[e.k] || ''));
    return h('li', {}, a);
  }

  function move(delta) {
    const links = [...list.querySelectorAll('a')];
    if (!links.length) return;
    active = (active + delta + links.length) % links.length;
    links.forEach((l, i) => l.setAttribute('aria-selected', String(i === active)));
    links[active].scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      const links = [...list.querySelectorAll('a')];
      const target = links[active] || links[0];
      if (target) {
        e.preventDefault();
        location.href = target.href;
      }
    }
  });
  render();
}
