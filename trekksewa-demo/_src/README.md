# TrekkSewa: site source

TrekkSewa is a trekking companion for Nepal. A visitor can find a trek, plan it day by day
(where they walk, where they sleep, who can help and what it may cost), ask for help arranging
it, and use the safety tools on the trail. Guides, porters, agencies and gear shops can apply
to be listed.

It is a static site. This folder (`_src`) holds everything that is written by hand. The build
turns it into the HTML, CSS and JavaScript in the parent folder (`trekksewa-demo/`), which is
what GitHub Pages serves at <https://diggajupadhyay.github.io/trekksewa-demo/>.

**Do not edit files outside `_src` by hand.** They are overwritten by the next build.

## Commands

```bash
cd trekksewa-demo/_src
npm install          # once
npm run build        # regenerate the site in ../
npm run dev          # preview at http://localhost:4173/trekksewa-demo/  (add -- --watch to rebuild on save)
npm run validate     # check all trek and place content against content/SCHEMA.md
npm test             # unit tests for the altitude, GPX and planner logic
npm run check        # validate + test + build + broken-link check: run this before committing
```

Node 20 or newer. The build needs esbuild, marked, Leaflet, two font packages and an icon set.
The scripts that read OpenStreetMap also need `pmtiles`, `@mapbox/vector-tile` and `pbf`.

## Where things are

| Folder | What is in it |
|---|---|
| `content/treks/*.json` | One file per trek. Format in `content/SCHEMA.md`. |
| `content/places/*.json` | Villages, passes, lakes and viewpoints, grouped by region. |
| `content/regions.json`, `permits.json`, `emergency.json`, `facts.json` | Reference data used across pages. |
| `content/notices.json` | Dated safety notices shown on affected treks, regions and the conditions page. |
| `content/market.json`, `transport.json` | Researched package prices and fares, and which fares each trek needs. |
| `content/osm-services.json`, `osm-trails.json`, `osm-hubs.json` | Lodges, footpaths and shop counts taken from OpenStreetMap. **Generated: do not edit by hand.** |
| `content/photos.json`, `static/photos/` | Openly licensed photographs and their credits. |
| `content/conditions.json`, `seasons.json`, `gear.json`, `packing.json` | Data for the conditions page, gear page and packing tool. |
| `content/articles/*.md` | Journal articles (Markdown with a short header). |
| `templates/` | Page templates: plain JavaScript functions that return HTML. |
| `client/` | Browser JavaScript. `main.js` runs on every page; `pages/*.js` are loaded only where needed. |
| `lib/` | Logic shared by the build and the browser: the planner's rules and sums (`plan.mjs`), altitude rules, GPX, the profile chart, formatting. |
| `styles/` | CSS. `tokens.css` holds the colours, type and spacing; `dark.css` the dark theme; `plan.css` the planner and the simpler pages built around it. |
| `scripts/` | The validator, tests, link checker, and the scripts that fetch open data (`osm/`, `verify-coordinates.mjs`). |
| `static/` | Files copied as they are (icons, photographs, social image). |
| `backend/supabase-schema.sql` | Database schema for trip requests, partner applications and listings. |
| `site.config.json` | Site name, public URL, contact details and backend settings. |

## The planner

`/plan/` asks one question per screen (how long, how hard, which month), suggests treks with
reasons, then asks for a start date, the number of people and the kind of help wanted. The
result is one page with the days, the places to sleep, the cost, the permits, a checklist and
a way to ask for help.

- The whole plan lives in the address (`?trek=…&start=…&people=…&help=…&spare=…`), so the Back
  button works and a plan can be bookmarked, shared or printed. Nothing needs an account.
- `lib/plan.mjs` holds every rule: which treks suit which answers (`rate`, `suggest`), which
  kinds of help a route allows (`helpOptions`), the cost estimate (`estimate`, `permitTotal`)
  and the start-date ideas (`startIdeas`). It has no DOM code and is covered by
  `scripts/test/plan.test.mjs`.
- `lib/data.mjs` writes what the planner reads: `data/treks.json` (all treks, compact),
  `data/trek/<slug>.json` (one trek in full) and `data/plan.json` (rates, exchange rate, visa).
- Saved plans, saved treks and the checklist ticks stay in the visitor's browser
  (`localStorage`, keys starting `ts-`). `/saved/` ("My trips") lists them.

**Money.** `NPR_PER_USD` and `FOOD_PER_DAY` are constants at the top of `lib/plan.mjs`. Guide
and porter day rates are read from `content/facts.json`; package prices and fares from
`content/market.json`. Update the exchange rate when it moves by more than a few rupees.

## Where a request for help goes

A trekker's "Get help arranging it" form and a partner's application both go to the first of
these that is configured in `site.config.json`:

| Order | Setting | What happens |
|---|---|---|
| 1 | `backend` (Supabase) | The request is stored in the database. |
| 2 | `contact.whatsapp` | WhatsApp opens on the visitor's device with the request written out, addressed to that number. They press send. |
| 3 | `contact.email` | Their email program opens with the request written out, addressed to that address. |
| none | | Nothing is sent. The planner offers to share or print the plan instead, and the pages say the booking desk is not open yet. |

The words on the pages follow the setting (`channelOf` in `templates/partials.mjs` at build
time, `requestChannel` in `client/lib/backend.js` in the browser), so the site never promises a
reply that nobody is there to give. **Whoever owns the number or address must actually answer.**

The quickest way to open the desk is a WhatsApp number:

```json
"contact": { "email": "", "whatsapp": "+977 98XXXXXXXX" }
```

Then `npm run build`, commit and push.

### With a database

1. Create a Supabase project and run `backend/supabase-schema.sql` in its SQL editor.
2. Put the project URL and the **anon (publishable)** key in `site.config.json`:

   ```json
   "backend": { "provider": "supabase", "supabaseUrl": "https://xxxx.supabase.co", "supabaseAnonKey": "…" }
   ```

3. `npm run build`, commit and push.

The anon key is public by design. What it may do is fixed by the row-level-security policies in
the schema: insert a trip request, insert an application, read published partners, and nothing
else. **Never put a service-role key in this repository.**

| Table | What it holds | Who can read it |
|---|---|---|
| `trip_requests` | Requests from the planner, with the trekker's contact details and the plan | Only you, in the Supabase dashboard |
| `partner_applications` | Raw applications from `/partners/` | Only you |
| `partners` | The profiles you have approved | The public sees rows with `published = true`, through the `partners_public` view |

To list a partner: check their papers, add a row to `partners` and set `published` to true. It
appears on the matching page (`/services/guides/`, `/services/porters/`, `/services/agencies/`
or `/gear/`) the next time someone opens it; no rebuild is needed. While nothing is published
those pages show no list at all.

`site.config.local.json` (not committed) overrides `site.config.json` for local testing.

## Refreshing the open data

The footpaths, lodges and shop counts come from OpenStreetMap, read from the
[Protomaps daily build](https://build.protomaps.com/) one map tile at a time. Tiles are cached
in `scripts/.cache/tiles/` (not committed), so a second run downloads nothing. Delete
`scripts/.cache/tiles/build.txt` to move to a newer build.

```bash
# behind a proxy, Node's fetch needs NODE_USE_ENV_PROXY=1 in front of each command
node scripts/osm/trails.mjs fetch       # download the tiles along every route
node scripts/osm/trails.mjs route       # find the footpath stop to stop -> content/osm-trails.json
node scripts/osm/extract.mjs services   # lodges, health posts, cash machines -> content/osm-services.json
node scripts/osm/extract.mjs hubs       # shop counts for Thamel, Lakeside, Namche -> content/osm-hubs.json
npm run check
```

`trails.mjs route <slug>` does one trek; `TRAIL_DEBUG=1` prints why a stage was left as a
dashed line. A stage is drawn as a real path only when the route found through the path network
is believable against the straight-line distance; otherwise the map shows dashes that join the
two stops. Each trek also gets a downloadable GPX file built from the same lines.

Distances in `scripts/osm/tiles.mjs` are in **kilometres**. A radius given in metres by mistake
asks for a country's worth of tiles.

This data is © OpenStreetMap contributors under the Open Database Licence (ODbL). The credits
page and every map say so; keep those notices, and keep the "as of" date that the pages show.

## Prices, fees and notices

Everything a visitor might pay or rely on carries a date and, where it was not confirmed, a
label. When you refresh one of these files, change its date too.

| File | What to keep current | Date field |
|---|---|---|
| `content/permits.json` | Permit fees. Set `"verified": true` only after reading an official source. | `reviewed` |
| `content/facts.json` | Guide and porter rates, visa fees, rescue costs and similar. Unconfirmed ones are labelled on the site. | `checked` on each fact |
| `content/market.json` | Package price ranges and transport fares, as companies and operators list them online. Not quotes. | `checked` |
| `content/transport.json` | Which fares from `market.json` each trek needs to reach the trail and get back. | none |
| `content/notices.json` | Road, trail and flight notices. `reported` is the date of the news; `checked` is the day someone last looked for something newer. | on each notice |
| `site.config.json` | `contentReviewed`, the month shown across the site. | |

Visitors are told when a notice is more than three weeks old and warned when it is more than
four months old, but **stale notices should be removed by hand**.

## Photographs

`content/photos.json` maps a trek slug (or `region-<slug>`, or any key listed under `home`) to
a photograph in `static/photos/`. Every entry needs the author, the licence with its link, and
the page it came from; the trek page, the planner and the credits page print them. Use only
photographs whose licence allows reuse with credit (CC BY, CC BY-SA, CC0 or public domain),
and keep the credit when you replace one. A trek with no entry shows its height profile
instead.

## Everyday edits

**Add or change a trek.** Edit or add a file in `content/treks/`, make sure every place it
mentions exists in `content/places/`, then run `npm run check`. The validator explains anything
that is wrong, including coordinates that are implausibly far apart for one walking day. Then
refresh the open data (above) so the new route gets its path and its lodges.

**Change a permit fee.** Edit `content/permits.json` and update `reviewed`.

**Post or remove a safety notice.** Edit `content/notices.json`.

## Moving to a custom domain

Every link in the generated site is relative, so the folder works at any address. To move it,
change `siteUrl` in `site.config.json` (used for canonical links, the sitemap and social
previews), rebuild, and serve the contents of `trekksewa-demo/` from the new location.

To publish under a different folder name on GitHub Pages, rename the folder, change `siteUrl`,
change the path in the repository's root `404.html`, and rebuild. Nothing else holds the name.

## What a visitor's browser talks to

- **Open-Meteo** for forecasts (free for non-commercial use; a commercial plan is needed once
  TrekkSewa earns money).
- **OpenStreetMap** and **OpenTopoMap** tile servers for maps. Both have fair-use policies: no
  bulk downloading, and a busy site should move to a paid or self-hosted tile service.
- **Supabase**, only if the backend is switched on.
- **WhatsApp** (`wa.me`) or the visitor's own email program, only when they press a send button.

There are no analytics, ads or third-party scripts.

## Honest limits of the content

- Place positions are a planning aid, not survey data. See "Checking place positions" below for
  how each one was tested.
- Trek maps follow the footpath mapped in OpenStreetMap where one could be found between two
  stops, and join the stops with dashes where it could not. Volunteers made that map: a path
  may have moved and a lodge may have closed.
- Package prices and fares in `content/market.json` were read from websites, not confirmed with
  a company or a ticket counter. The planner's totals are estimates and say so.
- Figures in `content/facts.json` marked `"verified": false` are typical figures that have not
  been confirmed for the current season. The site labels them.
- Each trek carries a `confidence` field that is shown to readers.
- No guide, porter, agency or shop is listed until someone has checked their papers. The site
  never shows an invented business.
- Emergency phone numbers were checked against official pages in November 2026. Re-check them
  each season: Kathmandu landlines have changed format before.
- The Nepali labels have not been read by a native speaker, and the terms and privacy pages
  have not been reviewed by a lawyer.

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
node scripts/osm/extract.mjs candidates       # named features near each place, from the map tiles
node scripts/verify-coordinates.mjs lookup    # ask OpenStreetMap (Nominatim) by name, one request a second
node scripts/verify-coordinates.mjs heights   # terrain height at each estimate and candidate (Open-Meteo)
node scripts/verify-coordinates.mjs decide    # weigh the evidence; writes scripts/.cache/coordinate-report.json
node scripts/verify-coordinates.mjs apply     # write the result into content/places/
npm run check
```

Each step caches its answers in `scripts/.cache/` (not committed) and can be re-run. The
services ration requests per address and per day, so a step may stop early and ask to be run
again later. Read the report before `apply`: it gives the reason for every decision. After
adding places, or to settle the ones still marked `uncertain`, run the steps again; the
quickest fix for a single place is to look it up on openstreetmap.org and type the coordinates
in by hand with `"coordQuality": "good", "coordSource": "osm", "coordPinned": true`. The pin
keeps later runs of the script from moving the place back.

**An estimate that fits the terrain is not a confirmed position.** Places marked
`estimate`/`approx` passed only one test: the ground there is at the right height. That can be
true on the wrong ridge. It happened: four stops on the Khumai Danda route were drawn 9 km east
of where they are, until the GPS tag on a photograph pointed to the right ridge, where
OpenStreetMap had all four under slightly different spellings ("Khumai Dada"). When a new
route's high stops keep their estimates and the trail script finds no path between them
(`TRAIL_DEBUG=1` says "0 path points near the ends"), look at the map yourself before
publishing.

Coordinates that come from OpenStreetMap are © OpenStreetMap contributors and stay under the
Open Database Licence (ODbL). The credits page says so; keep that notice.

## Regenerating icons

`node scripts/make-icons.mjs` redraws the favicon, app icons and social image into
`static/assets/img/`. It needs Playwright with Chromium and is only required when the logo or
brand colours change.
