// Small pieces of markup reused across pages.

import { html, raw } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { profileMini } from '../lib/profile.mjs';
import { DIFFICULTY, MONTHS, MONTHS_SHORT, metres, km, daysRange, num, longDate } from '../lib/format.mjs';

export const hueClass = (region) => `hue-${region?.hue || 'slate'}`;

export const regionTag = (ctx, region, { link = true } = {}) =>
  link
    ? html`<a class="tag ${hueClass(region)}" href="${ctx.u(`regions/${region.slug}/`)}">${region.name}</a>`
    : html`<span class="tag ${hueClass(region)}">${region.name}</span>`;

export function grade(difficulty) {
  const g = DIFFICULTY[difficulty] || DIFFICULTY.moderate;
  return html`<span class="grade" title="${g.blurb}"><span class="grade-pips" aria-hidden="true">${[1, 2, 3, 4].map((i) => html`<i class="${i <= g.level ? 'on' : ''}"></i>`)}</span>${g.label}</span>`;
}

/** Twelve-cell season strip. Each cell carries its meaning as text for screen readers. */
export function monthStrip(seasons, { large = false } = {}) {
  const kind = (m) => (seasons.best.includes(m) ? 'best' : seasons.good.includes(m) ? 'good' : 'hard');
  const word = { best: 'best time', good: 'good', hard: 'difficult' };
  return html`<ol class="months${large ? ' months-lg' : ''}" data-months>
    ${MONTHS.map((name, i) => {
      const k = kind(i + 1);
      return html`<li class="m-${k}" data-month="${i + 1}"><span aria-hidden="true">${large ? MONTHS_SHORT[i] : name[0]}</span><span class="sr-only">${name}: ${word[k]}</span></li>`;
    })}
  </ol>`;
}

export const monthKey = () => html`<ul class="months-key" aria-hidden="true">
  <li><i class="k-best"></i>Best</li><li><i class="k-good"></i>Good</li><li><i></i>Difficult</li><li><i class="k-now"></i>This month</li>
</ul>`;

export function trekCard(ctx, t, { heading = 'h3' } = {}) {
  const H = raw(heading);
  return html`<article class="trek-card ${hueClass(t.regionObj)}" data-trek="${t.slug}">
    <div class="trek-art${t.photo ? ' has-photo' : ''}">
      ${t.photo
        ? html`<img class="trek-photo" src="${ctx.u(`photos/${t.photo.small}`)}" alt="" loading="lazy" width="720" height="${Math.round((720 * t.photo.height) / t.photo.width)}" style="object-position:${t.photo.focus || '50% 50%'}">`
        : raw(profileMini(t.profile))}
      <span class="tag">${t.regionObj.name}</span>
    </div>
    <div class="trek-body">
      <${H}><a href="${ctx.u(`treks/${t.slug}/`)}">${t.name}</a></${H}>
      <p>${t.tagline}</p>
      <div class="trek-meta">
        <span>${icon('calendar-days', { size: 15 })}${daysRange(t.daysRange)}</span>
        <span>${icon('mountain', { size: 15 })}${metres(t.maxAlt.m)}</span>
        ${grade(t.difficulty)}
      </div>
    </div>
  </article>`;
}

/** A photograph with its caption and the credit its licence asks for. `size` picks the file. */
export const photoFigure = (ctx, p, { cls = 'trek-photo-fig', size = 'file', eager = false } = {}) => html`<figure class="${cls}">
  <img src="${ctx.u(`photos/${p[size] || p.file}`)}"${size === 'file' && p.small ? html` srcset="${ctx.u(`photos/${p.small}`)} 720w, ${ctx.u(`photos/${p.file}`)} ${p.width}w" sizes="(max-width: 760px) 100vw, 60rem"` : ''} alt="${p.alt || ''}" width="${p.width}" height="${p.height}" style="object-position:${p.focus || '50% 50%'}"${raw(eager ? ' fetchpriority="high"' : ' loading="lazy"')}>
  <figcaption>${p.caption || ''} <span class="photo-credit">Photo: <a href="${p.source}" rel="noopener">${p.author}</a>, <a href="${p.licenceUrl}" rel="noopener license">${p.licence}</a></span></figcaption>
</figure>`;

export const sectionHead = ({ eyebrow, title, text, action, level = 'h2' }) => html`<div class="section-head">
  <div>
    ${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ''}
    <${raw(level)}>${title}</${raw(level)}>
    ${text ? html`<p>${text}</p>` : ''}
  </div>
  ${action || ''}
</div>`;

export const arrowLink = (href, label) => html`<a class="link-arrow" href="${href}">${label}${icon('arrow-right', { size: 18 })}</a>`;

export function note(kind, body, { iconName } = {}) {
  const map = { info: ['', 'info'], warn: [' note-warn', 'triangle-alert'], danger: [' note-danger', 'siren'], ok: [' note-ok', 'circle-check'], plain: [' note-plain', 'info'] };
  const [cls, ic] = map[kind] || map.info;
  return html`<div class="note${cls}">${icon(iconName || ic)}<div>${body}</div></div>`;
}

/**
 * Dated safety notices (content/notices.json). Each one shows when it was reported, and the
 * browser adds a warning once a notice is old enough that it may no longer be true.
 */
export function noticesBlock(list) {
  if (!list || !list.length) return '';
  return html`<div class="notices">
    ${list.map(
      (n) => html`<aside class="note ${n.level === 'danger' ? 'note-danger' : 'note-warn'} notice" data-notice-date="${n.reported}" aria-label="Notice: ${n.title}">
        ${icon('triangle-alert')}
        <div>
          <p><strong>${n.title}</strong></p>
          <p>${n.text}</p>
          ${n.action ? html`<p><strong>What to do:</strong> ${n.action}</p>` : ''}
          <p class="xsmall muted notice-meta">Latest report we found: ${longDate(n.reported)}.${n.checked && n.checked !== n.reported ? ` We looked again on ${longDate(n.checked)} and found nothing newer.` : ' We have not re-checked it since.'} <span data-notice-age></span></p>
        </div>
      </aside>`,
    )}
  </div>`;
}
export const noticesFor = (content, { trek, region }) => (content.notices || []).filter((n) => (trek && (n.treks || []).includes(trek)) || (region && (n.regions || []).includes(region)));

export const placeChip =(ctx, p) => html`<a class="chip" href="${ctx.u(`places/${p.slug}/`)}">${p.name}<span class="muted xsmall">${num(p.alt)} m</span></a>`;

export function permitCard(p) {
  const kind = { 'national-park': 'National park', 'conservation-area': 'Conservation area', 'restricted-area': 'Restricted area', local: 'Local permit', registration: 'Registration' }[p.kind] || 'Permit';
  return html`<article class="card card-pad permit" id="permit-${p.id}">
    <div class="cluster" style="--gap:.5rem;justify-content:space-between">
      <h3>${p.short}</h3>
      <span class="badge ${p.kind === 'restricted-area' ? 'badge-watch' : 'badge-info'}">${kind}</span>
    </div>
    <p class="small muted">${p.name} · ${p.authority}</p>
    <table class="permit-fees">
      <tbody>
        ${p.fees.map((f) => html`<tr><td>${f.who}</td><td class="num"><strong>${f.amount}</strong></td><td class="muted">${f.per || ''}</td></tr>`)}
      </tbody>
    </table>
    <p class="small"><strong>Where:</strong> ${p.where}</p>
    ${p.notes ? html`<p class="small">${p.notes}</p>` : ''}
    ${p.needsAgency || p.verified === false
      ? html`<p class="small cluster" style="--gap:.4rem">
          ${p.needsAgency ? html`<span class="badge badge-soon">${icon('building-2', { size: 14 })}Agency required</span>` : ''}
          ${p.verified === false ? html`<span class="badge badge-watch">${icon('circle-alert', { size: 14 })}Fee not confirmed this season</span>` : ''}
        </p>`
      : ''}
  </article>`;
}

/**
 * Where a visitor's request reaches TrekkSewa, decided from site.config.json: 'database',
 * 'whatsapp', 'email' or '' (nowhere yet). The build-time twin of requestChannel() in
 * client/lib/backend.js, so the words on a page match what its form will really do.
 */
export function channelOf(config) {
  const b = config.backend || {};
  if (b.provider === 'supabase' && b.supabaseUrl && b.supabaseAnonKey) return 'database';
  if (String(config.contact?.whatsapp || '').replace(/\D/g, '').length >= 8) return 'whatsapp';
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.contact?.email || '')) return 'email';
  return '';
}
