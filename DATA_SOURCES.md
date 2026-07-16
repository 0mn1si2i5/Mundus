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

## Natural Earth populated places, 1:50m

- Source: [Natural Earth Populated Places](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-populated-places/)
- Version: Natural Earth 5.1.2
- Terms: [public domain](https://www.naturalearthdata.com/about/terms-of-use/); redistribution allowed
- Use: nearest represented place in Other Side
- Transformation: retain the Natural Earth identifier, ASCII place and
  admin-0 names, coordinates, and `pop_max`; sort by identifier; encode as
  compact tuples; load only while Other Side is active
- Attribution shown in the product: **Made with Natural Earth**

The source and derived-asset SHA-256 values are recorded in
`src/data/manifests/natural-earth-populated-places-50m.json`. “Nearest” means
nearest within this selected 1:50m dataset, not within a complete city or
settlement gazetteer.

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

The two generated snapshots are produced by scripts in `scripts/`. Each build
script pins the source URL and expected SHA-256 before transforming data. Run:

```bash
pnpm data:verify
```

to verify the two committed generated snapshots and the installed, pinned
`world-atlas` runtime asset by SHA-256. `pnpm test` separately exercises the
data registry schemas, record-level expectations, and calculation invariants;
the generator scripts validate their input and output while building a new
snapshot.
