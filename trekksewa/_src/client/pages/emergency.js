// Emergency page: position, SOS message, sound and light signals, personal emergency card.
// Nothing here talks to a server. The message is handed to the phone's own SMS or share sheet.

import { $, $$, h, on } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { toast, copyText, share } from '../lib/ui.js';

const PATTERN = [1, 1, 1, 3, 3, 3, 1, 1, 1]; // SOS: short = 1 unit, long = 3 units
const UNIT = 220; // ms; slow enough to stay well under three flashes a second

// ---------------------------------------------------------------- saved details
const ice = store.get('ice', {});
const sos = store.get('sos', {});
for (const el of $$('[data-ice-field]')) {
  el.value = ice[el.dataset.iceField] || '';
  el.addEventListener('input', () => {
    ice[el.dataset.iceField] = el.value.trim();
    store.set('ice', ice);
    const status = $('[data-ice-status]');
    if (status) status.textContent = 'Saved on this device.';
    rebuild();
  });
}
for (const el of $$('[data-sos-field]')) {
  el.value = sos[el.dataset.sosField] || '';
  el.addEventListener('input', () => {
    sos[el.dataset.sosField] = el.value.trim();
    store.set('sos', { name: sos.name, people: sos.people }); // the problem is not remembered between visits
    rebuild();
  });
}

// ---------------------------------------------------------------- position
let fix = null;
let watchId = null;
const coordsEl = $('[data-loc-coords]');
const metaEl = $('[data-loc-meta]');
const copyBtn = $('[data-loc-copy]');
const getBtn = $('[data-loc-get]');
const f5 = (v) => v.toFixed(5);

function paintFix() {
  if (!fix) return;
  const { latitude, longitude, accuracy, altitude } = fix.coords;
  coordsEl.textContent = `${f5(latitude)}, ${f5(longitude)}`;
  const time = new Date(fix.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  metaEl.textContent = `Accurate to about ${Math.round(accuracy)} m${typeof altitude === 'number' ? ` · GPS altitude about ${Math.round(altitude / 10) * 10} m` : ''} · fixed at ${time}`;
  copyBtn.disabled = false;
  $('[data-loc-box]').classList.add('has-fix');
  rebuild();
}

function locate() {
  if (!('geolocation' in navigator)) {
    metaEl.textContent = 'This device or browser cannot give a position.';
    return;
  }
  getBtn.disabled = true;
  metaEl.textContent = 'Finding your position… this can take a minute under open sky.';
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  const stop = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    getBtn.disabled = false;
  };
  const timer = setTimeout(stop, 45000);
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (!fix || pos.coords.accuracy <= fix.coords.accuracy || pos.timestamp - fix.timestamp > 60000) fix = pos;
      paintFix();
      if (pos.coords.accuracy <= 15) {
        clearTimeout(timer);
        stop();
      }
    },
    (err) => {
      clearTimeout(timer);
      stop();
      metaEl.textContent =
        err.code === err.PERMISSION_DENIED
          ? 'Location access was refused. Allow it for this site in your browser settings, then try again.'
          : 'No position yet. Move into the open, away from walls and cliffs, and try again.';
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 40000 },
  );
}
getBtn?.addEventListener('click', locate);
copyBtn?.addEventListener('click', async () => {
  if (!fix) return;
  const ok = await copyText(`${f5(fix.coords.latitude)}, ${f5(fix.coords.longitude)}`);
  toast(ok ? 'Coordinates copied' : 'Could not copy');
});

// ---------------------------------------------------------------- message
const msgEl = $('[data-sos-message]');
let edited = false;
msgEl?.addEventListener('input', () => {
  edited = true;
  paintLinks();
});

function buildMessage() {
  const lines = ['EMERGENCY. I need help.'];
  const who = [sos.name, ice.nationality].filter(Boolean).join(', ');
  if (who) lines.push(`Name: ${who}`);
  if (sos.problem) lines.push(`Problem: ${sos.problem}`);
  if (sos.people) lines.push(`People: ${sos.people}`);
  if (fix) {
    const { latitude, longitude, accuracy, altitude } = fix.coords;
    lines.push(`Position: ${f5(latitude)}, ${f5(longitude)} (within ${Math.round(accuracy)} m)${typeof altitude === 'number' ? `, altitude about ${Math.round(altitude / 10) * 10} m` : ''}`);
    lines.push(`Time: ${new Date(fix.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`);
    lines.push(`Map: https://maps.google.com/?q=${f5(latitude)},${f5(longitude)}`);
  } else lines.push('Position: not known yet');
  if (ice.insurer) lines.push(`Insurance: ${ice.insurer}${ice.assist ? `, assistance ${ice.assist}` : ''}`);
  if (ice.medical) lines.push(`Medical: ${ice.medical}`);
  if (ice.contact) lines.push(`Contact at home: ${ice.contact}`);
  return lines.join('\n');
}
function paintLinks() {
  const text = encodeURIComponent(msgEl.value);
  $('[data-sos-sms]').href = `sms:?&body=${text}`;
  $('[data-sos-wa]').href = `https://wa.me/?text=${text}`;
}
function rebuild() {
  if (!msgEl) return;
  if (!edited) msgEl.value = buildMessage();
  paintLinks();
}
$('[data-sos-share]')?.addEventListener('click', () => share({ title: 'Emergency', text: msgEl.value }));
rebuild();

// ---------------------------------------------------------------- SOS sequencer
function runPattern(onChange) {
  let stopped = false;
  let timer;
  let i = 0;
  const step = (isOn) => {
    if (stopped) return;
    if (isOn) {
      onChange(true);
      timer = setTimeout(() => step(false), PATTERN[i] * UNIT);
    } else {
      onChange(false);
      const last = i === PATTERN.length - 1;
      const letterEnd = i === 2 || i === 5;
      i = (i + 1) % PATTERN.length;
      timer = setTimeout(() => step(true), (last ? 7 : letterEnd ? 3 : 1) * UNIT);
    }
  };
  step(true);
  return () => {
    stopped = true;
    clearTimeout(timer);
    onChange(false);
  };
}

// ---------------------------------------------------------------- whistle
let stopWhistle = null;
const whistleBtn = $('[data-whistle]');
whistleBtn?.addEventListener('click', () => {
  if (stopWhistle) {
    stopWhistle();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    toast('This browser cannot play the whistle');
    return;
  }
  const ctx = new Ctx();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  // two close tones beat against each other like a pea whistle and carry further
  const oscs = [3050, 3180].map((f) => {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    o.connect(gain);
    o.start();
    return o;
  });
  const stopPattern = runPattern((isOn) => gain.gain.setTargetAtTime(isOn ? 0.9 : 0, ctx.currentTime, 0.008));
  whistleBtn.setAttribute('aria-pressed', 'true');
  whistleBtn.querySelector('strong').textContent = 'Stop whistle';
  stopWhistle = () => {
    stopPattern();
    oscs.forEach((o) => o.stop());
    ctx.close();
    stopWhistle = null;
    whistleBtn.setAttribute('aria-pressed', 'false');
    whistleBtn.querySelector('strong').textContent = 'SOS whistle';
  };
});

// ---------------------------------------------------------------- light
let stopStrobe = null;
const strobeBtn = $('[data-strobe]');
const screenEl = $('[data-strobe-screen]');
async function startStrobe() {
  let track = null;
  let wake = null;
  try {
    wake = await navigator.wakeLock?.request('screen');
  } catch {
    /* screen may dim; the signal still works */
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const t = stream.getVideoTracks()[0];
    if (t && t.getCapabilities && t.getCapabilities().torch) track = t;
    else stream.getTracks().forEach((x) => x.stop());
  } catch {
    /* no camera or permission refused: screen only */
  }
  screenEl.hidden = false;
  const stopPattern = runPattern((isOn) => {
    screenEl.classList.toggle('is-on', isOn);
    track?.applyConstraints({ advanced: [{ torch: isOn }] }).catch(() => {});
  });
  strobeBtn.setAttribute('aria-pressed', 'true');
  stopStrobe = () => {
    stopPattern();
    screenEl.hidden = true;
    track?.stop();
    wake?.release?.().catch(() => {});
    stopStrobe = null;
    strobeBtn.setAttribute('aria-pressed', 'false');
  };
}
strobeBtn?.addEventListener('click', () => (stopStrobe ? stopStrobe() : startStrobe()));
screenEl?.addEventListener('click', () => stopStrobe?.());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopStrobe?.();
    stopWhistle?.();
  }
});

// ---------------------------------------------------------------- emergency card
const LABELS = { name: 'Name', nationality: 'Nationality', passport: 'Passport', medical: 'Medical', insurer: 'Insurance', assist: 'Insurer 24 h phone', contact: 'Contact at home', agency: 'Agency / guide' };
const dialog = $('[data-ice-dialog]');
$('[data-ice-show]')?.addEventListener('click', () => {
  const all = { name: sos.name, ...ice };
  const rows = Object.entries(LABELS)
    .filter(([k]) => all[k])
    .map(([k, label]) => h('div', {}, h('dt', {}, label), h('dd', {}, all[k])));
  $('[data-ice-big]').replaceChildren(h('h2', {}, 'Emergency card'), rows.length ? h('dl', {}, rows) : h('p', {}, 'Nothing filled in yet.'));
  dialog.showModal();
});
$('[data-ice-clear]')?.addEventListener('click', () => {
  for (const k of Object.keys(ice)) delete ice[k];
  store.remove('ice');
  for (const el of $$('[data-ice-field]')) el.value = '';
  $('[data-ice-status]').textContent = 'Cleared.';
  rebuild();
});
on(document, 'click', '[data-print]', () => window.print());
