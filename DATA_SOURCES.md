# Data sources

Mundus keeps machine-readable source records under `src/data/manifests/` and
verifies committed derived snapshots with `pnpm data:verify`. Raw downloads are
not committed. The code license does not replace any data license described
below.

## Natural Earth countries, 1:110m

- Source: [Natural Earth Admin 0 – Countries](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/)
- Distribution: `world-atlas` 2.0.2, derived from Natural Earth 4.1.0
- Terms: [public domain](https://www.naturalearthdata.com/about/terms-of-use/); redistribution allowed
- Use: country geometry, country/ocean picking, borders, and globe textures
- Transformation: convert quantized TopoJSON to GeoJSON in the browser, assign
  stable internal identifiers, and rasterize land and borders to an
  equirectangular texture
- Attribution shown in the product: **Made with Natural Earth**

The pinned distribution SHA-256 is recorded in
`src/data/manifests/natural-earth-110m.json`. Boundaries are a cartographic view
and are not a legal authority on territorial status.

## GeoNames major cities

- Source: [GeoNames geographical database](https://www.geonames.org/)
- Snapshot: `cities15000`, `alternateNamesV2`, `countryInfo`,
  `admin1CodesASCII`, and upstream readme retrieved 2026-07-21
- Terms: [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
- Use: offline bilingual major-city autocomplete and bilateral nearest
  represented major-city results in Other Side
- Scope: active `P` records with codes `PPL`, `PPLA`, `PPLA2`, `PPLA3`,
  `PPLA4`, `PPLC`, or `PPLG`; all `PPLC` and `PPLA`, otherwise population at
  least 100,000; a non-empty admin-1 code and exact country and admin-1 joins
  are required
- Transformation: select current English and `zh-CN`/`zh-Hans`/`zh` names;
  convert only those existing Chinese source names from OpenCC traditional to
  Simplified Chinese using `opencc-js` 1.4.1 `t` to `cn` dictionaries; retain
  every distinct accepted original Chinese form and distinct simplified
  derivative as aliases; retain canonical/ASCII names and at most two
  additional non-display English aliases; sort by GeoNames ID and encode
  coordinates at 1e-5 degree precision
- Attribution shown in the product: **Contains GeoNames data, licensed under CC
  BY 4.0**, with a no-warranty statement

The final index contains 6,944 records. Its exact five source hashes, derived
hash, size measurements, fallback policy, and transformation are recorded in
`src/data/manifests/geonames-major-cities.json`. Missing Chinese source names
remain explicit canonical fallbacks; non-Chinese names are never translated.
GeoNames is a filtered search index, not a complete gazetteer or territorial
authority. Each relation distance is measured independently from an exact
endpoint to the nearest eligible entry in this same immutable index, with
deterministic distance, population, and GeoNames-ID ties. Results do not mean
nearest settlement, administrative boundary, or built area.

## UNDP Human Development Report 2025

- Source: [UNDP Human Development Report data center](https://hdr.undp.org/data-center/documentation-and-downloads)
- Edition: HDR 2025 complete time series, covering 1990–2023
- Terms: [Creative Commons Attribution 3.0 IGO](https://hdr.undp.org/copyright-and-terms-use); redistribution allowed with attribution
- Use: reported HDI and locally derived health, education, and income dimension
  indices in Development, Unpacked
- Transformation: preserve missing values as `null`; calculate dimension
  indices with the HDR 2025 Technical Note 1 goalposts; join ISO alpha-3 codes
  to Natural Earth identifiers; round derived values to four decimal places
- Attribution shown in the product: **Source: United Nations Development
  Programme, Human Development Report 2025; transformed by Mundus**, next to a
  link to the CC BY 3.0 IGO terms.

The source, auxiliary Natural Earth file, and derived-asset SHA-256 values are
recorded in `src/data/manifests/undp-hdr-2025-development.json`. Full formulas
and quality results are documented in `docs/data/undp-hdr-2025.md`. Small states
without a Natural Earth 110m polygon remain in the semantic table but cannot be
painted on the globe at this scale.

## Solar calculations

- Method source: [NOAA Solar Calculator calculation details](https://gml.noaa.gov/grad/solcalc/calcdetails.html)
- Dataset: none; results are calculated in the browser from a UTC timestamp and
  selected coordinates
- Use: solar declination, equation of time, subsolar point, solar elevation,
  and approximate sunrise and sunset in Sunline
- Transformation: NOAA/Meeus-style approximations with an apparent altitude of
  `-0.833°` for sunrise and sunset; inputs are limited to 2000–2099 and minute
  precision
- Redistribution: no external solar dataset is bundled

The result is an educational approximation. Atmospheric conditions and high
latitudes introduce additional error; it must not be used for legal,
navigational, or engineering purposes. NOAA states that this calculator is no
longer actively maintained and does not guarantee its accuracy or
functionality.

## Reproducibility

The generated snapshots are produced by scripts in `scripts/`. Each build
script pins the source URL and expected SHA-256 before transforming data. To
rebuild the GeoNames index from a clean checkout, run:

```bash
pnpm data:cities
```

The command creates ignored `tmp/geonames/` as needed, streams missing files
from the exact manifest URLs to atomic temporary paths, verifies SHA-256 before
renaming, and reuses only checksum-valid cached sources. Raw sources are never
committed. Then run:

```bash
pnpm data:verify
```

to verify the committed generated snapshots and the installed, pinned
`world-atlas` runtime asset by SHA-256. `pnpm test` separately exercises the
data registry schemas, record-level expectations, and calculation invariants;
the generator scripts validate their input and output while building a new
snapshot.
