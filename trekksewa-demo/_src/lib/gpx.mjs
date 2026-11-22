// GPX reading, writing and statistics. Pure functions: no DOM, so the same code runs in the
// browser and in the unit tests. The parser is deliberately tolerant; GPX files in the wild
// come from dozens of apps and devices.

import { haversineKm } from './geo.mjs';

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
};
const child = (body, name) => {
  const m = body.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i'));
  if (!m) return null;
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
};

function points(xml, tag) {
  const out = [];
  const re = new RegExp(`<(?:\\w+:)?${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${tag}>)`, 'gi');
  let m;
  while ((m = re.exec(xml))) {
    const lat = Number(attr(m[1], 'lat'));
    const lon = Number(attr(m[1], 'lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const body = m[2] || '';
    const eleText = child(body, 'ele');
    const ele = eleText === null || eleText === '' ? null : Number(eleText);
    const timeText = child(body, 'time');
    const time = timeText ? Date.parse(timeText) : NaN;
    out.push({ lat, lon, ele: Number.isFinite(ele) ? ele : null, time: Number.isFinite(time) ? time : null, name: child(body, 'name') });
  }
  return out;
}

/** Parse GPX text. Returns { name, track: [{lat, lon, ele, time}], waypoints: [{lat, lon, ele, name}] }. */
export function parseGpx(text) {
  if (typeof text !== 'string' || !/<gpx[\s>]/i.test(text)) throw new Error('This does not look like a GPX file.');
  const xml = text.replace(/<!--[\s\S]*?-->/g, '');
  let track = points(xml, 'trkpt');
  if (track.length < 2) track = points(xml, 'rtept'); // a route rather than a recorded track
  const waypoints = points(xml, 'wpt');
  if (track.length < 2 && waypoints.length < 1) throw new Error('No track, route or waypoints were found in this file.');
  const meta = xml.match(/<metadata[^>]*>([\s\S]*?)<\/metadata>/i);
  const trk = xml.match(/<trk[^>]*>([\s\S]*?)<trkseg/i);
  const name = (meta && child(meta[1], 'name')) || (trk && child(trk[1], 'name')) || null;
  return { name, track, waypoints };
}

/**
 * Distance, climb and time for a track. Elevation noise is filtered with a threshold so a
 * jittery GPS does not turn a flat path into hundreds of metres of "ascent".
 */
export function trackStats(track, { threshold = 5 } = {}) {
  let km = 0;
  let ascent = 0;
  let descent = 0;
  let min = Infinity;
  let max = -Infinity;
  let ref = null;
  const cumulative = [0];
  for (let i = 0; i < track.length; i++) {
    const p = track[i];
    if (i > 0) {
      km += haversineKm(track[i - 1], p);
      cumulative.push(km);
    }
    if (p.ele === null) continue;
    min = Math.min(min, p.ele);
    max = Math.max(max, p.ele);
    if (ref === null) ref = p.ele;
    const diff = p.ele - ref;
    if (diff >= threshold) {
      ascent += diff;
      ref = p.ele;
    } else if (diff <= -threshold) {
      descent -= diff;
      ref = p.ele;
    }
  }
  const hasEle = Number.isFinite(min);
  const times = track.filter((p) => p.time !== null).map((p) => p.time);
  const durationMs = times.length > 1 ? times[times.length - 1] - times[0] : null;
  return {
    km,
    ascent: hasEle ? Math.round(ascent) : null,
    descent: hasEle ? Math.round(descent) : null,
    min: hasEle ? Math.round(min) : null,
    max: hasEle ? Math.round(max) : null,
    points: track.length,
    durationMs: durationMs && durationMs > 0 ? durationMs : null,
    cumulative,
  };
}

/** Thin a long track to roughly `max` points, always keeping the first and last. */
export function thin(track, max = 2000) {
  if (track.length <= max) return track;
  const step = (track.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) out.push(track[Math.round(i * step)]);
  return out;
}

const xmlEsc = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);

/** Write a GPX 1.1 document for a recorded track. */
export function toGpx(track, { name = 'TrekkSewa track', creator = 'TrekkSewa' } = {}) {
  const pts = track
    .map((p) => {
      const ele = p.ele === null || p.ele === undefined ? '' : `<ele>${Number(p.ele).toFixed(1)}</ele>`;
      const time = p.time ? `<time>${new Date(p.time).toISOString()}</time>` : '';
      return `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${ele}${time}</trkpt>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="${xmlEsc(creator)}" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk>\n    <name>${xmlEsc(name)}</name>\n    <trkseg>\n${pts}\n    </trkseg>\n  </trk>\n</gpx>\n`;
}

/**
 * A route file for a whole trek: named waypoints for the stops and one track segment per
 * section of mapped path. `segments` are arrays of [lat, lon].
 */
export function routeGpx({ name, desc = '', link = '', waypoints = [], segments = [] }) {
  const wpts = waypoints
    .map((w) => `  <wpt lat="${w.lat.toFixed(5)}" lon="${w.lon.toFixed(5)}">${w.ele ? `<ele>${Math.round(w.ele)}</ele>` : ''}<name>${xmlEsc(w.name)}</name>${w.desc ? `<desc>${xmlEsc(w.desc)}</desc>` : ''}</wpt>`)
    .join('\n');
  const segs = segments.map((seg) => `    <trkseg>\n${seg.map(([lat, lon]) => `      <trkpt lat="${lat.toFixed(5)}" lon="${lon.toFixed(5)}"/>`).join('\n')}\n    </trkseg>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="TrekkSewa" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata>\n    <name>${xmlEsc(name)}</name>\n    <desc>${xmlEsc(desc)}</desc>${link ? `\n    <link href="${xmlEsc(link)}"><text>${xmlEsc(name)}</text></link>` : ''}\n    <copyright author="OpenStreetMap contributors"><license>https://opendatacommons.org/licenses/odbl/</license></copyright>\n  </metadata>\n${wpts}\n  <trk>\n    <name>${xmlEsc(name)}</name>\n${segs}\n  </trk>\n</gpx>\n`;
}
