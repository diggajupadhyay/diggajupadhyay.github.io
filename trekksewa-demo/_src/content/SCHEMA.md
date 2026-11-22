# TrekkSewa content format

All trek and place content lives in this folder as JSON. The site is generated from it by
`npm run build`, and `npm run validate` checks every rule below. If the validator passes, the
build will accept the file.

## House rules

- **Original writing only.** Every sentence must be written for TrekkSewa. Do not paste or
  paraphrase text from other trekking sites, apps or guidebooks. Facts (names, altitudes, stage
  order, fees) are fine to cross-check against several independent or official sources.
- **Be honest about certainty.** If a stage, altitude or distance is not well established, leave
  the optional field out and say so in a note. Never invent precision.
- **Plain, practical voice.** Second person, present tense, no hype ("breathtaking",
  "once-in-a-lifetime", "nestled"). Say what the day is like and what to watch for.
- **Metric units.** Altitude in metres, distance in kilometres, time in hours.
- Spell place names the way they appear on current Nepali maps and signboards.

## Places: `places/<region>.json`

Each file is a JSON array of place objects. A place is anything a trekker can be at: a town,
village, lodge cluster, pass, lake, viewpoint or base camp.

| field | required | notes |
|---|---|---|
| `slug` | yes | lowercase kebab-case of the common English name, unique across all files |
| `name` | yes | display name |
| `ne` | no | name in Devanagari — only when you are sure of the spelling |
| `aka` | no | array of other spellings / names |
| `region` | yes | a slug from `regions.json` |
| `type` | yes | `city` `town` `village` `settlement` `camp` `base-camp` `pass` `peak` `viewpoint` `lake` `monastery` `trailhead` `airstrip` |
| `alt` | yes | altitude in metres (integer) |
| `lat`, `lon` | yes | decimal degrees, 4 or 5 decimal places |
| `coordQuality` | yes | `good` (within roughly 500 m), `approx` (could be a kilometre or more out) or `uncertain` (not drawn on maps) |
| `coordSource` | no | set by `scripts/verify-coordinates.mjs`: `osm` (matched in OpenStreetMap), `terrain-fit` (moved onto ground at the right altitude) or `estimate` |
| `coordPinned` | no | `true` when someone corrected the position by hand: the checking script then leaves it alone |
| `blurb` | yes | 1–2 original sentences, 60–260 characters |
| `facilities` | no | array from: `lodges` `camping` `homestays` `shops` `atm` `bank` `health-post` `hospital` `pharmacy` `rescue-post` `wifi` `charging` `hot-shower` `bakery` `gear-shops` `permit-check` `police` `airstrip` `helipad` `bus` `jeep` `monastery` `viewpoint` |
| `tip` | no | one practical sentence |

`places/hubs.json` holds the cities and junction towns shared by several regions. Never redefine
a slug that already exists there.

## Treks: `treks/<slug>.json`

One file per trek, named after its slug.

| field | required | notes |
|---|---|---|
| `slug` | yes | kebab-case, matches the file name |
| `name` | yes | display name without the word "Trek" unless it is part of the name |
| `aka` | no | array of other names |
| `region` | yes | slug from `regions.json` |
| `tagline` | yes | ≤ 80 characters, no full stop |
| `summary` | yes | 90–200 characters, used on cards and as the meta description |
| `intro` | yes | array of 2–3 paragraphs, each 250–700 characters |
| `days` | yes | must equal the number of itinerary entries |
| `daysRange` | yes | `[min, max]` realistic range including variations |
| `distanceKm` | yes | approximate total walking distance |
| `maxAlt` | yes | `{ "m": 5545, "place": "<place slug>" }` — highest point reached |
| `difficulty` | yes | `easy` `moderate` `challenging` `strenuous` |
| `difficultyNote` | yes | one sentence explaining the grade |
| `style` | yes | array of `teahouse` `camping` `homestay` |
| `start`, `end` | yes | place slugs where walking starts and ends |
| `gateway` | yes | place slug of the city most people set out from |
| `access` | yes | `{ "summary": "...", "options": [ { "mode", "from", "to", "time", "note" } ] }`; mode is `flight` `bus` `jeep` `drive` |
| `seasons` | yes | `{ "best": [months], "good": [months], "hard": [months], "note": "..." }` — months 1–12, every month in exactly one list |
| `permits` | yes | array of ids from `permits.json` |
| `guide` | yes | `{ "rule": "required" \| "strongly-recommended" \| "optional", "note": "..." }` |
| `highlights` | yes | 4–6 short bullet strings |
| `itinerary` | yes | array of day objects, see below |
| `hazards` | yes | 2–5 objects `{ "title", "text" }` |
| `tips` | yes | 3–6 practical strings |
| `variants` | no | array of `{ "name", "text" }` |
| `related` | no | array of trek slugs |
| `confidence` | yes | `high` `medium` `low` — how well established the stage details are |

### Itinerary day

```json
{
  "day": 3,
  "title": "Acclimatization day in Namche",
  "from": "namche-bazaar",
  "to": "namche-bazaar",
  "via": ["everest-view-hotel"],
  "sleep": 3440,
  "high": 3880,
  "hours": [3, 4],
  "km": 5,
  "kind": "acclimatization",
  "mode": "walk",
  "note": "One or two original sentences about the day."
}
```

- `day` runs 1..n with no gaps. `to` of one day must equal `from` of the next.
- `from`, `to`, and every entry in `via` are place slugs that exist in `places/`.
- `sleep` is the sleeping altitude and should match the altitude of `to` (±60 m).
- `high` is optional: the highest point reached that day when it is above both ends.
- `via` is optional: up to four key waypoints in walking order.
- `hours` is `[min, max]` moving time. `km` is optional — leave it out rather than guess.
- `kind` is one of `trek` `acclimatization` `rest` `pass` `summit` `transfer` `buffer`.
- `mode` is `walk` (default, may be omitted), `flight`, `drive`, `jeep` or `bus`.
- `title` ≤ 70 characters. `note` 60–320 characters.

## Notices: `notices.json`

A JSON array. Each notice is shown on the treks and regions it names and on the conditions page.

| field | required | notes |
|---|---|---|
| `id` | yes | kebab-case, unique |
| `reported` | yes | `YYYY-MM-DD`: the date of the report the notice is based on |
| `checked` | no | `YYYY-MM-DD`: the day someone last looked for anything newer. Shown to readers. |
| `level` | yes | `warn` or `danger` |
| `regions`, `treks` | yes | arrays of slugs the notice applies to (either may be empty) |
| `title`, `text` | yes | what happened and what it means for a trekker, in plain words |
| `action` | no | one sentence shown after "What to do:" |

Remove a notice when it is no longer true. Do not leave it to age.

## Prices and fares: `market.json`

List prices read from the websites of trekking companies, booking sites and operators. They
help a visitor budget; they are not quotes, and the site says so.

- `checked`: `YYYY-MM-DD`, the day the figures were gathered.
- `packages[]`: one per trek. `trek` (slug), `days` (as companies sell it), `low` and `high`
  (USD per person for a standard guided lodge trek), `basis` (what that price assumes),
  `includes`, `excludes`, `sampled` (how many companies were looked at), `sources`.
  `budgetLow` and `luxuryHigh` are optional outer limits that are not used in sums.
- `fares[]`: one per journey. `id`, `from`, `to`, `mode`, `low`, `high`, `currency` (`USD` or
  `NPR`), `time`, `note`, `sources`.

## Getting to the trail: `transport.json`

`treks.<slug>` says which fares from `market.json` one person needs to reach the start and get
back. `text` is the sentence shown beside the cost. `options` is a list of alternatives; each
alternative is a list of `[fareId, howManyTimes]`. The planner shows the range from the
cheapest alternative to the dearest. A trek that starts from the city has no entry.

```json
"everest-base-camp": {
  "text": "Flights to Lukla and back, from Kathmandu or (in the busy months) from Manthali",
  "options": [
    [["kathmandu-lukla-flight", 2]],
    [["manthali-lukla-flight", 2], ["kathmandu-manthali-shared-shuttle", 2]]
  ]
}
```

## Photographs: `photos.json`

```json
{
  "checked": "2026-11-22",
  "photos": {
    "everest-base-camp": {
      "file": "everest-base-camp.jpg",
      "small": "everest-base-camp-sm.jpg",
      "width": 1600,
      "height": 1130,
      "focus": "50% 40%",
      "alt": "What the picture shows, for someone who cannot see it",
      "caption": "One short sentence that says where this is",
      "title": "The file's title on the site it came from",
      "author": "Name as the licence asks for it",
      "licence": "CC BY-SA 4.0",
      "licenceUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "source": "https://commons.wikimedia.org/wiki/File:…",
      "changes": "resized"
    }
  },
  "regions": { "everest": "everest-base-camp" },
  "home": ["home-1", "home-2"]
}
```

- The key is a trek slug, `region-<slug>`, or any name listed under `home`.
- `file` and `small` are in `static/photos/`: 1600 px and 720 px wide. `width` and `height`
  describe `file`. `changes` records what was done to the original (the licences ask for it).
- `focus` is the CSS `object-position` that keeps the subject in view when the picture is
  cropped to a card.
- Only photographs whose licence allows reuse with credit. `author`, `licence`, `licenceUrl`
  and `source` are required: they are printed beside the picture and on the credits page.
- The picture must show the place the trek goes to. A fine photograph of the wrong valley is
  worse than the height profile that is shown when a trek has no photograph.

## Generated from OpenStreetMap: `osm-*.json`

Written by the scripts in `scripts/osm/` (see the README). **Do not edit them by hand**: the
next run replaces them. Each carries `source` and `asOf`, which the pages quote.

| file | made by | holds |
|---|---|---|
| `osm-trails.json` | `trails.mjs route` | per trek, the mapped footpath for each walking stage (`legs[]` with `day`, `from`, `to`, `km`, `line`) |
| `osm-services.json` | `extract.mjs services` | per place: lodges by name, how many there are, health posts, cash machines, water points |
| `osm-hubs.json` | `extract.mjs hubs` | how many outdoor shops, travel offices, cash machines and pharmacies are mapped in Thamel, Lakeside and Namche |
