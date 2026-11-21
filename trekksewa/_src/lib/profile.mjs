// Altitude profile chart, rendered as HTML + one stretched SVG so it is fully responsive
// without JavaScript: the plot scales to any width while text and markers stay crisp at
// their natural size. Shared by the build (trek pages) and the browser (GPX viewer,
// acclimatization checker). Returns plain strings; callers must pass trusted or escaped labels.

import { num } from './format.mjs';

const escText = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function niceStep(range, target = 4) {
  const steps = [20, 50, 100, 200, 250, 500, 1000, 2000];
  return steps.find((s) => range / s <= target + 0.5) ?? 2000;
}

export function yScale(points, { floor } = {}) {
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const step = niceStep(Math.max(max - min, 100));
  let y0 = Math.floor((min - step * 0.1) / step) * step;
  if (typeof floor === 'number') y0 = floor;
  y0 = Math.max(0, y0);
  const y1 = Math.ceil((max + step * 0.3) / step) * step;
  const ticks = [];
  for (let y = y0; y <= y1 + 1e-6; y += step) ticks.push(y);
  return { y0, y1, step, ticks };
}

const pct = (v) => `${Math.round(v * 1000) / 10}%`;

/**
 * points: [{ x, y, marker?: boolean, soft?: boolean }] sorted by x. `soft` marks the segment
 *   that ends at this point as travel by vehicle (drawn lighter).
 * xDomain: [x0, x1]; xTicks: [{ x, label }]; labels: [{ x, y, text }] direct labels (use sparingly).
 * refs: [{ y, label }] quiet horizontal reference lines.
 */
export function profileHtml({ points, xDomain, xTicks = [], xTitle = '', labels = [], refs = [], floor, unit = 'm' }) {
  if (!points || points.length < 2) return '';
  const [x0, x1] = xDomain || [points[0].x, points[points.length - 1].x];
  const { y0, y1, ticks } = yScale(points, { floor });
  const fx = (x) => (x - x0) / (x1 - x0 || 1);
  const fy = (y) => (y - y0) / (y1 - y0 || 1);
  const X = (x) => Math.round(fx(x) * 10000) / 10;
  const Y = (y) => Math.round((1 - fy(y)) * 10000) / 10;

  // Split the line into walking and vehicle runs so transfers can be drawn lighter.
  const runs = [];
  let current = null;
  for (let i = 1; i < points.length; i++) {
    const soft = Boolean(points[i].soft);
    if (!current || current.soft !== soft) {
      current = { soft, pts: [points[i - 1]] };
      runs.push(current);
    }
    current.pts.push(points[i]);
  }
  const d = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)} ${Y(p.y)}`).join(' ');
  const area = `${d(points)} L${X(points[points.length - 1].x)} 1000 L${X(points[0].x)} 1000 Z`;

  const grid = ticks.map((t) => `<line x1="0" x2="1000" y1="${Y(t)}" y2="${Y(t)}" class="pf-grid"/>`).join('');
  const refLines = refs
    .filter((r) => r.y > y0 && r.y < y1)
    .map((r) => `<line x1="0" x2="1000" y1="${Y(r.y)}" y2="${Y(r.y)}" class="pf-ref"/>`)
    .join('');
  const lines = runs.map((r) => `<path d="${d(r.pts)}" class="pf-line${r.soft ? ' pf-line-soft' : ''}"/>`).join('');

  const yLabels = ticks.map((t) => `<span style="bottom:${pct(fy(t))}">${num(t)}</span>`).join('');
  const refLabels = refs
    .filter((r) => r.y > y0 && r.y < y1 && r.label)
    .map((r) => `<span class="pf-reflabel" style="bottom:${pct(fy(r.y))}">${escText(r.label)}</span>`)
    .join('');
  const xLabels = xTicks.map((t) => `<span style="left:${pct(fx(t.x))}">${escText(t.label)}</span>`).join('');
  const dots = points
    .filter((p) => p.marker)
    .map((p) => `<i class="pf-dot" style="left:${pct(fx(p.x))};bottom:${pct(fy(p.y))}"></i>`)
    .join('');
  const direct = labels
    .map((l) => {
      const px = fx(l.x);
      const side = px < 0.14 ? ' pf-label-start' : px > 0.86 ? ' pf-label-end' : '';
      return `<span class="pf-label${side}" style="left:${pct(px)};bottom:${pct(fy(l.y))}">${escText(l.text)}</span>`;
    })
    .join('');

  return (
    `<div class="pf" data-profile data-x0="${x0}" data-x1="${x1}" data-y0="${y0}" data-y1="${y1}">` +
    `<div class="pf-y" aria-hidden="true"><span class="pf-unit">${escText(unit)}</span>${yLabels}</div>` +
    `<div class="pf-plot">` +
    `<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `${grid}${refLines}<path d="${area}" class="pf-area"/>${lines}</svg>` +
    `${refLabels}${dots}${direct}` +
    `<div class="pf-cross" hidden></div><div class="pf-tip" role="status" hidden></div>` +
    `</div>` +
    `<div class="pf-x" aria-hidden="true">${xLabels}${xTitle ? `<span class="pf-xtitle">${escText(xTitle)}</span>` : ''}</div>` +
    `</div>`
  );
}

/** Tiny silhouette for cards. Uses one shared scale so cards can be compared at a glance. */
export function profileMini(points, { floor = 0, ceil = 6000 } = {}) {
  if (!points || points.length < 2) return '';
  const x0 = points[0].x;
  const x1 = points[points.length - 1].x;
  const X = (x) => Math.round(((x - x0) / (x1 - x0 || 1)) * 1000) / 10;
  const Y = (y) => Math.round((1 - (Math.min(y, ceil) - floor) / (ceil - floor)) * 400) / 10;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)} ${Y(p.y)}`).join(' ');
  return (
    `<svg class="pf-mini" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `<path d="${line} L100 40 L0 40 Z" class="pf-mini-area"/><path d="${line}" class="pf-mini-line"/></svg>`
  );
}
