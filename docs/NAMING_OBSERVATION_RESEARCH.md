# Naming Observation Research

Status: research complete; bounded Surname Atlas implementation merged into the
current development branch pending protected-main release validation

Updated: 2026-09-21, Asia/Shanghai

## Recommendation

Use a small community-sourced naming observation as the next product packet,
starting with surnames. The first question should be:

> What common surname record does this country have in the reviewed community
> dataset, and how is it written in local and Latin forms?

This is a source-indexed cultural observation, not a globally comparable census
ranking. The product must say when a country has no comparable record or when a
field is missing.

Given-name data can follow as a separate lens after the surname contract is
working. Its country coverage and meaning are different and should not be
silently merged with surname frequency.

## Candidate Source

`sigpwned/popular-names-by-country-dataset` is a practical low-resource source:

- repository: <https://github.com/sigpwned/popular-names-by-country-dataset>;
- release: v1.2, published 2023-07-16;
- repository data declaration: CC0;
- surname CSV: about 96 KB, 2,576 rows, 75 country codes;
- given-name CSV: about 124 KB, 2,278 rows, 106 country codes;
- source snapshot stated by the author: Wikipedia lists collected during the
  week of 2023-07-08;
- fields include country, rank, localised name, romanised name, count, and
  percentage when available.

The surname file has a `Rank=1` record for 72 of 75 countries. Albania, Bosnia
and Herzegovina, and Greece have no rank-one record in this snapshot. Some
countries have multiple rank-one spellings or transliterations. Counts and
percentages are frequently absent.

The repository's CC0 declaration does not erase the need to preserve upstream
provenance. Its README identifies Wikipedia list pages as the source, and those
pages are CC BY-SA 4.0. A production asset must retain the upstream page URLs,
the repository version, the collection date, the transformation, and both
license statements. A small manually reviewed derivative is preferable to
blindly treating the CSV as an authoritative global table.

## Data Contract

The first reviewed asset should retain all community rows but present rank-one
records as the primary finding. It should use a schema equivalent to:

```text
countryIso: string
rank: number | null
localForms: [{ value: string, script: string | null }]
romanizedForms: string[]
zhDisplay: string | null
zhMethod: "reviewed" | "source" | "missing"
count: number | null
share: number | null
statYear: number | null
sourceKind: "community" | "wiki-derived" | "official"
sourceUrl: string[]
license: string
sourceSnapshot: string
coverageNote: string
confidence: "reviewed" | "source-only" | "missing"
```

`rank=1` is an array of records, not a single string. `count`, `share`,
`statYear`, `zhDisplay`, and transliteration remain nullable. Missing values
must not become zero, and a missing rank-one record must not be filled by
guessing from another source.

The user-facing label should be “common surname record” or
“source-listed highest-frequency surname”. Use “Chinese presentation” rather
than “Chinese translation”: a Chinese form may be an established name, an
音译, or unavailable. Do not generate an official-looking Chinese name from
Google Translate at runtime.

## Alternative Sources

The U.S. Census 2010 surname release is a clean official single-country source:

- <https://www.census.gov/topics/population/genealogy/data/2010_surnames.html>;
- 162,253 surnames occurring at least 100 times;
- published rank and count, with technical documentation;
- top-1,000 workbook is under 0.1 MB; the complete archive is about 12.9 MB;
- use requires Census attribution and must remain explicitly US-only.

It is useful as an independently sourced US comparison or validation sample,
not as a way to make the community table globally uniform.

Wikidata has a CC0 structured-data policy but does not expose a single,
consistent country-by-country surname-frequency table. Wikipedia lists can be
used for provenance and manual review, not as a silently unified census.

Do not use Forebears as a redistribution source without a separate license
decision. Do not use `philipperemy/name-dataset`: its provenance includes a
Facebook data leak and its full data has multi-gigabyte storage and memory
requirements. Do not use unprovenanced country frequency repositories merely
because their repository license is permissive.

## Product Packet Boundary

An implementation packet should contain one static JSON asset under 0.2 MB,
reuse the existing country identity and globe, and add no backend, crawler,
runtime translation service, or new renderer. The initial interaction can be:

1. select a country on the globe or from the existing place context;
2. read the source-listed common surname record;
3. switch between local form, Latin form, and reviewed Chinese presentation;
4. inspect rank, year, coverage, source, and missing-state disclosures.

The packet must include manually reviewed Chinese forms for its chosen launch
set. Countries without a reviewed Chinese form show an explicit unavailable
state. Any country with multiple rank-one entries shows all of them.

Acceptance requires deterministic asset hashing, source and license notices,
desktop/mobile semantic output, keyboard access, reduced-motion behavior, and a
measured Pages transfer/runtime budget. No global crawl or large source dump is
part of the packet.

## Implementation packet

The bounded implementation uses `src/data/generated/surnames-by-country.json`
and `src/features/surnames/`. It contains 75 country entries and 72 rank-one
records, is 16,662 bytes before compression, and is loaded only when the mode is
active. The manifest pins the CSV and ISO mapping hashes. Five Chinese
presentations are manually reviewed (`CN`, `TW`, `KR`, `JP`, and `VN`); all
other countries show an explicit missing state. The app preserves alternate
local and romanized forms within a rank-one source group and does not infer a
statistical year from the 2023 collection snapshot.
