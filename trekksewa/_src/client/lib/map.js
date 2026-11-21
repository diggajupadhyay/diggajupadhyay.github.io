// Leaflet wrapper. Leaflet itself is loaded on demand so pages without a visible map stay light.
// Base maps are raster tiles from OpenStreetMap and OpenTopoMap, requested with CORS so the
// service worker can keep the tiles you have already seen.

import * as store from './store.js';

let leaflet;
export async function loadLeaflet() {
  // The package's default entry is a UMD file; ask for the ES module build so the
  // functions (map, tileLayer, marker …) arrive as named exports.
  leaflet ??= import('leaflet/dist/leaflet-src.esm.js');
  return leaflet;
}

export const LAYERS = {
  standard: {
    label: 'Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> contributors' },
  },
  topo: {
    label: 'Topographic',
    url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 17,
      attribution:
        'Map data © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> contributors, SRTM · style © <a href="https://opentopomap.org" rel="noopener">OpenTopoMap</a> (CC-BY-SA)',
    },
  },
};

/** Create a map in `el`. Returns { L, map }. */
export async function createMap(el, { bounds, center, zoom = 10, scrollZoom = false } = {}) {
  const L = await loadLeaflet();
  el.replaceChildren();
  const map = L.map(el, { scrollWheelZoom: scrollZoom, zoomControl: true, attributionControl: true });
  map.attributionControl.setPrefix(false);
  const layers = {};
  for (const [key, def] of Object.entries(LAYERS)) layers[def.label] = L.tileLayer(def.url, { ...def.options, crossOrigin: 'anonymous' });
  const preferred = LAYERS[store.get('map-layer', 'standard')] || LAYERS.standard;
  layers[preferred.label].addTo(map);
  L.control.layers(layers, null, { position: 'topright', collapsed: true }).addTo(map);
  el.querySelector('.leaflet-control-layers-toggle')?.setAttribute('aria-label', 'Choose the map style');
  L.control.scale({ imperial: false }).addTo(map);
  map.on('baselayerchange', (e) => {
    const key = Object.keys(LAYERS).find((k) => LAYERS[k].label === e.name);
    if (key) store.set('map-layer', key);
  });
  if (bounds) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
  else map.setView(center || [28.2, 84.2], zoom);
  // Tiles sit on whole pixels inside the map, so the map itself has to as well. Text above it
  // rarely adds up to a whole number of pixels, and on a high-density screen that leaves a
  // hairline between tile rows. Nudge the map down to the next whole pixel.
  const snap = () => {
    // an offset, not a margin: a margin this small collapses into the heading's above it
    el.style.top = '';
    el.style.left = '';
    const r = el.getBoundingClientRect();
    const up = (v) => (v % 1 > 0.01 ? `${(1 - (v % 1)).toFixed(3)}px` : '');
    el.style.top = up(r.top + window.scrollY);
    el.style.left = up(r.left + window.scrollX);
  };
  snap();
  window.addEventListener('resize', snap);
  document.fonts?.ready.then(snap);
  map.on('movestart', snap);
  // let people scroll the page past the map; zoom with the wheel only after a click
  if (!scrollZoom) {
    map.on('click', () => map.scrollWheelZoom.enable());
    map.on('mouseout', () => map.scrollWheelZoom.disable());
  }
  return { L, map };
}

export function pin(L, { kind = 'via', text = '' } = {}) {
  if (kind === 'via') return L.divIcon({ className: '', html: '<div class="dot-marker"></div>', iconSize: [12, 12], iconAnchor: [6, 6], popupAnchor: [0, -8] });
  return L.divIcon({ className: '', html: `<div class="pin pin-${kind}"><span>${text}</span></div>`, iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -26] });
}

/** Run `fn` once, when `el` is about to scroll into view. */
export function whenVisible(el, fn) {
  if (!('IntersectionObserver' in window)) return fn();
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        fn();
      }
    },
    { rootMargin: '300px' },
  );
  io.observe(el);
}

export function mapError(el, message = 'The map could not load. Check your connection and try again.') {
  const box = document.createElement('div');
  box.className = 'map-placeholder';
  const p = document.createElement('p');
  p.textContent = message;
  box.append(p);
  el.replaceChildren(box);
}
