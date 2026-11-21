// Safety hub and the three safety tools.

import { html, raw, jsonScript } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { ridgeStrip } from '../lib/landscape.mjs';
import { LLS_ITEMS, LLS_FUNCTION, RED_FLAGS, RULES, ZONES } from '../lib/altitude.mjs';
import { num } from '../lib/format.mjs';
import { note } from './partials.mjs';

const head = (ctx, { crumbs, title, lead, seed, eyebrow }) => html`<header class="page-head">
  <div class="wrap">
    <nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="${ctx.u()}">Home</a></li>${crumbs.map(([href, label]) => (href ? html`<li><a href="${ctx.u(href)}">${label}</a></li>` : html`<li aria-current="page">${label}</li>`))}</ol></nav>
    ${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ''}
    <h1>${title}</h1>
    <p class="lead">${lead}</p>
  </div>
  ${raw(ridgeStrip({ seed }))}
</header>`;

const disclaimer = () =>
  note(
    'plain',
    html`<p><strong>This is an educational aid, not a diagnosis.</strong> It cannot examine you and it can be wrong. If someone is getting worse at altitude, go down. If you are unsure, go down.</p>`,
    { iconName: 'info' },
  );

// ------------------------------------------------------------------ hub

export function safetyHubPage(ctx) {
  const { u } = ctx;
  const body = html`
${head(ctx, {
  crumbs: [[null, 'Safety']],
  title: 'Trekking safety in Nepal',
  lead: 'Most trekkers who get into trouble in Nepal are fit, well equipped and going too high too fast. Three tools and a few rules cover most of what goes wrong.',
  seed: 31,
})}
<div class="wrap section-tight">
  <div class="grid grid-4">
    <a class="card card-pad card-link feature" href="${u('safety/altitude-check/')}"><span class="feature-icon">${icon('heart-pulse', { size: 22 })}</span><h2 class="h3">Altitude sickness check</h2><p>Score your symptoms on the Lake Louise scale and get a clear next step. Keeps a history so you can see the trend.</p></a>
    <a class="card card-pad card-link feature" href="${u('safety/acclimatization/')}"><span class="feature-icon">${icon('trending-up', { size: 22 })}</span><h2 class="h3">Acclimatization checker</h2><p>Test any itinerary against ascent guidelines before you book it, and see where an extra night matters.</p></a>
    <a class="card card-pad card-link feature feature-sos" href="${u('safety/emergency/')}"><span class="feature-icon">${icon('siren', { size: 22 })}</span><h2 class="h3">Emergency &amp; SOS</h2><p>Rescue numbers, a one-tap location message, a whistle and a light signal, and how evacuation works.</p></a>
    <a class="card card-pad card-link feature" href="${u('safety/insurance/')}"><span class="feature-icon">${icon('shield-check', { size: 22 })}</span><h2 class="h3">Insurance check</h2><p>What your policy has to cover for the trek you have chosen, as a list to go through with the small print.</p></a>
  </div>
  <p class="small muted" style="margin-top:1rem">${icon('wifi-off', { size: 15 })} All of these work offline once you have opened them.</p>
</div>

<section class="section-tight band" aria-labelledby="rules-title">
  <div class="wrap">
    <p class="eyebrow">The three rules of altitude</p>
    <h2 id="rules-title">If you remember nothing else</h2>
    <ol class="rules">
      <li><span>1</span><h3>If you feel unwell up high, it is altitude until proven otherwise</h3><p>A headache with nausea, tiredness or dizziness above 2,500 m is altitude sickness. Do not explain it away as a cold, the food or the sun.</p></li>
      <li><span>2</span><h3>Never go higher with symptoms</h3><p>Stay where you are until they clear. A day lost to rest is cheaper than a helicopter.</p></li>
      <li><span>3</span><h3>If you are getting worse, go down now</h3><p>Not after breakfast, not when the group is ready. Descending 500 to 1,000 m is the treatment, and it works.</p></li>
    </ol>
  </div>
</section>

<section class="section-tight" aria-labelledby="o2-title" data-o2>
  <div class="wrap o2">
    <div>
      <h2 id="o2-title">How thin is the air?</h2>
      <p class="muted">The air is the same mix all the way up; there is simply less of it in each breath. Slide to a height to see what your body has to work with.</p>
      <div class="field o2-field">
        <label for="o2-alt">Altitude: <output data-o2-alt for="o2-alt">3,440 m</output></label>
        <input type="range" id="o2-alt" min="0" max="6000" step="20" value="3440" data-o2-range>
        <div class="chips o2-presets">
          <button type="button" class="chip" data-o2-set="1400">Kathmandu</button>
          <button type="button" class="chip" data-o2-set="3440">Namche</button>
          <button type="button" class="chip" data-o2-set="4130">Annapurna BC</button>
          <button type="button" class="chip" data-o2-set="5364">Everest BC</button>
          <button type="button" class="chip" data-o2-set="5416">Thorong La</button>
        </div>
      </div>
    </div>
    <dl class="stats">
      <div><dt>Oxygen per breath</dt><dd><span data-o2-pct>65%</span><small>of sea level, roughly</small></dd></div>
      <div><dt>Altitude zone</dt><dd class="stat-text"><span data-o2-zone>High altitude</span></dd></div>
      <div><dt>Water boils at</dt><dd><span data-o2-boil>88.5 °C</span><small>food takes longer to cook</small></dd></div>
    </dl>
  </div>
</section>

<section class="section" aria-labelledby="ill-title">
  <div class="wrap">
    <div class="section-head"><div><h2 id="ill-title">Three illnesses, one cause</h2><p>All come from going higher than your body has adapted to. The first is common and a warning. The other two can kill within hours.</p></div></div>
    <div class="grid grid-3 illness">
      <article class="card card-pad">
        <span class="badge badge-watch">Common</span>
        <h3>AMS: acute mountain sickness</h3>
        <p>Headache plus at least one of: loss of appetite or nausea, unusual tiredness, dizziness. Usually starts 6 to 12 hours after arriving higher.</p>
        <p><strong>Do:</strong> stop ascending, rest, drink, take a simple painkiller. Go down if it is no better in a day or gets worse.</p>
      </article>
      <article class="card card-pad">
        <span class="badge badge-danger">Emergency</span>
        <h3>HACE: swelling of the brain</h3>
        <p>AMS that progresses to staggering, confusion, odd behaviour or drowsiness. The heel-to-toe walking test fails.</p>
        <p><strong>Do:</strong> descend immediately with help, day or night. Give oxygen if there is any. Call for evacuation.</p>
      </article>
      <article class="card card-pad">
        <span class="badge badge-danger">Emergency</span>
        <h3>HAPE: fluid in the lungs</h3>
        <p>Breathless at rest, a wet cough, sometimes frothy or pink spit, a tight chest and a sudden drop in performance. Can occur without AMS first.</p>
        <p><strong>Do:</strong> descend immediately with as little exertion as possible. Keep warm, give oxygen. Call for evacuation.</p>
      </article>
    </div>
  </div>
</section>

<section class="section section-alt" aria-labelledby="prev-title">
  <div class="wrap grid grid-2" style="--gap:2.5rem">
    <div>
      <h2 id="prev-title">Going up sensibly</h2>
      <ul class="ticks">
        <li>Above about ${num(RULES.startAlt)} m, raise your sleeping altitude by no more than roughly ${RULES.dailyGain} m a day.</li>
        <li>Add a night with no gain for every ${num(RULES.restEvery)} m you climb.</li>
        <li>Climb high in the day if you like, but sleep low.</li>
        <li>Avoid going from below ${num(RULES.jumpFrom)} m to sleep above ${num(RULES.jumpTo)} m in a single day when you have the choice.</li>
        <li>Drink enough to keep your urine pale, eat even when you are not hungry, and leave alcohol for the way down.</li>
        <li>Walk slower than you think you need to. The fittest person in the group is not the safest.</li>
        <li>Tell someone how you feel every evening, honestly. Hiding a headache is how people get hurt.</li>
      </ul>
      <p class="small muted">These figures follow the ascent-rate advice in the Wilderness Medical Society's practice guidelines. People differ: some need longer.</p>
    </div>
    <div class="stack">
      <div class="card card-pad">
        <h3>${icon('pill', { size: 18 })} Medicines</h3>
        <p class="small">Acetazolamide (Diamox) can help prevent AMS and speed acclimatization. It is a prescription medicine with side effects and is not suitable for everyone, so talk to a travel doctor before your trip rather than buying it on the trail. No medicine makes it safe to keep climbing with symptoms.</p>
      </div>
      <div class="card card-pad">
        <h3>${icon('shield-check', { size: 18 })} Insurance</h3>
        <p class="small">Your policy must name helicopter evacuation and cover trekking to the highest point on your route. Many standard policies stop at 3,000 or 4,000 m. Carry the policy number and the 24-hour assistance phone on paper.</p>
        <a class="link-arrow small" href="${u('safety/emergency/#rescue')}">How rescue works in Nepal${icon('arrow-right', { size: 16 })}</a>
      </div>
      <div class="card card-pad">
        <h3>${icon('layers', { size: 18 })} Altitude zones</h3>
        <dl class="kv small">${ZONES.slice(1).map((z) => html`<dt>${num(z.min)}–${z.max >= 9000 ? '' : num(z.max)} m</dt><dd><strong>${z.label}.</strong> ${z.note}</dd>`)}</dl>
      </div>
    </div>
  </div>
</section>`;
  return {
    title: 'Trekking Safety in Nepal: Altitude, Acclimatization & Rescue',
    description: 'How to stay safe on a Nepal trek: the three rules of altitude, AMS, HACE and HAPE, sensible ascent rates, and free offline tools for symptom checks and emergencies.',
    section: 'safety',
    scripts: ['safety'],
    crumbs: [[null, 'Safety']],
    body,
  };
}

// ------------------------------------------------------------------ AMS self-check

export function amsPage(ctx) {
  const { u } = ctx;
  const q = (item, name) => html`<fieldset class="q">
    <legend>${item.label}</legend>
    <div class="q-options">
      ${item.options.map((o, i) => html`<label class="q-opt"><input type="radio" name="${name}" value="${i}"${i === 0 ? raw(' checked') : ''}><span class="q-score">${i}</span><span>${o}</span></label>`)}
    </div>
  </fieldset>`;
  const body = html`
${head(ctx, {
  crumbs: [['safety/', 'Safety'], [null, 'Altitude sickness check']],
  title: 'Altitude sickness check',
  lead: 'Answer for how you feel right now. It takes a minute, works offline and tells you plainly whether to carry on, rest or go down.',
  seed: 33,
})}
<div class="wrap wrap-narrow section-tight">
  ${disclaimer()}
  <form class="ams card card-pad" data-ams novalidate>
    <div class="ams-context">
      <div class="field">
        <label for="ams-alt">Where are you sleeping tonight? <span class="muted">(altitude in metres, optional)</span></label>
        <input class="input" type="number" id="ams-alt" name="altitude" inputmode="numeric" min="0" max="8848" step="10" placeholder="e.g. 4410" list="ams-alt-list">
        <datalist id="ams-alt-list"><option value="2860" label="Lukla"><option value="3440" label="Namche Bazaar"><option value="3540" label="Manang"><option value="3870" label="Kyanjin Gompa"><option value="4130" label="Annapurna Base Camp"><option value="4410" label="Dingboche"><option value="4940" label="Lobuche"><option value="5164" label="Gorak Shep"></datalist>
      </div>
      <label class="check"><input type="checkbox" name="recent" checked><span>I have gained altitude in the last couple of days</span></label>
    </div>

    <h2>How do you feel?</h2>
    ${LLS_ITEMS.map((item) => q(item, item.id))}

    <h2>Effect on your day</h2>
    ${q(LLS_FUNCTION, 'function')}

    <h2>Danger signs</h2>
    <p class="muted small">Tick anything you or your companions have noticed. Ask someone else to check: people with these signs often do not see them in themselves.</p>
    <div class="flags-list">
      ${RED_FLAGS.map((f) => html`<label class="check flag"><input type="checkbox" name="flag" value="${f.id}"><span>${f.label}</span></label>`)}
    </div>

    <div class="ams-actions">
      <button class="btn btn-lg" type="submit">${icon('heart-pulse')}See my result</button>
      <button class="btn btn-ghost" type="reset">Start again</button>
    </div>
  </form>

  <section class="ams-result" data-ams-result hidden tabindex="-1" aria-live="polite"></section>

  <section class="ams-history" data-ams-history hidden>
    <div class="section-head"><h2>Your recent checks</h2><button type="button" class="btn btn-ghost btn-sm" data-ams-clear>Clear history</button></div>
    <ol class="history" data-ams-history-list></ol>
    <p class="xsmall muted">Stored only on this device. Scores that rise from one check to the next matter more than any single number.</p>
  </section>

  <section class="prose ams-about">
    <h2>How this works</h2>
    <p>The questions are the Lake Louise Acute Mountain Sickness score in its 2018 revision, the scale doctors and researchers use in the field. Four symptoms are each scored from 0 to 3. Altitude sickness is a headache with a total score of 3 or more, after a recent gain in height. A score of 3 to 5 is mild, 6 to 9 moderate and 10 to 12 severe.</p>
    <p>The danger signs are separate. They point to the two life-threatening forms of altitude illness, in the brain (HACE) and the lungs (HAPE), and any one of them means descending at once whatever the score says.</p>
    <p>Wait about six hours after arriving at a new height before you trust a low score: symptoms take time to appear. Repeat the check morning and evening while you are above 3,000 m.</p>
    <p class="small"><a href="${u('safety/')}">More on altitude illness</a> · <a href="${u('credits/#medical')}">Sources</a></p>
  </section>
</div>`;
  return {
    title: 'Altitude Sickness Self-Check (Lake Louise AMS Score)',
    description: 'A free, offline altitude sickness check based on the Lake Louise AMS score. Answer five questions and get a clear next step: carry on, rest or descend.',
    section: 'safety',
    scripts: ['ams'],
    crumbs: [['safety/', 'Safety'], [null, 'Altitude sickness check']],
    body,
  };
}

// ------------------------------------------------------------------ acclimatization checker

export function acclimatizationPage(ctx) {
  const { u, content } = ctx;
  const body = html`
${head(ctx, {
  crumbs: [['safety/', 'Safety'], [null, 'Acclimatization checker']],
  title: 'Acclimatization checker',
  lead: 'Load one of our itineraries or type in your own sleeping altitudes. The checker marks the nights that gain height too fast and shows what an extra night does.',
  seed: 35,
})}
<div class="wrap section-tight">
  <div class="accl-tool" data-accl>
    <div class="card card-pad accl-controls">
      <div class="form-grid">
        <div class="field">
          <label for="accl-trek">Start from an itinerary</label>
          <select class="select" id="accl-trek" data-accl-trek>
            <option value="">My own itinerary</option>
            ${content.regions.filter((r) => r.treks.length).map((r) => html`<optgroup label="${r.long}">${r.treks.map((t) => html`<option value="${t.slug}">${t.name} (${t.days} days)</option>`)}</optgroup>`)}
          </select>
        </div>
        <div class="field">
          <label for="accl-start">Altitude you set out from <span class="muted">(m)</span></label>
          <input class="input" type="number" id="accl-start" data-accl-start inputmode="numeric" min="0" max="6000" step="10" value="1400">
          <span class="hint">Kathmandu is 1,400 m, Pokhara 820 m.</span>
        </div>
      </div>
      <div class="accl-summary" data-accl-summary aria-live="polite"></div>
    </div>

    <figure class="card card-pad profile-card" data-accl-chart aria-label="Sleeping altitude by night"></figure>

    <div class="card accl-table-card">
      <div class="table-wrap accl-table-wrap">
        <table class="accl-table">
          <thead><tr><th>Night</th><th>Where you sleep</th><th class="num">Altitude (m)</th><th class="num">Gain</th><th>Check</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody data-accl-rows></tbody>
        </table>
      </div>
      <div class="accl-foot">
        <button type="button" class="btn btn-secondary btn-sm" data-accl-add>${icon('plus', { size: 16 })}Add a night</button>
        <button type="button" class="btn btn-ghost btn-sm" data-accl-reset>Reset</button>
        <button type="button" class="btn btn-ghost btn-sm" data-print>${icon('printer', { size: 16 })}Print</button>
      </div>
    </div>
    <noscript>${note('warn', html`<p>This tool needs JavaScript. Every trek page already shows the same check for its itinerary.</p>`)}</noscript>
  </div>

  <div class="grid grid-2" style="--gap:2rem;margin-top:2.5rem">
    <div class="prose">
      <h2>What the checker looks for</h2>
      <ul>
        <li><strong>Daily gain.</strong> Once you sleep above ${num(RULES.startAlt)} m, a rise of more than about ${RULES.dailyGain} m in sleeping altitude is marked for attention, and more than ${RULES.bigGain} m is marked as too fast.</li>
        <li><strong>Rest nights.</strong> Roughly every ${num(RULES.restEvery)} m gained should include a night at the same height or lower.</li>
        <li><strong>The first jump.</strong> Arriving from below ${num(RULES.jumpFrom)} m to sleep above ${num(RULES.jumpTo)} m in one day, by road or by air, is a known risk.</li>
      </ul>
      <p>Only where you sleep counts. A day hike to a high viewpoint followed by a night lower down helps rather than hurts.</p>
    </div>
    <div>
      ${disclaimer()}
      <p class="small muted" style="margin-top:1rem">The thresholds follow the Wilderness Medical Society's practice guidelines for altitude illness. Many standard itineraries break them by a small margin, and most people cope. A marked night is a reason to pay attention, not proof of danger. <a href="${u('safety/altitude-check/')}">Check your symptoms</a> on the day.</p>
    </div>
  </div>
</div>`;
  return {
    title: 'Acclimatization Checker for Trek Itineraries',
    description: 'Check any trekking itinerary against altitude ascent guidelines. See which nights gain sleeping altitude too fast and where to add a rest day.',
    section: 'safety',
    scripts: ['acclimatization'],
    crumbs: [['safety/', 'Safety'], [null, 'Acclimatization checker']],
    body,
  };
}

// ------------------------------------------------------------------ emergency

export function emergencyPage(ctx) {
  const { u, content } = ctx;
  const e = content.emergency || { national: [], rescue: [], hospitals: [], aidPosts: [], howRescueWorks: [] };
  const tel = (n) => `tel:${String(n).replace(/[^+\d]/g, '')}`;
  const quick = e.national.filter((n) => ['100', '1144', '102'].includes(n.number));
  const body = html`
<header class="page-head sos-head">
  <div class="wrap">
    <nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="${u()}">Home</a></li><li><a href="${u('safety/')}">Safety</a></li><li aria-current="page">Emergency</li></ol></nav>
    <h1>Emergency &amp; SOS</h1>
    <p class="lead">Call for help, send your exact position and signal for attention. Everything here works offline once the page has been opened.</p>
    <div class="sos-calls">
      ${quick.map((n) => html`<a class="sos-call" href="${tel(n.number)}"><span>${n.name.replace(' hotline', '')}</span><strong>${n.number}</strong></a>`)}
    </div>
  </div>
</header>
<div class="wrap section-tight sos-layout">
  <div class="sos-main">
    ${note(
      'danger',
      html`<p><strong>Altitude illness getting worse? Go down now.</strong> Descending 500 to 1,000 m is the treatment. Do not wait for a helicopter if the person can be moved. <a href="${u('safety/altitude-check/')}">Check symptoms</a></p>`,
    )}

    <section class="card card-pad sos-card" id="location" aria-labelledby="loc-title" data-locate>
      <h2 id="loc-title">${icon('locate-fixed', { size: 22 })}Send my location</h2>
      <p class="muted small">Your phone's GPS works without mobile signal. Sending the message needs signal or Wi-Fi; with neither, show these coordinates to whoever goes for help.</p>
      <div class="loc-box" data-loc-box>
        <p class="loc-coords" data-loc-coords>Position not fixed yet</p>
        <p class="small muted" data-loc-meta>Tap the button and allow location access.</p>
      </div>
      <div class="cluster" style="--gap:.6rem">
        <button type="button" class="btn btn-danger" data-loc-get>${icon('locate-fixed', { size: 18 })}Get my position</button>
        <button type="button" class="btn btn-secondary" data-loc-copy disabled>${icon('copy', { size: 18 })}Copy</button>
      </div>
      <div class="form-grid sos-form">
        <div class="field"><label for="sos-name">Your name</label><input class="input" id="sos-name" data-sos-field="name" autocomplete="name"></div>
        <div class="field"><label for="sos-people">People in the group</label><input class="input" id="sos-people" data-sos-field="people" inputmode="numeric" placeholder="e.g. 2"></div>
        <div class="field span-all"><label for="sos-problem">What is wrong</label>
          <select class="select" id="sos-problem" data-sos-field="problem">
            <option value="">Choose…</option><option>Altitude sickness, cannot walk down</option><option>Injury, cannot walk</option><option>Lost or stranded</option><option>Serious illness</option><option>Trapped by weather, snow or landslide</option>
          </select>
        </div>
        <div class="field span-all"><label for="sos-msg">Message</label><textarea class="textarea" id="sos-msg" data-sos-message rows="5"></textarea><span class="hint">Edit it if you need to. Short and factual is best.</span></div>
      </div>
      <div class="cluster" style="--gap:.6rem">
        <a class="btn btn-danger" data-sos-sms href="sms:">${icon('message-circle', { size: 18 })}Send by SMS</a>
        <a class="btn btn-secondary" data-sos-wa href="https://wa.me/" target="_blank" rel="noopener">WhatsApp</a>
        <button type="button" class="btn btn-secondary" data-sos-share>${icon('share-2', { size: 18 })}Share…</button>
      </div>
    </section>

    <section class="card card-pad sos-card" id="signal" aria-labelledby="sig-title">
      <h2 id="sig-title">${icon('megaphone', { size: 22 })}Signal for attention</h2>
      <p class="muted small">Three short, three long, three short is SOS. Repeat it, pause, and repeat. Searchers look and listen for anything in a rhythm.</p>
      <div class="grid grid-2" style="--gap:.75rem">
        <button type="button" class="signal-btn" data-whistle aria-pressed="false">${icon('volume-2', { size: 26 })}<strong>SOS whistle</strong><span>Loud tone from your speaker. Turn the volume up.</span></button>
        <button type="button" class="signal-btn" data-strobe aria-pressed="false">${icon('flashlight', { size: 26 })}<strong>SOS light</strong><span>Flashes the screen, and the torch where the phone allows it.</span></button>
      </div>
      <p class="xsmall muted">The light flashes slowly, but if flashing lights affect you, do not use it. Both stop when you tap again.</p>
    </section>

    <section class="sos-section" id="numbers" aria-labelledby="num-title">
      <h2 id="num-title">Who to call</h2>
      <div class="contact-list">
        ${e.national.map((n) => html`<a class="contact" href="${tel(n.number)}"><span class="contact-num">${n.number}</span><span><strong>${n.name}</strong><small>${n.note}</small></span></a>`)}
      </div>
      <h3>Rescue and advice</h3>
      <div class="contact-list">
        ${e.rescue.map(
          (r) => html`<div class="contact contact-block"><span><strong>${r.name}</strong><small>${r.note}</small><span class="contact-nums">${r.numbers.map((n) => html`<a href="${tel(n)}">${n}</a>`)}</span></span></div>`,
        )}
      </div>
      <h3>Hospitals trekkers use</h3>
      <div class="contact-list">
        ${e.hospitals.map(
          (r) => html`<div class="contact contact-block"><span><strong>${r.name}</strong> <span class="tag tag-plain">${r.place}</span><small>${r.note}</small><span class="contact-nums">${r.numbers.map((n) => html`<a href="${tel(n)}">${n}</a>`)}</span></span></div>`,
        )}
      </div>
      ${e.aidPosts && e.aidPosts.length
        ? html`<h3>Aid posts on the trail</h3>
          <div class="contact-list">
            ${e.aidPosts.map((a) => html`<div class="contact contact-block"><span><strong>${a.name}</strong> <span class="tag tag-plain">${num(a.altitude)} m</span><small>${a.season} ${a.note}</small></span></div>`)}
          </div>`
        : ''}
      <p class="xsmall muted">Numbers checked ${e.reviewed || ctx.config.contentReviewed}. Kathmandu landlines changed format in recent years, so an old card or guidebook may show numbers that no longer connect. Save these to your phone before you leave the city.</p>
    </section>

    <section class="sos-section" id="rescue" aria-labelledby="res-title">
      <h2 id="res-title">How rescue works in Nepal</h2>
      <ol class="rescue-steps">${e.howRescueWorks.map((p) => html`<li><p>${p}</p></li>`)}</ol>
    </section>

    <section class="sos-section" aria-labelledby="tell-title">
      <h2 id="tell-title">What to tell them</h2>
      <ul class="ticks">
        <li>Who you are, your nationality and how many people need help.</li>
        <li>Exactly where you are: coordinates, the nearest village or lodge, and which side of the valley.</li>
        <li>What is wrong, since when, and whether the person can walk.</li>
        <li>Your insurer, policy number and its 24-hour assistance phone.</li>
        <li>A phone number or a lodge name where you can be reached, and the weather where you are.</li>
      </ul>
    </section>
  </div>

  <aside class="sos-side" aria-label="My emergency card">
    <section class="card card-pad ice" data-ice>
      <h2>${icon('badge-check', { size: 20 })}My emergency card</h2>
      <p class="small muted">Fill this in before you leave the city. It stays on this device only and is added to your SOS message.</p>
      <div class="stack" style="--stack:.75rem">
        <div class="field"><label for="ice-nat">Nationality</label><input class="input" id="ice-nat" data-ice-field="nationality" autocomplete="country-name"></div>
        <div class="field"><label for="ice-pass">Passport number</label><input class="input" id="ice-pass" data-ice-field="passport" autocomplete="off"></div>
        <div class="field"><label for="ice-blood">Blood group, allergies, medicines</label><input class="input" id="ice-blood" data-ice-field="medical" autocomplete="off"></div>
        <div class="field"><label for="ice-ins">Insurer and policy number</label><input class="input" id="ice-ins" data-ice-field="insurer" autocomplete="off"></div>
        <div class="field"><label for="ice-assist">Insurer's 24-hour phone</label><input class="input" id="ice-assist" data-ice-field="assist" type="tel" autocomplete="off"></div>
        <div class="field"><label for="ice-contact">Emergency contact at home</label><input class="input" id="ice-contact" data-ice-field="contact" autocomplete="off" placeholder="Name and phone"></div>
        <div class="field"><label for="ice-agency">Agency or guide phone</label><input class="input" id="ice-agency" data-ice-field="agency" type="tel" autocomplete="off"></div>
      </div>
      <div class="cluster" style="--gap:.5rem;margin-top:1rem">
        <button type="button" class="btn btn-secondary btn-sm" data-ice-show>${icon('eye', { size: 16 })}Show large</button>
        <button type="button" class="btn btn-ghost btn-sm" data-print>${icon('printer', { size: 16 })}Print</button>
        <button type="button" class="btn btn-ghost btn-sm" data-ice-clear>Clear</button>
      </div>
      <p class="xsmall muted" data-ice-status role="status"></p>
    </section>
  </aside>
</div>
<dialog class="ice-dialog" data-ice-dialog aria-label="Emergency card">
  <div class="ice-big" data-ice-big></div>
  <button type="button" class="btn btn-secondary" data-close>Close</button>
</dialog>
<div class="strobe" data-strobe-screen hidden><button type="button" class="btn btn-lg btn-secondary">Tap to stop</button></div>`;
  return {
    title: 'Emergency & SOS in Nepal: Rescue Numbers, Location Sharing',
    description: 'Emergency numbers for Nepal, one-tap location sharing by SMS, SOS whistle and light, hospitals, aid posts and how helicopter rescue works. Works offline.',
    section: 'safety',
    scripts: ['emergency'],
    bodyClass: 'sos-page',
    crumbs: [['safety/', 'Safety'], [null, 'Emergency']],
    body,
    jsonLd: [],
  };
}

// ------------------------------------------------------------------ insurance check

const INSURANCE_CHECKS = [
  ['altitude', 'Trekking is covered as an activity up to at least <span data-ins-tier>the highest point of your route</span>.', 'The limit applies to the highest point you reach, not to where you sleep. Many standard and credit-card policies stop at 3,000 or 4,000 m.'],
  ['heli', 'Helicopter evacuation and search and rescue are named in the policy.', 'Look for a low sub-limit hidden in the schedule. A single flight can cost several thousand dollars.'],
  ['medical', 'Emergency medical treatment in Nepal and repatriation home are covered.', ''],
  ['assist', 'There is a 24-hour assistance number, and I have it on paper as well as on my phone.', 'Add it to your emergency card on this site.'],
  ['approval', 'I know whether the insurer must approve a helicopter before it flies.', 'Most must. A flight they did not authorise may not be reimbursed, so the first call in an emergency is to them.'],
  ['dates', 'The policy covers the whole trip, including spare days for delayed flights.', ''],
  ['declared', 'Pre-existing conditions and any altitude medicine I have been prescribed are declared.', ''],
  ['delay', 'Trip delay, missed connections and cancellation are included, or I have chosen to go without.', 'Mountain flights are cancelled often.'],
  ['technical', 'If my route crosses a glacier or needs crampons or a rope, that is not excluded.', 'This matters on the Cho La, the Dhaulagiri Circuit and other high passes.', 'technical'],
  ['shared', 'My guide or agency has a copy of the policy number and the assistance phone.', ''],
];

export function insurancePage(ctx) {
  const { u, content } = ctx;
  const cost = content.facts?.helicopterRescueCost;
  const body = html`
${head(ctx, {
  crumbs: [['safety/', 'Safety'], [null, 'Insurance check']],
  title: 'Insurance check',
  lead: 'Most travel policies do not cover what a Nepal trek actually involves. Pick your trek and go through this list with the policy wording in front of you.',
  seed: 37,
})}
<div class="wrap section-tight ins-layout" data-insurance>
  <div>
    <div class="card card-pad">
      <div class="field" style="max-width:28rem">
        <label for="ins-trek">Your trek</label>
        <select class="select" id="ins-trek" data-ins-trek>
          <option value="">Choose a trek…</option>
          ${content.regions.filter((r) => r.treks.length).map((r) => html`<optgroup label="${r.long}">${r.treks.map((t) => html`<option value="${t.slug}" data-max="${t.maxAlt.m}" data-place="${t.maxPlace.name}" data-sleep="${t.analysis.maxSleep?.alt || ''}" data-grade="${t.difficulty}" data-style="${t.style.join(' ')}">${t.name}</option>`)}</optgroup>`)}
        </select>
      </div>
      <div class="ins-result" data-ins-result hidden></div>
    </div>
    <h2 class="ins-h">Go through it line by line</h2>
    <ul class="ins-list" data-ins-list>
      ${INSURANCE_CHECKS.map(
        ([id, text, why, flag]) => html`<li${flag ? raw(` data-ins-flag="${flag}"`) : ''}>
          <label class="check"><input type="checkbox" value="${id}"><span><span class="ins-text">${raw(text)}</span>${why ? html`<small>${why}</small>` : ''}</span></label>
        </li>`,
      )}
    </ul>
    <p class="ins-count" data-ins-count aria-live="polite"></p>
    <div class="cluster no-print" style="--gap:.5rem">
      <button type="button" class="btn btn-secondary btn-sm" data-print>${icon('printer', { size: 16 })}Print</button>
      <button type="button" class="btn btn-ghost btn-sm" data-ins-reset>Untick all</button>
      <a class="btn btn-ghost btn-sm" href="${u('safety/emergency/')}">Fill in my emergency card</a>
    </div>
  </div>
  <aside class="stack">
    ${cost ? html`<div class="fact"><p class="fact-label">What a rescue costs</p><p class="fact-value">${cost.value}</p><p class="small muted">${cost.detail}</p></div>` : ''}
    ${note('plain', html`<p>We do not sell or recommend insurance, and this list is not advice on any particular policy. Read the wording, and ask the insurer in writing if anything is unclear.</p>`)}
    <a class="link-arrow small" href="${u('safety/emergency/#rescue')}">How rescue works in Nepal${icon('arrow-right', { size: 16 })}</a>
  </aside>
  <noscript>${note('warn', html`<p>The altitude for your trek needs JavaScript. The list above applies to every route.</p>`)}</noscript>
</div>`;
  return {
    title: 'Travel Insurance Check for Trekking in Nepal',
    description: 'What travel insurance must cover for a Nepal trek: the altitude limit for your route, helicopter evacuation, approval rules and the small print to check.',
    section: 'safety',
    scripts: ['insurance'],
    crumbs: [['safety/', 'Safety'], [null, 'Insurance check']],
    body,
  };
}
