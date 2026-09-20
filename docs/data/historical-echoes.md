# Historical Echoes data gate

Status: local feasibility artifact prepared; runtime integration and public
data-PR review remain separate decisions.

## Pinned profile

The current artifact uses the Wikidata entity dump dated 2026-08-10. The source
gzip is `155457882747` bytes with SHA-256
`3d9c0999deafc6bcf00e0ec993b32539f9b384003872e5a3117dcf9eb2ca3618`; the
official MD5 and SHA-1 are recorded in the manifest and metadata.

The reviewed `current` profile has four seed roots:

- `Q811979` architectural structure;
- `Q486972` human settlement;
- `Q56061` administrative territorial entity;
- `Q839954` archaeological site.

P279 edges keep only non-deprecated statements. The denylist
(`Q5`, `Q43229`, `Q1190554`, `Q838948`) is a downward barrier: a denylisted
class and its descendants do not enter the closure, while a seed-root subtree
is not removed merely because it has a denylisted ancestor. The closure contains
`28142` classes and has fingerprint
`ca6d6d9bea9ca02205208dcbbc4cee837ff4cf518288ad6688bacca7b8029f5c`.

Records then require a valid Earth P625 coordinate, an English or Chinese
label, a deterministic non-deprecated P571/P580 start statement with precision
6–11, and a reference year before 1500. Preferred rank is used when present;
ties are resolved by property, precision, date, and stable statement identity.
Missing values are excluded, never imputed.

## Reproducibility evidence

Two independent full builds used the same pinned gzip source and produced the
same artifact byte-for-byte. The final tracked metadata is from the second
build; the first build's input statistic reported one additional admitted P279
edge (`5216821` versus `5216820`) even though its artifact bytes were identical.
The difference is explained by the two runs using different code boundaries: an older
counter admitted a valid P279 statement from a non-item entity while the graph
extractor admitted only item entities. The exact run commit was not recorded,
so this explains the statistic without claiming a precise historical SHA.

- `121307738` input entities, `5216820` admitted P279 edges, and `0` parse errors;
- `1395721` candidates and `43059` final records;
- artifact SHA-256 `7ce314e0b8ed3a5f0c8376bc57fd5e9ce8dd64cfa63fd656ad76cc6ab24a25cd`;
- artifact size `30907296` bytes;
- metadata SHA-256 `09aaf7877c1e8103195ac2df5480d92605c49a0aa0f4572717aebcfc8a9ad663`.

The artifact verifier and strict audit report zero schema, ordering, coordinate,
date, provenance, duplicate, and closure-membership errors. These are
artifact-level checks against the tracked metadata and closure authority; they
do not independently prove that the 145 GB source dump's full transitive graph
was reconstructed without omission. A one-byte artifact tamper test fails
closed on the metadata binding.

## Count-baseline review

The accepted design retains the earlier Phase 0 reference of `27471` primary
records and `25034` labeled records as an **unverified historical reference**.
The original Phase 0 artifact, metadata, full log, and exact code revision are
not available. A Phase 0 profile has now been rebuilt from the same pinned
source with the current builder's deterministic semantics. That rebuild is
reproducible evidence, but it is not proof that it is the historical run.

The tracked `current` profile and the rebuilt Phase 0 profile share the same
source identity and input totals:

| Comparison            |                                                          `current` |                                                   rebuilt `phase0` |
| --------------------- | -----------------------------------------------------------------: | -----------------------------------------------------------------: |
| seed roots            |                                                                  4 |                                                                 18 |
| closure classes       |                                                             28,142 |                                                              2,525 |
| closure fingerprint   | `ca6d6d9bea9ca02205208dcbbc4cee837ff4cf518288ad6688bacca7b8029f5c` | `16181030f9e430153cb5ff78b0d0c0b8449f947be823f58a8246b322c48ec54a` |
| final labeled records |                                                             43,059 |                                                             25,713 |
| input entities        |                                                        121,307,738 |                                                        121,307,738 |
| admitted P279 edges   |                                                          5,216,820 |                                                          5,216,820 |
| parse errors          |                                                                  0 |                                                                  0 |

The complete comparison is recorded in the ignored local output under
`tmp/historical-echoes/phase0-current-rules/profile-comparison.json`. Its
stable results are:

- shared IDs: `25,713`;
- current-only IDs: `17,346`;
- rebuilt-Phase-0-only IDs: `0`;
- shared semantic agreement: `25,713` (`100%`);
- shared semantic differences: `0`;
- shared full-record differences: `24,328`, all in profile-dependent
  `type`, `typeClass`, or `provenance.type` fields; labels, coordinates, start
  values, and provenance for those values agree.

The rebuilt Phase 0 count is `679` records (`2.7%`) above the historical
`25034` reference. The closure comparison explains the former `43059` versus
`25034` gap as a profile-definition difference for the same source, but the
remaining `679` historical discrepancy is still not attributable without the
original artifact, metadata, log, and code revision. Historical Echoes remains
data-review-only and its mode remains `coming-soon`.

The rebuilt Phase 0 artifact SHA-256 is
`bac2b0319289ece04e43770badf985d21739afebd9a69c7ba712a1d6509b0301`; its
metadata SHA-256 is
`e795a62ab6dab4a24a054736763c861fa821d567a9c169b6d3d8bc606c2e4ffe`.

### Local profile sensitivity evidence

An ignored local output from 2026-09-19 is available at
`/tmp/he-phase0-full.json` with SHA-256
`5754449227a4058b5e7a7a6c538c984d16d8380ebdba0e68ad33ec936a6c16f7`. It was
generated from the same pinned dump with the 18 Phase 0 roots, but its metadata
predates the current hardened schema and does not record a complete source or
manifest binding. It is therefore sensitivity evidence, not a Phase 0
reproduction or a release artifact.

The old output contains `25745` records. Compared with the rebuilt Phase 0
artifact, it has the same `25713` IDs plus `32` old-only records and no
newer-only records. The old output uses different coordinate/start selection
and label-provenance serialization and has no complete source binding, so the
32 records are a diagnostic clue, not a historical correction. Its closure
fingerprint is `2ee8842612782ef6e7b0f47e3f933bf6c3f43434d1c52c0bfa8433afceb647f8`.

This narrows the observed difference to profile coverage and classification,
but it does not explain the historical `25034` value. The one-edge
`p279Edges` difference between the old output (`5216821`) and the rebuilt
artifact (`5216820`) is explained by a code-boundary mismatch: an older input
counter admitted a valid P279 statement from a non-item entity, while the graph
extractor admitted only item entities. The exact old run revision is not
recorded, so this is a boundary explanation rather than a commit attribution.
P1249 inclusion, old coordinate/rank behavior, and the original code revision
remain unresolved. Do not promote the old output, its funnel counts, or its
`25745` total into the public data contract.

The comparison command is deterministic and keeps artifact-level differences
separate from profile metadata differences. It reports shared/current-only/
baseline-only IDs, field-level differences for shared records, source and
closure identity, and the selected input statistics:

```bash
pnpm data:compare:historical-echoes \
  --current-artifact=src/data/generated/historical-echoes.json \
  --current-metadata=src/data/generated/historical-echoes.metadata.json \
  --baseline-artifact=/path/to/phase0/historical-echoes.json \
  --baseline-metadata=/path/to/phase0/historical-echoes.metadata.json \
  --output=/path/to/profile-comparison.json
```

The comparison output is review evidence only. It does not alter the
production manifest, current-profile validator, or `coming-soon` mode state.

## Commands

The data gates require the exact CI runtime because Node/zlib versions can
change the measured GeoNames gzip budget:

```bash
pnpm toolchain:verify
pnpm data:verify
pnpm test:data-historical-echoes
pnpm check
```

Use Node.js `22.23.1` and pnpm `11.7.0`. Do not change the GeoNames manifest to
accommodate another zlib implementation.
