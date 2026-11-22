#!/usr/bin/env node
// Finds the real footpath between the stops of every trek, from OpenStreetMap.
//
//   NODE_USE_ENV_PROXY=1 node scripts/osm/trails.mjs fetch    download the map tiles along every route
//   NODE_USE_ENV_PROXY=1 node scripts/osm/trails.mjs route    walk the path network stop to stop,
//                                                             write content/osm-trails.json
//
// How a line is found: all paths, tracks and roads in the tiles along a stage are joined into
// one network; each stop is attached to the nearest path; the shortest way through the network
// from stop to stop is taken, preferring footpaths over roads. A stage is kept only when the
// result is believable against the straight-line distance and the distance we state for the
// day. Everything else stays a plain dashed line on the map.
//
// Source: the Protomaps daily build of OpenStreetMap. © OpenStreetMap contributors, ODbL.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineKm } from '../../lib/geo.mjs';
import { eachTile, layerFeatures, tilesAlong, tilesAround, uniqueTiles } from './tiles.mjs';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const mode = process.argv[2];
const only = process.argv[3]; // optional: one trek slug
const BUFFER_KM = 2.2;

function loadAll() {
  const places = new Map();
  for (const f of readdirSync(join(SRC, 'content', 'places')).filter((x) => x.endsWith('.json'))) for (const p of JSON.parse(readFileSync(join(SRC, 'content', 'places', f), 'utf8'))) places.set(p.slug, p);
  const treks = readdirSync(join(SRC, 'content', 'treks'))
    .filter((x) => x.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(SRC, 'content', 'treks', f), 'utf8')))
    .filter((t) => !only || t.slug === only);
  return { places, treks };
}

/** The walked legs of a trek: consecutive known points on walking days. */
function legsOf(trek, places) {
  const legs = [];
  for (const d of trek.itinerary) {
    if (d.mode && d.mode !== 'walk') continue;
    if (d.from === d.to && !(d.via || []).length) continue; // a rest day
    const chain = [d.from, ...(d.via || []), d.to].map((s) => places.get(s));
    for (let i = 1; i < chain.length; i++) {
      const a = chain[i - 1];
      const b = chain[i];
      if (!a || !b || a.slug === b.slug) continue;
      legs.push({ day: d.day, a, b, km: d.km, located: a.coordQuality !== 'uncertain' && b.coordQuality !== 'uncertain' });
    }
  }
  return legs;
}

function tilesFor(treks, places) {
  const lists = [];
  for (const t of treks) for (const leg of legsOf(t, places)) if (leg.located) lists.push(tilesAlong(leg.a, leg.b, BUFFER_KM), tilesAround(leg.a.lat, leg.a.lon, 1), tilesAround(leg.b.lat, leg.b.lon, 1));
  return uniqueTiles(lists);
}

async function fetchTiles() {
  const { places, treks } = loadAll();
  const tiles = tilesFor(treks, places);
  console.log(`${treks.length} treks, ${tiles.length} map tiles along their routes`);
  await eachTile(tiles, () => {}, { log: console.log, concurrency: 12 });
}

// ------------------------------------------------------------------ the path network

// how willing we are to walk each kind of way: 1 is a footpath
const COST = { path: 1, track: 1.15, footway: 1, steps: 1, pedestrian: 1.1, bridleway: 1, cycleway: 1.2, living_street: 1.5, residential: 1.5, service: 1.5, unclassified: 1.6, tertiary: 1.9, secondary: 2.3, primary: 2.8, trunk: 3.2, other: 1.6 };
const wayCost = (props) => {
  if (props.kind === 'rail' || props.kind === 'aeroway' || props.kind === 'ferry' || props.kind === 'aerialway') return null;
  if (props.kind === 'path') return COST[props.kind_detail] ?? 1;
  if (props.kind === 'highway' || props.kind === 'major_road') return COST[props.kind_detail] ?? 3;
  return COST[props.kind_detail] ?? COST.other;
};

class Network {
  constructor() {
    this.nodes = []; // [lon, lat]
    this.adj = []; // per node: [to, metres, cost]
    this.grid = new Map(); // ~1.1 m cells -> node index
    this.cells = new Map(); // ~220 m cells -> node indexes, for finding the nearest node
  }
  node(lon, lat) {
    const key = `${Math.round(lon * 1e5)},${Math.round(lat * 1e5)}`;
    let i = this.grid.get(key);
    if (i === undefined) {
      i = this.nodes.length;
      this.nodes.push([lon, lat]);
      this.adj.push([]);
      this.grid.set(key, i);
      const c = `${Math.floor(lon * 500)},${Math.floor(lat * 500)}`;
      if (!this.cells.has(c)) this.cells.set(c, []);
      this.cells.get(c).push(i);
    }
    return i;
  }
  edge(a, b, cost) {
    if (a === b) return;
    const m = haversineKm({ lat: this.nodes[a][1], lon: this.nodes[a][0] }, { lat: this.nodes[b][1], lon: this.nodes[b][0] }) * 1000;
    this.adj[a].push([b, m, m * cost]);
    this.adj[b].push([a, m, m * cost]);
  }
  addLine(line, cost) {
    let prev = null;
    for (const [lon, lat] of line) {
      const i = this.node(lon, lat);
      if (prev !== null) this.edge(prev, i, cost);
      prev = i;
    }
  }
  /** Nodes within about `metres` of a point, nearest first. */
  near(lon, lat, metres) {
    const out = [];
    const span = Math.ceil(metres / 200) + 1;
    const cx = Math.floor(lon * 500);
    const cy = Math.floor(lat * 500);
    for (let x = cx - span; x <= cx + span; x++)
      for (let y = cy - span; y <= cy + span; y++)
        for (const i of this.cells.get(`${x},${y}`) || []) {
          const m = haversineKm({ lat, lon }, { lat: this.nodes[i][1], lon: this.nodes[i][0] }) * 1000;
          if (m <= metres) out.push([i, m]);
        }
    return out.sort((a, b) => a[1] - b[1]);
  }
  /**
   * Tiles cut every way at their edge, with a small overlap, and each piece is rounded to its
   * own tile's grid. So where a path crosses a tile edge its two pieces overlap without sharing
   * a point: the loose end of one lies somewhere along a segment of the other. Join every loose
   * end to the segment it lies on (or to a node right beside it).
   */
  stitch(metres = 6) {
    // every segment, filed under the ~110 m cells its bounding box touches
    const cells = new Map();
    const cell = (v) => Math.floor(v * 1000);
    for (let a = 0; a < this.nodes.length; a++) {
      for (const [b, , w] of this.adj[a]) {
        if (b < a) continue;
        const [x1, y1] = this.nodes[a];
        const [x2, y2] = this.nodes[b];
        for (let cx = cell(Math.min(x1, x2)); cx <= cell(Math.max(x1, x2)); cx++)
          for (let cy = cell(Math.min(y1, y2)); cy <= cell(Math.max(y1, y2)); cy++) {
            const k = `${cx},${cy}`;
            if (!cells.has(k)) cells.set(k, []);
            cells.get(k).push([a, b, w]);
          }
      }
    }
    const loose = [];
    for (let i = 0; i < this.nodes.length; i++) if (this.adj[i].length === 1) loose.push(i);
    let joined = 0;
    for (const i of loose) {
      const [lon, lat] = this.nodes[i];
      const kx = 111320 * Math.cos((lat * Math.PI) / 180);
      const ky = 110540;
      const neighbour = this.adj[i][0][0];
      let best = null;
      for (let cx = cell(lon) - 1; cx <= cell(lon) + 1; cx++)
        for (let cy = cell(lat) - 1; cy <= cell(lat) + 1; cy++)
          for (const [a, b] of cells.get(`${cx},${cy}`) || []) {
            if (a === i || b === i || a === neighbour || b === neighbour) continue;
            const ax = (this.nodes[a][0] - lon) * kx;
            const ay = (this.nodes[a][1] - lat) * ky;
            const bx = (this.nodes[b][0] - lon) * kx;
            const by = (this.nodes[b][1] - lat) * ky;
            const dx = bx - ax;
            const dy = by - ay;
            const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1e-9)));
            const d = Math.hypot(ax + t * dx, ay + t * dy);
            if (d <= metres && (!best || d < best.d)) best = { d, a, b, da: Math.hypot(ax, ay), db: Math.hypot(bx, by) };
          }
      if (!best) continue;
      const cost = this.adj[i][0][2] / Math.max(this.adj[i][0][1], 0.01);
      for (const [to, m] of [[best.a, best.da], [best.b, best.db]]) {
        this.adj[i].push([to, m, m * cost]);
        this.adj[to].push([i, m, m * cost]);
      }
      joined++;
    }
    return joined;
  }
  /** Cheapest way between two sets of start and end nodes (each with a walk-on cost). */
  route(starts, ends, maxMetres) {
    const dist = new Map();
    const prev = new Map();
    const heap = new MinHeap();
    for (const [i, m] of starts) {
      const c = m * 3; // getting from the pin to the path is the least certain part
      if (!dist.has(i) || c < dist.get(i)) {
        dist.set(i, c);
        prev.set(i, -1);
        heap.push(c, i);
      }
    }
    const goal = new Map(ends.map(([i, m]) => [i, m * 3]));
    let best = null;
    while (heap.size) {
      const [c, i] = heap.pop();
      if (c > dist.get(i)) continue;
      if (best && c >= best.cost) break;
      if (goal.has(i)) {
        const total = c + goal.get(i);
        if (!best || total < best.cost) best = { cost: total, end: i };
      }
      if (c > maxMetres * 3.5) break;
      for (const [j, , w] of this.adj[i]) {
        const nc = c + w;
        if (!dist.has(j) || nc < dist.get(j)) {
          dist.set(j, nc);
          prev.set(j, i);
          heap.push(nc, j);
        }
      }
    }
    if (!best) return null;
    const path = [];
    for (let i = best.end; i !== -1; i = prev.get(i)) path.push(i);
    path.reverse();
    let metres = 0;
    for (let k = 1; k < path.length; k++) metres += haversineKm({ lat: this.nodes[path[k - 1]][1], lon: this.nodes[path[k - 1]][0] }, { lat: this.nodes[path[k]][1], lon: this.nodes[path[k]][0] }) * 1000;
    return { line: path.map((i) => this.nodes[i]), metres };
  }
}

class MinHeap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(k, v) {
    const a = this.a;
    a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Drop points that add nothing at map scale (Douglas-Peucker, tolerance in metres). */
function simplify(line, tol = 12) {
  if (line.length < 3) return line;
  const kx = 111320 * Math.cos((line[0][1] * Math.PI) / 180);
  const pts = line.map(([lon, lat]) => [lon * kx, lat * 110540]);
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let far = -1;
    let dmax = tol;
    const [x1, y1] = pts[s];
    const [x2, y2] = pts[e];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((y2 - y1) * pts[i][0] - (x2 - x1) * pts[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > dmax) {
        dmax = d;
        far = i;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([s, far], [far, e]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

async function route() {
  const { places, treks } = loadAll();
  const out = {};
  let build = '';
  const tally = { legs: 0, routed: 0, km: 0 };
  for (const trek of treks) {
    const legs = legsOf(trek, places);
    const net = new Network();
    const tiles = tilesFor([trek], places);
    build = await eachTile(tiles, (t, vt) => {
      for (const f of layerFeatures(vt, 'roads', t)) {
        if (f.type !== 2) continue;
        const cost = wayCost(f.props);
        if (cost === null) continue;
        for (const line of f.lines) net.addLine(line, cost);
      }
    });
    net.stitch();
    const done = [];
    for (const leg of legs) {
      tally.legs++;
      const why = (reason) => process.env.TRAIL_DEBUG && console.log(`   day ${leg.day} ${leg.a.slug} -> ${leg.b.slug}: ${reason}`);
      if (!leg.located) {
        why('a stop has no confirmed position');
        continue;
      }
      const straight = haversineKm(leg.a, leg.b);
      // how far a stop may sit from the path: a pin we trust is close; an approximate one may be a kilometre out
      const reach = (p) => net.near(p.lon, p.lat, p.coordQuality === 'good' ? (['pass', 'peak', 'viewpoint', 'lake'].includes(p.type) ? 500 : 350) : 1200).slice(0, 25);
      const r = net.route(reach(leg.a), reach(leg.b), Math.max(straight * 3.2, 4) * 1000);
      if (!r) {
        why(`no connected path (${straight.toFixed(1)} km apart; ${reach(leg.a).length} and ${reach(leg.b).length} path points near the ends)`);
        continue;
      }
      const km = r.metres / 1000;
      // believable? a mountain path is longer than the straight line, but not wildly
      if (km < straight * 0.98 || km > Math.max(straight * 2.6, straight + 3)) {
        why(`path of ${km.toFixed(1)} km against ${straight.toFixed(1)} km in a straight line`);
        continue;
      }
      const line = simplify(r.line).map(([lon, lat]) => [Number(lat.toFixed(5)), Number(lon.toFixed(5))]);
      done.push({ day: leg.day, from: leg.a.slug, to: leg.b.slug, km: Number(km.toFixed(1)), line });
      tally.routed++;
      tally.km += km;
    }
    out[trek.slug] = { legs: done, total: legs.length };
    console.log(`${trek.slug.padEnd(32)} ${String(done.length).padStart(2)}/${String(legs.length).padEnd(2)} legs, ${done.reduce((a, l) => a + l.km, 0).toFixed(0)} km on mapped paths (stated ${trek.distanceKm} km)`);
  }
  if (!only) {
    const date = `${build.slice(0, 4)}-${build.slice(4, 6)}-${build.slice(6, 8)}`;
    writeFileSync(join(SRC, 'content', 'osm-trails.json'), `${JSON.stringify({ source: 'OpenStreetMap contributors, Open Database Licence, through the Protomaps daily build', asOf: date, treks: out })}\n`);
  }
  console.log(`\n${tally.routed} of ${tally.legs} legs follow a mapped path, ${Math.round(tally.km)} km in all`);
}

const STEPS = { fetch: fetchTiles, route };
if (!STEPS[mode]) {
  console.log('usage: NODE_USE_ENV_PROXY=1 node scripts/osm/trails.mjs fetch | route [trek-slug]');
  process.exit(1);
}
await STEPS[mode]();
