# TrekkSewa: site source

TrekkSewa is a trekking companion for Nepal: route guides, a gazetteer of places, safety and
planning tools, and the foundations for a directory of guides, porters, agencies and gear shops.

It is a static site. This folder (`_src`) holds everything that is written by hand. The build
turns it into the HTML, CSS and JavaScript in the parent folder (`trekksewa/`), which is what
GitHub Pages serves at <https://diggajupadhyay.github.io/trekksewa/>.

**Do not edit files outside `_src` by hand.** They are overwritten by the next build.

## Commands

```bash
cd trekksewa/_src
npm install          # once
npm run build        # regenerate the site in ../
npm run dev          # preview at http://localhost:4173/trekksewa/  (add -- --watch to rebuild on save)
npm run validate     # check all trek and place content against content/SCHEMA.md
npm test             # unit tests for the altitude and GPX logic
npm run check        # validate + test + build + broken-link check: run this before committing
```

Node 20 or newer. The only build dependencies are esbuild, marked, Leaflet, two font packages
and an icon set.

## Where things are

| Folder | What is in it |
|---|---|
| `content/treks/*.json` | One file per trek. Format in `content/SCHEMA.md`. |
| `content/places/*.json` | Villages, passes, lakes and viewpoints, grouped by region. |
| `content/regions.json`, `permits.json`, `emergency.json`, `facts.json` | Reference data used across pages. |
| `content/notices.json` | Dated safety notices shown on affected treks, regions and the conditions page. |
| `content/conditions.json`, `seasons.json`, `gear.json`, `packing.json` | Data for the conditions page, gear page and packing tool. |
| `content/articles/*.md` | Journal articles (Markdown with a short header). |
| `templates/` | Page templates: plain JavaScript functions that return HTML. |
| `client/` | Browser JavaScript. `main.js` runs on every page; `pages/*.js` are loaded only where needed. |
| `lib/` | Logic shared by the build and the browser: altitude rules, GPX parsing, the profile chart, formatting. |
| `styles/` | CSS. `tokens.css` holds the colours, type and spacing; `dark.css` the dark theme. |
| `static/` | Files copied as they are (icons, social image). |
| `backend/supabase-schema.sql` | Database schema for partner applications and listings. |
| `site.config.json` | Site name, public URL, contact details and backend settings. |

## Everyday edits

**Add or change a trek.** Edit or add a file in `content/treks/`, make sure every place it
mentions exists in `content/places/`, then run `npm run check`. The validator explains anything
that is wrong, including coordinates that are implausibly far apart for one walking day.

**Change a permit fee.** Edit `content/permits.json` and update `reviewed`. Set `"verified": true`
only when you have confirmed the figure with an official source.

**Post or remove a safety notice.** Edit `content/notices.json`. Each notice has a `reported`
date. Visitors are told automatically when a notice is more than three weeks old, and warned
when it is more than four months old, but **stale notices should be removed by hand**.

**Update the review date** shown across the site: `contentReviewed` in `site.config.json`.

## Switching on partner applications

Out of the box the application form at `/partners/` runs in preview mode: it validates and
saves a draft on the visitor's device but sends nothing, and says so. To collect applications:

1. Create a Supabase project and run `backend/supabase-schema.sql` in its SQL editor.
2. Put the project URL and the **anon (publishable)** key in `site.config.json`:

   ```json
   "backend": { "provider": "supabase", "supabaseUrl": "https://xxxx.supabase.co", "supabaseAnonKey": "…" }
   ```

3. `npm run build`, commit and push.

The anon key is public by design. What it may do is fixed by the row-level-security policies in
the schema: insert an application, read published partners, and nothing else. **Never put a
service-role key in this repository.** Applications are reviewed in the Supabase dashboard.

For a quick alternative without a database, set `contact.email` and/or `contact.whatsapp` in
`site.config.json`. The form then offers to send the completed application by email or WhatsApp.

`site.config.local.json` (not committed) overrides `site.config.json` for local testing.

## Moving to a custom domain

Every link in the generated site is relative, so the folder works at any address. To move it,
change `siteUrl` in `site.config.json` (used for canonical links, the sitemap and social
previews), rebuild, and serve the contents of `trekksewa/` from the new location.

## What a visitor's browser talks to

- **Open-Meteo** for forecasts (free for non-commercial use; a commercial plan is needed once
  TrekkSewa earns money).
- **OpenStreetMap** and **OpenTopoMap** tile servers for maps. Both have fair-use policies: no
  bulk downloading, and a busy site should move to a paid or self-hosted tile service.
- **Supabase**, only if the backend is switched on.

There are no analytics, ads or third-party scripts.

## Honest limits of the content

- Place positions are a planning aid, not survey data. See "Checking place positions" below for
  how each one was tested. Trek maps join stops with a dashed straight line and say so.
- Daily rates, rental prices and food costs in `content/facts.json` marked `"verified": false`
  are typical figures that have not been confirmed for the current season. The site labels them.
- Each trek carries a `confidence` field that is shown to readers.
- Emergency phone numbers were checked against official pages in November 2026. Re-check them
  each season: Kathmandu landlines have changed format before.

## Checking place positions

Every place started as an estimate. `scripts/verify-coordinates.mjs` tests those estimates and
records the outcome in each place's `coordQuality` and `coordSource`:

| `coordSource` | `coordQuality` | Meaning | On the site |
|---|---|---|---|
| `osm` | `good` | Matched in OpenStreetMap by name, and a height (mapped, or from the terrain model) agrees | Pin |
| `osm` | `approx` | Matched in OpenStreetMap by name and position only | Pin, labelled approximate |
| `estimate` | `approx` | No clear match, but our estimate sits on ground at the right height | Pin, labelled approximate |
| any | `uncertain` | No match, and the estimate does not fit the terrain | No pin; the place page says so |

```bash
node scripts/verify-coordinates.mjs lookup    # ask OpenStreetMap (Nominatim) for each place, one request a second
node scripts/verify-coordinates.mjs heights   # terrain height at each estimate and candidate (Open-Meteo)
node scripts/verify-coordinates.mjs decide    # weigh the evidence; writes scripts/.cache/coordinate-report.json
node scripts/verify-coordinates.mjs apply     # write the result into content/places/
npm run check
```

Each step caches its answers in `scripts/.cache/` (not committed) and can be re-run. Both
services ration requests per address and per day, so a step may stop early and ask to be run
again later. Read the report before `apply`: it gives the reason for every decision. After
adding places, or to settle the ones still marked `uncertain`, run the four steps again; the
quickest fix for a single place is to look it up on openstreetmap.org and type the coordinates
in by hand with `"coordQuality": "good", "coordSource": "osm"`.

Coordinates that come from OpenStreetMap are © OpenStreetMap contributors and stay under the
Open Database Licence (ODbL). The credits page says so; keep that notice.

## Regenerating icons

`node scripts/make-icons.mjs` redraws the favicon, app icons and social image into
`static/assets/img/`. It needs Playwright with Chromium and is only required when the logo or
brand colours change.
