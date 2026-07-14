# UNDP HDR 2025 development data

## Dataset and grain

Mundus uses the UNDP Human Development Report 2025 complete time series. The derived asset contains one row per country or territory and one observation per year from 1990 through 2023 for reported HDI and locally derived health, education and income dimension indices.

The build script pins and verifies both source files, then writes a compact snapshot. Raw downloads stay outside Git; the normalized snapshot and machine-readable manifest are committed.

## Method

- Health: `(life expectancy - 20) / (85 - 20)`
- Education: arithmetic mean of `expected years / 18` and `mean years / 15`
- Income: `(ln(GNI per capita) - ln(100)) / (ln(75,000) - ln(100))`
- Values are clamped to 0–1 and rounded to four decimal places.
- Missing inputs remain `null`; they are never converted to zero.

These formulas and goalposts were visually checked against Technical Note 1 of the Human Development Report 2025.

## Quality profile

| Check                                            |      Result |
| ------------------------------------------------ | ----------: |
| Country and territory rows                       |         195 |
| Years                                            |          34 |
| Duplicate ISO keys                               |           0 |
| Values outside 0–1                               |           0 |
| Mapped Natural Earth 110m units                  | 166 (85.1%) |
| Latest-year HDI coverage                         |   193 / 195 |
| Maximum reported-vs-reconstructed HDI difference |     0.00054 |

The 29 unmapped rows are predominantly small states and territories without a polygon in the Natural Earth 110m distribution. They remain available to the semantic table but cannot be painted on the globe at this scale.

UNDP recalculates the full HDI series when a new report is released. Mundus therefore treats HDR 2025 as one indivisible edition and does not mix its values with earlier releases.
