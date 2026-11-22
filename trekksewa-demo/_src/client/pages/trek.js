// Trek detail page: chart hover, lazy map, sharing, offline save, dated itinerary.

import { $, $$, on } from '../lib/dom.js';
import { url } from '../lib/site.js';
import * as store from '../lib/store.js';
import { toast, share, download } from '../lib/ui.js';
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

// ---------- dated itinerary ----------
const plan = $('[data-plan]');
if (plan) {
  const slug = plan.dataset.plan;
  const input = $('[data-plan-start]', plan);
  const icsBtn = $('[data-plan-ics]', plan);
  const clearBtn = $('[data-plan-clear]', plan);
  const summary = $('[data-plan-summary]', plan);
  const days = $$('.days .day');
  const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  input.min = iso(new Date());

  function apply(startStr, save = true) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(startStr || '');
    days.forEach((li, i) => {
      const t = li.querySelector('[data-plan-date]');
      if (!t) return;
      if (!valid) {
        t.hidden = true;
        return;
      }
      const d = addDays(parse(startStr), i);
      t.dateTime = iso(d);
      t.textContent = fmt.format(d);
      t.hidden = false;
    });
    icsBtn.disabled = !valid;
    clearBtn.hidden = !valid;
    summary.hidden = !valid;
    if (valid) {
      const start = parse(startStr);
      const end = addDays(start, days.length - 1);
      summary.textContent = `${fmt.format(start)} to ${fmt.format(end)} ${end.getFullYear()}. Dates are shown beside each day above.`;
    }
    if (save) {
      const plans = store.get('plans', {});
      if (valid) plans[slug] = { start: startStr, name: plan.dataset.planName, days: days.length };
      else delete plans[slug];
      store.set('plans', plans);
    }
  }

  const saved = store.get('plans', {})[slug];
  if (saved?.start) {
    input.value = saved.start;
    apply(saved.start, false);
  }
  input.addEventListener('change', () => apply(input.value));
  clearBtn.addEventListener('click', () => {
    input.value = '';
    apply('');
  });
  icsBtn.addEventListener('click', () => {
    if (!input.value) return;
    const start = parse(input.value);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const d8 = (d) => iso(d).replace(/-/g, '');
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
    const events = days.map((li, i) => {
      const day = addDays(start, i);
      const title = li.querySelector('h3')?.textContent.trim() || `Day ${i + 1}`;
      const noteText = li.querySelector('.day-body > p:not(.day-route)')?.textContent.trim() || '';
      const sleep = li.querySelector('.day-stats dd')?.textContent.trim() || '';
      return ['BEGIN:VEVENT', `UID:${slug}-${i + 1}-${d8(day)}@trekksewa`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d8(day)}`, `DTEND;VALUE=DATE:${d8(addDays(day, 1))}`, `SUMMARY:${esc(`Day ${i + 1}: ${title}`)}`, `DESCRIPTION:${esc(`${noteText}${sleep ? `\nSleep at ${sleep}.` : ''}\n${location.href.split('#')[0]}`)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT'].join('\r\n');
    });
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TrekkSewa//Trek planner//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(plan.dataset.planName)}`, ...events, 'END:VCALENDAR'].join('\r\n');
    download(`${slug}.ics`, ics, 'text/calendar');
    toast('Calendar file downloaded');
  });
}
