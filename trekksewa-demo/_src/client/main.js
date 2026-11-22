// Runs on every page: theme, menus, search, saved treks, offline support.

import { $, $$, on } from './lib/dom.js';
import { ROOT, url } from './lib/site.js';
import { isSaved, toggleSaved } from './lib/store.js';
import { toast } from './lib/ui.js';

const doc = document.documentElement;

// ---------- theme ----------
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = () => doc.dataset.theme || (systemDark.matches ? 'dark' : 'light');
on(document, 'click', '[data-theme-toggle]', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  doc.dataset.theme = next;
  try {
    localStorage.setItem('ts-theme', next);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
});

// ---------- text size ----------
// Three sizes, remembered on this device. The whole page scales, because every measurement in
// the stylesheet is relative to the root size.
const SIZES = ['', 'l', 'xl'];
const SIZE_NAME = { '': 'normal', l: 'large', xl: 'largest' };
function setTextSize(size, announce = true) {
  if (size) doc.dataset.text = size;
  else doc.removeAttribute('data-text');
  try {
    localStorage.setItem('ts-text', size);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  for (const b of $$('[data-text-set]')) {
    const active = (b.dataset.textSet || '') === size;
    b.classList.toggle('is-on', active);
    b.setAttribute('aria-pressed', String(active));
  }
  if (announce) toast(`Text size: ${SIZE_NAME[size]}`);
}
on(document, 'click', '[data-text-size]', () => setTextSize(SIZES[(SIZES.indexOf(doc.dataset.text || '') + 1) % SIZES.length]));
on(document, 'click', '[data-text-set]', (e, el) => setTextSize(el.dataset.textSet || ''));
setTextSize(doc.dataset.text || '', false);

// ---------- header dropdown ----------
const menuBtn = $('[data-menu]');
if (menuBtn) {
  const panel = document.getElementById(menuBtn.getAttribute('aria-controls'));
  const setOpen = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  };
  menuBtn.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !e.target.closest('.menu')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      menuBtn.focus();
    }
  });
}

// ---------- dialogs (mobile menu, search) ----------
const sheet = $('#menu-sheet');
on(document, 'click', '[data-sheet-open]', () => sheet?.showModal());
on(document, 'click', 'dialog [data-close]', (e, el) => el.closest('dialog').close());
for (const dlg of $$('dialog')) {
  // click on the backdrop closes
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
}

const searchDlg = $('#search');
let searchReady;
async function openSearch() {
  if (!searchDlg || searchDlg.open) return;
  searchDlg.showModal();
  $('#search-input').focus();
  searchReady ??= import('./lib/search.js').then((m) => m.initSearch(searchDlg));
  try {
    await searchReady;
  } catch {
    searchReady = undefined;
  }
}
on(document, 'click', '[data-search-open]', openSearch);
document.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(input|textarea|select)$/i.test(e.target.tagName));
  if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
    e.preventDefault();
    openSearch();
  }
});

// ---------- current month on season strips ----------
const month = new Date().getMonth() + 1;
for (const li of $$(`[data-months] li[data-month="${month}"]`)) li.classList.add('m-now');

// ---------- dated notices: say so when one is old enough to be out of date ----------
for (const el of $$('[data-notice-date]')) {
  const then = new Date(`${el.dataset.noticeDate}T00:00:00`);
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  const slot = el.querySelector('[data-notice-age]');
  if (!slot || !Number.isFinite(days)) continue;
  if (days > 120) {
    slot.textContent = `This notice is ${Math.round(days / 30)} months old and may no longer apply.`;
    el.classList.add('notice-old');
  } else if (days > 21) slot.textContent = `That was ${Math.round(days / 7)} weeks ago, so things may have changed.`;
}

// ---------- wide tables and tab strips: say so when part of one is out of sight ----------
// A table that scrolls sideways on a narrow screen gets a line of words above it, a soft edge
// where it runs on, and can be reached and scrolled from the keyboard.
function markScrollable() {
  for (const box of $$('.table-wrap, .tabs')) {
    const hidden = box.scrollWidth - box.clientWidth > 8;
    box.classList.toggle('can-scroll', hidden);
    if (!box.classList.contains('table-wrap')) continue;
    let hint = box.previousElementSibling?.classList.contains('scroll-hint') ? box.previousElementSibling : null;
    if (hidden && !hint) {
      hint = document.createElement('p');
      hint.className = 'scroll-hint';
      hint.textContent = 'This table is wider than your screen. Swipe it sideways to see the rest.';
      box.before(hint);
      box.tabIndex = 0;
      box.setAttribute('role', 'region');
      box.setAttribute('aria-label', box.querySelector('caption')?.textContent.trim() || 'Table');
    }
    if (hint) hint.hidden = !hidden;
  }
}
markScrollable();
// once per frame at most, however busy the page is
let scrollCheck = 0;
const checkSoon = () => {
  if (scrollCheck) return;
  scrollCheck = requestAnimationFrame(() => {
    scrollCheck = 0;
    markScrollable();
  });
};
window.addEventListener('resize', checkSoon);
// tables drawn after the page loads (the tools) are found too
new MutationObserver(checkSoon).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });

// ---------- saved treks ----------
function paintSave(btn) {
  const saved = isSaved(btn.dataset.save);
  btn.setAttribute('aria-pressed', String(saved));
  const label = btn.querySelector('[data-save-label]');
  if (label) label.textContent = saved ? 'Saved' : 'Save';
}
$$('[data-save]').forEach(paintSave);
on(document, 'click', '[data-save]', (e, btn) => {
  e.preventDefault();
  const saved = toggleSaved(btn.dataset.save);
  $$(`[data-save="${btn.dataset.save}"]`).forEach(paintSave);
  toast(saved ? 'Saved to this device' : 'Removed from saved treks');
});

// ---------- offline indicator ----------
let banner;
function paintOnline() {
  if (navigator.onLine) {
    banner?.remove();
    banner = null;
    return;
  }
  if (banner) return;
  banner = document.createElement('div');
  banner.className = 'offline-banner';
  banner.setAttribute('role', 'status');
  banner.textContent = 'You are offline — showing saved pages';
  document.body.append(banner);
}
window.addEventListener('online', paintOnline);
window.addEventListener('offline', paintOnline);
paintOnline();

// ---------- install prompt ----------
let installEvent;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  for (const b of $$('[data-install]')) b.hidden = false;
});
on(document, 'click', '[data-install]', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  for (const b of $$('[data-install]')) b.hidden = true;
});

// ---------- service worker ----------
const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && secure) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(url('sw.js'), { scope: ROOT.pathname }).catch(() => {
      /* offline support is an enhancement; ignore failures */
    });
  });
}
