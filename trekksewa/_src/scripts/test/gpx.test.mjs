import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGpx, trackStats, toGpx, thin } from '../../lib/gpx.mjs';
import { haversineKm, distanceToSegmentM, nearestOnTrack } from '../../lib/geo.mjs';

const SAMPLE = `<?xml version="1.0"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Namche &amp; back</name></metadata>
  <wpt lat="27.8056" lon="86.7139"><ele>3440</ele><name>Namche Bazaar</name></wpt>
  <trk><name>ignored</name><trkseg>
    <trkpt lat="27.7408" lon="86.7128"><ele>2610</ele><time>2026-10-01T02:00:00Z</time></trkpt>
    <trkpt lat="27.7722" lon="86.7228"><ele>2835.4</ele><time>2026-10-01T04:00:00Z</time></trkpt>
    <trkpt lat="27.7800" lon="86.7200"><ele>2832</ele><time>2026-10-01T04:30:00Z</time></trkpt>
    <trkpt lat="27.8056" lon="86.7139"><ele>3440</ele><time>2026-10-01T08:00:00Z</time></trkpt>
    <trkpt lat="bad" lon="86.7"><ele>1</ele></trkpt>
  </trkseg></trk>
</gpx>`;

test('parses tracks, waypoints, names and entities', () => {
  const g = parseGpx(SAMPLE);
  assert.equal(g.name, 'Namche & back');
  assert.equal(g.track.length, 4, 'the malformed point is skipped');
  assert.equal(g.waypoints.length, 1);
  assert.equal(g.waypoints[0].name, 'Namche Bazaar');
  assert.equal(g.track[1].ele, 2835.4);
  assert.equal(g.track[0].time, Date.parse('2026-10-01T02:00:00Z'));
});

test('computes distance, climb and duration, ignoring elevation jitter', () => {
  const s = trackStats(parseGpx(SAMPLE).track);
  assert.ok(s.km > 7 && s.km < 8, `distance ${s.km}`);
  assert.equal(s.ascent, 830, 'the 3 m dip is below the noise threshold');
  assert.equal(s.descent, 0);
  assert.equal(s.max, 3440);
  assert.equal(s.min, 2610);
  assert.equal(s.durationMs, 6 * 3600 * 1000);
  assert.equal(s.cumulative.length, 4);
});

test('falls back to route points and handles files without elevation', () => {
  const g = parseGpx('<gpx><rte><rtept lat="28.0" lon="84.0"/><rtept lat="28.01" lon="84.0"></rtept></rte></gpx>');
  assert.equal(g.track.length, 2);
  const s = trackStats(g.track);
  assert.equal(s.ascent, null);
  assert.ok(Math.abs(s.km - 1.112) < 0.01);
});

test('rejects things that are not GPX', () => {
  assert.throws(() => parseGpx('<kml></kml>'), /GPX/);
  assert.throws(() => parseGpx('<gpx></gpx>'), /No track/);
  assert.throws(() => parseGpx(42), /GPX/);
});

test('written GPX can be read back', () => {
  const track = parseGpx(SAMPLE).track;
  const again = parseGpx(toGpx(track, { name: 'A <b> & c' }));
  assert.equal(again.track.length, track.length);
  assert.equal(again.name, 'A <b> & c');
  assert.ok(Math.abs(again.track[3].lat - track[3].lat) < 1e-6);
  assert.equal(again.track[0].time, track[0].time);
});

test('thinning keeps both ends', () => {
  const long = Array.from({ length: 10001 }, (_, i) => ({ lat: 27 + i / 1e5, lon: 86, ele: null, time: null }));
  const t = thin(long, 500);
  assert.equal(t.length, 500);
  assert.equal(t[0], long[0]);
  assert.equal(t[499], long[10000]);
});

test('off-track distance', () => {
  const a = { lat: 28, lon: 84 };
  const b = { lat: 28, lon: 84.01 };
  assert.ok(Math.abs(haversineKm(a, b) - 0.982) < 0.01);
  assert.ok(distanceToSegmentM({ lat: 28.001, lon: 84.005 }, a, b) > 105 && distanceToSegmentM({ lat: 28.001, lon: 84.005 }, a, b) < 116);
  assert.ok(distanceToSegmentM({ lat: 28, lon: 84.02 }, a, b) > 950, 'beyond the end of the segment the nearest point is the end');
  const near = nearestOnTrack({ lat: 28.0005, lon: 84.015 }, [a, b, { lat: 28, lon: 84.02 }]);
  assert.equal(near.index, 1);
  assert.ok(near.distanceM > 50 && near.distanceM < 60);
});
