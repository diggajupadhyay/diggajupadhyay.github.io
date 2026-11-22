// Reads OpenStreetMap data out of the Protomaps daily build, one vector tile at a time.
//
// The build is one very large file on build.protomaps.com. Only the tiles we ask for are
// downloaded (HTTP range requests), and every tile is kept in scripts/.cache/tiles so a second
// run costs nothing. Data © OpenStreetMap contributors (ODbL).
//
// Node's fetch needs NODE_USE_ENV_PROXY=1 when the machine reaches the internet through a proxy.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PMTiles } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import * as pbfModule from 'pbf';

const Pbf = pbfModule.default || pbfModule.PbfReader || pbfModule.Pbf;
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CACHE = join(SRC, 'scripts', '.cache');
export const Z = 15; // the build's most detailed level: every lodge and footpath is in it

/** The build to read: one already cached, else the newest of the last few days. */
export async function chooseBuild() {
  const pin = join(CACHE, 'tiles', 'build.txt');
  if (existsSync(pin)) return readFileSync(pin, 'utf8').trim();
  for (let back = 1; back <= 6; back++) {
    const d = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    const res = await fetch(`https://build.protomaps.com/${d}.pmtiles`, { method: 'HEAD' });
    if (res.ok) {
      mkdirSync(dirname(pin), { recursive: true });
      writeFileSync(pin, d);
      return d;
    }
  }
  throw new Error('No recent Protomaps build could be reached.');
}

export const tileOf = (lat, lon, z = Z) => {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return { z, x: Math.floor(((lon + 180) / 360) * n), y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n) };
};
const keyOf = (t) => `${t.z}/${t.x}/${t.y}`;

/** Every tile that touches a circle of radiusKm around a point. */
export function tilesAround(lat, lon, radiusKm, z = Z) {
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const a = tileOf(lat + dLat, lon - dLon, z);
  const b = tileOf(lat - dLat, lon + dLon, z);
  const out = [];
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) out.push({ z, x, y });
  return out;
}

/** Every tile within bufferKm of the straight line between two points. */
export function tilesAlong(p, q, bufferKm, z = Z) {
  const km = Math.hypot((q.lat - p.lat) * 111.32, (q.lon - p.lon) * 111.32 * Math.cos((p.lat * Math.PI) / 180));
  const steps = Math.max(1, Math.ceil(km / 0.5));
  const seen = new Map();
  for (let i = 0; i <= steps; i++) {
    const lat = p.lat + ((q.lat - p.lat) * i) / steps;
    const lon = p.lon + ((q.lon - p.lon) * i) / steps;
    for (const t of tilesAround(lat, lon, bufferKm, z)) seen.set(keyOf(t), t);
  }
  return [...seen.values()];
}

export const uniqueTiles = (lists) => {
  const seen = new Map();
  for (const t of lists.flat()) seen.set(keyOf(t), t);
  return [...seen.values()];
};

/**
 * Fetch tiles (cached on disk). Calls onTile(tile, vectorTile) for each one that exists.
 * A missing tile (open ocean, or nothing mapped) is remembered as an empty file.
 */
export async function eachTile(list, onTile, { concurrency = 10, log = () => {} } = {}) {
  const build = await chooseBuild();
  const dir = join(CACHE, 'tiles', build);
  let archive = null;
  let fetched = 0;
  let done = 0;
  const queue = [...list];
  const worker = async () => {
    for (;;) {
      const t = queue.shift();
      if (!t) return;
      const file = join(dir, String(t.z), String(t.x), `${t.y}.mvt`);
      let bytes;
      if (existsSync(file)) {
        bytes = readFileSync(file);
      } else {
        archive ??= new PMTiles(`https://build.protomaps.com/${build}.pmtiles`);
        let res;
        for (let attempt = 0; ; attempt++) {
          try {
            res = await archive.getZxy(t.z, t.x, t.y);
            break;
          } catch (e) {
            if (attempt >= 4) throw e;
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          }
        }
        bytes = res ? Buffer.from(res.data) : Buffer.alloc(0);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, bytes);
        fetched++;
      }
      done++;
      if (done % 500 === 0) log(`tiles: ${done}/${list.length} (${fetched} downloaded)`);
      if (bytes.length) onTile(t, new VectorTile(new Pbf(new Uint8Array(bytes))));
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  log(`tiles: ${done}/${list.length} read, ${fetched} downloaded, build ${build}`);
  return build;
}

/** Features of one layer with geometry in longitude and latitude. */
export function* layerFeatures(vt, layerName, t) {
  const layer = vt.layers[layerName];
  if (!layer) return;
  const n = 2 ** t.z;
  const toLonLat = (p) => {
    const fx = (t.x + p.x / layer.extent) / n;
    const fy = (t.y + p.y / layer.extent) / n;
    return [fx * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - 2 * fy))) * 180) / Math.PI];
  };
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    yield { type: f.type, props: f.properties, lines: f.loadGeometry().map((ring) => ring.map(toLonLat)), inTile: (ll) => ll }; // type 1 point, 2 line, 3 polygon
  }
}

/** Is a point inside the tile proper (not just its overlap margin)? Stops double counting. */
export function owns(t, lon, lat) {
  const o = tileOf(lat, lon, t.z);
  return o.x === t.x && o.y === t.y;
}
