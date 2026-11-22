// Trek planning logic shared by the build, the tests and the browser:
// which treks suit a few plain answers, what a trip may cost, and dates.

import { MONTHS, num } from './format.mjs';

// What a day of meals and a lodge bed costs one person, in USD, by region.
// Checked against content/facts.json (teahouseDailyCost) whenever that changes.
// 2026 agency estimates: Annapurna and Langtang USD 25-50, Everest USD 35-65. The estimate
// spreads 15% below and 20% above these, which covers those ranges.
export const FOOD_PER_DAY = { everest: 48, annapurna: 36, mustang: 42, langtang: 36, manaslu: 40, dhaulagiri: 38, eastern: 38, western: 40, gaurishankar: 34, kathmandu: 30 };
// Rupees to the US dollar. Nepal Rastra Bank's rate on 11 November 2026 was 151.89 buying and
// 152.49 selling. The rupee is pegged to the Indian rupee, so it drifts rather than jumps:
// look again every few months (nrb.org.np/forex).
export const NPR_PER_USD = 152;
// Travel insurers sell trekking cover in altitude bands; the band is set by the highest point reached.
const TIERS = [3000, 4000, 4500, 5000, 5500, 6000];
export const insuranceTier = (maxMetres) => TIERS.find((t) => t >= maxMetres) || Math.ceil(maxMetres / 500) * 500;

// ------------------------------------------------------------------ the three questions

export const DAY_CHOICES = [
  { id: 'short', label: 'A short walk', sub: '2 to 5 days', range: [1, 5] },
  { id: 'week', label: 'About a week', sub: '6 to 9 days', range: [6, 9] },
  { id: 'fortnight', label: 'About two weeks', sub: '10 to 15 days', range: [10, 15] },
  { id: 'long', label: 'A long journey', sub: '16 days or more', range: [16, 99] },
  { id: 'any', label: 'I am not sure yet', sub: 'Show me everything', range: [1, 99] },
];

export const LEVEL_CHOICES = [
  { id: 'gentle', label: 'Gentle', sub: 'Three to five hours a day on good paths, staying fairly low. Right for a first trek or if you like to take your time.' },
  { id: 'steady', label: 'Steady', sub: 'Five to six hours a day with some long climbs. You walk regularly and are comfortable on hills.' },
  { id: 'tough', label: 'Tough', sub: 'Long days, high passes and thin air. You are very fit and have walked in mountains before.' },
];

// how well each grade of trek suits each answer; a missing entry means "do not suggest"
const LEVEL_FIT = {
  gentle: { easy: 3, moderate: 1.5 },
  steady: { easy: 2, moderate: 3, challenging: 1.5 },
  tough: { easy: 1, moderate: 2, challenging: 3, strenuous: 3 },
};

const median = (list) => {
  const a = [...list].sort((x, y) => x - y);
  return a.length ? a[Math.floor((a.length - 1) / 2)] : 0;
};

/** Typical and longest walking day of an itinerary (hours). */
export function walkStats(days) {
  const walking = days.filter((d) => d.h && !d.m && d.k !== 'rest' && d.k !== 'acclimatization');
  if (!walking.length) return { typical: [0, 0], longest: 0, walkingDays: 0 };
  return { typical: [median(walking.map((d) => d.h[0])), median(walking.map((d) => d.h[1]))], longest: Math.max(...walking.map((d) => d.h[1])), walkingDays: walking.length };
}

/**
 * How well one trek suits the answers. Returns null when it should not be suggested at all.
 * `t` is an entry of data/treks.json; `a` is { days, level, month }.
 */
export function rate(t, a = {}) {
  const why = [];
  const care = [];
  let score = 0;
  const stats = walkStats(t.it);

  // --- time
  const choice = DAY_CHOICES.find((c) => c.id === a.days);
  if (choice && choice.id !== 'any') {
    const [lo, hi] = choice.range;
    if (t.d >= lo && t.d <= hi) {
      score += 3;
      why.push(`It takes about ${t.d} days, which fits the time you have.`);
    } else if (t.dr[0] <= hi && t.dr[1] >= lo) {
      score += 2;
      why.push(`It usually takes ${t.d} days, and can be done in ${Math.max(t.dr[0], lo)} to ${Math.min(t.dr[1], hi)}.`);
    } else {
      const gap = t.d < lo ? lo - t.d : t.d - hi;
      if (gap > 3) return null;
      score += 0.5;
      care.push(t.d > hi ? `It needs about ${t.d} days, a little more than you have.` : `It is shorter than you asked for: about ${t.d} days.`);
    }
  } else score += 2;

  // --- effort
  if (a.level) {
    const fit = LEVEL_FIT[a.level]?.[t.g];
    if (fit === undefined) return null;
    // "gentle" stretches to a moderate trek only when it stays low, the days stay short, and
    // no night climbs faster than the height check allows (t.up counts the nights it flags)
    if (a.level === 'gentle' && t.g === 'moderate' && (t.hi >= 3700 || stats.longest > 7 || t.up)) return null;
    score += fit;
    if (a.level === 'gentle') score += t.hi < 3000 ? 1 : t.hi < 3600 ? 0.5 : 0;
  } else score += 2;
  if (stats.walkingDays) why.push(stats.typical[0] === stats.typical[1] ? `Most days are about ${stats.typical[0]} hours of walking.` : `Most days are ${stats.typical[0]} to ${stats.typical[1]} hours of walking.`);

  // --- season
  let hardMonth = false;
  if (a.month) {
    const name = MONTHS[a.month - 1];
    if (t.best.includes(a.month)) {
      score += 3;
      why.push(`${name} is one of the best months for it.`);
    } else if (t.good.includes(a.month)) {
      score += 2;
      why.push(`${name} is a good month for it.`);
    } else {
      hardMonth = true;
      score -= 2;
      care.push(`${name} is a hard month for this trek. Look at "When to go" before you decide.`);
    }
  } else score += 1.5;

  // --- how you sleep and how high
  const camping = t.st.includes('camping') && !t.st.includes('teahouse');
  if (camping) {
    care.push('You sleep in tents, so it needs a full camping crew arranged by an agency.');
    if (a.level !== 'tough') score -= 1;
  }
  if (t.hi >= 5000) care.push(`You sleep as high as ${num(t.hi)} m. That is very high: the plan must climb slowly, with rest days.`);
  else if (t.hi >= 4000) care.push(`You sleep as high as ${num(t.hi)} m. Most people feel the altitude, so the plan climbs slowly.`);
  else if (t.hi >= 3000) why.push(`The highest night is at ${num(t.hi)} m: you will notice the altitude, but it is rarely a problem if you go slowly.`);
  else why.push(`You never sleep above ${num(t.hi)} m, so altitude is not a worry.`);
  // a long climb to a first high night, on a trek that is otherwise low enough not to mention
  if (t.up && t.hi < 4000) care.push('One day climbs a long way to a high night. The plan marks it, so you can take it slowly.');

  // --- paperwork and access
  if (t.ra) care.push('It is a restricted area: a registered trekking agency must arrange your permit.');
  else if (t.gr === 'required') care.push('A licensed guide is required on this route.');
  if (t.fl) care.push('It starts with a short mountain flight that the weather often delays. Keep a spare day or two.');

  // well-trodden routes have more lodges, clearer paths and more help at hand
  if (t.f) score += Math.max(0, 0.7 - 0.04 * t.f);
  return { trek: t, score, why: why.slice(0, 3), care: care.slice(0, 3), hardMonth, stats };
}

/** Treks that suit the answers, best first. Hard-month treks go last. */
export function suggest(treks, answers) {
  return treks
    .map((t) => rate(t, answers))
    .filter(Boolean)
    .sort((x, y) => Number(x.hardMonth) - Number(y.hardMonth) || y.score - x.score || x.trek.d - y.trek.d);
}

// ------------------------------------------------------------------ help on the trail

export const HELP_CHOICES = [
  { id: 'agency', label: 'A trekking company arranges everything', sub: 'They book your guide, porter, permits, transport and beds, and look after you if anything goes wrong. The easiest way, and the usual choice for a first trek.' },
  { id: 'guide-porter', label: 'A guide walks with me and a porter carries my bag', sub: 'You walk with a small day bag. The guide finds the way, books beds and watches how you cope with the altitude.' },
  { id: 'guide', label: 'A guide walks with me', sub: 'You carry your own pack. The guide finds the way, books beds and handles any problem.' },
  { id: 'porter', label: 'A porter carries my bag', sub: 'You find your own way and book your own beds. The porter carries up to 20 to 25 kg for you.' },
  { id: 'self', label: 'I will go on my own', sub: 'You carry everything and arrange everything yourself.' },
];

/** Which kinds of help make sense for a trek, with the reason when one is ruled out. */
export function helpOptions(t) {
  return HELP_CHOICES.map((c) => {
    let blocked = '';
    if (t.ra && (c.id === 'self' || c.id === 'porter' || c.id === 'guide' || c.id === 'guide-porter')) blocked = 'Not possible here: restricted-area permits are issued only through a registered agency.';
    else if (t.gr === 'required' && (c.id === 'self' || c.id === 'porter')) blocked = 'The rules require a licensed guide on this route.';
    else if (t.cg && c.id !== 'agency') blocked = 'This is a camping trek: tents, food and crew have to be organised by an agency.';
    return { ...c, blocked };
  });
}

// ------------------------------------------------------------------ money

/** "NPR 3,000" / "USD 50" -> { cur, amount } for the first figure in the text. */
export function parseAmount(text) {
  const m = String(text).match(/(NPR|USD)\s*([\d,]+(?:\.\d+)?)/i);
  return m ? { cur: m[1].toUpperCase(), amount: Number(m[2].replace(/,/g, '')) } : null;
}

/**
 * Permit cost per foreign trekker in USD. Fees quoted per day or per week are scaled by the
 * length of the trek, which overstates them slightly: that is the safe direction.
 * `permits` maps id -> { short, fees: [{ who, amount, per }], verified }.
 */
export function permitTotal(ids, days, rate, permits) {
  let total = 0;
  const parts = [];
  for (const id of ids) {
    const p = permits[id];
    if (!p) continue;
    const fee = p.fees.find((f) => /foreign/i.test(f.who)) || p.fees[0];
    const base = parseAmount(fee.amount);
    if (!base) continue;
    let amount = base.amount;
    const per = `${fee.per || ''} ${fee.amount}`.toLowerCase();
    if (/per day|a day\b/.test(per) && !/first|then/.test(per)) amount = base.amount * days;
    else if (/per week/.test(per) && !/first \d+ days/.test(per)) amount = base.amount * Math.ceil(days / 7);
    else {
      const first = per.match(/first (\d+) days/);
      const extra = per.match(/then (?:npr|usd)\s*([\d,]+) a day/);
      if (first && extra && days > Number(first[1])) amount += (days - Number(first[1])) * Number(extra[1].replace(/,/g, ''));
    }
    total += base.cur === 'NPR' ? amount / rate : amount;
    parts.push({ id, short: p.short, cur: base.cur, amount, verified: p.verified !== false });
  }
  return { total, parts };
}

const round = (v, step) => Math.round(v / step) * step;

/**
 * What a trip may cost one person, as honest low-to-high ranges in USD.
 * `rates` = { guide: [lo, hi], porter: [lo, hi], food: perDay, npr } ; `pkg` = { low, high } | null.
 */
export function estimate({ days, people = 1, help = 'guide', rates, permitsUsd = 0, transport = [0, 0], transportNote = '', pkg = null }) {
  const n = Math.max(1, people);
  const items = [];
  const add = (label, low, high, note) => items.push({ label, low: Math.round(low), high: Math.round(high), note });
  const food = [rates.food * 0.85, rates.food * 1.2].map((v) => v * days);

  if (help === 'agency' && pkg) {
    add('A full package from a trekking company', pkg.low, pkg.high, 'Guide, porter, permits, transport, beds and meals. Based on prices published by several companies.');
    add('Drinks, hot showers, charging and tips', days * 8 + 60, days * 15 + 120, 'Paid in cash on the trail.');
  } else {
    const guides = help === 'agency' || help === 'guide' || help === 'guide-porter' ? 1 : 0;
    const porters = help === 'agency' || help === 'guide-porter' || help === 'porter' ? Math.ceil(n / 2) : 0;
    const wages = [0, 1].map((i) => (guides * rates.guide[i] + porters * rates.porter[i]) * days);
    add('Meals and a bed each night', food[0], food[1], `${days} days in lodges. Food costs more the higher you go.`);
    if (guides) add(n > 1 ? `Your share of the guide (${n} people)` : 'A guide', (guides * rates.guide[0] * days) / n, (guides * rates.guide[1] * days) / n, 'Daily wage. Ask whether it covers their food, bed and insurance: it usually does.');
    if (porters) add(porters > 1 || n > 1 ? `Your share of ${porters === 1 ? 'the porter' : `${porters} porters`}` : 'A porter', (porters * rates.porter[0] * days) / n, (porters * rates.porter[1] * days) / n, 'One porter carries for two trekkers.');
    if (guides || porters) add('Tips', (wages[0] * 0.1) / n, (wages[1] * 0.15) / n, 'Usual at the end of the trek.');
    if (help === 'agency') add('Company service charge', (wages[0] + food[0] * n) * 0.1 / n, (wages[1] + food[1] * n) * 0.2 / n, 'For arranging staff, permits and transport.');
    add('Permits', permitsUsd, permitsUsd, 'Park and conservation fees for a foreign visitor.');
    if (transport[1]) add('Getting to the start and back', transport[0], transport[1], transportNote);
    add('Drinks, hot showers and charging', days * 4, days * 9, 'Small extras add up at altitude.');
  }
  const low = items.reduce((s, i) => s + i.low, 0);
  const high = items.reduce((s, i) => s + i.high, 0);
  const buffer = [low * 0.1, high * 0.1];
  add('Something in reserve', buffer[0], buffer[1], 'For an extra night, a delayed flight or a change of plan.');
  // what has to be in your pocket on the trail, in rupees: lodges, tips and extras take cash only
  const packaged = help === 'agency' && pkg;
  const cashUsd = packaged ? days * 15 + 120 : food[1] + days * 9 + (items.find((i) => i.label === 'Tips')?.high || 0);
  return { items, total: [round(low + buffer[0], 10), round(high + buffer[1], 10)], cashNpr: round(cashUsd * 1.1 * rates.npr, 1000), packaged: Boolean(packaged) };
}

// ------------------------------------------------------------------ dates

export const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseDate = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * Good moments to start a trek: the 10th of each of the next best (then good) months, from
 * `today` on. A month the visitor already named (`wanted`, 1 to 12) always comes first, even
 * when it is a hard month for this trek, so the answer they gave is never lost.
 * Returns [{ date, label, best, good, chosen? }].
 */
export function startIdeas(t, today = new Date(), count = 4, wanted = 0) {
  const soonest = addDays(today, 10); // any sooner is too soon to arrange anything
  const out = [];
  let chosen = null;
  for (let i = 0; i < 18; i++) {
    const day = new Date(today.getFullYear(), today.getMonth() + i, 10);
    if (day < soonest) continue;
    const m = day.getMonth() + 1;
    const idea = { date: isoDate(day), label: `${MONTHS[m - 1]} ${day.getFullYear()}`, best: t.best.includes(m), good: t.good.includes(m) };
    if (m === wanted && !chosen) chosen = { ...idea, chosen: true };
    else if ((idea.best || idea.good) && out.length < count) out.push(idea);
  }
  // the nearest few months, leading with the best ones when there are any
  out.sort((a, b) => Number(b.best) - Number(a.best) || a.date.localeCompare(b.date));
  return [...(chosen ? [chosen] : []), ...out].slice(0, count);
}
