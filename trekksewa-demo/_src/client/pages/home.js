// Home page: fill the "conditions" teaser with this month's season note and in-season treks.

import { $, h } from '../lib/dom.js';
import { url } from '../lib/site.js';
import { MONTHS } from '../../lib/format.mjs';

const dataEl = $('#season-data');
if (dataEl) {
  try {
    const { seasons, treks } = JSON.parse(dataEl.textContent);
    const m = new Date().getMonth() + 1;
    const season = seasons.find((s) => s.month === m);
    if (season) {
      $('[data-season-eyebrow]').textContent = `${MONTHS[m - 1]} in Nepal`;
      $('[data-season-title]').textContent = season.title;
      $('[data-season-text]').textContent = season.text;
    }
    const inSeason = treks.filter((t) => t.b.includes(m));
    const list = $('[data-season-list]');
    if (inSeason.length && list) {
      $('[data-season-list-title]').textContent = `At their best in ${MONTHS[m - 1]}`;
      list.replaceChildren(
        ...inSeason.slice(0, 6).map((t) => h('li', {}, h('a', { href: url(`treks/${t.s}/`) }, t.n), h('span', { class: 'muted small' }, t.r))),
      );
      const more = $('[data-season-more]');
      if (more) {
        more.href = url(`treks/?month=${m}`);
        more.firstChild.textContent = `All ${inSeason.length} treks for ${MONTHS[m - 1]}`;
      }
    }
  } catch {
    /* keep the static fallback text */
  }
}
