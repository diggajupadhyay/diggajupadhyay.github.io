// Page shell shared by every page: <head>, header, navigation, footer, dialogs.

import { html, raw, jsonScript } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { logoMark, ridgeStrip } from '../lib/landscape.mjs';

// The header carries one clear action and four places. Everything else lives under "More".
export const NAV = [
  { href: 'treks/', label: 'Treks', section: 'treks', icon: 'mountain-snow' },
  { href: 'services/', label: 'Guides & porters', section: 'services', icon: 'handshake' },
  { href: 'safety/', label: 'Safety', section: 'safety', icon: 'heart-pulse' },
  { href: 'support/', label: 'Help', section: 'about', icon: 'life-buoy' },
];

export const MORE = [
  { href: 'saved/', label: 'My trips', desc: 'Plans and treks you have saved', icon: 'bookmark' },
  { href: 'regions/', label: 'Regions', desc: 'The mountain regions compared', icon: 'map' },
  { href: 'places/', label: 'Places to stay', desc: 'Villages, lodges and altitudes', icon: 'map-pin' },
  { href: 'conditions/', label: 'Trail conditions', desc: 'Weather and notices this week', icon: 'cloud-sun' },
  { href: 'permits/', label: 'Permits and fees', desc: 'What you need and what it costs', icon: 'ticket' },
  { href: 'tools/', label: 'Planning tools', desc: 'Packing list, budget, compare', icon: 'compass' },
  { href: 'gear/', label: 'Gear', desc: 'What to rent or buy in Nepal', icon: 'store' },
  { href: 'journal/', label: 'Journal', desc: 'Plain advice for first trekkers', icon: 'book-open' },
];

export const SERVICES = [
  { href: 'services/guides/', label: 'Guides', desc: 'Licensed trekking guides who know the route', icon: 'signpost' },
  { href: 'services/porters/', label: 'Porters', desc: 'Fairly paid, insured and properly equipped', icon: 'backpack' },
  { href: 'services/agencies/', label: 'Agencies', desc: 'Registered companies for permits and logistics', icon: 'building-2' },
  { href: 'gear/', label: 'Gear', desc: 'Rent or buy trekking equipment in Nepal', icon: 'store' },
  { href: 'partners/', label: 'Join as a partner', desc: 'List your services on TrekkSewa', icon: 'handshake' },
];

const FOOTER = [
  {
    title: 'Explore',
    links: [
      ['plan/', 'Plan my trek'],
      ['treks/', 'All treks'],
      ['regions/', 'Regions'],
      ['places/', 'Places & altitudes'],
      ['conditions/', 'Trail conditions'],
      ['permits/', 'Permits & fees'],
      ['journal/', 'Journal'],
    ],
  },
  {
    title: 'Safety & tools',
    links: [
      ['safety/altitude-check/', 'Altitude sickness check'],
      ['safety/acclimatization/', 'Acclimatization checker'],
      ['safety/emergency/', 'Emergency & SOS'],
      ['safety/insurance/', 'Insurance check'],
      ['tools/compare/', 'Compare treks'],
      ['tools/gpx/', 'GPX viewer'],
      ['tools/packing/', 'Packing list'],
      ['tools/budget/', 'Budget estimator'],
    ],
  },
  {
    title: 'Services',
    links: [
      ['services/guides/', 'Guides'],
      ['services/porters/', 'Porters'],
      ['services/agencies/', 'Agencies'],
      ['gear/', 'Gear marketplace'],
      ['partners/', 'Become a partner'],
    ],
  },
  {
    title: 'TrekkSewa',
    links: [
      ['about/', 'About'],
      ['support/', 'Help & FAQ'],
      ['saved/', 'My trips'],
      ['privacy/', 'Privacy'],
      ['terms/', 'Terms'],
      ['credits/', 'Data & credits'],
    ],
  },
];

/** Relative-URL helper for a page at `path` (e.g. "treks/everest-base-camp/"). */
export function makeCtx(path, shared) {
  const depth = path.split('/').filter(Boolean).length;
  const root = depth === 0 ? './' : '../'.repeat(depth);
  const u = (p = '') => (p === '' ? root : root + p);
  return { ...shared, path, root, u };
}

export const pageHead = (ctx, { title, lead, crumbs = [], eyebrow, seed = 1, extra }) => html`
  <header class="page-head">
    <div class="wrap">
      ${crumbs.length
        ? html`<nav aria-label="Breadcrumb"><ol class="breadcrumb">
            <li><a href="${ctx.u()}">Home</a></li>
            ${crumbs.map(([href, label]) => (href ? html`<li><a href="${ctx.u(href)}">${label}</a></li>` : html`<li aria-current="page">${label}</li>`))}
          </ol></nav>`
        : ''}
      ${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ''}
      <h1>${title}</h1>
      ${lead ? html`<p class="lead">${lead}</p>` : ''}
      ${extra || ''}
    </div>
    ${raw(ridgeStrip({ seed }))}
  </header>
`;

export function layout(ctx, page) {
  const { config, assets, u } = ctx;
  const isHome = ctx.path === '';
  const fullTitle = isHome ? `${config.name} — ${config.strapline}` : `${page.title} · ${config.name}`;
  const description = page.description || config.description;
  const canonical = `${config.siteUrl}/${ctx.path}`;
  const section = page.section || '';
  const cur = (s) => (s === section ? raw(' aria-current="true"') : '');
  const scripts = ['main', ...(page.scripts || [])];
  const ld = [...(page.jsonLd || [])];
  if (page.crumbs && page.crumbs.length) {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [['', 'Home'], ...page.crumbs].map(([href, label], i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: label,
        item: href === null ? canonical : `${config.siteUrl}/${href}`,
      })),
    });
  }

  return `<!doctype html>
${html`<html lang="${config.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${fullTitle}</title>
<meta name="description" content="${description}">
${page.noindex ? raw('<meta name="robots" content="noindex">') : ''}
<link rel="canonical" href="${canonical}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="${config.themeColor.light}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${config.themeColor.dark}" media="(prefers-color-scheme: dark)">
<meta property="og:site_name" content="${config.name}">
<meta property="og:type" content="${page.ogType || 'website'}">
<meta property="og:title" content="${isHome ? fullTitle : page.title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${config.siteUrl}/${assets.og}">
<meta name="twitter:card" content="summary_large_image">
<link rel="manifest" href="${u('manifest.webmanifest')}">
<link rel="icon" href="${u(assets.favicon)}" type="image/svg+xml">
<link rel="icon" href="${u(assets.icon192)}" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="${u(assets.appleIcon)}">
<meta name="apple-mobile-web-app-title" content="${config.name}">
${assets.fonts.map((f) => html`<link rel="preload" href="${u(f)}" as="font" type="font/woff2" crossorigin>`)}
<link rel="stylesheet" href="${u(assets.css)}">
${(page.styles || []).map((s) => html`<link rel="stylesheet" href="${u(assets.styles[s])}">`)}
<script>(function(){var d=document.documentElement;d.classList.add('js');try{var t=localStorage.getItem('ts-theme');if(t==='dark'||t==='light')d.dataset.theme=t;var z=localStorage.getItem('ts-text');if(z==='l'||z==='xl')d.dataset.text=z}catch(e){}})();</script>
${page.head || ''}
${ld.map((o) => html`<script type="application/ld+json">${jsonScript(o)}</script>`)}
</head>
<body class="${page.bodyClass || ''}" data-root="${ctx.root}" data-section="${section}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="${u()}" aria-label="${config.name} home">${raw(logoMark({ size: 30 }))}<span>Trekk<b>Sewa</b></span></a>
    <nav class="primary-nav" aria-label="Main">
      <a class="nav-plan" href="${u('plan/')}"${cur('plan')}>${icon('calendar-check', { size: 18 })}Plan my trek</a>
      ${NAV.map((n) => html`<a href="${u(n.href)}"${cur(n.section)}>${n.label}</a>`)}
      <div class="menu">
        <button type="button" aria-expanded="false" aria-controls="more-menu" data-menu>More ${icon('chevron-down', { size: 16 })}</button>
        <div class="menu-panel" id="more-menu" hidden>
          ${MORE.map((m) => html`<a href="${u(m.href)}">${icon(m.icon, { size: 20 })}<strong>${m.label}</strong><span>${m.desc}</span></a>`)}
        </div>
      </div>
    </nav>
    <div class="header-actions">
      <button type="button" class="icon-btn" data-search-open aria-label="Search treks and places" title="Search">${icon('search')}</button>
      <button type="button" class="icon-btn text-size" data-text-size aria-label="Change the text size" title="Text size">${icon('a-large-small')}</button>
      <button type="button" class="icon-btn theme-toggle" data-theme-toggle aria-label="Switch between light and dark" title="Light or dark">${icon('sun', { cls: 'icon-sun' })}${icon('moon', { cls: 'icon-moon' })}</button>
      <a class="btn-sos" href="${u('safety/emergency/')}">${icon('siren', { size: 16 })}SOS</a>
    </div>
  </div>
</header>
<main id="main">
${page.body}
</main>
<footer class="site-footer">
  <div class="bunting" aria-hidden="true"></div>
  <div class="wrap">
    <div class="footer-top">
      <div class="footer-brand">
        <a class="brand" href="${u()}">${raw(logoMark({ size: 30 }))}<span>Trekk<b>Sewa</b></span></a>
        <p>${config.description}</p>
        <p><span lang="ne">सेवा</span> means service. We build for trekkers and for the people who make trekking in Nepal possible.</p>
      </div>
      ${FOOTER.map(
        (col) => html`<nav aria-label="${col.title}">
          <h2>${col.title}</h2>
          <ul>${col.links.map(([href, label]) => html`<li><a href="${u(href)}">${label}</a></li>`)}</ul>
        </nav>`,
      )}
    </div>
    <div class="footer-emergency">
      <strong>In an emergency in Nepal</strong>
      <span>Police <a href="tel:100">100</a></span>
      <span>Tourist Police <a href="tel:1144">1144</a></span>
      <span>Ambulance <a href="tel:102">102</a></span>
      <a href="${u('safety/emergency/')}">Open the SOS toolkit</a>
    </div>
    <div class="footer-bottom">
      <p>TrekkSewa is a planning aid, not a guide or a rescue service. Trails, weather, permits and prices change faster than any website. Check locally and trust what is in front of you.</p>
      <p>© ${new Date().getFullYear()} ${config.name}. Maps © OpenStreetMap contributors.</p>
    </div>
  </div>
</footer>
<nav class="tabbar" aria-label="Quick navigation">
  <a href="${u()}"${cur('home')}>${icon('house', { size: 24 })}Home</a>
  <a href="${u('treks/')}"${cur('treks')}>${icon('mountain-snow', { size: 24 })}Treks</a>
  <a class="tab-plan" href="${u('plan/')}"${cur('plan')}>${icon('calendar-check', { size: 24 })}Plan</a>
  <a href="${u('safety/')}"${cur('safety')}>${icon('heart-pulse', { size: 24 })}Safety</a>
  <button type="button" data-sheet-open aria-haspopup="dialog">${icon('menu', { size: 24 })}More</button>
</nav>
<dialog class="sheet" id="menu-sheet" aria-label="Menu">
  <div class="sheet-inner">
    <div class="sheet-head"><strong>Menu</strong><button type="button" class="icon-btn" data-close aria-label="Close menu">${icon('x')}</button></div>
    <a class="btn btn-lg btn-block" href="${u('plan/')}">${icon('calendar-check')}Plan my trek</a>
    <h3>Find your way</h3>
    <div class="sheet-nav">
      <a href="${u('treks/')}">${icon('mountain-snow')}Treks</a>
      ${MORE.map((m) => html`<a href="${u(m.href)}">${icon(m.icon)}${m.label}</a>`)}
    </div>
    <h3>People who help you</h3>
    <div class="sheet-nav">
      ${SERVICES.map((x) => html`<a href="${u(x.href)}">${icon(x.icon)}${x.label}</a>`)}
    </div>
    <h3>Help and safety</h3>
    <div class="sheet-nav">
      <a href="${u('support/')}">${icon('life-buoy')}Help</a>
      <a href="${u('safety/')}">${icon('heart-pulse')}Safety</a>
      <a href="${u('safety/emergency/')}">${icon('siren')}Emergency</a>
      <a href="${u('about/')}">${icon('info')}About</a>
    </div>
    <div class="sheet-size">
      <span id="sheet-size-label">Text size</span>
      <div class="segs" role="group" aria-labelledby="sheet-size-label">
        <button type="button" class="seg" data-text-set="">Normal</button>
        <button type="button" class="seg" data-text-set="l">Large</button>
        <button type="button" class="seg" data-text-set="xl">Largest</button>
      </div>
    </div>
    <div class="sheet-size">
      <span>Light or dark</span>
      <button type="button" class="seg" data-theme-toggle>${icon('sun', { size: 18, cls: 'icon-sun' })}${icon('moon', { size: 18, cls: 'icon-moon' })} Switch</button>
    </div>
  </div>
</dialog>
<dialog class="search-dialog" id="search" aria-label="Search">
  <div class="search-field">
    ${icon('search')}
    <input type="search" id="search-input" placeholder="Search treks, places and guides…" autocomplete="off" spellcheck="false" aria-controls="search-results" aria-label="Search">
    <button type="button" class="icon-btn" data-close aria-label="Close search">${icon('x')}</button>
  </div>
  <ul class="search-results" id="search-results" role="listbox" aria-label="Results"></ul>
</dialog>
${scripts.map((s) => html`<script type="module" src="${u(assets.js[s])}"></script>`)}
</body>
</html>`}`;
}
