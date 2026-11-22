// Plan my trek: one question per screen, then a complete plan on one page.
// Everything about a plan lives in the address (?trek=…&start=…&people=…&help=…), so the
// browser's Back button works, a plan can be bookmarked or shared as a link, and nothing has
// to be remembered between visits.

import { $, h } from '../lib/dom.js';
import { url } from '../lib/site.js';
import * as store from '../lib/store.js';
import { toast, share, copyText, download } from '../lib/ui.js';
import { requestChannel, submitTripRequest } from '../lib/backend.js';
import { MONTHS, num } from '../../lib/format.mjs';
import { DAY_CHOICES, LEVEL_CHOICES, HELP_CHOICES, suggest, walkStats, helpOptions, estimate, permitTotal, startIdeas, isoDate, parseDate, addDays } from '../../lib/plan.mjs';

const root = $('[data-plan]');
if (root) init();

function init() {
  const view = $('[data-plan-view]', root);
  const live = $('[data-plan-live]', root);
  const iconBank = $('[data-plan-icons]', root).content;
  const ic = (name, size = 22) => {
    const svg = iconBank.querySelector(`[data-i="${name}"] svg`).cloneNode(true);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    return svg;
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const hrs = (r) => (r[0] === r[1] ? `${r[0]} hours` : `${r[0]} to ${r[1]} hours`);
  const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const longFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const usd = (v) => `USD ${num(v)}`;
  const range = (lo, hi) => (lo === hi ? usd(lo) : `${usd(lo)} to ${num(hi)}`);
  const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

  // ------------------------------------------------------------------ data
  const cache = {};
  const getJson = (path) => (cache[path] ??= fetch(url(path)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))));
  const loadBase = () => Promise.all([getJson('data/treks.json'), getJson('data/plan.json')]);
  const loadTrek = (slug) => getJson(`data/trek/${slug}.json`);

  // ------------------------------------------------------------------ state in the address
  function read() {
    const q = new URLSearchParams(location.search);
    const draft = store.get('plan-draft', {});
    return {
      step: q.get('step') || '',
      days: q.get('days') || '',
      level: q.get('level') || '',
      month: clamp(Number(q.get('month')) || 0, 0, 12),
      trek: q.get('trek') || '',
      start: /^\d{4}-\d{2}-\d{2}$/.test(q.get('start') || '') ? q.get('start') : '',
      people: clamp(Number(q.get('people')) || draft.people || 2, 1, 16),
      help: HELP_CHOICES.some((c) => c.id === q.get('help')) ? q.get('help') : '',
      spare: q.has('spare') ? clamp(Number(q.get('spare')) || 0, 0, 3) : 1,
    };
  }
  let state = read();
  function address(s) {
    const q = new URLSearchParams();
    for (const k of ['step', 'days', 'level', 'month', 'trek', 'start', 'help']) if (s[k]) q.set(k, s[k]);
    if (s.trek) {
      q.set('people', s.people);
      if (s.spare !== 1) q.set('spare', s.spare);
    }
    const text = q.toString();
    return text ? `?${text}` : location.pathname;
  }
  function go(patch, { replace = false } = {}) {
    state = { ...state, ...patch };
    history[replace ? 'replaceState' : 'pushState'](null, '', address(state));
    // remembered so an answer is still marked when someone steps back to a question
    const kept = store.get('plan-draft', {});
    store.set('plan-draft', { ...kept, people: state.people, ...(state.days ? { days: state.days } : {}), ...(state.level ? { level: state.level } : {}), ...(patch.month !== undefined ? { month: state.month } : {}) });
    render(true);
  }
  const given = (key) => state[key] || store.get('plan-draft', {})[key] || '';
  window.addEventListener('popstate', () => {
    state = read();
    render(true);
  });

  // which screen: an explicit step, else the first thing a chosen trek still needs
  const stepOf = (s) => s.step || (s.trek ? (!s.start ? 'date' : !s.help ? 'help' : 'summary') : 'days');
  const FINDER = ['days', 'level', 'month', 'choose'];
  const PLAN = ['date', 'help', 'summary'];
  function progress(step) {
    const fromFinder = Boolean(state.days || state.level || state.month) || FINDER.includes(step);
    const steps = fromFinder ? [...FINDER, ...PLAN] : PLAN;
    return { n: steps.indexOf(step) + 1, total: steps.length };
  }

  // ------------------------------------------------------------------ building blocks
  function shell(step, { title, lead, body, back, wide = false }) {
    const { n, total } = progress(step);
    const el = h(
      'div',
      { class: `plan-step${wide ? ' plan-step-wide' : ''}` },
      h('p', { class: 'plan-progress' }, `Step ${n} of ${total}`),
      h('div', { class: 'plan-bar', role: 'presentation' }, h('span', { style: `width:${Math.round((n / total) * 100)}%` })),
      h('h1', { tabindex: '-1' }, title),
      lead ? h('p', { class: 'lead' }, lead) : null,
      ...[body].flat(),
      back ? h('div', { class: 'plan-nav' }, h('button', { type: 'button', class: 'btn btn-secondary btn-lg', onclick: back }, ic('arrow-left', 20), 'Back')) : null,
    );
    el.dataset.step = step;
    return el;
  }
  const choice = ({ label, sub, selected, disabled, why, onpick, badge }) =>
    h(
      'button',
      { type: 'button', class: `choice${selected ? ' is-selected' : ''}`, 'aria-pressed': selected ? 'true' : 'false', disabled: disabled || null, onclick: disabled ? null : onpick },
      h('span', { class: 'choice-text' }, h('strong', {}, label, badge ? h('span', { class: 'choice-badge' }, badge) : null), sub ? h('span', {}, sub) : null, why ? h('span', { class: 'choice-why' }, why) : null),
      disabled ? null : ic(selected ? 'circle-check' : 'chevron-right', 24),
    );
  const fact = (icon, text) => h('li', {}, ic(icon, 18), h('span', {}, text));
  const note = (kind, ...children) => h('div', { class: `note note-${kind}` }, ic(kind === 'warn' ? 'triangle-alert' : 'info', 20), h('div', {}, ...children));

  function show(el, announce) {
    view.replaceChildren(el);
    if (announce) {
      const title = $('h1', el);
      window.scrollTo(0, 0);
      title?.focus({ preventScroll: true });
      live.textContent = `${$('.plan-progress', el)?.textContent || ''}: ${title?.textContent || ''}`;
    }
    document.title = `${$('h1', el)?.textContent || 'Plan my trek'} · TrekkSewa`;
  }
  const failed = () =>
    h(
      'div',
      { class: 'plan-step' },
      h('h1', { tabindex: '-1' }, 'We could not load the planner'),
      h('p', { class: 'lead' }, 'It needs an internet connection the first time. Please check your connection and try again.'),
      h('button', { type: 'button', class: 'btn btn-lg', onclick: () => location.reload() }, ic('refresh-cw', 20), 'Try again'),
    );

  // ------------------------------------------------------------------ the three questions
  function stepDays(treks) {
    const picker = h('select', { class: 'select select-lg', id: 'plan-known', 'aria-label': 'Choose a trek' }, h('option', { value: '' }, 'Choose a trek…'), ...treks.map((t) => h('option', { value: t.s }, t.n)));
    picker.addEventListener('change', () => picker.value && go({ trek: picker.value, step: 'date' }));
    return shell('days', {
      title: 'How many days would you like to walk?',
      lead: 'Count only the days on the trail. Getting to Nepal and back comes on top.',
      body: [
        h('div', { class: 'choices' }, ...DAY_CHOICES.map((c) => choice({ label: c.label, sub: c.sub, selected: given('days') === c.id, onpick: () => go({ days: c.id, step: 'level' }) }))),
        h('div', { class: 'plan-aside' }, h('label', { for: 'plan-known' }, 'Already know which trek you want?'), picker),
      ],
    });
  }
  function stepLevel() {
    return shell('level', {
      title: 'How much walking feels right for you?',
      lead: 'There is no wrong answer. A slow, steady walker enjoys the mountains more than a tired fast one.',
      body: h('div', { class: 'choices' }, ...LEVEL_CHOICES.map((c) => choice({ label: c.label, sub: c.sub, selected: given('level') === c.id, onpick: () => go({ level: c.id, step: 'month' }) }))),
      back: () => go({ step: 'days' }),
    });
  }
  const SEASON = ['Cold and clear', 'Cold and clear', 'Spring begins', 'Spring flowers', 'Warm and hazy', 'Rains begin', 'Monsoon rain', 'Monsoon rain', 'Rains ease', 'Clear skies', 'Clear and cool', 'Cold and quiet'];
  const POPULAR = new Set([3, 4, 10, 11]);
  function stepMonth() {
    return shell('month', {
      title: 'When would you like to go?',
      lead: 'October, November, March and April have the most settled weather, and are the busiest.',
      body: [
        h(
          'div',
          { class: 'choices choices-months' },
          ...MONTHS.map((m, i) => choice({ label: m, sub: SEASON[i], badge: POPULAR.has(i + 1) ? 'Popular' : '', selected: Number(given('month')) === i + 1, onpick: () => go({ month: i + 1, step: 'choose' }) })),
        ),
        h('div', { class: 'choices' }, choice({ label: 'I can go at any time', sub: 'Show me treks for every season', selected: false, onpick: () => go({ month: 0, step: 'choose' }) })),
      ],
      back: () => go({ step: 'level' }),
    });
  }

  // ------------------------------------------------------------------ suggestions
  function pickCard(r, { headingTag = 'h2' } = {}) {
    const t = r.trek;
    const media = t.ph
      ? h('img', { class: 'pick-photo', src: url(`photos/${t.ph.f}`), alt: t.ph.a || '', loading: 'lazy', width: '720', height: '480', style: `object-position:${t.ph.o || '50% 50%'}` })
      : h('div', { class: 'pick-photo pick-photo-none', 'aria-hidden': 'true' }, ic('mountain', 44));
    return h(
      'article',
      { class: 'pick card' },
      media,
      h(
        'div',
        { class: 'pick-body' },
        h('p', { class: 'pick-region' }, t.rn),
        h(headingTag, {}, t.n),
        t.tag ? h('p', { class: 'pick-tag' }, t.tag) : null,
        h('ul', { class: 'facts' }, fact('calendar-days', `${t.d} days`), r.stats.walkingDays ? fact('footprints', `${hrs(r.stats.typical)} a day`) : null, fact('mountain', `Highest night ${num(t.hi)} m`), t.pk ? fact('wallet', `Guided from about ${usd(t.pk[0])}`) : null),
        r.why.length ? h('ul', { class: 'why' }, ...r.why.map((w) => fact('check', w))) : null,
        r.care.length ? h('ul', { class: 'care' }, ...r.care.map((w) => fact('triangle-alert', w))) : null,
        h(
          'div',
          { class: 'pick-actions' },
          h('button', { type: 'button', class: 'btn btn-lg', onclick: () => go({ trek: t.s, step: 'date' }) }, 'Plan this trek', ic('arrow-right', 20)),
          h('a', { class: 'btn btn-lg btn-secondary', href: url(`treks/${t.s}/`) }, 'Read the full guide'),
        ),
      ),
    );
  }
  function stepChoose(treks) {
    const answers = { days: state.days, level: state.level, month: state.month };
    const results = suggest(treks, answers);
    const good = results.filter((r) => !r.hardMonth);
    const shown = (good.length ? good : results).slice(0, 3);
    const more = results.filter((r) => !shown.includes(r));
    const said = [DAY_CHOICES.find((c) => c.id === state.days)?.sub, LEVEL_CHOICES.find((c) => c.id === state.level)?.label.toLowerCase(), state.month ? MONTHS[state.month - 1] : ''].filter(Boolean).join(' · ');
    const moreBox = h('div', { class: 'picks', hidden: true });
    const moreBtn = more.length
      ? h(
          'button',
          {
            type: 'button',
            class: 'btn btn-secondary btn-lg',
            onclick: () => {
              moreBox.replaceChildren(...more.map((r) => pickCard(r)));
              moreBox.hidden = false;
              moreBtn.hidden = true;
            },
          },
          `Show ${more.length} more ${more.length === 1 ? 'trek' : 'treks'} that could suit you`,
        )
      : null;
    const empty = !results.length
      ? note('plain', h('p', {}, h('strong', {}, 'No trek matches all three answers.'), ' Try a different length or month, or look through every trek.'), h('p', {}, h('a', { class: 'btn btn-secondary', href: url('treks/') }, 'See all treks')))
      : null;
    return shell('choose', {
      wide: true,
      title: results.length ? (shown.length === 1 ? 'This trek suits you' : 'These treks suit you') : 'Nothing quite fits',
      lead: said ? `You said: ${said}.` : 'Here are the treks we would start with.',
      body: [empty, !good.length && results.length ? note('warn', h('p', {}, `${MONTHS[state.month - 1]} is a difficult month for the treks that fit. They are shown anyway, with the reason.`)) : null, h('div', { class: 'picks' }, ...shown.map((r) => pickCard(r))), moreBtn, moreBox, h('p', { class: 'plan-alt' }, h('a', { href: url('treks/') }, 'Or browse every trek'))],
      back: () => go({ step: 'month' }),
    });
  }

  // ------------------------------------------------------------------ dates and people
  function stepDate(t) {
    let picked = state.start;
    let people = state.people;
    const said = h('p', { class: 'plan-said', 'aria-live': 'polite' });
    const input = h('input', { class: 'input input-lg', type: 'date', id: 'plan-start', min: isoDate(new Date()), value: picked || '' });
    const next = h('button', { type: 'button', class: 'btn btn-lg', disabled: picked ? null : true, onclick: () => go({ start: picked, people, step: state.help ? 'summary' : 'help' }) }, 'Continue', ic('arrow-right', 20));
    const ideaBtns = [];
    const paint = () => {
      next.disabled = !picked;
      if (!picked) {
        said.textContent = '';
        return;
      }
      const start = parseDate(picked);
      const end = addDays(start, t.d - 1);
      const m = start.getMonth() + 1;
      const fit = t.best.includes(m) ? 'one of the best months for this trek' : t.good.includes(m) ? 'a good month for this trek' : 'a hard month for this trek';
      said.replaceChildren(h('strong', {}, `You start on ${longFmt.format(start)}`), ` and finish on ${longFmt.format(end)}. ${MONTHS[m - 1]} is ${fit}.`);
      said.className = `plan-said${t.best.includes(m) || t.good.includes(m) ? '' : ' is-warn'}`;
      for (const b of ideaBtns) b.classList.toggle('is-selected', b.dataset.date === picked);
    };
    input.addEventListener('change', () => {
      picked = input.value;
      paint();
    });
    const ideas = startIdeas(t, new Date(), 4, state.month);
    for (const idea of ideas) {
      const quality = idea.best ? 'One of the best months' : idea.good ? 'A good month' : 'A hard month for this trek';
      const b = choice({
        label: idea.label,
        sub: idea.chosen ? `The month you chose. ${quality}.` : quality,
        badge: idea.best ? 'Best' : '',
        onpick: () => {
          picked = idea.date;
          input.value = picked;
          paint();
        },
      });
      b.dataset.date = idea.date;
      ideaBtns.push(b);
    }
    const count = h('output', { class: 'stepper-value', 'aria-live': 'polite' }, String(people));
    const bump = (d) => {
      people = clamp(people + d, 1, 16);
      count.textContent = String(people);
    };
    const el = shell('date', {
      title: `When do you start ${t.n}?`,
      lead: `This is the day the trek itself begins, about ${t.d} days. Plan to arrive in Nepal at least two days before.`,
      body: [
        ideas.length ? h('div', { class: 'choices choices-2' }, ...ideaBtns) : null,
        h('div', { class: 'field field-lg' }, h('label', { for: 'plan-start' }, ideas.length ? 'Or choose the exact day' : 'Choose the day you start'), input, ideas.length ? h('span', { class: 'hint' }, 'The buttons above set the 10th of the month. You can change the day here.') : null),
        said,
        h(
          'div',
          { class: 'field field-lg' },
          h('span', { class: 'label', id: 'plan-people-label' }, 'How many of you are going?'),
          h('div', { class: 'stepper', role: 'group', 'aria-labelledby': 'plan-people-label' }, h('button', { type: 'button', class: 'stepper-btn', 'aria-label': 'One fewer person', onclick: () => bump(-1) }, ic('minus', 24)), count, h('button', { type: 'button', class: 'stepper-btn', 'aria-label': 'One more person', onclick: () => bump(1) }, ic('plus', 24))),
        ),
        h('div', { class: 'plan-next' }, next),
      ],
      back: () => (state.days || state.level ? go({ step: 'choose', trek: '' }) : history.length > 1 ? history.back() : (location.href = url('treks/'))),
    });
    paint();
    return el;
  }

  // ------------------------------------------------------------------ who helps
  function stepHelp(t, base) {
    const price = (id) => {
      const g = base.rates.guide;
      const p = base.rates.porter;
      if (id === 'agency') return t.pk ? `Usually ${range(t.pk[0], t.pk[1])} a person for everything on the trek` : 'Ask for a quote: prices depend on the group and the season';
      if (id === 'guide') return `About ${range(g[0], g[1])} a day for the guide`;
      if (id === 'guide-porter') return `About ${range(g[0], g[1])} a day for the guide and ${range(p[0], p[1])} for the porter`;
      if (id === 'porter') return `About ${range(p[0], p[1])} a day`;
      return 'No wages to pay';
    };
    const options = helpOptions(t);
    const open = options.filter((o) => !o.blocked);
    return shell('help', {
      title: 'Who would you like to help you?',
      lead: t.gr === 'required' || t.ra ? 'The rules on this route limit the choice. The options that are not allowed are greyed out, with the reason.' : 'You can change this later. If you are not sure, a trekking company is the simplest choice.',
      body: [
        h('div', { class: 'choices' }, ...options.map((o) => choice({ label: o.label, sub: o.blocked ? '' : o.sub, why: o.blocked || price(o.id), badge: !o.blocked && o.id === open[0].id && o.id === 'agency' ? 'Easiest' : '', selected: state.help === o.id, disabled: Boolean(o.blocked), onpick: () => go({ help: o.id, step: 'summary' }) }))),
        h('p', { class: 'plan-alt' }, h('a', { href: url('services/') }, 'What is the difference between a guide, a porter and an agency?')),
      ],
      back: () => go({ step: 'date' }),
    });
  }

  // ------------------------------------------------------------------ the plan
  const MODE_ICON = { flight: 'plane', bus: 'bus', jeep: 'car', drive: 'car', taxi: 'car' };
  const KIND_LABEL = { acclimatization: 'A rest day to get used to the height', rest: 'Rest day', transfer: 'Travel day', buffer: 'Spare day' };

  function stayLine(d) {
    const s = d.stay;
    if (!s) return null;
    let text;
    if (s.c) text = [h('strong', {}, `${s.c} ${s.c === 1 ? 'place' : 'places'} to stay`), s.n.length ? `, such as ${list(s.n.slice(0, 3))}.` : '.'];
    else if (s.city) text = [h('strong', {}, 'Plenty of hotels'), ' at every price.'];
    else if (s.some) text = [h('strong', {}, s.some === 'homestays' ? 'Homestays here.' : 'Lodges here.'), ' Your guide will know which.'];
    else if (s.camp) text = [h('strong', {}, 'Camping only.'), ' There are no lodges at this stop.'];
    else return null;
    return h('p', { class: 'pday-stay' }, ic('bed-double', 18), h('span', {}, ...text, ' ', s.city ? null : h('a', { href: url(`places/${d.ts}/`) }, `About ${d.to}`)));
  }

  function summary(t, base, detail) {
    const start = parseDate(state.start);
    const trekDays = detail.days.length;
    const total = trekDays + state.spare;
    const end = addDays(start, total - 1);
    const month = start.getMonth() + 1;
    const helpChoice = HELP_CHOICES.find((c) => c.id === state.help);
    // the trip around the trek: every itinerary starts and ends in its gateway city, and
    // people from abroad land in Kathmandu
    const fromKathmandu = detail.gateway === 'Kathmandu';
    const arrive = addDays(start, fromKathmandu ? -2 : -3);
    const flyHome = addDays(end, fromKathmandu ? 1 : 2);
    const permitMap = Object.fromEntries(detail.permits.map((p) => [p.id, p]));
    const permits = permitTotal(detail.permits.map((p) => p.id), trekDays, base.npr, permitMap);
    const cost = estimate({ days: trekDays, people: state.people, help: state.help, rates: { ...base.rates, food: detail.food, npr: base.npr }, permitsUsd: permits.total, transport: detail.transport || [0, 0], transportNote: detail.transportText ? `${detail.transportText}.` : '', pkg: detail.pkg });
    const planUrl = new URL(address({ ...state, step: '' }), location.href).href;
    const title = `${t.n}: ${total} days from ${dayFmt.format(start)}`;

    // --- words for sharing, printing and sending
    const planText = () =>
      [
        `Trek plan: ${t.n} (Nepal)`,
        `Dates: ${longFmt.format(start)} to ${longFmt.format(end)} (${total} days${state.spare ? `, including ${state.spare} spare` : ''})`,
        `People: ${state.people}`,
        `Arrive in Kathmandu by ${longFmt.format(arrive)}; fly home on ${longFmt.format(flyHome)} or later`,
        `Help wanted: ${helpChoice.label.toLowerCase()}`,
        '',
        ...detail.days.map((d, i) => `Day ${i + 1}, ${dayFmt.format(addDays(start, i))}: ${d.t}${d.back ? ` (night in ${detail.gateway})` : d.a ? ` (sleep at ${num(d.a)} m)` : ''}`),
        ...Array.from({ length: state.spare }, (_, i) => `Day ${trekDays + i + 1}, ${dayFmt.format(addDays(start, trekDays + i))}: spare day`),
        '',
        `Rough cost per person: ${range(cost.total[0], cost.total[1])}`,
        `Plan: ${planUrl}`,
      ].join('\n');

    // --- top
    const savePlan = () => {
      const plans = store.get('plans', {});
      plans[t.s] = { start: state.start, name: t.n, days: total, people: state.people, help: state.help, spare: state.spare };
      store.set('plans', plans);
      toast('Saved on this device. You will find it under My trips.');
    };
    const calendar = () => {
      const d8 = (d) => isoDate(d).replace(/-/g, '');
      const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const events = [...detail.days, ...Array.from({ length: state.spare }, () => ({ t: 'Spare day', to: '', a: 0, h: null }))].map((d, i) => {
        const day = addDays(start, i);
        const desc = [d.back ? `Night in ${detail.gateway}` : d.to ? `Sleep at ${d.to}${d.a ? ` (${d.a} m)` : ''}` : '', d.h ? `About ${hrs(d.h)}` : '', planUrl].filter(Boolean).join('\n');
        return ['BEGIN:VEVENT', `UID:${t.s}-${i + 1}-${d8(day)}@trekksewa`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d8(day)}`, `DTEND;VALUE=DATE:${d8(addDays(day, 1))}`, `SUMMARY:${esc(`${t.n} day ${i + 1}: ${d.t}`)}`, `DESCRIPTION:${esc(desc)}`, 'END:VEVENT'].join('\r\n');
      });
      download(`${t.s}.ics`, ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TrekkSewa//Plan my trek//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n'), 'text/calendar');
      toast('Calendar file downloaded');
    };
    const actions = h(
      'div',
      { class: 'plan-actions no-print' },
      h('a', { class: 'btn btn-lg', href: '#send' }, ic('send', 20), 'Get help arranging it'),
      h('button', { type: 'button', class: 'btn btn-lg btn-secondary', onclick: () => window.print() }, ic('printer', 20), 'Print'),
      h('button', { type: 'button', class: 'btn btn-lg btn-secondary', onclick: savePlan }, ic('bookmark', 20), 'Save'),
      h('button', { type: 'button', class: 'btn btn-lg btn-secondary', onclick: () => share({ title, text: planText(), url: planUrl }) }, ic('share-2', 20), 'Share'),
    );
    const edit = (label, step) => h('button', { type: 'button', class: 'link-btn no-print', onclick: () => go({ step }) }, ic('pencil', 16), label);
    const head = h(
      'header',
      { class: 'plan-head' },
      h('p', { class: 'plan-progress' }, 'Your trek plan'),
      h('h1', { tabindex: '-1' }, t.n),
      h('div', { class: 'plan-when' }, h('strong', {}, `${longFmt.format(start)} to ${longFmt.format(end)}`), h('div', { class: 'plan-when-meta' }, h('span', {}, `${total} days · ${state.people} ${state.people === 1 ? 'person' : 'people'}`), edit('Change dates or people', 'date'))),
      detail.photo
        ? h(
            'figure',
            { class: 'plan-photo' },
            h('img', { src: url(`photos/${detail.photo.f}`), srcset: `${url(`photos/${detail.photo.sm}`)} 720w, ${url(`photos/${detail.photo.f}`)} ${detail.photo.w}w`, sizes: '(max-width: 760px) 100vw, 56rem', alt: detail.photo.a || '', width: String(detail.photo.w), height: String(detail.photo.h), style: `object-position:${detail.photo.o || '50% 50%'}` }),
            // the credit the licence asks for: who made it, where it came from, under which terms
            h('figcaption', {}, `${detail.photo.c || ''} `, h('span', { class: 'photo-credit' }, 'Photo: ', h('a', { href: detail.photo.src, rel: 'noopener' }, detail.photo.by), ', ', h('a', { href: detail.photo.lu, rel: 'noopener license' }, detail.photo.l))),
          )
        : null,
      h('p', { class: 'lead' }, detail.sum),
      actions,
      h('nav', { class: 'plan-jump no-print', 'aria-label': 'Parts of this plan' }, ...[['days', 'Day by day'], ['help', 'Who helps you'], ['cost', 'What it costs'], ['papers', 'Permits and papers'], ['ready', 'Before you go'], ['send', 'Get help']].map(([id, label]) => h('a', { href: `#${id}` }, label))),
    );

    // --- days
    const hardMonth = !t.best.includes(month) && !t.good.includes(month);
    const spareBtns = [0, 1, 2, 3].map((n) => h('button', { type: 'button', class: `seg${state.spare === n ? ' is-on' : ''}`, 'aria-pressed': String(state.spare === n), onclick: () => go({ spare: n }, { replace: true }) }, n === 0 ? 'None' : String(n)));
    const dayCard = (d, i) => {
      const date = addDays(start, i);
      const kind = KIND_LABEL[d.k];
      const facts = [];
      if (d.h) facts.push(d.m ? `${hrs(d.h)} by ${d.m === 'flight' ? 'air' : d.m}` : `${hrs(d.h)} of walking`);
      if (d.km && !d.m) facts.push(`about ${d.km} km`);
      if (d.back) facts.push(`tonight in ${detail.gateway}`);
      else if (d.a) facts.push(`sleep at ${num(d.a)} m`);
      return h(
        'li',
        { class: `pday pday-${d.k}${d.lvl && d.lvl !== 'ok' ? ' pday-flag' : ''}`, id: `day-${i + 1}` },
        h('div', { class: 'pday-when' }, h('span', { class: 'pday-n' }, `Day ${i + 1}`), h('span', { class: 'pday-date' }, dayFmt.format(date))),
        h(
          'div',
          { class: 'pday-body' },
          h('h3', {}, d.m ? ic(MODE_ICON[d.m] || 'car', 20) : null, d.t),
          kind ? h('p', { class: 'pday-kind' }, kind) : null,
          facts.length ? h('p', { class: 'pday-facts' }, facts.join(' · ')) : null,
          d.note ? h('p', { class: 'pday-note' }, d.note) : null,
          d.lvl && d.lvl !== 'ok' && d.why.length ? h('p', { class: 'pday-alt' }, ic('heart-pulse', 18), h('span', {}, h('strong', {}, 'Go gently tonight. '), d.why.join(' '), ' ', h('a', { href: url(`safety/acclimatization/?trek=${t.s}`) }, 'See the altitude check'))) : null,
          stayLine(d),
          d.med && d.med.length ? h('p', { class: 'pday-med' }, ic('stethoscope', 18), h('span', {}, `Medical help here: ${list(d.med)}.`)) : null,
        ),
      );
    };
    const spareCard = (i) => h('li', { class: 'pday pday-buffer' }, h('div', { class: 'pday-when' }, h('span', { class: 'pday-n' }, `Day ${trekDays + i + 1}`), h('span', { class: 'pday-date' }, dayFmt.format(addDays(start, trekDays + i)))), h('div', { class: 'pday-body' }, h('h3', {}, 'Spare day'), h('p', { class: 'pday-note' }, 'Kept free for a delayed flight, a blocked road, bad weather or a tired body. If you do not need it, it is a day to rest in the city.')));
    const lodgeNights = detail.days.filter((d) => d.stay && d.stay.c).length;
    const daysSection = h(
      'section',
      { class: 'plan-section', id: 'days', 'aria-labelledby': 'days-h' },
      h('h2', { id: 'days-h' }, 'Day by day'),
      hardMonth ? note('warn', h('p', {}, h('strong', {}, `${MONTHS[month - 1]} is a hard month for this trek. `), h('a', { href: url(`treks/${t.s}/#season`) }, 'Read "When to go"'), ' before you book anything.')) : null,
      h('p', {}, `Where you walk and where you sleep each night. ${lodgeNights ? 'Places to stay come from OpenStreetMap; ' : ''}in the busy months, ask your guide or company to reserve beds ahead.`),
      h(
        'ol',
        { class: 'trip-line', 'aria-label': 'Your whole trip, start to finish' },
        h('li', {}, h('strong', {}, `Arrive in Kathmandu by ${dayFmt.format(arrive)}`), h('span', {}, fromKathmandu ? 'That leaves a full day to rest after the flight, change money and collect what you need.' : 'That leaves a full day to rest after the flight and change money before you travel on.')),
        fromKathmandu ? null : h('li', {}, h('strong', {}, `Travel to ${detail.gateway} on ${dayFmt.format(addDays(start, -1))}`), h('span', {}, `The day before the trek. ${detail.reach || ''}`)),
        h('li', {}, h('strong', {}, `Trek from ${dayFmt.format(start)} to ${dayFmt.format(addDays(start, trekDays - 1))}`), h('span', {}, `${trekDays} days, each one set out below. The last day brings you back to ${detail.gateway}.`)),
        state.spare ? h('li', {}, h('strong', {}, state.spare === 1 ? `One spare day, ${dayFmt.format(end)}` : `${state.spare} spare days, to ${dayFmt.format(end)}`), h('span', {}, 'For a delayed flight, a blocked road or a slower pace.')) : null,
        h('li', {}, h('strong', {}, `Fly home on ${dayFmt.format(flyHome)} or later`), h('span', {}, fromKathmandu ? 'Not on the day the trek ends: mountain flights and roads are often late.' : `That allows a day to get back from ${detail.gateway} to Kathmandu.`)),
      ),
      h('ol', { class: 'pdays' }, ...detail.days.map(dayCard), ...Array.from({ length: state.spare }, (_, i) => spareCard(i))),
      h('div', { class: 'spare no-print' }, h('span', { id: 'spare-label' }, 'Spare days at the end'), h('div', { class: 'segs', role: 'group', 'aria-labelledby': 'spare-label' }, ...spareBtns), h('span', { class: 'hint' }, t.fl ? 'This trek begins with a mountain flight. Keep at least one, better two.' : 'One is sensible for any trek.')),
      h('p', { class: 'no-print' }, h('a', { class: 'btn btn-secondary', href: url(`treks/${t.s}/`) }, ic('map', 18), 'See the route on a map'), ' ', h('button', { type: 'button', class: 'btn btn-secondary', onclick: calendar }, ic('calendar-plus', 18), 'Add to my calendar')),
    );

    // --- help
    const helpSection = h(
      'section',
      { class: 'plan-section', id: 'help', 'aria-labelledby': 'help-h' },
      h('h2', { id: 'help-h' }, 'Who helps you'),
      h('div', { class: 'card card-pad plan-help' }, h('h3', {}, helpChoice.label), h('p', {}, helpChoice.sub), edit('Change', 'help')),
      detail.guide?.note ? h('p', {}, detail.guide.note) : null,
      h('p', { class: 'no-print' }, h('a', { href: url('services/guides/') }, 'How to choose a good guide'), ' · ', h('a', { href: url('services/porters/') }, 'How porters should be treated'), ' · ', h('a', { href: url('services/agencies/') }, 'What a registered agency is')),
    );

    // --- cost
    const costSection = h(
      'section',
      { class: 'plan-section', id: 'cost', 'aria-labelledby': 'cost-h' },
      h('h2', { id: 'cost-h' }, 'What it may cost'),
      h('p', { class: 'cost-total' }, h('span', {}, 'For each person, roughly'), h('strong', {}, range(cost.total[0], cost.total[1])), h('span', {}, `about NPR ${num(Math.round((cost.total[0] * base.npr) / 1000) * 1000)} to ${num(Math.round((cost.total[1] * base.npr) / 1000) * 1000)}`)),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'cost-table' },
          h('caption', { class: 'sr-only' }, 'Estimated cost per person'),
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'What'), h('th', { scope: 'col', class: 'num' }, 'Per person'))),
          h('tbody', {}, ...cost.items.map((i) => h('tr', {}, h('td', {}, i.label, i.note ? h('small', {}, i.note) : null), h('td', { class: 'num' }, range(i.low, i.high))))),
        ),
      ),
      cost.packaged && detail.pkg ? h('p', { class: 'small' }, `The package price is the range that ${detail.pkg.sampled ? `${detail.pkg.sampled} trekking companies` : 'several trekking companies'} published for ${detail.pkg.days || 'this trek'} days${base.asOf.market ? `, checked ${base.asOf.market}` : ''}. It usually includes ${list(detail.pkg.includes.slice(0, 5)) || 'guide, permits, beds and meals'}.`) : null,
      !cost.packaged && !(detail.transport && detail.transport[1]) ? h('p', { class: 'small' }, `Not included: getting from ${detail.gateway} to the start and back. ${detail.access}`) : null,
      !cost.packaged && detail.transportExtra ? h('p', { class: 'small' }, `Not included, because we found no reliable fare: ${detail.transportExtra}.`) : null,
      h('p', { class: 'cost-cash' }, ic('wallet', 20), h('span', {}, h('strong', {}, `Carry about NPR ${num(cost.cashNpr)} each in cash on the trail. `), detail.cash.length ? `There are cash machines at ${list(detail.cash)}, but they often run dry.` : `We know of no cash machine on this route, so take it all from ${detail.gateway}.`)),
      h('p', { class: 'small muted' }, `These are estimates in US dollars, at about NPR ${base.npr} to the dollar, not a quote. International flights, your visa and insurance are extra. `, h('a', { class: 'no-print', href: url(`tools/budget/?trek=${t.s}`) }, 'Change the numbers yourself')),
    );

    // --- papers
    const papers = h(
      'section',
      { class: 'plan-section', id: 'papers', 'aria-labelledby': 'papers-h' },
      h('h2', { id: 'papers-h' }, 'Permits and papers'),
      h(
        'ul',
        { class: 'papers' },
        base.visa ? h('li', {}, ic('ticket', 22), h('div', {}, h('h3', {}, 'Tourist visa for Nepal'), h('p', {}, `${base.visa}. Most visitors get it on arrival at Kathmandu airport. Your passport needs six months left.`))) : null,
        ...detail.permits.map((p) => h('li', {}, ic('ticket', 22), h('div', {}, h('h3', {}, p.name), h('p', {}, h('strong', {}, p.fee), p.verified ? '' : ' (fee not confirmed this season)'), h('p', {}, p.where)))),
        h('li', {}, ic('shield-check', 22), h('div', {}, h('h3', {}, 'Travel insurance'), h('p', {}, `It must cover trekking up to at least ${num(detail.insure)} m and rescue by helicopter. The highest point of this trek is ${detail.max.name} at ${num(detail.max.m)} m.`), h('p', { class: 'no-print' }, h('a', { href: url(`safety/insurance/?trek=${t.s}`) }, 'Check your policy line by line')))),
      ),
      state.help === 'agency' ? h('p', {}, 'A trekking company normally arranges the trekking permits for you. The visa and insurance are yours to sort out.') : null,
    );

    // --- checklist
    const ticks = new Set(store.get('plan-checks', {})[t.s] || []);
    const todo = [
      ['flights', `Book flights: arrive in Kathmandu by ${dayFmt.format(arrive)}, fly home on ${dayFmt.format(flyHome)} or later`, null],
      ['doctor', 'Talk to your doctor about walking at altitude and the vaccinations you need', null],
      ['insurance', `Buy insurance that covers trekking to ${num(detail.insure)} m and helicopter rescue`, `safety/insurance/?trek=${t.s}`],
      ['help', state.help === 'self' ? 'Decide where you will sleep each night' : `Arrange ${state.help === 'agency' ? 'your trekking company' : state.help === 'porter' ? 'your porter' : 'your guide'}`, null],
      ['permits', detail.permits.length ? `Get your permits: ${list(detail.permits.map((p) => p.short))}` : 'No trekking permit is needed for this route', 'permits/'],
      ['kit', `Pack for ${MONTHS[month - 1]} at ${num(detail.max.m)} m`, `tools/packing/?trek=${t.s}&month=${month}`],
      ['cash', `Take about NPR ${num(cost.cashNpr)} each in cash from ${detail.gateway}`, null],
      ['card', 'Fill in your emergency card and learn the warning signs of altitude sickness', 'safety/'],
      ['home', 'Leave a copy of this plan with someone at home', null],
    ];
    const countEl = h('p', { class: 'ready-count', 'aria-live': 'polite' });
    const paintCount = () => (countEl.textContent = ticks.size === todo.length ? 'Everything is ticked. Have a wonderful trek.' : `${ticks.size} of ${todo.length} done`);
    const ready = h(
      'section',
      { class: 'plan-section', id: 'ready', 'aria-labelledby': 'ready-h' },
      h('h2', { id: 'ready-h' }, 'Before you go'),
      h(
        'ul',
        { class: 'ready' },
        ...todo.map(([id, text, link]) => {
          const box = h('input', { type: 'checkbox', id: `todo-${id}`, checked: ticks.has(id) || null });
          box.addEventListener('change', () => {
            if (box.checked) ticks.add(id);
            else ticks.delete(id);
            const all = store.get('plan-checks', {});
            all[t.s] = [...ticks];
            store.set('plan-checks', all);
            paintCount();
          });
          return h('li', {}, box, h('label', { for: `todo-${id}` }, text), link ? h('a', { class: 'no-print', href: url(link), 'aria-label': `Open the page for: ${text}` }, 'Open') : null);
        }),
      ),
      countEl,
    );
    paintCount();

    // --- send
    const send = sendSection({ t, detail, base, start, end, total, planUrl, planText, cost, title });
    const el = h('div', { class: 'plan-step plan-step-wide plan-summary' }, head, daysSection, helpSection, costSection, papers, ready, send, h('p', { class: 'plan-foot small muted' }, 'A plan is a starting point. Weather, trails, prices and rules change: check locally, and turn back when that is the right thing to do.'));
    el.dataset.step = 'summary';
    return el;
  }

  // ------------------------------------------------------------------ asking for help with it
  function sendSection({ t, detail, start, end, total, planUrl, planText, cost, title }) {
    const channel = requestChannel();
    const wants = [
      ['package', 'A full package from a trekking company', state.help === 'agency'],
      ['guide', 'A licensed guide', state.help === 'guide' || state.help === 'guide-porter'],
      ['porter', 'A porter', state.help === 'guide-porter' || state.help === 'porter'],
      ['rooms', 'Lodge rooms booked ahead', false],
      ['permits', 'Permits arranged for me', state.help === 'agency'],
      ['city', 'Airport pick-up and a hotel in Kathmandu', false],
    ];
    const shareBtns = h(
      'div',
      { class: 'send-share no-print' },
      h('a', { class: 'btn btn-lg btn-secondary', href: `https://wa.me/?text=${encodeURIComponent(planText())}`, target: '_blank', rel: 'noopener' }, ic('message-circle', 20), 'Send by WhatsApp'),
      h('a', { class: 'btn btn-lg btn-secondary', href: `mailto:?subject=${encodeURIComponent(`Trek plan: ${t.n}`)}&body=${encodeURIComponent(planText())}` }, ic('mail', 20), 'Send by email'),
      h('button', { type: 'button', class: 'btn btn-lg btn-secondary', onclick: async () => toast((await copyText(planText())) ? 'Plan copied. Paste it into a message.' : 'Could not copy. Use Print instead.') }, ic('copy', 20), 'Copy the plan'),
    );
    if (!channel.kind) {
      return h(
        'section',
        { class: 'plan-section', id: 'send', 'aria-labelledby': 'send-h' },
        h('h2', { id: 'send-h' }, 'Get help arranging it'),
        h('p', {}, 'Send this plan to a trekking company or a guide and ask for a price. It tells them everything they need: your dates, your route, how many you are and the help you want.'),
        shareBtns,
        note('plain', h('p', {}, h('strong', {}, 'TrekkSewa\u2019s own booking desk is not open yet. '), 'We are enrolling guides, porters and agencies now. Until then, ', h('a', { href: url('services/agencies/') }, 'here is how to check that a company is registered'), '.')),
      );
    }
    const saved = store.get('plan-contact', {});
    const field = (id, label, attrs = {}, hint = '') => h('div', { class: 'field field-lg' }, h('label', { for: `rq-${id}` }, label), h('input', { class: 'input input-lg', id: `rq-${id}`, name: id, value: saved[id] || '', ...attrs }), hint ? h('span', { class: 'hint' }, hint) : null);
    const status = h('div', { class: 'send-status', role: 'status', 'aria-live': 'polite' });
    const submit = h('button', { type: 'submit', class: 'btn btn-lg' }, ic('send', 20), channel.kind === 'whatsapp' ? 'Send on WhatsApp' : channel.kind === 'email' ? 'Send by email' : 'Send my request');
    const form = h(
      'form',
      { class: 'send-form', novalidate: true },
      h('fieldset', { class: 'send-wants' }, h('legend', {}, 'What would you like arranged?'), ...wants.map(([id, label, on]) => h('label', { class: 'tick' }, h('input', { type: 'checkbox', name: 'wants', value: id, checked: on || null }), h('span', {}, label)))),
      field('name', 'Your name', { autocomplete: 'name', required: true }),
      field('email', 'Email address', { type: 'email', autocomplete: 'email', inputmode: 'email' }, 'Give an email address or a WhatsApp number, whichever you prefer.'),
      field('whatsapp', 'WhatsApp or phone number', { type: 'tel', autocomplete: 'tel', inputmode: 'tel' }, 'Include the country code, for example +44.'),
      field('country', 'Where are you travelling from?', { autocomplete: 'country-name' }),
      h('div', { class: 'field field-lg' }, h('label', { for: 'rq-message' }, 'Anything we should know?'), h('textarea', { class: 'input input-lg', id: 'rq-message', name: 'message', rows: '4', placeholder: 'For example: your age, your walking experience, a health condition, food you cannot eat.' })),
      h('label', { class: 'tick tick-consent' }, h('input', { type: 'checkbox', name: 'consent', required: true }), h('span', {}, 'TrekkSewa may use these details to reply to me about this trek. ', h('a', { href: url('privacy/') }, 'How we handle your details'))),
      status,
      h('div', { class: 'plan-next' }, submit),
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim();
      const whatsapp = String(data.get('whatsapp') || '').trim();
      const problems = [];
      if (!name) problems.push(['name', 'Please tell us your name.']);
      if (!email && !whatsapp) problems.push(['email', 'Please give an email address or a WhatsApp number so we can reply.']);
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push(['email', 'That email address does not look right. Please check it.']);
      if (!data.get('consent')) problems.push(['consent', 'Please tick the box so we are allowed to reply to you.']);
      if (problems.length) {
        status.className = 'send-status is-error';
        status.replaceChildren(h('strong', {}, 'Almost there.'), h('ul', {}, ...problems.map(([, msg]) => h('li', {}, msg))));
        form.elements[problems[0][0]]?.focus();
        return;
      }
      store.set('plan-contact', { name, email, whatsapp, country: String(data.get('country') || '').trim() });
      const request = {
        trek: t.s,
        trek_name: t.n,
        start_date: state.start,
        end_date: isoDate(end),
        days: total,
        people: state.people,
        help: state.help,
        wants: data.getAll('wants').map(String),
        name,
        email,
        whatsapp,
        country: String(data.get('country') || '').trim(),
        message: String(data.get('message') || '').trim().slice(0, 2000),
        estimate_usd: `${cost.total[0]}-${cost.total[1]}`,
        plan_url: planUrl,
        plan_text: planText(),
      };
      submit.disabled = true;
      status.className = 'send-status';
      status.textContent = 'Sending…';
      const res = await submitTripRequest(request);
      submit.disabled = false;
      if (res.ok) {
        const done =
          res.via === 'database'
            ? ['Thank you. Your request has reached TrekkSewa.', `We will reply ${email ? `to ${email}` : `on ${whatsapp}`}. Keep a copy of your plan: print it or save it below.`]
            : res.via === 'whatsapp'
              ? ['WhatsApp has opened with your plan.', 'Press send there to finish. If it did not open, use the buttons below instead.']
              : ['Your email program has opened with your plan.', 'Press send there to finish. If it did not open, use the buttons below instead.'];
        form.replaceWith(h('div', { class: 'send-done', role: 'status', tabindex: '-1' }, ic('circle-check', 34), h('h3', {}, done[0]), h('p', {}, done[1])));
        $('.send-done', root)?.focus();
      } else {
        status.className = 'send-status is-error';
        status.replaceChildren(h('strong', {}, 'That did not go through. '), res.message || 'Please try again, or send the plan yourself with the buttons below.');
      }
    });
    return h(
      'section',
      { class: 'plan-section', id: 'send', 'aria-labelledby': 'send-h' },
      h('h2', { id: 'send-h' }, 'Get help arranging it'),
      h('p', {}, `Send this plan to TrekkSewa and a person will reply with what it would cost and who can take you. It costs nothing to ask, and you are not committing to anything. ${title}.`),
      form,
      h('h3', { class: 'no-print' }, 'Or send the plan to someone yourself'),
      shareBtns,
    );
  }

  // ------------------------------------------------------------------ draw
  async function render(announce = false) {
    const step = stepOf(state);
    let base;
    try {
      base = await loadBase();
    } catch {
      show(failed(), announce);
      return;
    }
    const [treks, figures] = base;
    const t = state.trek ? treks.find((x) => x.s === state.trek) : null;
    if (state.trek && !t) {
      state = { ...state, trek: '', step: 'days' };
      history.replaceState(null, '', address(state));
      return render(announce);
    }
    if (PLAN.includes(step) && !t) return go({ step: 'days' }, { replace: true });
    if (step === 'summary' && (!state.start || !state.help)) return go({ step: !state.start ? 'date' : 'help' }, { replace: true });
    if (step === 'summary' && helpOptions(t).find((o) => o.id === state.help)?.blocked) return go({ step: 'help', help: '' }, { replace: true });

    if (step === 'level') return show(stepLevel(), announce);
    if (step === 'month') return show(stepMonth(), announce);
    if (step === 'choose') return show(stepChoose(treks), announce);
    if (step === 'date') return show(stepDate(t), announce);
    if (step === 'help') return show(stepHelp(t, figures), announce);
    if (step === 'summary') {
      let detail;
      try {
        detail = await loadTrek(t.s);
      } catch {
        show(failed(), announce);
        return;
      }
      show(summary(t, figures, detail), announce);
      if (location.hash && !announce) document.getElementById(location.hash.slice(1))?.scrollIntoView();
      return;
    }
    show(stepDays(treks), announce);
  }
  render(false);
}
