# GeoNames major-city index

The Other Side autocomplete and bilateral nearest-major-city relation use a
reviewed GeoNames snapshot retrieved on
2026-07-21. All five source files are pinned by SHA-256 in
`src/data/manifests/geonames-major-cities.json`; raw archives remain ignored.

Candidate A retains every active `PPLA` and `PPLC`, plus active `PPL`, `PPLA2`,
`PPLA3`, `PPLA4`, and `PPLG` records with population of at least 100,000.
Coordinates, a non-empty admin-1 code, and exact ISO2 country/admin-1 joins are required. Historic,
colloquial, expired, abandoned, destroyed, and `PPLX` records are excluded.

English and Chinese labels are selected deterministically from current source
names. Only existing `zh-CN`, `zh-Hans`, and `zh` strings are converted from
OpenCC traditional Chinese to Simplified Chinese with `opencc-js` 1.4.1 using
`{ from: 't', to: 'cn' }`. Every distinct accepted original Chinese form and
every distinct simplified derivative remains searchable. Only additional
non-display English aliases are capped at two. No non-Chinese name is
translated. Missing Chinese names remain explicit canonical fallbacks.

The compact index has 6,944 ID-sorted rows, E5 coordinates, a lexical string
table, complete accepted Chinese aliases, and bounded additional English
aliases. The committed asset is 779,105 raw bytes and 274,846 gzip bytes. Its
static decoded estimate is 3,116,420 bytes. Including decoder-precomputed,
deduplicated normalized display/country/admin/alias fields, per-city search
objects, and alias references, the conservative runtime total is 4,758,952
bytes, below the 8 MiB gate. Its SHA-256 is
`0d3b027c525497968cfcf7f44ac531310b97ff4585753f30af82e1b2741d63e3`.

Run `pnpm data:cities` from a clean checkout. Missing sources are streamed from
the exact manifest URLs into ignored `tmp/geonames/`, verified before atomic
rename, and valid cached sources are reused. A checksum mismatch fails closed;
raw downloads are not committed.

The visible relation searches this same immutable index independently from the
exact origin and exact antipode. Results mean nearest eligible represented
major city, not nearest settlement, administrative boundary, or built area;
distance ties retain the index's deterministic population and GeoNames ID
ordering.
