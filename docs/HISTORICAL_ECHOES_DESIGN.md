# Historical Echoes Product Design

Status: accepted product design; implementation not yet authorized

Accepted: 2026-08-16, Asia/Shanghai

## 1. Product decision

Historical Echoes is Mundus's second featured observation mode. It observes the
uneven coverage of a fixed Wikidata snapshot rather than claiming to measure
the amount, continuity, depth, or completeness of local history.

The mode asks:

> Around this point, how many records in the snapshot carry an interpretable
> start date before 1500, and how far back do they reach?

Chinese:

> 这一点周围，快照收录了多少条具有可解释起始年代、且年代早于 1500 年的记录？这些记录最早能追溯到何时？

The product name is **Historical Echoes / 历史回响**. The stable mode ID is
`historical-echoes`.

Historical Echoes is not a nearby-attractions list, heritage guide, historical
authority, or claim about whether a place has history. The visible record field
and its gaps are the observation. A lack of qualifying records is a valid
finding, not an error and not evidence of a lack of history.

## 2. First-release experience

The mode preserves the geographic point already held by the Exhibit Shell. A
new session therefore opens on the shell's default point; switching modes
preserves the user's current point. There is no separate unselected-point state.

The first-release loop is:

1. enter Historical Echoes and see the fixed snapshot's global record field;
2. inspect the result for the current point;
3. choose another point directly on the globe;
4. read the count, earliest interpretable start record, and date distribution;
5. inspect the visible method and coverage disclosure;
6. share the current mode and point or return to the lobby.

The observation radius is fixed at **150 km**. The first release has no radius
control and no radius URL state. This deliberately preserves local gaps instead
of expanding the search until a record appears.

When the radius contains no qualifying records, the result may report the
distance to the nearest qualifying record in the fixed snapshot. It reports
only the approximate distance: no place name, pin, route, recommendation, or
"go there" action. This keeps the fact about sparse coverage from becoming a
point-of-interest result.

Historical Echoes does not inherit Other Side's city search, coordinate form,
geolocation, or curated-city controls. Those controls are mode-local today.
The first release uses globe selection, the shell's preserved point, and point
state loaded from a valid shared URL. A future shared place picker requires a
separate shell design.

## 3. Result contract

The primary result contains three descriptive measures without a composite
score or qualitative global rating:

- **recorded concentration:** the number of qualifying records within 150 km;
- **temporal reach:** the earliest interpretable start record within 150 km;
- **temporal distribution:** a precision-aware distribution of start records
  by time bucket.

The first release does not label places or areas as thin, medium, thick, sparse,
dense, important, or historically deep. A future percentile-based label needs
a separate metric-feasibility gate covering threshold stability, snapshot
reproducibility, and the dataset's geographic and religious-building bias.

For a small non-zero count, the result still shows the count, earliest record,
and available distribution. It must not expand into a list of every matching
place. The earliest record is secondary evidence, not the mode's sole finding.

The result states are:

- loading;
- ready with zero records;
- ready with one or more records;
- recoverable data or decoding failure;
- WebGL unavailable or context lost, with the complete textual result retained.

The mode always retains the shell, Mode Atlas, language, sharing, and
return-to-lobby controls. A mode-local failure must not take down the canvas or
another mode.

## 4. Data contract

The first release uses a reproducibly derived, fixed snapshot with this scope:

- Wikidata entity dump dated 2026-08-10;
- place records selected through the reviewed Historical Echoes type closure;
- `P571` and `P580` start properties only;
- a valid Earth `P625` coordinate with finite latitude/longitude;
- interpretable Wikidata time precision 6 through 11;
- start date earlier than 1500;
- at least one English or Chinese label;
- no `P1249` expansion;
- no claim of globally complete historical coverage.

The Phase 0 primary set contains 27,471 records, of which 25,034 have an English
or Chinese label. The production asset must be regenerated as the labeled
subset by a reviewed, pinned script; fixed by checksum; registered through the
existing data manifest and registry path; and rejected by `pnpm data:verify` on
identity drift. Phase 0 files under `/tmp` are evidence, not release assets.

The current evidence is explicitly uneven. The labeled set is dominated by
European and religious-building records, while the Americas, Oceania,
sub-Saharan Africa, and parts of Asia have much thinner coverage. The product
must expose that limitation as part of the observation, never hide it behind a
generic disclaimer or reinterpret it as the distribution of history.

The fixed disclosure remains visible with the result. Its meaning in both
languages is:

> Data comes from a fixed Wikidata 2026-08-10 snapshot, using P571/P580 start
> records before 1500 with interpretable precision and an English or Chinese
> label. Results reflect snapshot coverage, not the amount, continuity, or
> completeness of local history, and they do not explain why gaps formed.

Chinese:

> 数据来自固定的 Wikidata 2026-08-10 快照，仅使用年代早于 1500 年、精度可解释、具有英文或中文标签的 P571/P580 起始记录。结果反映快照覆盖，不代表当地历史的多少、连续性或完整程度，也不解释空白为何形成。

## 5. Date semantics

Every production record carries one deterministically selected start value and
its original precision. The formal data gate must freeze and test these rules:

1. accept only qualifying `P571` and `P580` statements with precision 6–11;
2. exclude deprecated statements;
3. define and audit Wikidata preferred-versus-normal rank behavior before the
   production rebuild;
4. select deterministically by the accepted rank rule, date, property,
   precision, and stable statement identity;
5. preserve BCE values and coarse precision without inventing a finer date.

Coordinate selection must also exclude deprecated or non-Earth claims, prefer
preferred-rank claims over normal-rank claims, reject out-of-range values, and
break remaining ties deterministically. Records without a valid `P625` cannot
participate in the fixed-radius query or the rendered record field.

Year, month, and day precision may be presented at year granularity. Decade,
century, and millennium precision must be described as approximate at their
actual granularity. Product copy uses "recorded start date" or "recorded start
period," never "founded," "built," or a claim that the current structure has
survived since that date.

The time distribution must state its bucketing method. Coarse records may be
assigned deterministically to a bucket by their encoded reference/lower-bound
year, but the interface must disclose that a century- or millennium-precision
record can span multiple finer buckets.

The first release does not classify a place as extant, ruined, continuously
occupied, or culturally continuous. It may display the supported record type
and start value only.

## 6. Globe and accessible presentation

The single existing Canvas renders the approximately 25,000 labeled records as
a neutral snapshot record field:

- one subdued, static point field with uniform meaning;
- no importance color scale, particles, pulsing, or implied ranking;
- points within 150 km of the selected point are emphasized;
- points outside the radius remain visible at lower emphasis;
- a restrained surface ring identifies the fixed observation radius;
- a legend states that each visible mark represents a qualifying snapshot
  record.

The field is enhancement rather than the only carrier of meaning. Count,
earliest record, time distribution, method, source, and limitations exist in
semantic DOM. Canvas accessibility is supplied through surrounding semantic
text and an equivalent result summary rather than inaccessible per-point
objects. Reduced motion keeps the field static. WebGL failure retains the full
textual finding.

Rendering cost is a release gate, not an assumption. Desktop and supported
mobile measurements must freeze a point-buffer, frame, memory, and context-loss
budget before release.

## 7. Shell and architecture boundaries

Historical Echoes follows Exhibit Shell V2's static mode contract:

- `ModeDefinition` remains pure, compile-time metadata;
- mode IDs and URL parsing remain exhaustive and versioned;
- lobby and preview surfaces do not request the Historical Echoes asset;
- only the active mode acquires the asset;
- `useModePresentation`, `ModeControls`, and `ModeResult` keep exhaustive
  dispatch;
- `GlobeViewport` remains the only Canvas and owns renderer internals;
- Three.js objects do not escape into controls or application state;
- loading, failure, retry, unmount, and context-loss paths dispose resources
  and prevent stale results;
- the selected point and camera policy remain consistent across mode changes.

The share contract is `v=2`, `mode=historical-echoes`, and the non-default
point. Historical Echoes adds no first-release query key. Opening the lobby,
preview, Mode Atlas, or Share dialog must not mutate shareable state.

The implementation will require an explicit Historical Echoes feature module,
a production data decoder/query boundary, mode-local result presentation, and
a globe render state. Exact file changes belong in the later implementation
plan, not this product contract.

## 8. Curation order

The accepted featured order is:

1. Other Side;
2. Historical Echoes.

Historical Echoes is initially marked new and experimental. Development and
Sunline move to a folded "Other Modes" collection rather than occupying the
second and third featured positions.

This curation change is a separate Exhibit Shell packet and must complete
before Historical Echoes implementation. It is not folded opportunistically
into the mode implementation. The shell packet must preserve direct V2 URLs,
preview and focus behavior, accessibility, geographic context, and existing
mode functionality.

## 9. First-release exclusions

The first release excludes:

- nearby-place or heritage-site lists;
- named nearest-place fallback;
- radius controls or multi-radius comparison;
- global percentile or density labels;
- a time playback or animated historical timeline;
- `P1249` and local-language label expansion;
- extant-versus-ruin or continuity classification;
- a shared global place picker;
- arbitrary layer catalogs or a runtime plugin system;
- a second Canvas or renderer;
- backend services, telemetry, or HTTP Range dependency;
- GHSL integration or changes to the Human Morphology contract.

## 10. Acceptance gates

Implementation may be planned only after this product design is reviewed. A
release candidate must then satisfy all of the following:

- the production labeled artifact is reproducible, checksum-pinned, licensed,
  registered, and fail-closed;
- every retained record has a valid deterministic Earth coordinate and the
  audit reports missing, invalid, and non-Earth coordinate claims;
- count, radius, nearest distance, date selection, rank handling, BCE/coarse
  formatting, and distribution buckets have deterministic tests;
- Chinese and English preserve the same meaning in zero, non-zero, coarse-date,
  failure, and disclosure states;
- prohibited causal, completeness, "founded," and POI language is absent;
- the lobby and preview fetch no Historical Echoes resource;
- Other Side-only navigation fetches no Historical Echoes asset or feature
  chunk;
- the mode remains useful through semantic DOM when WebGL is unavailable;
- desktop, mobile, keyboard, focus, reduced-motion, context-loss, retry,
  sharing, and return-to-lobby paths pass;
- measured point-field performance stays within the separately frozen release
  budget;
- `pnpm check`, the complete desktop/mobile end-to-end suite, and the Pages
  artifact verifier pass on the final implementation commit.

This design does not authorize implementation, data regeneration, GHSL work,
release operations, or remote mutation.
