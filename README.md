# Mundus

[简体中文](README.zh-CN.md)

Mundus is an interactive three-dimensional globe for looking at one planet
through three different scientific lenses. It is designed as a small digital
museum exhibit: direct enough to explore, explicit about its methods, and
careful about the limits of its data.

The product remains intentionally limited to three modes. This checkout is the
unpublished **V1.1.0 Parchment Atlas** candidate:

- **Other Side** calculates exact antipodal endpoints and shows the nearest
  eligible major city to each endpoint in the bundled GeoNames snapshot. These
  are represented major-city results, not nearest settlements, boundaries, or
  built areas.
- **Development, Unpacked** compares reported HDI with derived health,
  education, and income dimension indices from the UNDP Human Development
  Report 2025 dataset.
- **Sunline** visualizes the day-night boundary and estimates solar position,
  sunrise, and sunset in UTC for educational use.

The verified public **V1.0.0** site is
<https://0mn1si2i5.github.io/Mundus/> at commit
`a5ff99bc60fb7cd2e6e14f4d3bc4f54e5abfb4a1`. It predates this checkout's
parchment presentation, GeoNames bilateral city relations, and Natural Earth
vector globe. Those candidate capabilities are not public until a separately
authorized deployment passes desktop/mobile live verification.

## Run locally

Mundus requires Node.js 22 or later and pnpm 11.7.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Before submitting a change, run the complete local gate:

```bash
pnpm check
pnpm test:e2e
```

`pnpm check` verifies formatting, lint, types, generated-data integrity, unit
tests, and the production build. Production source maps are deliberately
disabled for the V1 public artifact.

The local candidate uses reproducibly generated Natural Earth vector spheres: low quality
loads 110m, while medium/high quality loads 50m. Country colors are supplied by
a small palette texture, and the existing raster globe remains the loading and
failure fallback.

## Data and licensing

The repository's MIT License covers Mundus source code only. Bundled datasets
and third-party packages retain their own terms. See [Data sources](DATA_SOURCES.md)
for provenance, transformations, attribution, and caveats, and
[Third-party licenses](THIRD_PARTY_LICENSES.md) for the dependency and data
license inventory.

Natural Earth boundaries are a cartographic representation, not a legal
authority on territorial status. UNDP and solar results are educational
interpretations and must not be used as legal, navigational, or engineering
advice.

## Repository layout

```text
src/
  app/           Application shell and responsive layout
  data/          Data manifests, generated snapshots, and registry
  features/      Globe kernel and domain-oriented modes
  i18n/          Chinese and English interface copy
  state/         Small cross-feature application state
  styles/        Global tokens and base styles
  test/          Unit-test setup
tests/e2e/       Real-browser release checks
docs/            Product decisions and implementation evidence
```

Security issues should be reported privately according to
[SECURITY.md](SECURITY.md).
