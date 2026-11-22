import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rate, suggest, walkStats, helpOptions, estimate, permitTotal, startIdeas, insuranceTier, parseAmount } from '../../lib/plan.mjs';

// a small cast of treks in the shape of data/treks.json
const day = (h, extra = {}) => ({ t: 'x', to: 'y', a: 2000, h, k: 'trek', ...extra });
const trek = (over) => ({ s: 'x', n: 'X', r: 'annapurna', rn: 'Annapurna', d: 5, dr: [4, 6], g: 'easy', st: ['teahouse'], best: [3, 4, 10, 11], good: [2, 5, 9, 12], p: [], ra: 0, gr: 'optional', hi: 2800, it: [day([4, 5]), day([4, 5]), day([5, 6]), day([3, 4])], ...over });
const poonHill = trek({ s: 'poon-hill', n: 'Poon Hill', d: 5, dr: [4, 6], g: 'easy', hi: 2860, f: 6 });
const abc = trek({ s: 'abc', n: 'ABC', d: 8, dr: [6, 11], g: 'moderate', hi: 4130, gr: 'required', f: 2, it: [day([5, 6]), day([5, 6]), day([6, 7]), day([4, 5])] });
const ebc = trek({ s: 'ebc', n: 'EBC', d: 12, dr: [12, 15], g: 'challenging', hi: 5164, fl: 1, f: 1, it: [day([3, 4]), day([5, 6]), day([7, 8], { k: 'trek' }), day([2, 3], { k: 'acclimatization' })] });
const mustang = trek({ s: 'mustang', n: 'Upper Mustang', d: 12, dr: [10, 14], g: 'moderate', hi: 3810, ra: 1, gr: 'required', best: [5, 6, 7, 8, 9], good: [4, 10] });
const dolpo = trek({ s: 'dolpo', n: 'Upper Dolpo', d: 21, dr: [18, 24], g: 'strenuous', hi: 4900, ra: 1, cg: 1, st: ['camping'], gr: 'required' });
const all = [poonHill, abc, ebc, mustang, dolpo];

test('typical and longest walking day ignore rest days and rides', () => {
  const s = walkStats([day([4, 5]), day([5, 6]), day([8, 9], { m: 'jeep' }), day([2, 3], { k: 'acclimatization' }), day([6, 7])]);
  assert.deepEqual(s.typical, [5, 6]);
  assert.equal(s.longest, 7);
  assert.equal(s.walkingDays, 3);
});

test('a gentle walker is never offered a high or hard trek', () => {
  const picks = suggest(all, { days: 'any', level: 'gentle', month: 10 }).map((r) => r.trek.s);
  assert.deepEqual(picks, ['poon-hill']);
});

test('gentle stretches to a moderate trek only if it stays low with short days', () => {
  const low = trek({ s: 'low', g: 'moderate', hi: 3200, it: [day([4, 5]), day([5, 6])] });
  assert.ok(rate(low, { level: 'gentle' }));
  assert.equal(rate(abc, { level: 'gentle' }), null);
});

test('length of the trek has to be near the time available', () => {
  assert.equal(rate(ebc, { days: 'short' }), null);
  assert.ok(rate(abc, { days: 'week' }).why.some((w) => w.includes('8 days')));
  const stretch = rate(abc, { days: 'short' });
  assert.ok(stretch === null || stretch.care.some((c) => c.includes('more than you have')));
});

test('a hard month is flagged and sorted last', () => {
  const r = suggest(all, { days: 'any', level: 'steady', month: 7 });
  assert.equal(r[0].trek.s, 'mustang'); // the rain-shadow trek leads in the monsoon
  assert.ok(r.find((x) => x.trek.s === 'abc').hardMonth);
  assert.ok(r.findIndex((x) => x.hardMonth) > r.findIndex((x) => !x.hardMonth));
});

test('cautions name altitude, guide rule, restricted area and flights', () => {
  const e = rate(ebc, { level: 'tough' }).care.join(' ');
  assert.match(e, /5,164 m/);
  assert.match(e, /mountain flight/);
  assert.match(rate(abc, { level: 'steady' }).care.join(' '), /licensed guide is required/);
  assert.match(rate(mustang, { level: 'steady' }).care.join(' '), /restricted area/);
});

test('the rules decide which kinds of help are offered', () => {
  const open = (t) => helpOptions(t).filter((o) => !o.blocked).map((o) => o.id);
  assert.deepEqual(open(poonHill), ['agency', 'guide-porter', 'guide', 'porter', 'self']);
  assert.deepEqual(open(abc), ['agency', 'guide-porter', 'guide']);
  assert.deepEqual(open(mustang), ['agency']);
  assert.deepEqual(open(dolpo), ['agency']);
});

const rates = { guide: [25, 40], porter: [18, 25], food: 36, npr: 140 };

test('an estimate adds up, and sharing a guide makes it cheaper', () => {
  const solo = estimate({ days: 8, people: 1, help: 'guide', rates, permitsUsd: 36 });
  const pair = estimate({ days: 8, people: 2, help: 'guide', rates, permitsUsd: 36 });
  const sum = (e, k) => e.items.reduce((s, i) => s + i[k], 0);
  assert.ok(Math.abs(sum(solo, 'low') - solo.total[0]) <= 10);
  assert.ok(Math.abs(sum(solo, 'high') - solo.total[1]) <= 10);
  assert.ok(pair.total[1] < solo.total[1]);
  assert.ok(solo.total[0] < solo.total[1]);
  assert.ok(solo.items.some((i) => i.label === 'A guide'));
  assert.ok(!estimate({ days: 8, people: 1, help: 'self', rates, permitsUsd: 36 }).items.some((i) => /guide|porter|Tips/.test(i.label)));
});

test('a company package is used when one is known, and transport is added otherwise', () => {
  const pkg = estimate({ days: 8, people: 2, help: 'agency', rates, permitsUsd: 36, pkg: { low: 700, high: 1100 } });
  assert.equal(pkg.packaged, true);
  assert.equal(pkg.items[0].low, 700);
  assert.ok(pkg.total[0] >= 700 && pkg.total[1] >= 1100);
  const own = estimate({ days: 8, people: 2, help: 'guide-porter', rates, permitsUsd: 36, transport: [25, 55], transportNote: 'Bus.' });
  assert.equal(own.packaged, false);
  assert.deepEqual(
    own.items.filter((i) => i.label === 'Getting to the start and back').map((i) => [i.low, i.high, i.note]),
    [[25, 55, 'Bus.']],
  );
  assert.ok(own.cashNpr > 0 && own.cashNpr % 1000 === 0);
});

test('permit fees: flat, per day, and a first week with extra days', () => {
  const permits = {
    acap: { short: 'ACAP', fees: [{ who: 'Foreign nationals', amount: 'NPR 3,000', per: 'person, single entry' }] },
    mustang: { short: 'Upper Mustang RAP', fees: [{ who: 'All foreign nationals', amount: 'USD 50', per: 'person per day' }] },
    manaslu: { short: 'Manaslu RAP', fees: [{ who: 'September to November', amount: 'USD 100', per: 'person for the first 7 days, then USD 15 a day' }] },
  };
  assert.equal(Math.round(permitTotal(['acap'], 8, 140, permits).total), 21);
  assert.equal(permitTotal(['mustang'], 10, 140, permits).total, 500);
  assert.equal(permitTotal(['manaslu'], 10, 140, permits).total, 145);
  assert.deepEqual(parseAmount('about NPR 3,000 each'), { cur: 'NPR', amount: 3000 });
});

test('start ideas fall in good months and leave time to prepare', () => {
  const today = new Date(2026, 10, 22); // 22 November 2026
  const ideas = startIdeas(abc, today);
  assert.ok(ideas.length >= 3);
  for (const idea of ideas) {
    const [y, m, d] = idea.date.split('-').map(Number);
    assert.ok(new Date(y, m - 1, d) - today >= 10 * 86400000);
    assert.ok(abc.best.includes(m) || abc.good.includes(m));
  }
  assert.ok(ideas[0].best);
});

test('a month the visitor named comes first, even a hard one', () => {
  const today = new Date(2026, 10, 22);
  const october = startIdeas(abc, today, 4, 10);
  assert.equal(october.length, 4);
  assert.deepEqual([october[0].date, october[0].chosen, october[0].best], ['2027-10-10', true, true]);
  assert.equal(new Set(october.map((i) => i.date)).size, 4); // the chosen month is not offered twice
  const july = startIdeas(abc, today, 4, 7)[0];
  assert.deepEqual([july.date, july.chosen, july.best, july.good], ['2027-07-10', true, false, false]);
  // this month is too close to arrange: the next one of the same name is offered
  assert.equal(startIdeas(abc, today, 4, 11)[0].date, '2027-11-10');
});

test('insurance band is the first one at or above the highest point', () => {
  assert.equal(insuranceTier(3210), 4000);
  assert.equal(insuranceTier(4130), 4500);
  assert.equal(insuranceTier(5545), 6000);
  assert.equal(insuranceTier(6189), 6500);
});
