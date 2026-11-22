// The list of every page on the site and the template that renders it.

import { homePage } from './home.mjs';
import { trekPage, treksIndexPage } from './trek.mjs';
import { safetyHubPage, amsPage, acclimatizationPage, emergencyPage, insurancePage } from './safety.mjs';
import { conditionsPage } from './conditions.mjs';
import { toolsHubPage, gpxPage, packingPage, budgetPage, comparePage } from './tools.mjs';
import { planPage, plannerRedirectPage } from './plan.mjs';
import { aboutPage, supportPage, privacyPage, termsPage, creditsPage, savedPage, offlinePage, notFoundPage, journalIndexPage, articlePage } from './site.mjs';
import { servicesHubPage, guidesPage, portersPage, agenciesPage, gearPage, partnersPage } from './services.mjs';
import { regionsIndexPage, regionPage, placesIndexPage, placePage, permitsPage } from './explore.mjs';

export function allPages(shared) {
  const pages = [];
  const add = (path, render) => pages.push({ path, render });

  add('', homePage);
  add('treks/', treksIndexPage);
  for (const t of shared.content.treks) add(`treks/${t.slug}/`, (ctx) => trekPage(ctx, t));

  add('regions/', regionsIndexPage);
  for (const r of shared.content.regions) add(`regions/${r.slug}/`, (ctx) => regionPage(ctx, r));
  add('places/', placesIndexPage);
  for (const p of shared.content.places) add(`places/${p.slug}/`, (ctx) => placePage(ctx, p));
  add('permits/', permitsPage);
  add('conditions/', conditionsPage);
  add('services/', servicesHubPage);
  add('services/guides/', guidesPage);
  add('services/porters/', portersPage);
  add('services/agencies/', agenciesPage);
  add('gear/', gearPage);
  add('partners/', partnersPage);
  add('safety/', safetyHubPage);
  add('safety/altitude-check/', amsPage);
  add('safety/acclimatization/', acclimatizationPage);
  add('safety/emergency/', emergencyPage);
  add('safety/insurance/', insurancePage);
  add('tools/compare/', comparePage);
  add('tools/', toolsHubPage);
  add('tools/gpx/', gpxPage);
  add('plan/', planPage);
  add('tools/planner/', plannerRedirectPage);
  add('tools/packing/', packingPage);
  add('tools/budget/', budgetPage);
  add('journal/', journalIndexPage);
  for (const a of shared.content.articles) add(`journal/${a.slug}/`, (ctx) => articlePage(ctx, a));
  add('about/', aboutPage);
  add('support/', supportPage);
  add('privacy/', privacyPage);
  add('terms/', termsPage);
  add('credits/', creditsPage);
  add('saved/', savedPage);
  add('offline/', offlinePage);
  add('404/', notFoundPage);

  return pages;
}
