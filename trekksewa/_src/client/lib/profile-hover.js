// Crosshair + tooltip for altitude profiles. Works with pointer, touch and keyboard.
// Every value shown here is also in the itinerary table, so the tooltip never gates information.

import { num } from '../../lib/format.mjs';

export function initProfiles(root = document) {
  for (const pf of root.querySelectorAll('[data-profile]')) {
    if (pf.dataset.ready) continue;
    const dataEl = pf.parentElement.querySelector('[data-profile-points]');
    if (!dataEl) continue;
    let points;
    try {
      points = JSON.parse(dataEl.textContent);
    } catch {
      continue;
    }
    attach(pf, points);
  }
}

export function attach(pf, points) {
  pf.dataset.ready = '1';
  const plot = pf.querySelector('.pf-plot');
  const cross = pf.querySelector('.pf-cross');
  const tip = pf.querySelector('.pf-tip');
  const x0 = Number(pf.dataset.x0);
  const x1 = Number(pf.dataset.x1);
  const y0 = Number(pf.dataset.y0);
  const y1 = Number(pf.dataset.y1);
  const fx = (x) => (x - x0) / (x1 - x0 || 1);
  const fy = (y) => (y - y0) / (y1 - y0 || 1);
  const dot = document.createElement('i');
  dot.className = 'pf-dot is-active';
  dot.hidden = true;
  plot.append(dot);
  let index = -1;

  function show(i) {
    index = Math.max(0, Math.min(points.length - 1, i));
    const p = points[index];
    const left = fx(p.x) * 100;
    cross.style.left = `${left}%`;
    cross.hidden = false;
    dot.style.left = `${left}%`;
    dot.style.bottom = `${fy(p.y) * 100}%`;
    dot.hidden = false;
    tip.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = `${num(p.y)} m`;
    const span = document.createElement('span');
    span.textContent = p.l || '';
    tip.append(strong, span);
    if (p.s) {
      const sub = document.createElement('span');
      sub.textContent = p.s;
      tip.append(sub);
    }
    tip.hidden = false;
    // keep the tooltip inside the plot
    const w = plot.clientWidth;
    const tw = tip.offsetWidth;
    let px = (left / 100) * w + 12;
    if (px + tw > w) px = (left / 100) * w - tw - 12;
    tip.style.left = `${Math.max(0, px)}px`;
  }
  function hide() {
    cross.hidden = true;
    tip.hidden = true;
    dot.hidden = true;
    index = -1;
  }
  function nearest(clientX) {
    const rect = plot.getBoundingClientRect();
    const x = x0 + ((clientX - rect.left) / rect.width) * (x1 - x0);
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  plot.addEventListener('pointermove', (e) => show(nearest(e.clientX)));
  plot.addEventListener('pointerdown', (e) => show(nearest(e.clientX)));
  plot.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') hide();
  });
  plot.tabIndex = 0;
  plot.setAttribute('role', 'group');
  plot.setAttribute('aria-label', 'Altitude profile. Use the left and right arrow keys to step through the points.');
  plot.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      show(index < 0 ? 0 : index + (e.key === 'ArrowRight' ? 1 : -1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      show(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      show(points.length - 1);
    } else if (e.key === 'Escape') hide();
  });
  plot.addEventListener('blur', hide);
}
