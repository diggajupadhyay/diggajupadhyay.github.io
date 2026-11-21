// Procedural Himalayan skyline, generated at build time so no photographs or third-party
// artwork are needed. Every fill is a CSS custom property, so the same drawing works in the
// light and dark themes. A seed makes each skyline repeatable.

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1-D value noise with a few octaves.
function noise(rand, octaves = 4) {
  const tables = [];
  for (let o = 0; o < octaves; o++) {
    const n = 8 * 2 ** o + 2;
    tables.push(Array.from({ length: n }, () => rand()));
  }
  return (u, rough = 0.5) => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      const t = tables[o];
      const x = u * (t.length - 2);
      const i = Math.floor(x);
      const f = x - i;
      const s = f * f * (3 - 2 * f);
      sum += (t[i] * (1 - s) + t[i + 1] * s) * amp;
      norm += amp;
      amp *= rough;
    }
    return sum / norm;
  };
}

/**
 * One ridge line. `peaks` are [{ c, h, w, p }] in 0..1 units (centre, height, half-width, sharpness).
 * Returns an array of [x, y] in pixel space with y measured downward.
 */
function ridge({ rand, width, base, amp, rough, peaks = [], samples = 140 }) {
  const n = noise(rand, 5);
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    let y = base - n(u, rough) * amp;
    for (const pk of peaks) {
      const d = Math.abs(u - pk.c) / pk.w;
      if (d < 1) y -= pk.h * Math.pow(1 - d, pk.p ?? 1.3);
    }
    pts.push([Math.round(u * width * 10) / 10, Math.round(y * 10) / 10]);
  }
  return pts;
}

const toPath = (pts, height) => `M0 ${height} L${pts.map((p) => p.join(' ')).join(' L')} L${pts[pts.length - 1][0]} ${height} Z`;
const yAt = (pts, x) => {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] >= x) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((x - x0) / (x1 - x0 || 1)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
};

const FLAG_COLOURS = ['var(--flag-blue)', 'var(--flag-white)', 'var(--flag-red)', 'var(--flag-green)', 'var(--flag-yellow)'];

/** A sagging string of prayer flags between two points. */
function flagString([x0, y0], [x1, y1], { sag = 18, count = 12, size = 7, start = 0 } = {}) {
  const at = (t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * sag];
  const line = [];
  for (let i = 0; i <= 24; i++) line.push(at(i / 24).map((v) => Math.round(v * 10) / 10).join(' '));
  let flags = '';
  for (let i = 0; i < count; i++) {
    const t = (i + 0.7) / (count + 0.4);
    const [x, y] = at(t);
    const [xb, yb] = at(Math.min(1, t + 0.01));
    const ang = (Math.atan2(yb - y, xb - x) * 180) / Math.PI;
    flags += `<rect x="${(x - size / 2).toFixed(1)}" y="${(y + 0.6).toFixed(1)}" width="${size}" height="${(size * 1.25).toFixed(1)}" fill="${FLAG_COLOURS[(i + start) % 5]}" transform="rotate(${ang.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }
  return `<path d="M${line.join(' L')}" fill="none" stroke="var(--flag-line)" stroke-width="0.8"/>${flags}`;
}

/** A small chorten (stupa) with its base at (x, y). */
function chorten(x, y, s = 1) {
  const r = (v) => (v * s).toFixed(1);
  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">` +
    `<rect x="${r(-15)}" y="${r(-5)}" width="${r(30)}" height="${r(7)}" fill="var(--chorten-shade)"/>` +
    `<rect x="${r(-11.5)}" y="${r(-10)}" width="${r(23)}" height="${r(5.5)}" fill="var(--chorten)"/>` +
    `<path d="M${r(-9)} ${r(-10)} C${r(-10)} ${r(-24)} ${r(10)} ${r(-24)} ${r(9)} ${r(-10)} Z" fill="var(--chorten)"/>` +
    `<path d="M${r(1)} ${r(-20.4)} C${r(8)} ${r(-20)} ${r(9.6)} ${r(-14)} ${r(9)} ${r(-10)} L${r(3)} ${r(-10)} Z" fill="var(--chorten-shade)"/>` +
    `<rect x="${r(-3.4)}" y="${r(-26)}" width="${r(6.8)}" height="${r(5.6)}" fill="var(--chorten)"/>` +
    `<path d="M${r(-3)} ${r(-26)} L0 ${r(-39)} L${r(3)} ${r(-26)} Z" fill="var(--flag-yellow)"/>` +
    `<line x1="0" y1="${r(-39)}" x2="0" y2="${r(-44)}" stroke="var(--flag-line)" stroke-width="${r(0.9)}"/>` +
    `</g>`
  );
}

/**
 * Full hero landscape. Returns an <svg> string that fills its container
 * (anchored to the bottom, cropped at the sides on narrow screens).
 */
export function heroLandscape({ seed = 7, width = 1600, height = 560 } = {}) {
  const rand = prng(seed);
  const H = height;
  const W = width;

  const far = ridge({
    rand,
    width: W,
    base: H * 0.62,
    amp: 46,
    rough: 0.62,
    samples: 220,
    peaks: [
      { c: 0.13, h: 120, w: 0.11, p: 1.25 },
      { c: 0.3, h: 205, w: 0.13, p: 1.35 },
      { c: 0.43, h: 150, w: 0.09, p: 1.2 },
      { c: 0.6, h: 250, w: 0.15, p: 1.45 },
      { c: 0.74, h: 170, w: 0.1, p: 1.25 },
      { c: 0.9, h: 135, w: 0.11, p: 1.2 },
    ],
  });
  const second = ridge({
    rand,
    width: W,
    base: H * 0.7,
    amp: 64,
    rough: 0.58,
    samples: 180,
    peaks: [
      { c: 0.05, h: 90, w: 0.14 },
      { c: 0.22, h: 70, w: 0.1 },
      { c: 0.5, h: 95, w: 0.12 },
      { c: 0.83, h: 105, w: 0.14 },
    ],
  });
  const mid = ridge({ rand, width: W, base: H * 0.8, amp: 70, rough: 0.5, peaks: [{ c: 0.36, h: 50, w: 0.16, p: 1.6 }, { c: 0.97, h: 60, w: 0.2, p: 1.6 }] });
  const near = ridge({ rand, width: W, base: H * 0.9, amp: 58, rough: 0.42, peaks: [{ c: 0.72, h: 46, w: 0.2, p: 1.8 }] });
  const front = ridge({ rand, width: W, base: H * 1.0, amp: 40, rough: 0.35, samples: 80, peaks: [{ c: 0.2, h: 40, w: 0.24, p: 2 }] });

  // snow shading: a lighter cap that follows the far range, cut off at a wavy snowline
  const snowline = ridge({ rand, width: W, base: H * 0.5, amp: 30, rough: 0.7, samples: 220 });
  const cap = far.map(([x, y], i) => [x, Math.max(y, Math.min(snowline[i][1], y + 70))]);
  const capPath = `M${far.map((p) => p.join(' ')).join(' L')} L${[...cap].reverse().map((p) => p.join(' ')).join(' L')} Z`;

  const cx = W * 0.715;
  const cy = yAt(near, cx) + 2;
  const top = [cx, cy - 44];
  const leftAnchor = [cx - 190, yAt(near, cx - 190) - 4];
  const rightAnchor = [cx + 170, yAt(near, cx + 170) - 4];
  const farAnchor = [cx + 330, yAt(near, cx + 330) - 60];

  // a few stars, only visible in the dark theme
  let stars = '';
  for (let i = 0; i < 46; i++) {
    stars += `<circle cx="${(rand() * W).toFixed(0)}" cy="${(rand() * H * 0.45).toFixed(0)}" r="${(0.6 + rand() * 1.1).toFixed(1)}"/>`;
  }

  return (
    `<svg class="landscape" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">` +
    `<defs>` +
    `<linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky-top)"/><stop offset="0.72" stop-color="var(--sky-low)"/><stop offset="1" stop-color="var(--sky-glow)"/></linearGradient>` +
    `<linearGradient id="ls-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ridge-far-top)"/><stop offset="1" stop-color="var(--ridge-far)"/></linearGradient>` +
    `<linearGradient id="ls-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--haze)" stop-opacity="0"/><stop offset="1" stop-color="var(--haze)" stop-opacity="0.55"/></linearGradient>` +
    `<radialGradient id="ls-sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="var(--sun)" stop-opacity="0.5"/><stop offset="1" stop-color="var(--sun)" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" fill="url(#ls-sky)"/>` +
    `<g class="ls-stars" fill="var(--star)">${stars}</g>` +
    `<circle cx="${W * 0.515}" cy="${H * 0.33}" r="190" fill="url(#ls-sun)"/>` +
    `<circle cx="${W * 0.515}" cy="${H * 0.33}" r="30" fill="var(--sun)"/>` +
    `<path d="${toPath(far, H)}" fill="url(#ls-far)"/>` +
    `<path d="${capPath}" fill="var(--snow)"/>` +
    `<path d="${toPath(second, H)}" fill="var(--ridge-4)"/><path d="${toPath(second, H)}" fill="url(#ls-haze)"/>` +
    `<path d="${toPath(mid, H)}" fill="var(--ridge-3)"/><path d="${toPath(mid, H)}" fill="url(#ls-haze)" opacity="0.7"/>` +
    `${flagString(top, farAnchor, { sag: 30, count: 13, size: 7, start: 3 })}` +
    `<path d="${toPath(near, H)}" fill="var(--ridge-2)"/>` +
    `${flagString(leftAnchor, top, { sag: 22, count: 10, size: 7.5 })}` +
    `${flagString(top, rightAnchor, { sag: 20, count: 9, size: 7.5, start: 2 })}` +
    `${chorten(cx, cy, 1.05)}` +
    `<path d="${toPath(front, H)}" fill="var(--ridge-1)"/>` +
    `</svg>`
  );
}

/** A low strip of ridgelines for page headers; the seed gives each page its own skyline. */
export function ridgeStrip({ seed = 1, width = 1400, height = 150 } = {}) {
  const rand = prng(seed * 7919 + 13);
  const W = width;
  const H = height;
  const mk = (o) => ridge({ rand, width: W, samples: 90, ...o }).map(([x, y]) => [Math.round(x), Math.round(y)]);
  const peaks = Array.from({ length: 4 }, () => ({ c: 0.08 + rand() * 0.84, h: 36 + rand() * 60, w: 0.07 + rand() * 0.08, p: 1.3 }));
  const a = mk({ base: H * 0.78, amp: 30, rough: 0.6, peaks });
  const b = mk({ base: H * 0.9, amp: 34, rough: 0.5 });
  const c = mk({ base: H * 1.04, amp: 30, rough: 0.4 });
  return (
    `<svg class="ridge-strip" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">` +
    `<path d="${toPath(a, H)}" fill="var(--strip-3)"/><path d="${toPath(b, H)}" fill="var(--strip-2)"/><path d="${toPath(c, H)}" fill="var(--strip-1)"/></svg>`
  );
}

/** The brand mark: two faces of one peak (or two palms pressed together) under a rising sun. */
export function logoMark({ size = 32, mono = false } = {}) {
  const a = mono ? 'currentColor' : 'var(--logo-a, #0b5d5e)';
  const b = mono ? 'currentColor' : 'var(--logo-b, #17898a)';
  const s = mono ? 'currentColor' : 'var(--logo-sun, #e9a31b)';
  return (
    `<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">` +
    `<circle cx="47.5" cy="15.5" r="6.5" fill="${s}"/>` +
    `<path d="M29.5 9.5c-1 0-1.9.5-2.5 1.4L4.6 50.4C3.4 52.5 4.9 55 7.3 55h20.2c1.7 0 3-1.3 3-3V11c0-.8-.4-1.5-1-1.5z" fill="${a}"/>` +
    `<path d="M35 24.5c0-1.5 1.9-2.1 2.800-.9l21 26.600c1.500 1.900.1 4.800-2.300 4.800H38c-1.700 0-3-1.300-3-3z" fill="${b}"${mono ? ' opacity="0.72"' : ''}/>` +
    `</svg>`
  );
}
