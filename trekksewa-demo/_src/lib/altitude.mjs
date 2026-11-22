// Altitude maths shared by the build and the browser tools. Pure functions only.
//
// The acclimatization thresholds follow the ascent-rate advice in the Wilderness Medical
// Society practice guidelines for altitude illness: above about 3,000 m, raise your sleeping
// altitude by no more than roughly 500 m a day and add a night without gain for every
// 1,000 m or so. They are planning heuristics, not a medical assessment.

import { num } from './format.mjs';

export const ZONES = [
  { id: 'low', min: 0, max: 1500, label: 'Low altitude', note: 'No altitude effects for most people.' },
  { id: 'moderate', min: 1500, max: 2500, label: 'Moderate altitude', note: 'You may notice the climb, but altitude illness is unusual.' },
  { id: 'high', min: 2500, max: 3500, label: 'High altitude', note: 'Altitude illness is possible, especially after a fast ascent.' },
  { id: 'very-high', min: 3500, max: 5500, label: 'Very high altitude', note: 'Altitude illness is common without gradual ascent.' },
  { id: 'extreme', min: 5500, max: 9000, label: 'Extreme altitude', note: 'The body cannot fully adapt. Keep visits short.' },
];

export function zoneFor(alt) {
  return ZONES.find((z) => alt >= z.min && alt < z.max) || ZONES[ZONES.length - 1];
}

/** Barometric pressure (kPa) at altitude in a standard atmosphere. */
export function pressureKpa(alt) {
  return 101.325 * Math.pow(1 - 2.25577e-5 * alt, 5.25588);
}

/** Oxygen available per breath as a percentage of sea level. */
export function oxygenPercent(alt) {
  return Math.round((pressureKpa(alt) / 101.325) * 100);
}

/** Approximate boiling point of water in °C (useful for cooking times and water treatment). */
export function boilingPointC(alt) {
  return Math.round((100 - alt / 300) * 10) / 10;
}

export const RULES = {
  startAlt: 3000, // gains are judged once you sleep above this
  dailyGain: 500, // recommended maximum gain in sleeping altitude per day
  balancedGain: 650, // a gain up to this is acceptable when a rest night sits next to it
  bigGain: 800, // clearly too fast
  restEvery: 1000, // add a night without gain for roughly every 1,000 m
  jumpTo: 2800, // arriving to sleep above this from low altitude in one day is a risk factor
  jumpFrom: 1500,
  climbTo: 2800, // a single day that climbs this much ...
  climbGain: 1000, // ... to sleep above climbTo is worth a warning, wherever it started
};

/**
 * Analyse a list of nights. Each night is { alt, label?, day? } in order.
 * Returns the same nights annotated with gain, counted (the part of the gain above the
 * threshold), level ('ok' | 'watch' | 'high'), reasons (why it is flagged) and notes
 * (worth knowing, not a flag), plus a summary. `startAlt` is where the trek set out from.
 *
 * A gain a little over the guideline is treated as acceptable when the night before or the
 * night after is a rest night, following the guideline's advice to add an acclimatization
 * day around any unavoidable large gain.
 */
export function analyseNights(nights, startAlt) {
  const start = typeof startAlt === 'number' ? startAlt : nights.length ? nights[0].alt : 0;
  const alts = nights.map((n) => n.alt);
  const before = (i) => (i === 0 ? start : alts[i - 1]);
  const gains = alts.map((a, i) => a - before(i));
  // a rest night: no higher than the night before it, and already up at altitude
  const isRest = (i) => i >= 0 && i < alts.length && gains[i] <= 0 && alts[i] > RULES.startAlt - 500;
  // "after" also counts a descent to any lower altitude
  const eases = (i) => i < alts.length && gains[i] <= 0;

  const out = [];
  let sinceRest = 0; // metres of sleeping altitude gained above the threshold since the last rest night

  nights.forEach((n, i) => {
    const prev = before(i);
    const gain = gains[i];
    const reasons = [];
    const notes = [];
    let level = 'ok';
    let counted = 0;
    const bump = (l) => {
      if (l === 'high' || (l === 'watch' && level === 'ok')) level = l;
    };

    if (n.alt > RULES.startAlt && gain > 0) {
      counted = Math.min(gain, n.alt - Math.max(prev, RULES.startAlt));
      const balanced = isRest(i - 1) || eases(i + 1);
      if (counted > RULES.bigGain) {
        bump('high');
        reasons.push(`Sleeping altitude rises ${num(counted)} m in one day, well over the ${RULES.dailyGain} m guideline. Split the climb if you can.`);
      } else if (counted > RULES.dailyGain) {
        if (balanced && counted <= RULES.balancedGain) {
          notes.push(`Sleeping altitude rises ${counted} m, a little over the ${RULES.dailyGain} m guideline, balanced by the rest night ${isRest(i - 1) ? 'before' : 'after'} it.`);
        } else {
          bump('watch');
          reasons.push(
            balanced
              ? `Sleeping altitude rises ${counted} m, well over the ${RULES.dailyGain} m guideline even with a rest night next to it.`
              : `Sleeping altitude rises ${counted} m, over the ${RULES.dailyGain} m guideline, with no rest night before or after.`,
          );
        }
      }
      sinceRest += counted;
      if (sinceRest > RULES.restEvery + 250) {
        bump(sinceRest > RULES.restEvery + 700 ? 'high' : 'watch');
        reasons.push(`About ${num(Math.round(sinceRest / 50) * 50)} m gained above ${num(RULES.startAlt)} m without a rest night.`);
      }
    }
    if (n.alt >= RULES.jumpTo && prev < RULES.jumpFrom) {
      bump(n.alt >= 3500 ? 'high' : 'watch');
      reasons.push(`A jump from ${num(prev)} m to sleep at ${num(n.alt)} m in a single day.`);
    } else if (n.alt >= RULES.climbTo && gain >= RULES.climbGain && !reasons.length) {
      // a long climb from the middle hills to a first high night: the 500 m rule above 3,000 m
      // does not see it, but a body that slept at 2,000 m last night is not ready for 3,300 m
      bump('watch');
      reasons.push(`A climb of ${num(gain)} m in one day, to sleep at ${num(n.alt)} m. Go slowly, drink plenty, and say so if you get a headache.`);
    }
    if (gain <= 0 || n.alt <= RULES.startAlt) sinceRest = 0; // a night at the same height or lower resets the count

    out.push({ ...n, gain, counted, level, reasons, notes });
  });

  const above = (m) => out.filter((n) => n.alt >= m).length;
  const gains2 = out.filter((n) => n.counted > 0);
  const biggest = gains2.reduce((a, b) => (b.counted > (a?.counted ?? -1) ? b : a), null);
  const maxSleep = out.reduce((a, b) => (b.alt > (a?.alt ?? -1) ? b : a), null);
  return {
    nights: out,
    summary: {
      maxSleep,
      biggestGain: biggest,
      nightsAbove3000: above(3000),
      nightsAbove4000: above(4000),
      nightsAbove5000: above(5000),
      watch: out.filter((n) => n.level === 'watch').length,
      high: out.filter((n) => n.level === 'high').length,
    },
  };
}

// ---------------------------------------------------------------------------------------
// Lake Louise Acute Mountain Sickness score (2018 revision, Roach et al., High Alt Med Biol).
// Four symptoms scored 0–3. AMS = headache ≥ 1 and total ≥ 3 after a recent gain in altitude.

export const LLS_ITEMS = [
  {
    id: 'headache',
    label: 'Headache',
    options: ['No headache', 'Mild headache', 'Moderate headache', 'Severe headache that stops me doing things'],
  },
  {
    id: 'gut',
    label: 'Stomach',
    options: ['Good appetite', 'Poor appetite or feeling a little sick', 'Moderate nausea or vomiting', 'Severe nausea and vomiting that stops me doing things'],
  },
  {
    id: 'fatigue',
    label: 'Tiredness or weakness',
    options: ['Not tired or weak', 'Mild tiredness or weakness', 'Moderate tiredness or weakness', 'Severe tiredness or weakness that stops me doing things'],
  },
  {
    id: 'dizzy',
    label: 'Dizziness or light-headedness',
    options: ['No dizziness', 'Mild dizziness', 'Moderate dizziness', 'Severe dizziness that stops me doing things'],
  },
];

export const LLS_FUNCTION = {
  id: 'function',
  label: 'Overall, how have your symptoms affected what you could do?',
  options: [
    'Not at all',
    'Symptoms are there, but I carried on as planned',
    'I had to stop going up, or walked down under my own power',
    'I had to be helped or evacuated to a lower altitude',
  ],
};

// Danger signs of high-altitude cerebral or pulmonary oedema. Any one of these means descend now.
export const RED_FLAGS = [
  { id: 'ataxia', group: 'HACE', label: 'Staggering, or cannot walk heel-to-toe in a straight line' },
  { id: 'confusion', group: 'HACE', label: 'Confused, unusually drowsy, irritable or behaving oddly' },
  { id: 'headache-severe', group: 'HACE', label: 'Severe headache that painkillers do not ease, or repeated vomiting' },
  { id: 'breathless-rest', group: 'HAPE', label: 'Breathless while resting, or far more breathless than companions' },
  { id: 'cough', group: 'HAPE', label: 'Wet, gurgling cough, or frothy or pink spit' },
  { id: 'chest', group: 'HAPE', label: 'Tight chest, blue lips, or a sudden drop in walking performance' },
];

/**
 * answers: { headache, gut, fatigue, dizzy } each 0–3; flags: array of red-flag ids;
 * context: { altitude?: number, recentAscent?: boolean }
 */
export function scoreLakeLouise(answers, flags = [], context = {}) {
  const v = (k) => Math.max(0, Math.min(3, Number(answers?.[k]) || 0));
  const headache = v('headache');
  const total = headache + v('gut') + v('fatigue') + v('dizzy');
  const hasAms = headache >= 1 && total >= 3;
  let severity = 'none';
  if (hasAms) severity = total >= 10 ? 'severe' : total >= 6 ? 'moderate' : 'mild';
  const redFlags = RED_FLAGS.filter((f) => flags.includes(f.id));
  const lowAltitude = typeof context.altitude === 'number' && context.altitude < 2500;
  let verdict;
  if (redFlags.length) verdict = 'emergency';
  else if (severity === 'severe') verdict = 'descend';
  else if (severity === 'moderate') verdict = 'stop';
  else if (severity === 'mild') verdict = 'rest';
  else if (total > 0) verdict = 'watch';
  else verdict = 'clear';
  return { total, headache, hasAms, severity, redFlags, verdict, lowAltitude };
}
