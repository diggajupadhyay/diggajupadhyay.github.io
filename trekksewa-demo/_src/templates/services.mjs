// Services: guides, porters, agencies, gear, and the partner application.
// Each page explains how the service works in Nepal, then gives the trekker something to do
// today: ask for help with a plan (worded for wherever requests really go, see channelOf),
// and check papers against the official lists. Partners that have been approved in the
// database are listed by client/pages/directory.js; until there are some, no list is shown.
// Nothing here presents an invented business as real.

import { html, raw, jsonScript } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { ridgeStrip } from '../lib/landscape.mjs';
import { longDate } from '../lib/format.mjs';
import { note, channelOf } from './partials.mjs';

const head = (ctx, { crumbs, title, lead, seed, extra }) => html`<header class="page-head">
  <div class="wrap">
    <nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="${ctx.u()}">Home</a></li>${crumbs.map(([href, label]) => (href ? html`<li><a href="${ctx.u(href)}">${label}</a></li>` : html`<li aria-current="page">${label}</li>`))}</ol></nav>
    <h1>${title}</h1>
    <p class="lead">${lead}</p>
    ${extra || ''}
  </div>
  ${raw(ridgeStrip({ seed }))}
</header>`;

/** A researched figure, with an honest label when it has not been confirmed this season. */
function fact(content, key, label) {
  const f = content.facts?.[key];
  if (!f) return '';
  return html`<div class="fact">
    <p class="fact-label">${label}${f.verified === false ? html` <span class="badge badge-soon" title="A typical figure from recent seasons that we have not been able to confirm for this one">Typical, unconfirmed</span>` : ''}</p>
    <p class="fact-value">${f.value}</p>
    <p class="small muted">${f.detail}</p>
  </div>`;
}

const STANDARDS = [
  ['badge-check', 'Checked credentials', 'Guides are listed with their licence number and agencies with their registration, tourism licence and tax numbers, so you can verify them yourself.'],
  ['scale', 'Loads within limits', 'Porters carry no more than 25 kg including their own kit, and less at altitude or on rough ground.'],
  ['banknote', 'Wages agreed and paid in full', 'The daily rate, what it includes and who pays for food and lodging are agreed before the trek and paid without deductions.'],
  ['shield-check', 'Everyone insured', 'Guides and porters are covered for accident, medical care and evacuation for the whole route, including its highest point.'],
  ['shirt', 'Dressed for the altitude', 'Staff have boots, warm clothing, a sleeping place and food suited to the highest and coldest night of the trek.'],
  ['heart-pulse', 'Nobody sent down alone', 'A sick or injured guide or porter gets the same care as a client and is never paid off and sent down unaccompanied.'],
];

const standardsBlock = (id = 'standards') => html`<section class="section section-alt" id="${id}" aria-labelledby="${id}-title">
  <div class="wrap">
    <div class="section-head"><div>
      <p class="eyebrow">The fair-trek standards</p>
      <h2 id="${id}-title">What every partner agrees to</h2>
      <p>Based on the International Porter Protection Group's guidelines and on how the better Nepali agencies already work. Partners accept them when they apply.</p>
    </div></div>
    <div class="grid grid-3">
      ${STANDARDS.map(([ic, title, text]) => html`<div class="feature"><span class="feature-icon">${icon(ic, { size: 22 })}</span><h3>${title}</h3><p>${text}</p></div>`)}
    </div>
  </div>
</section>`;

const joinBand = (ctx, { role, title, text, ne }) => html`<section class="section-tight band join-band">
  <div class="wrap install-inner">
    <div>
      <h2>${title}</h2>
      <p>${text}</p>
      ${ne ? html`<p lang="ne" class="join-ne">${ne}</p>` : ''}
    </div>
    <a class="btn btn-gold btn-lg" href="${ctx.u(`partners/?role=${role}`)}">${icon('handshake')}Apply to join</a>
  </div>
</section>`;

/**
 * How a trekker gets this kind of help today. The first card is the way through the planner,
 * worded for wherever a request really goes; the second is how to check papers.
 */
function getHelp(ctx, { id, title, lead, tick, sendTo, compare, enrolling, checks }) {
  const open = channelOf(ctx.config) !== '';
  return html`<section class="section-tight section-alt" id="${id}" aria-labelledby="${id}-h">
  <div class="wrap">
    <div class="section-head"><div><h2 id="${id}-h">${title}</h2><p>${lead}</p></div></div>
    <div class="grid grid-2 get-help">
      <article class="card card-pad get-card">
        <span class="feature-icon">${icon('send', { size: 24 })}</span>
        <h3>${open ? 'Ask us, with your plan' : 'Ask with your plan'}</h3>
        <ol class="get-steps">
          <li><strong>Make your plan.</strong> A few simple questions set out your dates, your route and how many you are.</li>
          ${open
            ? html`<li><strong>Press “Get help arranging it”</strong> on the plan and tick <em>${tick}</em>.</li>
          <li><strong>We answer you.</strong> Your request comes to the ${ctx.config.name} team and we reply by email or WhatsApp. Asking is free.</li>`
            : html`<li><strong>Send it.</strong> Press Share or Print on the plan and send it to ${sendTo}.</li>
          <li><strong>Compare the answers.</strong> ${compare}</li>`}
        </ol>
        <a class="btn btn-lg" href="${ctx.u('plan/')}">${icon('calendar-check')}Plan my trek</a>
        ${open ? '' : html`<p class="small muted get-foot">${ctx.config.name}’s own booking desk is not open yet. ${enrolling}</p>`}
      </article>
      <article class="card card-pad get-card">
        <span class="feature-icon">${icon('badge-check', { size: 24 })}</span>
        <h3>Check before you pay</h3>
        <ul class="ticks">${checks.map((c) => html`<li>${c}</li>`)}</ul>
      </article>
    </div>
  </div>
</section>`;
}

/** Approved partners, filled in by client/pages/directory.js. Stays hidden while there are none. */
const directory = (role, title, lead) => html`<section class="section-tight" data-directory="${role}" aria-labelledby="dir-${role}" hidden>
  <div class="wrap">
    <div class="section-head"><div><h2 id="dir-${role}">${title}</h2><p>${lead}</p></div></div>
    <div class="grid grid-3 directory" data-directory-list></div>
  </div>
</section>`;

const TAAN_LIST = 'https://www.taan.org.np/members';

// ------------------------------------------------------------------ hub

export function servicesHubPage(ctx) {
  const { u } = ctx;
  const cards = [
    ['services/guides/', 'signpost', 'Guides', 'Licensed trekking guides who know the route, the lodges and the signs of altitude illness.'],
    ['services/porters/', 'backpack', 'Porters', 'The people who carry the loads. Hire them directly and fairly, with insurance and proper kit.'],
    ['services/agencies/', 'building-2', 'Agencies', 'Registered companies that arrange permits, staff, transport and full trips, and are required for restricted areas.'],
    ['gear/', 'store', 'Gear', 'Shops in Kathmandu, Pokhara and on the trail that rent and sell what you need.'],
  ];
  const facts = ctx.content.facts || {};
  const who = [
    {
      icon: 'building-2',
      title: 'A trekking company',
      best: 'Best for a first trek, a short holiday, or anywhere a permit needs an agency.',
      does: 'Arranges everything: guide, porter, permits, transport and beds. One price, one person to call if something goes wrong.',
      cost: 'Usually a single price for the whole trek. Each trek page shows the range companies publish.',
      href: 'services/agencies/',
    },
    {
      icon: 'signpost',
      title: 'A guide',
      best: 'Best if you are happy to organise your own travel and permits but want someone who knows the way.',
      does: 'Walks with you, sets a safe pace, books the lodges, watches how you cope with the height and deals with any problem.',
      cost: facts.guideDailyRate?.value || '',
      href: 'services/guides/',
    },
    {
      icon: 'backpack',
      title: 'A porter',
      best: 'Best if you want to walk with only a small day bag. It makes every day easier, at any age.',
      does: 'Carries your main bag between lodges, up to about 20 to 25 kg, usually for two trekkers.',
      cost: facts.porterDailyRate?.value || '',
      href: 'services/porters/',
    },
  ];
  const body = html`
${head(ctx, {
  crumbs: [[null, 'Guides and porters']],
  title: 'Guides, porters and trekking companies',
  lead: 'You do not have to do this alone. Here is who can help you on a trek in Nepal, what each of them does, and what they cost.',
  seed: 51,
})}
<section class="section-tight" aria-labelledby="who-title">
  <div class="wrap">
    <div class="section-head"><div><h2 id="who-title">Which help do I need?</h2><p>Many people take a company for their first trek, and a guide and porter after that.</p></div></div>
    <div class="who-grid">
      ${who.map(
        (w) => html`<article class="card card-pad who">
          <span class="feature-icon">${icon(w.icon, { size: 24 })}</span>
          <h3>${w.title}</h3>
          <p class="who-best">${w.best}</p>
          <p>${w.does}</p>
          ${w.cost ? html`<p class="who-cost">${icon('wallet', { size: 18 })}<span>${w.cost}</span></p>` : ''}
          <a class="link-arrow" href="${u(w.href)}">More about this${icon('arrow-right', { size: 18 })}</a>
        </article>`,
      )}
    </div>
    <div class="who-cta card card-pad">
      <div>
        <h3>Not sure? Plan your trek first.</h3>
        <p>The planner shows which kinds of help are allowed on your route and what each would cost, then lets you send your plan to ask for a price.</p>
      </div>
      <a class="btn btn-lg" href="${u('plan/')}">${icon('calendar-check')}Plan my trek</a>
    </div>
  </div>
</section>

<div class="wrap section-tight">
  <div class="section-head"><div><h2>Read more</h2></div></div>
  <div class="grid grid-4">
    ${cards.map(([href, ic, title, text]) => html`<a class="card card-pad card-link feature" href="${u(href)}"><span class="feature-icon">${icon(ic, { size: 22 })}</span><h3>${title}</h3><p>${text}</p></a>`)}
  </div>
</div>

<section class="section-tight" aria-labelledby="how-title">
  <div class="wrap">
    <div class="section-head"><div><h2 id="how-title">How to arrange help, step by step</h2><p>Whoever you choose, the same four steps keep you safe.</p></div></div>
    <ol class="steps">
      <li><span class="step-n">1</span><h3>Make your plan</h3><p>Dates, route, how many of you and the help you want. <a href="${u('plan/')}">The planner</a> puts it on one page.</p></li>
      <li><span class="step-n">2</span><h3>Ask for a price</h3><p>Send the plan to two or three registered companies or guides and compare what each price includes.</p></li>
      <li><span class="step-n">3</span><h3>Check their papers</h3><p>A guide shows a licence card. A company shows its registration. Both should show staff insurance.</p></li>
      <li><span class="step-n">4</span><h3>Agree it in writing</h3><p>Dates, daily rate, what is included, the porter's load and what happens if you turn back early.</p></li>
    </ol>
  </div>
</section>

${standardsBlock()}

${joinBand(ctx, {
  role: '',
  title: 'Do you work in trekking?',
  text: 'Guides, porters, agencies and gear shops can apply now. It takes about five minutes, in English or Nepali, and applying is free.',
  ne: 'गाइड, पोर्टर, एजेन्सी र सामान पसलहरूले अहिले नै आवेदन दिन सक्नुहुन्छ।',
})}`;
  return {
    title: 'Trekking Services in Nepal: Guides, Porters, Agencies & Gear',
    description: 'Who can help you on a trek in Nepal: trekking companies, guides and porters. What each one does, what they cost, how to ask for a price and what to check before you pay.',
    section: 'services',
    crumbs: [[null, 'Services']],
    body,
  };
}

// ------------------------------------------------------------------ guides

export function guidesPage(ctx) {
  const { u, content } = ctx;
  const body = html`
${head(ctx, {
  crumbs: [['services/', 'Services'], [null, 'Guides']],
  title: 'Trekking guides',
  lead: 'A good guide does far more than show the way. They pace the group, book the beds, read the weather, notice when you are not right and know who to call.',
  seed: 53,
})}
<div class="wrap section-tight service-layout">
  <div class="prose">
    <h2>What a licensed guide is</h2>
    <p>In Nepal a trekking guide holds a government licence, issued after a training course and renewed periodically. The licence is personal: it has a photo, a number and an expiry date, and a guide should be happy to show it.</p>
    <p>A <strong>porter-guide</strong> is a different arrangement: one person who carries a lighter load and also leads the way. It suits one or two fit trekkers on a well-marked route. It is a job description rather than a licence, so ask whether yours actually holds a guide licence if your route requires one.</p>
    <h2>Before you agree anything</h2>
    <ul>
      <li>See the licence card and note the number.</li>
      <li>Agree the daily rate and exactly what it covers: food, lodging, transport to and from the trailhead, insurance.</li>
      <li>Ask what insurance the guide has and up to what altitude.</li>
      <li>Fix the number of days, and what happens if the trek runs longer or is cut short.</li>
      <li>Talk about pace and rest days. A guide who promises to get you there faster is not doing you a favour.</li>
      <li>Put it in a message or on paper, even if it is two lines.</li>
    </ul>
    <h2>Tipping</h2>
    <p>Tips are expected and are a real part of income. A common guide is about a day's wage for every week of trekking, more for a hard trip handled well, given directly to each person at the end.</p>
  </div>
  <aside class="stack">
    ${fact(content, 'guideDailyRate', 'Typical daily rate')}
    ${fact(content, 'guideLicensing', 'How licensing works')}
    ${fact(content, 'guideRule', 'Is a guide compulsory?')}
  </aside>
</div>

${directory('guide', 'Guides you can contact', 'Each one has shown us a licence, and has agreed to the fair-trek standards.')}
${getHelp(ctx, {
  id: 'get-guide',
  title: 'How to get a guide',
  lead: 'Most trekkers find their guide through a trekking company. Here is the simplest way to ask, and what to check.',
  tick: 'A licensed guide',
  sendTo: 'two or three trekking companies, or to a guide someone you trust has walked with',
  compare: 'Look at the daily rate, what it covers, and who exactly will walk with you.',
  enrolling: 'We are enrolling licensed guides now.',
  checks: [
    html`<strong>See the licence card.</strong> It carries the guide's photo, a number and an expiry date.`,
    html`<strong>Look the company up.</strong> If the guide comes through a company, find it in the <a href="${TAAN_LIST}" rel="noopener">trekking agencies' association member list</a>.`,
    html`<strong>Ask about insurance.</strong> Who insures the guide, and up to what height?`,
    html`<strong>Agree it in writing.</strong> The days, the daily rate and what it includes. A message on your phone is enough.`,
  ],
})}
${joinBand(ctx, { role: 'guide', title: 'Are you a licensed guide?', text: 'Tell us your licence number, your routes and your languages. We check the details and publish your profile with direct contact, so trekkers reach you without a middleman.', ne: 'तपाईं लाइसेन्स प्राप्त ट्रेकिङ गाइड हुनुहुन्छ? आजै आवेदन दिनुहोस्।' })}`;
  return {
    title: 'Hiring a Trekking Guide in Nepal: Licences & Rates',
    description: 'How to hire a licensed trekking guide in Nepal: what the licence is, typical daily rates, what to agree before you start, and how to check credentials.',
    section: 'services',
    scripts: ['directory'],
    crumbs: [['services/', 'Services'], [null, 'Guides']],
    body,
  };
}

// ------------------------------------------------------------------ porters

export function portersPage(ctx) {
  const { u, content } = ctx;
  const body = html`
${head(ctx, {
  crumbs: [['services/', 'Services'], [null, 'Porters']],
  title: 'Porters',
  lead: 'Porters make trekking in Nepal possible, and they are the people most often short-changed by it. Hiring one fairly costs little and changes a great deal.',
  seed: 55,
})}
<div class="wrap section-tight service-layout">
  <div class="prose">
    <h2>What a porter does</h2>
    <p>A porter carries your main bag from lodge to lodge, usually walking ahead of the group and arriving first. One porter normally carries for two trekkers. Most are farmers from the middle hills working the season, not Sherpas from the high valleys, and they feel the cold and the altitude exactly as you do.</p>
    <h2>Hiring responsibly</h2>
    <ul>
      <li><strong>Weigh the bag.</strong> Keep your share to 10–12 kg so the total load stays at 25 kg or under. Leave what you do not need at your hotel.</li>
      <li><strong>Ask about insurance.</strong> A porter should be insured for accident and evacuation on your route. If the agency cannot confirm it, choose another agency.</li>
      <li><strong>Look at their kit on day one.</strong> Boots, a warm jacket, gloves, sunglasses and a sleeping bag or blanket for the high nights. If something is missing, it is cheap to put right in Kathmandu or Namche.</li>
      <li><strong>Check where they sleep and eat.</strong> Above the tree line that means a place indoors and hot food.</li>
      <li><strong>Watch for altitude sickness.</strong> Porters hide symptoms because they fear losing the job. Ask every evening.</li>
      <li><strong>Never send a sick porter down alone.</strong> Someone who speaks their language goes with them, with money for treatment.</li>
      <li><strong>Pay and tip directly.</strong> Hand the tip to each person yourself at the end.</li>
    </ul>
  </div>
  <aside class="stack">
    ${fact(content, 'porterDailyRate', 'Typical daily rate')}
    ${fact(content, 'porterLoadLimit', 'How much a porter may carry')}
    ${fact(content, 'porterWelfare', 'The IPPG guidelines')}
  </aside>
</div>

${directory('porter', 'Porters you can contact', 'Each one works within the fair-trek standards: a fair load, proper kit, insurance and full pay.')}
${getHelp(ctx, {
  id: 'get-porter',
  title: 'How to get a porter',
  lead: 'A porter hired through a registered company or a lodge you trust is insured and has someone responsible for them. Here is the simplest way to ask.',
  tick: 'A porter',
  sendTo: 'two or three trekking companies, and ask each for a price with a porter',
  compare: 'Look at the daily rate, what it covers, the load they allow and how the porter is insured.',
  enrolling: 'We are enrolling porters and the companies that employ them now.',
  checks: [
    html`<strong>Ask to see the insurance.</strong> It should cover the porter for accident and rescue on your route.`,
    html`<strong>Agree the load.</strong> 20 to 25 kg at the very most, so about 10 to 12 kg from each of two trekkers.`,
    html`<strong>Agree the pay.</strong> The daily rate, whether it covers the porter's food and bed, and that it is paid in full.`,
    html`<strong>Look at the kit on day one.</strong> Boots, a warm jacket, gloves and sunglasses for the highest night.`,
  ],
})}
${standardsBlock('porter-standards')}
${joinBand(ctx, { role: 'porter', title: 'Are you a porter or porter-guide?', text: 'Register with a phone number and the regions you work in. A friend, family member or agency can fill in the form for you.', ne: 'तपाईं पोर्टर वा पोर्टर-गाइड हुनुहुन्छ? फोन नम्बर र काम गर्ने क्षेत्र राखेर दर्ता गर्नुहोस्। तपाईंको तर्फबाट साथी वा परिवारले पनि फारम भर्न सक्छन्।' })}`;
  return {
    title: 'Hiring a Porter in Nepal Fairly: Loads, Pay & Welfare',
    description: 'How to hire a trekking porter in Nepal responsibly: load limits, typical wages, insurance, clothing and the porter-welfare standards TrekkSewa partners accept.',
    section: 'services',
    scripts: ['directory'],
    crumbs: [['services/', 'Services'], [null, 'Porters']],
    body,
  };
}

// ------------------------------------------------------------------ agencies

export function agenciesPage(ctx) {
  const { u, content } = ctx;
  const body = html`
${head(ctx, {
  crumbs: [['services/', 'Services'], [null, 'Agencies']],
  title: 'Trekking agencies',
  lead: 'For restricted areas an agency is the law. Everywhere else a good one saves you days of logistics, and a bad one is the most expensive mistake you can make.',
  seed: 57,
})}
<div class="wrap section-tight service-layout">
  <div class="prose">
    <h2>When you need one</h2>
    <ul>
      <li><strong>Restricted areas.</strong> Manaslu, Tsum, Upper Mustang, Nar Phu, Dolpo, Kanchenjunga and the other restricted zones issue permits only through a registered agency, with a licensed guide.</li>
      <li><strong>TIMS cards.</strong> Outside Khumbu the trekker registration card is issued through agencies.</li>
      <li><strong>Camping routes.</strong> Dhaulagiri, Upper Dolpo and similar trips need tents, a kitchen crew and pack animals that only an outfitter can put together.</li>
    </ul>
    <h2>Questions worth asking</h2>
    <ul>
      <li>What are your company registration, tourism licence and tax numbers?</li>
      <li>Who exactly will guide us, and can we speak to them before we pay?</li>
      <li>How are your guides and porters insured, and to what altitude?</li>
      <li>What is the porter load limit on your trips?</li>
      <li>What is included, line by line, and what is not?</li>
      <li>What happens to my money if flights are cancelled or I turn back early?</li>
    </ul>
    <h2>Warning signs</h2>
    <ul>
      <li>A price far below everyone else's. The saving comes out of staff wages, insurance or your safety margin.</li>
      <li>Pressure to take a helicopter down for a mild illness. Unnecessary evacuations billed to insurers are a known fraud; call your insurer yourself before agreeing to any flight.</li>
      <li>Itineraries that skip rest days to look shorter.</li>
      <li>No written quote and no company papers.</li>
    </ul>
  </div>
  <aside class="stack">
    ${fact(content, 'agencyLicensing', 'What a legal agency holds')}
    ${note('info', html`<p>Permit fees for every region are on the <a href="${u('permits/')}">permits page</a>. An agency charges those at cost plus a service fee; ask to see the breakdown.</p>`)}
  </aside>
</div>

${directory('agency', 'Companies you can contact', 'Each one has shown us its registration and tourism licence, and has agreed to the fair-trek standards.')}
${getHelp(ctx, {
  id: 'get-agency',
  title: 'How to get a price from a trekking company',
  lead: 'Ask two or three companies for the same trek on the same dates, so the prices can be compared.',
  tick: 'A full package from a trekking company',
  sendTo: 'two or three registered trekking companies',
  compare: 'Look at what each price includes, line by line, and who will guide you.',
  enrolling: 'We are enrolling registered companies now.',
  checks: [
    html`<strong>Look the company up.</strong> Find it in the <a href="${TAAN_LIST}" rel="noopener">trekking agencies' association member list</a>.`,
    html`<strong>Ask for its numbers.</strong> Company registration, tourism licence and tax (PAN) number. The names should match.`,
    html`<strong>Get a written quote.</strong> What is included, what is not, and what happens to your money if a flight is cancelled.`,
    html`<strong>Ask who will guide you.</strong> A good company lets you speak to your guide before you pay.`,
  ],
})}
${joinBand(ctx, { role: 'agency', title: 'Do you run a registered agency?', text: 'List your company with its registration details, the routes you operate and your staff standards. We verify the papers before anything is published.', ne: 'दर्ता भएको ट्रेकिङ एजेन्सी चलाउनुहुन्छ? आफ्नो कम्पनी सूचीकृत गर्न आवेदन दिनुहोस्।' })}`;
  return {
    title: 'Choosing a Trekking Agency in Nepal: What to Check',
    description: 'When you need a registered trekking agency in Nepal, what papers a legal company holds, the questions to ask and the warning signs to walk away from.',
    section: 'services',
    scripts: ['directory'],
    crumbs: [['services/', 'Services'], [null, 'Agencies']],
    body,
  };
}

// ------------------------------------------------------------------ gear

export function gearPage(ctx) {
  const { u, content } = ctx;
  const g = content.gear;
  const MODE = { rent: ['Rent in Nepal', 'badge-ok'], buy: ['Buy in Nepal', 'badge-info'], bring: ['Bring from home', 'badge-watch'], either: ['Rent or borrow', 'badge-ok'] };
  const hubs = content.hubs || {};
  const hubsAsOf = content.sources?.hubs;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const hubCards = [
    hubs.thamel && {
      ...hubs.thamel,
      count: hubs.thamel.outdoor,
      countLabel: 'outdoor shops within a kilometre',
      text: `The biggest choice in the country, with ${plural(hubs.thamel.atm, 'cash machine', 'cash machines')} and ${plural(hubs.thamel.exchange, 'money changer', 'money changers')} close by. Rent and buy here if your trek starts from Kathmandu.`,
    },
    hubs.lakeside && {
      ...hubs.lakeside,
      count: hubs.lakeside.outdoor,
      countLabel: 'outdoor shops along the lake',
      text: `The place to shop for the Annapurna treks, with ${plural(hubs.lakeside.atm, 'cash machine', 'cash machines')} nearby. A smaller choice than Kathmandu, at much the same prices.`,
    },
    hubs.namche && {
      ...hubs.namche,
      count: 0,
      countLabel: '',
      text: `The last shops on the Everest trail, with ${plural(hubs.namche.atm, 'cash machine', 'cash machines')} and ${plural(hubs.namche.pharmacy, 'pharmacy', 'pharmacies')} mapped. Buy what you forgot here, but do not plan to equip yourself here: everything is carried up, and the prices show it.`,
    },
  ].filter(Boolean);
  const body = html`
${head(ctx, {
  crumbs: [[null, 'Gear']],
  title: 'Trekking gear in Nepal',
  lead: g.intro,
  seed: 59,
})}
<div class="wrap section-tight">
  <div class="section-head"><div><h2>What to bring, rent and buy</h2></div><a class="link-arrow" href="${u('tools/packing/')}">Build a packing list${icon('arrow-right', { size: 18 })}</a></div>
  <div class="gear-grid">
    ${g.categories.map((c) => {
      const [label, cls] = MODE[c.mode] || MODE.either;
      return html`<article class="card card-pad gear-cat" id="gear-${c.id}">
        <div class="gear-cat-head"><span class="feature-icon">${icon(c.icon, { size: 22 })}</span><div><h3>${c.name}</h3><span class="badge ${cls}">${label}</span></div></div>
        <p class="small">${c.text}</p>
      </article>`;
    })}
  </div>
</div>

<section class="section-tight section-alt" aria-labelledby="rent-title">
  <div class="wrap grid grid-2" style="--gap:2.5rem">
    <div>
      <h2 id="rent-title">Renting without regrets</h2>
      <ul class="ticks">${g.checks.map((c) => html`<li>${c}</li>`)}</ul>
    </div>
    <div class="stack">
      ${fact(content, 'gearRental', 'Typical rental prices')}
    </div>
  </div>
</section>

<section class="section-tight" aria-labelledby="where-title">
  <div class="wrap">
    <div class="section-head"><div>
      <h2 id="where-title">Where to rent and buy</h2>
      <p>Most of the trekking shops in Nepal are in three places. ${hubsAsOf ? html`The counts are what OpenStreetMap showed on ${longDate(hubsAsOf)}.` : ''}</p>
    </div></div>
    <div class="grid grid-3 hub-grid">
      ${hubCards.map(
        (h) => html`<article class="card card-pad hub">
          <h3>${h.name}<span>${h.city}</span></h3>
          ${h.count ? html`<p class="hub-count"><strong>${h.count}</strong> ${h.countLabel}</p>` : ''}
          <p>${h.text}</p>
          <a class="link-arrow" href="https://www.openstreetmap.org/#map=17/${h.lat}/${h.lon}" rel="noopener">See ${h.name} on the map${icon('arrow-right', { size: 18 })}</a>
        </article>`,
      )}
    </div>
    <div class="grid grid-2 hub-notes">
      ${note('info', html`<p><strong>Ask your trekking company first.</strong> Many lend a sleeping bag and a down jacket for the trek, so you may not need to rent either.</p>`)}
      ${note('plain', html`<p><strong>Famous labels at low prices are usually local copies.</strong> They often do for one trek. Check the zips, the seams and the warmth yourself, and buy boots only if you have time to wear them in.</p>`)}
    </div>
  </div>
</section>
${directory('gear', 'Shops you can contact', 'Each one has confirmed where it is, what it rents and sells, and its prices.')}
${joinBand(ctx, { role: 'gear', title: 'Do you rent or sell trekking gear?', text: 'Put your shop, your stock and your prices in front of trekkers while they are still planning.', ne: 'ट्रेकिङका सामान भाडामा दिनुहुन्छ वा बेच्नुहुन्छ? आफ्नो पसल सूचीकृत गर्नुहोस्।' })}`;
  return {
    title: 'Trekking Gear in Nepal: What to Rent, Buy and Bring',
    description: 'What trekking gear to bring from home and what to rent or buy in Kathmandu and Pokhara, with typical rental prices and a checklist for renting.',
    section: 'services',
    scripts: ['directory'],
    crumbs: [[null, 'Gear']],
    body,
  };
}

// ------------------------------------------------------------------ partner application

const L = (en, ne) => html`${en}${ne ? html` <span class="ne-label" lang="ne">${ne}</span>` : ''}`;
const field = ({ id, en, ne, type = 'text', required = false, hint, attrs = '', placeholder = '' }) => html`<div class="field">
  <label for="pa-${id}">${L(en, ne)}${required ? raw(' <span class="req" aria-hidden="true">*</span>') : ''}</label>
  <input class="input" id="pa-${id}" name="${id}" type="${type}"${required ? raw(' required') : ''}${placeholder ? raw(` placeholder="${placeholder}"`) : ''} ${raw(attrs)}>
  ${hint ? html`<span class="hint">${hint}</span>` : ''}
</div>`;
const select = ({ id, en, ne, options, required = false }) => html`<div class="field">
  <label for="pa-${id}">${L(en, ne)}${required ? raw(' <span class="req" aria-hidden="true">*</span>') : ''}</label>
  <select class="select" id="pa-${id}" name="${id}"${required ? raw(' required') : ''}><option value="">Choose…</option>${options.map((o) => html`<option>${o}</option>`)}</select>
</div>`;
const checks = ({ name, en, ne, options }) => html`<fieldset class="span-all">
  <legend>${L(en, ne)}</legend>
  <div class="chips">${options.map((o) => html`<label class="chip"><input type="checkbox" name="${name}" value="${o}">${o}</label>`)}</div>
</fieldset>`;

export function partnersPage(ctx) {
  const { u, content, config } = ctx;
  const roles = [
    ['guide', 'signpost', 'Guide', 'गाइड', 'Licensed trekking guide'],
    ['porter', 'backpack', 'Porter', 'पोर्टर', 'Porter or porter-guide'],
    ['agency', 'building-2', 'Agency', 'एजेन्सी', 'Registered trekking company'],
    ['gear', 'store', 'Gear shop', 'सामान पसल', 'Rent or sell equipment'],
    ['other', 'plus', 'Something else', 'अन्य', 'Lodge, transport, crew'],
  ];
  const regionNames = content.regions.map((r) => r.name);
  const gearCats = content.gear.categories.map((c) => c.name);
  // where an application really goes decides what the page promises and what the button says
  const channel = channelOf(config);
  const SEND = { database: 'Send application', whatsapp: 'Send on WhatsApp', email: 'Send by email', '': 'Try the application' };

  const body = html`
${head(ctx, {
  crumbs: [[null, 'Join as a partner']],
  title: html`Join TrekkSewa <span class="ne" lang="ne">ट्रेकसेवामा सामेल हुनुहोस्</span>`,
  lead: 'We are enrolling the guides, porters, agencies and gear shops who will be listed first. Applying is free and takes about five minutes.',
  seed: 61,
})}
<div class="wrap section-tight partner-layout">
  <div>
    ${channel
      ? ''
      : html`<div data-preview-note>${note('warn', html`<p><strong>Preview.</strong> Online applications are not switched on yet. You can fill in the form to see how it works; your answers are kept on this device only and are not sent to TrekkSewa.</p>`)}</div>`}
    <form class="partner-form card card-pad" data-partner-form novalidate>
      <fieldset class="role-pick">
        <legend>${L('I am a…', 'म हुँ…')}</legend>
        <div class="role-grid">
          ${roles.map(
            ([id, ic, en, ne, sub], i) => html`<label class="role-card"><input type="radio" name="role" value="${id}"${i === 0 ? raw(' checked') : ''}>${icon(ic, { size: 24 })}<strong>${en}</strong><span lang="ne">${ne}</span><small>${sub}</small></label>`,
          )}
        </div>
      </fieldset>

      <h2>${L('About you', 'तपाईंको बारेमा')}</h2>
      <div class="form-grid">
        ${field({ id: 'name', en: 'Full name', ne: 'पूरा नाम', required: true, attrs: 'autocomplete="name" maxlength="120"' })}
        ${field({ id: 'phone', en: 'Mobile number', ne: 'मोबाइल नम्बर', type: 'tel', required: true, attrs: 'autocomplete="tel" inputmode="tel" maxlength="30" pattern="[0-9+ \\(\\)\\-]{6,30}"', hint: 'We will call or message this number before publishing anything.' })}
        ${field({ id: 'whatsapp', en: 'WhatsApp, if different', ne: 'ह्वाट्सएप नम्बर', type: 'tel', attrs: 'inputmode="tel" maxlength="30"' })}
        ${field({ id: 'email', en: 'Email (optional)', ne: 'इमेल (ऐच्छिक)', type: 'email', attrs: 'autocomplete="email" maxlength="160"' })}
        ${field({ id: 'district', en: 'Home district', ne: 'गृह जिल्ला', attrs: 'maxlength="60"', placeholder: 'e.g. Solukhumbu' })}
        ${field({ id: 'base', en: 'Where you are based for work', ne: 'काम गर्ने ठाउँ', attrs: 'maxlength="80"', placeholder: 'e.g. Kathmandu, Pokhara, Lukla' })}
      </div>

      <!-- guide -->
      <fieldset class="role-fields" data-role="guide">
        <h2>${L('Your guiding', 'गाइडको विवरण')}</h2>
        <div class="form-grid">
          ${field({ id: 'licence', en: 'Trekking guide licence number', ne: 'ट्रेकिङ गाइड लाइसेन्स नम्बर', required: true, attrs: 'maxlength="40"' })}
          ${field({ id: 'guide_years', en: 'Years of guiding', ne: 'अनुभव (वर्ष)', type: 'number', required: true, attrs: 'min="0" max="60" inputmode="numeric"' })}
          ${select({ id: 'first_aid', en: 'First-aid training', ne: 'प्राथमिक उपचार तालिम', options: ['None yet', 'Basic first aid', 'Wilderness first aid', 'Wilderness first responder or higher'] })}
          ${select({ id: 'guide_insurance', en: 'Are you insured for trekking?', ne: 'बीमा छ?', options: ['Yes, my own policy', 'Yes, through the agency I work with', 'No', 'Not sure'] })}
          ${field({ id: 'guide_rate', en: 'Daily rate you ask (NPR, optional)', ne: 'दैनिक ज्याला (रु.)', type: 'number', attrs: 'min="0" max="100000" inputmode="numeric"' })}
          ${field({ id: 'guide_agency', en: 'Agency you usually work with (optional)', ne: 'काम गर्ने एजेन्सी', attrs: 'maxlength="120"' })}
        </div>
      </fieldset>

      <!-- porter -->
      <fieldset class="role-fields" data-role="porter">
        <h2>${L('Your work', 'कामको विवरण')}</h2>
        <div class="form-grid">
          ${field({ id: 'porter_years', en: 'Years of portering', ne: 'अनुभव (वर्ष)', type: 'number', required: true, attrs: 'min="0" max="60" inputmode="numeric"' })}
          ${select({ id: 'porter_type', en: 'I work as', ne: 'म काम गर्छु', options: ['Porter', 'Porter-guide (I also lead and speak some English)'], required: true })}
          ${select({ id: 'porter_kit', en: 'Do you have your own boots and warm clothes?', ne: 'आफ्नै जुत्ता र न्यानो लुगा छ?', options: ['Yes', 'Some', 'No'] })}
          ${select({ id: 'porter_insurance', en: 'Are you insured when you work?', ne: 'काम गर्दा बीमा हुन्छ?', options: ['Yes', 'Sometimes, it depends on the agency', 'No', 'Not sure'] })}
          ${field({ id: 'porter_rate', en: 'Daily rate you ask (NPR, optional)', ne: 'दैनिक ज्याला (रु.)', type: 'number', attrs: 'min="0" max="100000" inputmode="numeric"' })}
          <label class="check span-all"><input type="checkbox" name="proxy" value="yes"><span>${L('Someone else is filling this in for me', 'मेरो तर्फबाट अरूले भर्दै हुनुहुन्छ')}</span></label>
        </div>
      </fieldset>

      <!-- agency -->
      <fieldset class="role-fields" data-role="agency">
        <h2>${L('Your company', 'कम्पनीको विवरण')}</h2>
        <div class="form-grid">
          ${field({ id: 'company', en: 'Company name', ne: 'कम्पनीको नाम', required: true, attrs: 'maxlength="160" autocomplete="organization"' })}
          ${field({ id: 'company_reg', en: 'Company registration number', ne: 'कम्पनी दर्ता नम्बर', required: true, attrs: 'maxlength="40"' })}
          ${field({ id: 'tourism_licence', en: 'Department of Tourism licence number', ne: 'पर्यटन इजाजतपत्र नम्बर', required: true, attrs: 'maxlength="40"' })}
          ${field({ id: 'pan', en: 'PAN / VAT number', ne: 'प्यान / भ्याट नम्बर', required: true, attrs: 'maxlength="40"' })}
          ${field({ id: 'taan', en: 'TAAN membership number (optional)', ne: 'टान सदस्यता नम्बर', attrs: 'maxlength="40"' })}
          ${field({ id: 'since', en: 'Operating since (year)', ne: 'स्थापना वर्ष', type: 'number', attrs: 'min="1950" max="2100" inputmode="numeric"' })}
          ${field({ id: 'website', en: 'Website (optional)', ne: 'वेबसाइट', type: 'url', attrs: 'maxlength="200"', placeholder: 'https://' })}
          ${field({ id: 'address', en: 'Office address', ne: 'कार्यालयको ठेगाना', attrs: 'maxlength="200" autocomplete="street-address"' })}
          ${checks({ name: 'agency_services', en: 'What you arrange', ne: 'सेवाहरू', options: ['Restricted-area permits', 'Full-service treks', 'Guide and porter hire', 'Camping treks', 'Peak climbing', 'Flights and transport'] })}
        </div>
      </fieldset>

      <!-- gear -->
      <fieldset class="role-fields" data-role="gear">
        <h2>${L('Your shop', 'पसलको विवरण')}</h2>
        <div class="form-grid">
          ${field({ id: 'shop', en: 'Shop name', ne: 'पसलको नाम', required: true, attrs: 'maxlength="160"' })}
          ${field({ id: 'shop_place', en: 'Where the shop is', ne: 'पसलको ठेगाना', required: true, attrs: 'maxlength="160"', placeholder: 'e.g. Thamel, Kathmandu' })}
          ${checks({ name: 'gear_offer', en: 'You offer', ne: 'के सेवा दिनुहुन्छ?', options: ['Rental', 'Sales', 'Repairs'] })}
          ${checks({ name: 'gear_categories', en: 'What you stock', ne: 'सामानका प्रकार', options: gearCats })}
        </div>
      </fieldset>

      <!-- other -->
      <fieldset class="role-fields" data-role="other">
        <h2>${L('What you do', 'तपाईंको काम')}</h2>
        <div class="form-grid">
          ${select({ id: 'other_type', en: 'Type of service', ne: 'सेवाको प्रकार', options: ['Lodge or teahouse', 'Jeep or transport', 'Cook or kitchen crew', 'Mountaineering or climbing guide', 'Something else'], required: true })}
          ${field({ id: 'other_name', en: 'Business name (optional)', ne: 'व्यवसायको नाम', attrs: 'maxlength="160"' })}
        </div>
      </fieldset>

      <h2>${L('Where you work', 'काम गर्ने क्षेत्र')}</h2>
      <div class="form-grid">
        ${checks({ name: 'regions', en: 'Regions', ne: 'क्षेत्रहरू', options: regionNames })}
        ${checks({ name: 'languages', en: 'Languages you speak', ne: 'बोल्ने भाषाहरू', options: ['Nepali', 'English', 'Hindi', 'Chinese', 'Japanese', 'Korean', 'French', 'German', 'Spanish'] })}
        <div class="field span-all">
          <label for="pa-notes">${L('Anything else we should know?', 'अरू केही भन्नु छ?')}</label>
          <textarea class="textarea" id="pa-notes" name="notes" maxlength="1200" rows="3"></textarea>
        </div>
      </div>

      <div class="hp" aria-hidden="true"><label>Leave this empty<input type="text" name="website_url" tabindex="-1" autocomplete="off"></label></div>

      <div class="partner-consent">
        <label class="check" data-pledge><input type="checkbox" name="pledge" value="yes" required><span>${L('I accept the', '')} <a href="${u('services/#standards')}" target="_blank" rel="noopener">fair-trek standards</a>. <span class="ne-label" lang="ne">म निष्पक्ष ट्रेक मापदण्ड स्वीकार गर्छु।</span></span></label>
        <label class="check"><input type="checkbox" name="consent" value="yes" required><span>${L('These details are true, and TrekkSewa may contact me about my listing.', 'मैले दिएको विवरण सही छ, र ट्रेकसेवाले मलाई सम्पर्क गर्न सक्छ।')}</span></label>
      </div>
      <p class="form-error" data-form-error role="alert" hidden></p>
      <div class="cluster" style="--gap:.75rem">
        <button class="btn btn-lg" type="submit" data-submit>${icon('handshake')}<span>${SEND[channel]}</span></button>
        <span class="small muted" lang="ne">${channel ? 'आवेदन पठाउनुहोस्' : ''}</span>
      </div>
      <p class="xsmall muted">Fields marked * are needed. We use what you send only to review and publish your listing. See the <a href="${u('privacy/')}">privacy page</a>.</p>
    </form>
    <section class="partner-done card card-pad" data-partner-done hidden tabindex="-1" aria-live="polite"></section>
    <noscript>${note('warn', html`<p>The application form needs JavaScript to send.</p>`)}</noscript>
  </div>

  <aside class="stack partner-side">
    <div class="card card-pad">
      <h2 class="mini-h">What happens next</h2>
      <ol class="mini-steps">
        <li>We read your application and check the licence or registration you gave.</li>
        <li>We contact you on your mobile number to confirm the details.</li>
        <li>Your profile is published only when you have seen and approved it.</li>
      </ol>
    </div>
    <div class="card card-pad">
      <h2 class="mini-h">What your profile shows</h2>
      <ul class="ticks small">
        <li>Your name, where you work from and the routes you know</li>
        <li>Your licence or registration number, and the day we checked it</li>
        <li>Your languages, experience and first-aid training</li>
        <li>Your daily rate and what it includes, if you want to show it</li>
        <li>A way to reach you directly: WhatsApp, phone or email</li>
      </ul>
    </div>
    <div class="card card-pad">
      <h2 class="mini-h">What we ask of partners</h2>
      <ul class="ticks small">${STANDARDS.slice(0, 4).map(([, title]) => html`<li>${title}</li>`)}</ul>
      <a class="link-arrow small" href="${u('services/#standards')}">All the standards${icon('arrow-right', { size: 16 })}</a>
    </div>
    <div class="card card-pad">
      <h2 class="mini-h">Your details</h2>
      <p class="small">Your phone number is shown on your profile only if you choose that. We do not sell or share applicant details.</p>
    </div>
  </aside>
</div>
<script type="application/json" id="partner-config">${jsonScript({ contact: config.contact })}</script>`;
  return {
    title: 'Join as a Guide, Porter, Agency or Gear Shop',
    description: 'Trekking guides, porters, registered agencies and gear shops in Nepal can apply to be listed on TrekkSewa. Free to apply, in English or Nepali.',
    section: 'services',
    scripts: ['partners'],
    crumbs: [[null, 'Join as a partner']],
    body,
  };
}
