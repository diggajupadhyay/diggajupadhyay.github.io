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
