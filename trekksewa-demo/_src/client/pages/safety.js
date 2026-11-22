// Safety hub: the "how thin is the air" slider.

import { $, $$ } from '../lib/dom.js';
import { oxygenPercent, zoneFor, boilingPointC } from '../../lib/altitude.mjs';
import { num } from '../../lib/format.mjs';

const box = $('[data-o2]');
if (box) {
  const range = $('[data-o2-range]', box);
  const paint = () => {
    const alt = Number(range.value);
    $('[data-o2-alt]', box).textContent = `${num(alt)} m`;
    $('[data-o2-pct]', box).textContent = `${oxygenPercent(alt)}%`;
    $('[data-o2-zone]', box).textContent = zoneFor(alt).label;
    $('[data-o2-boil]', box).textContent = `${boilingPointC(alt)} °C`;
    range.setAttribute('aria-valuetext', `${num(alt)} metres, ${oxygenPercent(alt)} percent of sea-level oxygen`);
  };
  range.addEventListener('input', paint);
  for (const b of $$('[data-o2-set]', box)) {
    b.addEventListener('click', () => {
      range.value = b.dataset.o2Set;
      paint();
    });
  }
  paint();
}
