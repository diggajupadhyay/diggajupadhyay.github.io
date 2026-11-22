// GPX viewer: load a track, show stats, profile and map, follow it with off-track alerts,
// and record a breadcrumb trail. Everything stays on the device.

import { $, h } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { toast, download, vibrate } from '../lib/ui.js';
import { createMap, pin } from '../lib/map.js';
import { attach } from '../lib/profile-hover.js';
import { parseGpx, trackStats, thin, toGpx } from '../../lib/gpx.mjs';
import { profileHtml } from '../../lib/profile.mjs';
import { nearestOnTrack, haversineKm } from '../../lib/geo.mjs';
import { num } from '../../lib/format.mjs';

const root = $('[data-gpx]');
if (root) {
  const statusEl = $('[data-gpx-status]', root);
  const view = $('[data-gpx-view]', root);
  const mapEl = $('[data-gpx-map]', root);
  const restoreBtn = $('[data-gpx-restore]', root);
  const clearBtn = $('[data-gpx-clear]', root);
  let current = null; // { name, track, waypoints }
  let mapCtx = null; // { L, map }
  let layers = [];
  let meMarker = null;

  const fmtKm = (v) => (v < 10 ? v.toFixed(2) : v.toFixed(1));
  const fmtDur = (ms) => {
    const m = Math.round(ms / 60000);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
  };

  async function ensureMap(bounds) {
    if (!mapCtx) mapCtx = await createMap(mapEl, { bounds, scrollZoom: true });
    else if (bounds) mapCtx.map.fitBounds(bounds, { padding: [28, 28] });
    return mapCtx;
  }

  async function show(data, { remember = true } = {}) {
    current = data;
    const s = trackStats(data.track);
    $('[data-gpx-name]', root).textContent = data.name || 'Untitled track';
    const tile = (label, value, sub) => h('div', {}, h('dt', {}, label), h('dd', {}, value, sub ? h('small', {}, sub) : null));
    $('[data-gpx-stats]', root).replaceChildren(
      tile('Distance', `${fmtKm(s.km)} km`),
      tile('Ascent', s.ascent === null ? 'No data' : `${num(s.ascent)} m`, s.descent === null ? null : `descent ${num(s.descent)} m`),
      tile('Highest point', s.max === null ? 'No data' : `${num(s.max)} m`, s.min === null ? null : `lowest ${num(s.min)} m`),
      tile(s.durationMs ? 'Recorded time' : 'Track points', s.durationMs ? fmtDur(s.durationMs) : num(s.points), s.durationMs ? `${num(s.points)} points` : null),
    );

    // ----- profile (distance on the x axis)
    const chartEl = $('[data-gpx-chart]', root);
    const withEle = data.track.map((p, i) => ({ x: s.cumulative[i], y: p.ele })).filter((p) => p.y !== null);
    if (withEle.length > 1 && s.km > 0) {
      const pts = thin(withEle, 600);
      const step = s.km <= 6 ? 1 : s.km <= 15 ? 2 : s.km <= 40 ? 5 : s.km <= 100 ? 10 : 25;
      const ticks = [];
      for (let k = 0; k <= s.km; k += step) ticks.push({ x: k, label: String(k) });
      const top = pts.reduce((m, p) => (p.y > m.y ? p : m), pts[0]);
      chartEl.innerHTML =
        profileHtml({ points: pts, xDomain: [0, s.km], xTicks: ticks, xTitle: 'Distance (km)', labels: [{ x: top.x, y: top.y, text: `${num(top.y)} m` }] }) +
        '<figcaption class="xsmall muted">Elevation as recorded in the file. GPS and barometer heights can be tens of metres out.</figcaption>';
      attach(
        chartEl.querySelector('[data-profile]'),
        pts.map((p) => ({ x: p.x, y: p.y, l: `${fmtKm(p.x)} km from the start` })),
      );
      chartEl.hidden = false;
    } else {
      chartEl.replaceChildren(h('p', { class: 'muted small' }, 'This file has no elevation data, so there is no profile to draw.'));
    }

    view.hidden = false;
    clearBtn.hidden = false;
    restoreBtn.hidden = true;
    statusEl.textContent = `Loaded ${data.name || 'track'}: ${fmtKm(s.km)} km, ${num(s.points)} points${data.waypoints.length ? `, ${data.waypoints.length} waypoints` : ''}.`;

    // ----- map
    try {
      const latlngs = data.track.map((p) => [p.lat, p.lon]);
      const all = [...latlngs, ...data.waypoints.map((w) => [w.lat, w.lon])];
      const { L, map } = await ensureMap(all);
      layers.forEach((l) => l.remove());
      layers = [];
      if (latlngs.length > 1) {
        layers.push(L.polyline(latlngs, { color: '#c2253a', weight: 4, opacity: 0.9, lineJoin: 'round' }).addTo(map));
        layers.push(L.marker(latlngs[0], { icon: pin(L, { kind: 'start', text: '●' }), title: 'Start' }).addTo(map).bindPopup('Start of the track'));
        layers.push(L.marker(latlngs[latlngs.length - 1], { icon: pin(L, { kind: 'night', text: '■' }), title: 'End' }).addTo(map).bindPopup('End of the track'));
      }
      for (const w of data.waypoints.slice(0, 300)) {
        const m = L.marker([w.lat, w.lon], { icon: pin(L, { kind: 'via' }), title: w.name || 'Waypoint' }).addTo(map);
        const box = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = w.name || 'Waypoint';
        box.append(strong);
        if (w.ele !== null) box.append(document.createTextNode(`${num(w.ele)} m`));
        m.bindPopup(box);
        layers.push(m);
      }
      map.invalidateSize();
    } catch {
      statusEl.textContent += ' The map could not load; the figures above are still correct.';
    }

    if (remember) {
      const slim = { name: data.name, track: thin(data.track, 4000).map((p) => [Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6)), p.ele === null ? null : Math.round(p.ele), p.time]), waypoints: data.waypoints.slice(0, 200) };
      if (!store.set('gpx-last', slim)) statusEl.textContent += ' (Too large to keep for next time.)';
    }
  }

  function readFile(file) {
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) {
      statusEl.textContent = 'That file is larger than 40 MB. Export a simplified track from your app and try again.';
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => (statusEl.textContent = 'The file could not be read.');
    reader.onload = () => {
      try {
        const data = parseGpx(String(reader.result));
        if (data.track.length < 2) {
          statusEl.textContent = `This file has ${data.waypoints.length} waypoints but no track line. Showing the waypoints only.`;
        }
        if (!data.name) data.name = file.name.replace(/\.gpx$/i, '');
        show(data);
      } catch (e) {
        statusEl.textContent = e.message || 'This file could not be read as GPX.';
      }
    };
    reader.readAsText(file);
  }

  const input = $('[data-gpx-file]', root);
  const drop = $('[data-gpx-drop]', root);
  input.addEventListener('change', () => readFile(input.files[0]));
  for (const type of ['dragenter', 'dragover']) drop.addEventListener(type, (e) => (e.preventDefault(), drop.classList.add('is-over')));
  for (const type of ['dragleave', 'drop']) drop.addEventListener(type, (e) => (e.preventDefault(), drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => readFile(e.dataTransfer.files[0]));

  const saved = store.get('gpx-last');
  const revive = (s) => ({ name: s.name, waypoints: s.waypoints || [], track: s.track.map(([lat, lon, ele, time]) => ({ lat, lon, ele, time })) });
  if (saved && Array.isArray(saved.track) && saved.track.length > 1) {
    restoreBtn.hidden = false;
    restoreBtn.addEventListener('click', () => show(revive(saved), { remember: false }));
  }
  clearBtn.addEventListener('click', () => {
    store.remove('gpx-last');
    current = null;
    layers.forEach((l) => l.remove());
    layers = [];
    view.hidden = true;
    clearBtn.hidden = true;
    statusEl.textContent = 'Track removed from this device.';
    input.value = '';
  });

  // ---------------------------------------------------------------- position plumbing
  let watchId = null;
  let wake = null;
  const listeners = new Set();
  async function startWatch() {
    if (watchId !== null || !('geolocation' in navigator)) return watchId !== null;
    try {
      wake = await navigator.wakeLock?.request('screen');
    } catch {
      wake = null;
    }
    watchId = navigator.geolocation.watchPosition(
      (pos) => listeners.forEach((fn) => fn(pos)),
      (err) => listeners.forEach((fn) => fn(null, err)),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    return true;
  }
  function stopWatchIfIdle() {
    if (listeners.size || watchId === null) return;
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    wake?.release?.().catch(() => {});
    wake = null;
  }
  async function paintMe(pos) {
    try {
      const { L, map } = await ensureMap();
      const ll = [pos.coords.latitude, pos.coords.longitude];
      if (!meMarker) {
        meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="me-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), title: 'You are here', zIndexOffset: 1000 }).addTo(map);
        if (!current) map.setView(ll, 15);
      } else meMarker.setLatLng(ll);
    } catch {
      /* the readout still works without a map */
    }
  }
  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.4;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 450);
    } catch {
      /* silent */
    }
  }

  // ---------------------------------------------------------------- follow
  const followBtn = $('[data-follow]', root);
  const followOut = $('[data-follow-readout]', root);
  const limitSel = $('[data-follow-limit]', root);
  let wasOff = false;
  const onFollow = (pos, err) => {
    if (!pos) {
      followOut.textContent = err && err.code === 1 ? 'Location access was refused. Allow it for this site and try again.' : 'Waiting for a position. Move into the open.';
      return;
    }
    paintMe(pos);
    const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    const acc = Math.round(pos.coords.accuracy);
    if (!current || current.track.length < 2) {
      followOut.textContent = `Position fixed, accurate to about ${acc} m. Load a track to measure against.`;
      return;
    }
    const { distanceM } = nearestOnTrack(here, current.track);
    const limit = Number(limitSel.value);
    const off = distanceM - acc > limit; // only warn when the error margin cannot explain it
    followOut.className = `follow-readout ${off ? 'is-off' : 'is-on'}`;
    followOut.textContent = off ? `Off the track: about ${Math.round(distanceM)} m from the line.` : `On the track (${Math.round(distanceM)} m from the line, position accurate to ${acc} m).`;
    if (off && !wasOff) {
      beep();
      vibrate([300, 150, 300]);
    }
    wasOff = off;
  };
  followBtn.addEventListener('click', async () => {
    const on = followBtn.getAttribute('aria-pressed') !== 'true';
    followBtn.setAttribute('aria-pressed', String(on));
    followBtn.textContent = on ? 'Stop following' : 'Start following';
    if (on) {
      listeners.add(onFollow);
      followOut.textContent = 'Finding your position…';
      if (!(await startWatch())) followOut.textContent = 'This device or browser cannot give a position.';
    } else {
      listeners.delete(onFollow);
      stopWatchIfIdle();
      followOut.className = 'follow-readout';
      followOut.textContent = 'Not following.';
    }
  });

  // ---------------------------------------------------------------- record
  const recBtn = $('[data-record]', root);
  const recOut = $('[data-record-readout]', root);
  const recSave = $('[data-record-save]', root);
  const recClear = $('[data-record-clear]', root);
  let recorded = store.get('gpx-recording', []);
  let recLine = null;
  const recKm = () => recorded.reduce((sum, p, i) => (i ? sum + haversineKm(recorded[i - 1], p) : 0), 0);
  async function paintRecording() {
    recSave.disabled = recClear.disabled = recorded.length < 2;
    recOut.textContent = recorded.length ? `${recorded.length} points, ${fmtKm(recKm())} km recorded.` : 'Nothing recorded.';
    if (recorded.length < 2) return;
    try {
      const { L, map } = await ensureMap();
      const ll = recorded.map((p) => [p.lat, p.lon]);
      if (!recLine) recLine = L.polyline(ll, { color: '#1a8fe3', weight: 4, opacity: 0.9, dashArray: '1 7', lineCap: 'round' }).addTo(map);
      else recLine.setLatLngs(ll);
      view.hidden = false;
    } catch {
      /* readout only */
    }
  }
  const onRecord = (pos) => {
    if (!pos) return;
    paintMe(pos);
    if (pos.coords.accuracy > 60) return; // poor fixes would draw a zig-zag
    const p = { lat: pos.coords.latitude, lon: pos.coords.longitude, ele: typeof pos.coords.altitude === 'number' ? pos.coords.altitude : null, time: pos.timestamp };
    const last = recorded[recorded.length - 1];
    if (last && haversineKm(last, p) * 1000 < 12) return; // standing still
    recorded.push(p);
    if (recorded.length % 5 === 0) store.set('gpx-recording', recorded.slice(-6000));
    paintRecording();
  };
  recBtn.addEventListener('click', async () => {
    const on = recBtn.getAttribute('aria-pressed') !== 'true';
    recBtn.setAttribute('aria-pressed', String(on));
    recBtn.textContent = on ? 'Stop recording' : recorded.length ? 'Resume recording' : 'Start recording';
    if (on) {
      listeners.add(onRecord);
      if (!(await startWatch())) recOut.textContent = 'This device or browser cannot give a position.';
      else toast('Recording. Keep this page open and the screen on.');
    } else {
      listeners.delete(onRecord);
      stopWatchIfIdle();
      store.set('gpx-recording', recorded.slice(-6000));
    }
  });
  recSave.addEventListener('click', () => {
    const stamp = new Date().toISOString().slice(0, 10);
    download(`trekksewa-track-${stamp}.gpx`, toGpx(recorded, { name: `Recorded ${stamp}` }), 'application/gpx+xml');
  });
  recClear.addEventListener('click', () => {
    recorded = [];
    store.remove('gpx-recording');
    recLine?.remove();
    recLine = null;
    recBtn.textContent = recBtn.getAttribute('aria-pressed') === 'true' ? 'Stop recording' : 'Start recording';
    paintRecording();
  });
  if (recorded.length) {
    recBtn.textContent = 'Resume recording';
    paintRecording();
  }
  // the screen lock is released when the tab is hidden; take it again on return
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && watchId !== null && !wake) {
      try {
        wake = await navigator.wakeLock?.request('screen');
      } catch {
        wake = null;
      }
    }
  });
}
