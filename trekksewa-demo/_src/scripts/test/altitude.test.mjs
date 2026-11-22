import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseNights, scoreLakeLouise, zoneFor, oxygenPercent, RULES } from '../../lib/altitude.mjs';

const levels = (alts, start = 1400) => analyseNights(alts.map((alt) => ({ alt })), start).nights.map((n) => n.level);

test('standard Everest Base Camp itinerary is balanced by its rest days', () => {
  const ebc = [2610, 3440, 3440, 3860, 4410, 4410, 4940, 5164, 4240, 3440, 2860, 1400];
  const r = analyseNights(ebc.map((alt) => ({ alt })), 1400);
  assert.deepEqual(r.nights.map((n) => n.level), Array(12).fill('ok'));
  assert.equal(r.summary.nightsAbove4000, 5);
  assert.equal(r.summary.maxSleep.alt, 5164);
  assert.equal(r.summary.biggestGain.counted, 550);
  assert.ok(r.nights[4].notes.length === 1, 'Dingboche gain is noted, not flagged');
});

test('the same climb without rest days is flagged', () => {
  const l = levels([2610, 3440, 3860, 4410, 4940, 5164]);
  assert.equal(l[3], 'watch'); // +550 with no rest either side
  assert.notEqual(l[4], 'ok'); // +530 and over 1,000 m without a rest night
});

test('a single-day gain over the big-gain limit is always high', () => {
  assert.equal(levels([3540, 3540, 4450, 4450])[2], 'high'); // +910 even between rest nights
});

test('only the gain above the threshold counts', () => {
  const r = analyseNights([{ alt: 2610 }, { alt: 3440 }], 1400);
  assert.equal(r.nights[1].gain, 830);
  assert.equal(r.nights[1].counted, 440);
  assert.equal(r.nights[1].level, 'ok');
});

test('flying or driving straight to altitude is flagged', () => {
  assert.equal(levels([2860], 1400)[0], 'watch');
  assert.equal(levels([3650], 1300)[0], 'high');
  assert.equal(levels([2610], 1400)[0], 'ok');
});

test('a long climb to a first high night is flagged even from the middle hills', () => {
  // Charikot to Kuri: only 370 m of the gain is above 3,000 m, which the 500 m rule passes
  const r = analyseNights([{ alt: 1970 }, { alt: 3370 }, { alt: 3370 }], 1400);
  assert.equal(r.nights[1].level, 'watch');
  assert.match(r.nights[1].reasons.join(' '), /climb of 1,400 m in one day, to sleep at 3,370 m/);
  // Phakding to Namche gains less than 1,000 m and stays as it was
  assert.equal(analyseNights([{ alt: 2610 }, { alt: 3440 }], 1400).nights[1].level, 'ok');
  // and a long climb that stays below 2,800 m is no concern
  assert.equal(analyseNights([{ alt: 1200 }, { alt: 2500 }], 800).nights[1].level, 'ok');
});

test('low treks are never flagged', () => {
  assert.ok(levels([1900, 2500, 2850, 2000, 1100], 820).every((l) => l === 'ok'));
});

test('Lake Louise scoring follows the 2018 definition', () => {
  assert.equal(scoreLakeLouise({ headache: 0, gut: 2, fatigue: 2, dizzy: 1 }).hasAms, false, 'no headache means no AMS');
  assert.equal(scoreLakeLouise({ headache: 1, gut: 1, fatigue: 0, dizzy: 0 }).hasAms, false, 'total below 3');
  const mild = scoreLakeLouise({ headache: 1, gut: 1, fatigue: 1, dizzy: 0 });
  assert.deepEqual([mild.total, mild.severity, mild.verdict], [3, 'mild', 'rest']);
  assert.equal(scoreLakeLouise({ headache: 2, gut: 2, fatigue: 1, dizzy: 1 }).severity, 'moderate');
  assert.equal(scoreLakeLouise({ headache: 3, gut: 3, fatigue: 2, dizzy: 2 }).verdict, 'descend');
  assert.equal(scoreLakeLouise({ headache: 0, gut: 0, fatigue: 0, dizzy: 0 }).verdict, 'clear');
  assert.equal(scoreLakeLouise({ headache: 0, gut: 1, fatigue: 0, dizzy: 0 }).verdict, 'watch');
});

test('any danger sign overrides the score', () => {
  const r = scoreLakeLouise({ headache: 0, gut: 0, fatigue: 0, dizzy: 0 }, ['ataxia']);
  assert.equal(r.verdict, 'emergency');
  assert.equal(r.redFlags.length, 1);
});

test('answers outside 0–3 are clamped', () => {
  assert.equal(scoreLakeLouise({ headache: 9, gut: -2, fatigue: 'x', dizzy: 1 }).total, 4);
});

test('zones and oxygen', () => {
  assert.equal(zoneFor(1400).id, 'low');
  assert.equal(zoneFor(3440).id, 'high');
  assert.equal(zoneFor(5164).id, 'very-high');
  assert.equal(zoneFor(5545).id, 'extreme');
  assert.equal(oxygenPercent(0), 100);
  assert.ok(oxygenPercent(5364) > 48 && oxygenPercent(5364) < 56);
  assert.equal(RULES.dailyGain, 500);
});
