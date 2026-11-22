// Guides, porters, companies and gear shops that have been approved and published.
// The list lives in the database (the partners_public view). With no database configured,
// or nothing published yet, the section simply stays hidden: no placeholder, no sample.

import { $, $$, h } from '../lib/dom.js';
import { listPartners } from '../lib/backend.js';
import { num } from '../../lib/format.mjs';

const ROLE_WORD = { guide: 'Licensed trekking guide', porter: 'Porter', agency: 'Trekking company', gear: 'Gear shop', other: 'Service' };
const digits = (s) => String(s || '').replace(/\D/g, '');
const safeUrl = (s) => (/^https?:\/\//i.test(String(s || '')) ? String(s) : '');
const list = (items) => (Array.isArray(items) ? items.filter(Boolean).join(', ') : '');

function card(p) {
  const facts = [
    p.licence_no ? ['Licence', p.licence_no] : null,
    p.registration ? ['Registration', p.registration] : null,
    p.years ? ['Experience', `${p.years} ${p.years === 1 ? 'year' : 'years'}`] : null,
    list(p.languages) ? ['Languages', list(p.languages)] : null,
    p.daily_rate_npr ? ['Daily rate', `NPR ${num(p.daily_rate_npr)}${p.rate_includes ? `, ${p.rate_includes}` : ''}`] : null,
  ].filter(Boolean);
  const wa = digits(p.whatsapp);
  const site = safeUrl(p.website);
  const contact = [
    wa ? h('a', { class: 'btn btn-sm', href: `https://wa.me/${wa}`, rel: 'noopener', target: '_blank' }, 'WhatsApp') : null,
    p.phone_public ? h('a', { class: 'btn btn-secondary btn-sm', href: `tel:${String(p.phone_public).replace(/[^\d+]/g, '')}` }, `Call ${p.phone_public}`) : null,
    p.email_public ? h('a', { class: 'btn btn-secondary btn-sm', href: `mailto:${p.email_public}` }, 'Email') : null,
    site ? h('a', { class: 'btn btn-ghost btn-sm', href: site, rel: 'noopener nofollow', target: '_blank' }, 'Website') : null,
  ].filter(Boolean);
  return h(
    'article',
    { class: 'card card-pad profile' },
    h('div', { class: 'profile-top' }, h('div', {}, h('h3', {}, p.name), h('p', { class: 'small muted' }, [ROLE_WORD[p.role] || '', p.base].filter(Boolean).join(' · ')))),
    p.tagline ? h('p', {}, p.tagline) : null,
    facts.length ? h('dl', { class: 'kv small' }, ...facts.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])) : null,
    p.verified_at ? h('p', { class: 'profile-checked small' }, `Papers checked by us on ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(p.verified_at))}.`) : null,
    contact.length ? h('div', { class: 'profile-contact' }, ...contact) : null,
  );
}

for (const section of $$('[data-directory]')) {
  listPartners({ role: section.dataset.directory }).then((rows) => {
    if (!rows.length) return;
    $('[data-directory-list]', section).replaceChildren(...rows.map(card));
    section.hidden = false;
  });
}
