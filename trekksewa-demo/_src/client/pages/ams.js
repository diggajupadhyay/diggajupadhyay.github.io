// Altitude sickness self-check (Lake Louise AMS score, 2018 revision).

import { $, $$, h } from '../lib/dom.js';
import { url } from '../lib/site.js';
import * as store from '../lib/store.js';
import { share, toast } from '../lib/ui.js';
import { scoreLakeLouise, RED_FLAGS } from '../../lib/altitude.mjs';

const form = $('[data-ams]');
const resultEl = $('[data-ams-result]');
const historyEl = $('[data-ams-history]');
const historyList = $('[data-ams-history-list]');

const VERDICTS = {
  clear: {
    tone: 'ok',
    title: 'No symptoms of altitude sickness',
    lead: 'Nothing in your answers points to altitude illness right now.',
    steps: ['Keep to a sensible ascent rate and drink enough.', 'Check again this evening and tomorrow morning, or as soon as you feel off.'],
  },
  watch: {
    tone: 'info',
    title: 'Mild symptoms, not yet altitude sickness',
    lead: 'Your symptoms do not add up to AMS on this scale. Effort, sun, dehydration or a cold can all cause them.',
    steps: ['Rest, drink and eat something.', 'Check again in a few hours.', 'Do not go higher if you are feeling worse rather than better.'],
  },
  rest: {
    tone: 'watch',
    title: 'Mild altitude sickness',
    lead: 'A headache with other symptoms after gaining height is AMS. It usually settles if you stop climbing.',
    steps: [
      'Do not go any higher until the symptoms have gone completely.',
      'Rest where you are, drink enough and eat lightly. A simple painkiller such as paracetamol or ibuprofen can ease the headache.',
      'Tell your guide or companions. Do not stay on your own.',
      'Check again in 6 to 12 hours. If you are no better after a day, or any worse, go down at least 500 m.',
    ],
  },
  stop: {
    tone: 'high',
    title: 'Moderate altitude sickness',
    lead: 'This is more than a bad day. Your body is not coping with this height.',
    steps: [
      'Stop ascending now.',
      'Go down 500 to 1,000 m today unless you improve clearly with a few hours of rest.',
      'Stay with someone at all times, including overnight.',
      'Get medical advice if there is an aid post, a doctor or a trained leader nearby. Medicines for altitude illness are for them to decide.',
      'Check again in a few hours and watch for the danger signs below.',
    ],
  },
  descend: {
    tone: 'high',
    title: 'Severe altitude sickness: go down',
    lead: 'A score this high means you need to lose height now.',
    steps: [
      'Descend at least 500 to 1,000 m, with someone, and keep going until you feel clearly better.',
      'Do not wait for morning if you can move safely.',
      'Use oxygen if any is available.',
      'Get medical help, and arrange evacuation if you cannot walk down.',
    ],
  },
  emergency: {
    tone: 'high',
    title: 'Danger signs: descend immediately',
    lead: 'These signs can mean fluid on the brain (HACE) or in the lungs (HAPE). Both can kill within hours and both improve with descent.',
    steps: [
      'Go down now, by day or night, with people to help. Carry the person if they cannot walk straight.',
      'Give oxygen if there is any. Keep them warm and sitting upright if breathing is hard.',
      'Call for evacuation at the same time, but do not wait for it at altitude if the person can be moved.',
      'Never leave them alone.',
    ],
  },
};
const TONE_ICON = { ok: '✓', info: 'i', watch: '!', high: '!' };
const SEVERITY = { none: 'no AMS', mild: 'mild AMS', moderate: 'moderate AMS', severe: 'severe AMS' };

function read() {
  const data = new FormData(form);
  const answers = Object.fromEntries(['headache', 'gut', 'fatigue', 'dizzy'].map((k) => [k, Number(data.get(k) || 0)]));
  const flags = data.getAll('flag');
  const altitude = data.get('altitude') ? Number(data.get('altitude')) : undefined;
  const fn = Number(data.get('function') || 0);
  return { answers, flags, altitude, fn, recent: data.get('recent') === 'on' };
}

function evaluate(input) {
  const r = scoreLakeLouise(input.answers, input.flags, { altitude: input.altitude });
  let verdict = r.verdict;
  // symptoms that have already forced a stop or an evacuation are never just "mild"
  if (input.fn >= 3 && !['emergency', 'descend'].includes(verdict)) verdict = 'descend';
  else if (input.fn >= 2 && ['clear', 'watch', 'rest'].includes(verdict) && r.total > 0) verdict = 'stop';
  return { ...r, verdict };
}

function render(input, r, { announce = true } = {}) {
  const v = VERDICTS[r.verdict];
  const notes = [];
  if (r.lowAltitude && r.total > 0 && r.verdict !== 'emergency') notes.push('Below 2,500 m altitude sickness is unlikely. Think about dehydration, exhaustion, sun or a stomach bug, and see a doctor if you are worried.');
  if (!input.recent && r.hasAms && r.verdict !== 'emergency') notes.push('You said you have not gained height recently. AMS normally follows an ascent, so consider other causes too, but treat it as altitude sickness until you know otherwise.');
  if (r.redFlags.length) notes.push(`Danger signs you ticked: ${r.redFlags.map((f) => f.label.toLowerCase()).join('; ')}.`);

  const card = h(
    'div',
    { class: `result result-${v.tone}` },
    h(
      'div',
      { class: 'result-head' },
      h('span', { class: 'result-icon', 'aria-hidden': 'true' }, TONE_ICON[v.tone]),
      h('div', {}, h('p', { class: 'result-score' }, `Lake Louise score ${r.total} of 12 · ${SEVERITY[r.severity]}`), h('h2', {}, v.title)),
    ),
    h('p', { class: 'result-lead' }, v.lead),
    h('h3', {}, 'What to do'),
    h(
      'ol',
      { class: 'result-steps' },
      v.steps.map((s) => h('li', {}, s)),
    ),
    notes.map((n) => h('p', { class: 'small result-note' }, n)),
    h(
      'div',
      { class: 'cluster result-actions' },
      r.verdict === 'emergency' || r.verdict === 'descend' ? h('a', { class: 'btn btn-danger', href: url('safety/emergency/') }, 'Open emergency tools') : null,
      h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => shareResult(input, r) }, 'Share with my guide'),
      h('a', { class: 'btn btn-ghost', href: url('safety/') }, 'About altitude illness'),
    ),
  );
  resultEl.replaceChildren(card);
  resultEl.hidden = false;
  if (announce) {
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    resultEl.focus({ preventScroll: true });
  }
}

function shareResult(input, r) {
  const v = VERDICTS[r.verdict];
  const when = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const flags = r.redFlags.length ? `\nDanger signs: ${r.redFlags.map((f) => f.label).join('; ')}` : '';
  const text = `Altitude check, ${when}${input.altitude ? ` at ${input.altitude} m` : ''}\nLake Louise score ${r.total}/12 (${SEVERITY[r.severity]})\n${v.title}${flags}`;
  share({ title: 'Altitude check', text });
}

function paintHistory() {
  const list = store.get('ams-history', []);
  historyEl.hidden = list.length === 0;
  historyList.replaceChildren(
    ...list.map((e, i) => {
      const prev = list[i + 1];
      const trend = prev ? (e.total > prev.total ? '▲ worse than last time' : e.total < prev.total ? '▼ better than last time' : 'same as last time') : '';
      const when = new Date(e.t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return h(
        'li',
        { class: `history-item tone-${VERDICTS[e.v]?.tone || 'info'}` },
        h('span', { class: 'history-score' }, String(e.total)),
        h('span', {}, h('strong', {}, VERDICTS[e.v]?.title || ''), h('small', {}, `${when}${e.alt ? ` · ${e.alt} m` : ''}${trend ? ` · ${trend}` : ''}`)),
      );
    }),
  );
}

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = read();
    const r = evaluate(input);
    render(input, r);
    const list = store.get('ams-history', []);
    list.unshift({ t: Date.now(), total: r.total, v: r.verdict, alt: input.altitude || null, flags: input.flags.length });
    store.set('ams-history', list.slice(0, 20));
    paintHistory();
  });
  form.addEventListener('reset', () => {
    resultEl.hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  // ticking a danger sign shows the warning straight away
  form.addEventListener('change', (e) => {
    if (e.target.name === 'flag' && e.target.checked) {
      const input = read();
      render(input, evaluate(input), { announce: true });
    }
  });
  $('[data-ams-clear]')?.addEventListener('click', () => {
    store.remove('ams-history');
    paintHistory();
    toast('History cleared');
  });
  paintHistory();
  // keep the list of flags honest if the shared definition changes
  if ($$('input[name="flag"]', form).length !== RED_FLAGS.length) console.warn('Danger-sign list is out of date');
}
