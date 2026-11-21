// Formatting helpers shared by the build and the browser bundles. No DOM, no Node APIs.

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 5545 -> "5,545" */
export function num(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 5545 -> "5,545 m" (thin non-breaking space keeps the unit attached) */
export const metres = (n) => `${num(n)} m`;
export const feet = (n) => `${num(n * 3.28084)} ft`;
export const km = (n) => `${num(n)} km`;

/** [5, 6] -> "5–6 h", [4, 4] -> "4 h" */
export function hours(range) {
  if (!Array.isArray(range)) return '';
  const [a, b] = range;
  const f = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
  return a === b ? `${f(a)} h` : `${f(a)}–${f(b)} h`;
}

/** [12, 15] -> "12–15 days" */
export function daysRange(range) {
  if (!Array.isArray(range)) return '';
  const [a, b] = range;
  return a === b ? `${a} days` : `${a}–${b} days`;
}

/** +550 / −920 with a real minus sign */
export function signed(n) {
  if (n > 0) return `+${num(n)}`;
  if (n < 0) return `−${num(Math.abs(n))}`;
  return '0';
}

/** [3,4,5,10,11] -> "Mar–May, Oct–Nov" */
export function monthRanges(months) {
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  if (!sorted.length) return '';
  const runs = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const m = sorted[i];
    if (m === prev + 1) {
      prev = m;
      continue;
    }
    runs.push([start, prev]);
    start = m;
    prev = m;
  }
  // join a run that wraps the year end (Dec + Jan)
  if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1][1] === 12) {
    const last = runs.pop();
    runs[0] = [last[0], runs[0][1]];
    runs.push(runs.shift());
  }
  return runs.map(([a, b]) => (a === b ? MONTHS_SHORT[a - 1] : `${MONTHS_SHORT[a - 1]}–${MONTHS_SHORT[b - 1]}`)).join(', ');
}

/** "2026-11-15" -> "15 November 2026"; "2026-11" -> "November 2026" */
export function longDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m) return String(iso);
  return `${d ? `${d} ` : ''}${MONTHS[m - 1]} ${y}`;
}

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
/** 9 -> "Nine" (falls back to digits above twelve) */
export const numberWord = (n) => WORDS[n] ?? String(n);

export const titleCase = (s) => String(s).replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

export const DIFFICULTY = {
  easy: { label: 'Easy', level: 1, blurb: 'Short days below 3,500 m on good paths. Fine for a first trek.' },
  moderate: { label: 'Moderate', level: 2, blurb: 'Five to seven hour days with real climbs, usually below 4,500 m.' },
  challenging: { label: 'Challenging', level: 3, blurb: 'Long days and several nights above 4,000 m, or a pass above 5,000 m.' },
  strenuous: { label: 'Strenuous', level: 4, blurb: 'Remote, long and high, often with camping, snow or glacier travel.' },
};

export const STYLE_LABEL = { teahouse: 'Teahouse lodges', camping: 'Camping', homestay: 'Homestays' };

export const PLACE_TYPE_LABEL = {
  city: 'City',
  town: 'Town',
  village: 'Village',
  settlement: 'Lodge settlement',
  camp: 'Camp',
  'base-camp': 'Base camp',
  pass: 'Pass',
  peak: 'Peak',
  viewpoint: 'Viewpoint',
  lake: 'Lake',
  monastery: 'Monastery',
  trailhead: 'Trailhead',
  airstrip: 'Airstrip',
};

export const FACILITY_LABEL = {
  lodges: 'Lodges',
  camping: 'Camping ground',
  homestays: 'Homestays',
  shops: 'Shops',
  atm: 'ATM',
  bank: 'Bank',
  'health-post': 'Health post',
  hospital: 'Hospital',
  pharmacy: 'Pharmacy',
  'rescue-post': 'Rescue / aid post',
  wifi: 'Wi-Fi',
  charging: 'Device charging',
  'hot-shower': 'Hot shower',
  bakery: 'Bakery',
  'gear-shops': 'Gear shops',
  'permit-check': 'Permit checkpoint',
  police: 'Police post',
  airstrip: 'Airstrip',
  helipad: 'Helipad',
  bus: 'Bus',
  jeep: 'Jeep',
  monastery: 'Monastery',
  viewpoint: 'Viewpoint',
};
