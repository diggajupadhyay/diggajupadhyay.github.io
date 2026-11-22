// Permits page: pick a trek, see exactly which permits it needs.

import { $, $$, h } from '../lib/dom.js';
import { url } from '../lib/site.js';

const select = $('[data-permit-trek]');
const result = $('[data-permit-result]');
if (select && result) {
  const GUIDE = {
    required: 'A licensed guide is required on this route.',
    'strongly-recommended': 'A guide is not compulsory here, but strongly recommended.',
    optional: 'A guide is optional on this route.',
  };
  const preset = new URLSearchParams(location.search).get('trek');
  if (preset && [...select.options].some((o) => o.value === preset)) select.value = preset;

  function paint() {
    const opt = select.selectedOptions[0];
    for (const w of $$('[data-permit]')) w.classList.remove('is-needed');
    if (!opt || !opt.value) {
      result.hidden = true;
      return;
    }
    const ids = (opt.dataset.permits || '').split(' ').filter(Boolean);
    const items = ids
      .map((id) => {
        const wrap = $(`[data-permit="${id}"]`);
        if (!wrap) return null;
        wrap.classList.add('is-needed');
        const name = wrap.querySelector('h3')?.textContent || id;
        const fee = wrap.querySelector('.permit-fees strong')?.textContent || '';
        return h('li', {}, h('a', { href: `#permit-${id}` }, name), fee ? h('span', { class: 'muted' }, ` · from ${fee}`) : null);
      })
      .filter(Boolean);
    result.replaceChildren(
      h('p', {}, h('strong', {}, opt.textContent), items.length ? ` needs ${items.length} ${items.length === 1 ? 'permit' : 'permits'}:` : ' needs no trekking permit.'),
      items.length ? h('ul', {}, items) : null,
      h('p', { class: 'small' }, GUIDE[opt.dataset.guide] || '', ' ', h('a', { href: url(`treks/${opt.value}/#permits`) }, 'Open the trek guide')),
    );
    result.hidden = false;
  }
  select.addEventListener('change', paint);
  paint();
}
