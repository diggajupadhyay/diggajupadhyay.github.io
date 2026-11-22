// Small geographic helpers shared by the build and the browser.

const R = 6371; // km
const rad = (d) => (d * Math.PI) / 180;

export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bounds(points) {
  let s = 90;
  let w = 180;
  let n = -90;
  let e = -180;
  for (const p of points) {
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
    w = Math.min(w, p.lon);
    e = Math.max(e, p.lon);
  }
  return [
    [s, w],
    [n, e],
  ];
}

/** Shortest distance in metres from point p to the segment a–b (equirectangular approximation). */
export function distanceToSegmentM(p, a, b) {
  const kx = 111320 * Math.cos(rad(p.lat));
  const ky = 110540;
  const px = p.lon * kx;
  const py = p.lat * ky;
  const ax = a.lon * kx;
  const ay = a.lat * ky;
  const bx = b.lon * kx;
  const by = b.lat * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Nearest point on a polyline: returns { distanceM, index } where index is the segment start. */
export function nearestOnTrack(p, track) {
  let best = { distanceM: Infinity, index: 0 };
  for (let i = 1; i < track.length; i++) {
    const d = distanceToSegmentM(p, track[i - 1], track[i]);
    if (d < best.distanceM) best = { distanceM: d, index: i - 1 };
  }
  return best;
}

export function formatCoord(lat, lon) {
  const f = (v, pos, neg) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? pos : neg}`;
  return `${f(lat, 'N', 'S')}, ${f(lon, 'E', 'W')}`;
}
