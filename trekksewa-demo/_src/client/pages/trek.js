// Trek detail page: chart hover, lazy map, sharing, offline save, dates from a saved plan.

import { $, $$, on } from '../lib/dom.js';
import { url } from '../lib/site.js';
import * as store from '../lib/store.js';
import { toast, share } from '../lib/ui.js';
import { initProfiles } from '../lib/profile-hover.js';
import { createMap, pin, whenVisible, mapError } from '../lib/map.js';
import { num } from '../../lib/format.mjs';

initProfiles();

// ---------- map ----------
const mapEl = $('[data-map]');
const mapDataEl = $('[data-map-data]');
if (mapEl && mapDataEl) {
  whenVisible(mapEl, async () => {
    try {
      const data = JSON.parse(mapDataEl.textContent);
      const { L, map } = await createMap(mapEl, { bounds: data.bounds });
      if (data.trail && data.trail.length) {
        // the mapped footpath, with a pale casing so it reads on any map style
        L.polyline(data.trail, { color: '#ffffff', weight: 7, opacity: 0.85, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
        L.polyline(data.trail, { color: '#0b5d5e', weight: 3.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
        // sections with no mapped path: dashes that simply join two stops
        if (data.gaps.length) L.polyline(data.gaps, { color: '#0b5d5e', weight: 3, opacity: 0.85, dashArray: '2 8', lineCap: 'round', interactive: false }).addTo(map);
      } else if (data.line.length > 1) L.polyline(data.line, { color: '#0b5d5e', weight: 3, opacity: 0.85, dashArray: '2 8', lineCap: 'round' }).addTo(map);
      for (const p of data.points) {
        const text = p.k === 'night' ? String(p.d[0]) : p.k === 'high' ? '▲' : p.k === 'start' ? '●' : '';
        const marker = L.marker([p.lat, p.lon], { icon: pin(L, { kind: p.k, text }), title: p.n, keyboard: true, zIndexOffset: p.k === 'via' ? 0 : 500 }).addTo(map);
        const box = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = p.n;
        const meta = document.createElement('span');
        meta.textContent = `${num(p.a)} m${p.d.length ? ` · night ${p.d.join(', ')}` : ''}${p.q === 'approx' ? ' · position approximate' : ''}`;
        const link = document.createElement('a');
        link.href = url(`places/${p.s}/`);
        link.textContent = 'Weather and details';
        box.append(strong, meta, document.createElement('br'), link);
        marker.bindPopup(box);
      }
    } catch (e) {
      console.warn('Map failed to load:', e);
      mapError(mapEl);
    }
  });
}

// ---------- share / print ----------
on(document, 'click', '[data-share]', (e, btn) => share({ title: btn.dataset.shareTitle, text: btn.dataset.shareText, url: location.href.split('#')[0] }));
on(document, 'click', '[data-print]', () => window.print());

// ---------- keep offline ----------
const offlineBtn = $('[data-offline]');
if (offlineBtn && 'serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((reg) => {
    offlineBtn.hidden = false;
    offlineBtn.addEventListener('click', () => {
      const places = $$('.route-places a').map((a) => a.href);
      const urls = [location.href.split('#')[0], url('safety/emergency/'), url('safety/altitude-check/'), ...places];
      const id = String(Date.now());
      navigator.serviceWorker.addEventListener('message', function done(ev) {
        if (ev.data?.type !== 'cache-pages-done' || ev.data.id !== id) return;
        navigator.serviceWorker.removeEventListener('message', done);
        toast(`Saved for offline: this guide and ${ev.data.ok - 3 > 0 ? ev.data.ok - 3 : 0} place pages`);
        const label = offlineBtn.lastChild;
        if (label) label.textContent = 'Kept offline';
      });
      reg.active?.postMessage({ type: 'cache-pages', id, urls });
      toast('Saving this trek for offline use…');
    });
  });
}

// ---------- sticky sub-navigation ----------
const tabs = $$('.subnav a');
if (tabs.length && 'IntersectionObserver' in window) {
  const byId = new Map(tabs.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        tabs.forEach((a) => a.removeAttribute('aria-current'));
        const a = byId.get(e.target.id);
        if (a) {
          a.setAttribute('aria-current', 'true');
          a.scrollIntoView({ block: 'nearest', inline: 'center' });
        }
      }
    },
    { rootMargin: '-30% 0px -60% 0px' },
  );
  for (const id of byId.keys()) {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  }
}

// ---------- a plan saved for this trek ----------
// Plans are made on the Plan my trek page. When one is saved for this trek, its dates are
// shown beside each day here and the button opens that plan again.
const plan = $('[data-plan]');
if (plan) {
  const slug = plan.dataset.plan;
  const days = $$('.days .day');
  const savedNote = $('[data-plan-saved]', plan);
  const open = $('[data-plan-open]', plan);
  const freshHref = open.href;
  const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const longFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  const paint = () => {
    const saved = store.get('plans', {})[slug];
    const valid = Boolean(saved) && /^\d{4}-\d{2}-\d{2}$/.test(saved.start || '');
    days.forEach((li, i) => {
      const t = li.querySelector('[data-plan-date]');
      if (!t) return;
      t.hidden = !valid;
      if (!valid) return;
      const d = addDays(parse(saved.start), i);
      t.dateTime = iso(d);
      t.textContent = fmt.format(d);
    });
    savedNote.hidden = !valid;
    if (!valid) {
      open.href = freshHref;
      open.querySelector('span').textContent = 'Plan this trek';
      return;
    }
    savedNote.textContent = `You have a plan for this trek, starting on ${longFmt.format(parse(saved.start))}. The dates are shown beside each day above.`;
    const q = new URLSearchParams({ trek: slug, start: saved.start });
    if (saved.people) q.set('people', saved.people);
    if (saved.help) q.set('help', saved.help);
    if (saved.spare !== undefined && saved.spare !== 1) q.set('spare', saved.spare);
    open.href = url(`plan/?${q}`);
    open.querySelector('span').textContent = 'Open my plan';
  };
  paint();
  window.addEventListener('ts:store', paint);
}
