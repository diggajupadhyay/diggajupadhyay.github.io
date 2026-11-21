// Place listing, place detail and region pages: filters, forecast and maps.

import { $, $$ } from '../lib/dom.js';
import { url } from '../lib/site.js';
import { createMap, pin, whenVisible, mapError } from '../lib/map.js';
import { renderWeather } from '../lib/weather.js';
import { num } from '../../lib/format.mjs';

// ---------- forecast ----------
for (const el of $$('[data-weather]')) whenVisible(el, () => renderWeather(el));

// ---------- maps ----------
for (const mapEl of $$('[data-map]')) {
  const dataEl = mapEl.parentElement.querySelector('[data-map-data]');
  if (!dataEl) continue;
  whenVisible(mapEl, async () => {
    try {
      const data = JSON.parse(dataEl.textContent);
      const pts = data.points || [];
      const bounds = data.fit && pts.length > 1 ? pts.map((p) => [p.lat, p.lon]) : null;
      const { L, map } = await createMap(mapEl, { bounds, center: data.center, zoom: data.zoom });
      for (const p of pts) {
        const focus = p.s === data.focus;
        const marker = L.marker([p.lat, p.lon], { icon: pin(L, focus ? { kind: 'high', text: '●' } : { kind: 'via' }), title: p.n, zIndexOffset: focus ? 800 : 0 }).addTo(map);
        const box = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = p.n;
        const meta = document.createElement('span');
        meta.textContent = `${p.t} · ${num(p.a)} m`;
        box.append(strong, meta);
        if (!focus) {
          const link = document.createElement('a');
          link.href = url(`places/${p.s}/`);
          link.textContent = 'Open';
          box.append(document.createElement('br'), link);
        }
        marker.bindPopup(box);
      }
    } catch (e) {
      console.warn('Map failed to load:', e);
      mapError(mapEl);
    }
  });
}

// ---------- place filters ----------
const form = $('[data-place-filters]');
const list = $('[data-place-list]');
if (form && list) {
  const items = $$('li', list);
  const status = $('[data-place-status]');
  const empty = $('[data-place-empty]');
  form.hidden = false;
  const params = new URLSearchParams(location.search);
  form.elements.q.value = params.get('q') || '';
  form.elements.region.value = params.get('region') || '';
  form.elements.type.value = params.get('type') || '';

  function apply() {
    const q = form.elements.q.value.trim().toLowerCase();
    const region = form.elements.region.value;
    const type = form.elements.type.value;
    const sort = form.elements.sort.value;
    let shown = 0;
    for (const li of items) {
      const d = li.dataset;
      const ok = (!q || d.name.includes(q)) && (!region || d.region === region) && (!type || d.type === type);
      li.hidden = !ok;
      if (ok) shown++;
    }
    const sorted = [...items].sort(sort === 'name' ? (a, b) => a.dataset.name.localeCompare(b.dataset.name) : (a, b) => b.dataset.alt - a.dataset.alt);
    sorted.forEach((li) => list.append(li));
    status.textContent = shown === items.length ? `${shown} places` : `${shown} of ${items.length} places`;
    empty.hidden = shown > 0;
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (region) next.set('region', region);
    if (type) next.set('type', type);
    const qs = next.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }
  form.addEventListener('input', apply);
  form.addEventListener('submit', (e) => e.preventDefault());
  apply();
}
