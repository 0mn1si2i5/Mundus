# Mundus Exhibit Shell V2

Status: accepted product and architecture design; implementation not started

Accepted: 2026-08-15, Asia/Shanghai

## 1. Purpose

Mundus will evolve from an application with three co-equal modes into a
curated Earth observatory that can gain, feature, retain, and archive many
observation modes over time.

The first screen becomes a calm, mode-neutral globe rather than an already
active observation. A user may rotate the globe and select a point, inspect a
mode's exhibit label, deliberately enter that observation, and later return to
the neutral globe without losing geographic context.

This is a curated exhibit system, not a general GIS, arbitrary layer catalog,
runtime plugin platform, marketplace, or user-extensible renderer.

## 2. Product Model

The stable product hierarchy is:

- the **Exhibit Lobby**, containing the neutral globe and curated mode entry
  points;
- the **Mode Atlas**, containing the complete browsable collection;
- independent **Observation Modes**, each answering one clear question;
- shared, explicitly designed **Observation Overlays**, such as the stopped
  GHSL Human Morphology proposal, which do not consume a mode identity.

Other Side remains a long-term observation mode but is no longer required to
be the automatic product entry. Development and Sunline remain available and
retain their existing URLs and semantics. The new shell must not delete,
silently reinterpret, or prematurely rewrite any existing mode.

## 3. Lobby And Mode Entry

The lobby has no active mode. It renders the shared base globe without any
mode-specific result, control, overlay, code chunk, or data request.

On desktop, four to six featured or newly published mode labels visually orbit
the globe. The orbit is editorial, not a complete navigation surface. It does
not autoplay. Labels may respond with restrained parallax to direct user
interaction; under reduced motion they remain still.

The initial shell has exactly three real modes, so the first orbit shows those
three labels. It must not fabricate placeholder modes to fill a target count.
As the collection grows, the curated orbit targets four to six labels, with a
hard cap of six.

On mobile, the same curated sequence appears as a horizontally scrollable
label strip below the globe. Mobile does not shrink the complete desktop orbit
into small or overlapping touch targets.

Selecting a label opens a mode preview. The preview states:

- the question the mode answers;
- a short bilingual description;
- its data source and observation scope;
- its maturity or relevant availability state;
- an explicit action to enter the observation.

The preview reads pure catalog metadata and must not load the mode runtime or
its data. Only the explicit enter action activates and loads the mode.

Exiting an active mode returns to the lobby while preserving the selected point
and the current in-session camera orientation and zoom. The selected point may
be shared. Camera orientation and zoom remain session-only and do not create
URL updates during globe movement.

## 4. Mode Atlas And Curation

The home orbit exposes only a bounded curated subset. The Mode Atlas owns
complete discovery through:

- Featured;
- New;
- search;
- multiple editorial tags, initially capable of expressing themes such as
  place, time, humanity, and nature;
- the complete maintained collection;
- an explicit route to archived observations.

A mode may have multiple tags. Tags are catalog metadata, not executable
capabilities or arbitrary data-layer identifiers.

Two independent dimensions describe a mode:

1. **Curation lifecycle** — Featured, Collection, or Archived.
2. **Product maturity** — for example Stable or Experimental.

Featured modes may appear on the lobby orbit. Collection modes remain normally
searchable and shareable. Archived modes leave default browsing but retain
working historical URLs and display a clear archive notice. Archiving never
silently changes the meaning of a saved URL.

## 5. State Model

The shell adds two distinct state concepts:

- `activeMode: ModeId | null` — `null` represents the lobby;
- `previewMode: ModeId | null` — a transient preview that is not shareable URL
  state.

The observable flow is:

1. **Lobby** — neutral globe, catalog entry points, no active runtime.
2. **Preview** — exhibit label expanded from pure metadata.
3. **Active** — the selected mode runtime and its resources are loaded.
4. **Exit** — return to Lobby while retaining point and session camera.

The core shell continues to own locale, selected point, shared country
interaction, camera intent, dialogs, and active mode identity. This phase does
not generalize all existing mode-specific state into an untyped global map.

## 6. URL Compatibility

The bare Pages URL changes to the lobby:

| URL shape                                                           | Required behavior                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/Mundus/`                                                          | Open the new neutral lobby.                                         |
| An unversioned URL with historical query state such as `?point=...` | Preserve the existing Other Side interpretation.                    |
| Any valid `v=1` URL                                                 | Preserve the complete current parser and sharing semantics.         |
| `?v=2` with no `mode`                                               | Open the lobby; an optional valid `point` selects the shared point. |
| `?v=2&mode=<id>`                                                    | Open that mode; V2 active modes are always explicit.                |
| `v=2` with an unknown mode                                          | Open the lobby and show a non-blocking explanation.                 |
| A known archived mode URL                                           | Open the mode and show its archive notice.                          |

Besides the required V2 discriminator, new lobby links serialize only a
non-default selected point. They do not serialize preview state or camera
state. New active-mode links use V2 and always include the mode identifier,
including Other Side.

Browser back and forward must restore shareable lobby or active-mode state.
Opening or closing a preview alone must not mutate URL history.

## 7. Architecture

### 7.1 Phase-one shell boundary

The existing `ModeDefinition` principle remains: catalog definitions are pure
metadata. The catalog may gain localized preview copy, tags, curation
lifecycle, maturity, featured order, and declarative resource identity. It
must not contain React hooks, data loaders, renderer objects, camera callbacks,
or mutable runtime state.

The first Shell V2 implementation may keep the current explicit, exhaustive
runtime dispatch in `useModePresentation`, `ModeControls`, `ModeResult`, and the
single `GlobeViewport`. It adds an explicit neutral-globe presentation without
loading or calculating inactive-mode resources.

### 7.2 Deferred static runtime contract

Do not invent a general runtime module abstraction during the shell migration.
After Historical Echoes passes its data feasibility gate, use that fourth real
mode together with the existing three to design and freeze a build-time static
mode-module contract.

That later contract may reduce the number of core dispatch edits required for
new modes, but it must preserve:

- build-time registration and type checking;
- one shared WebGL Canvas;
- mode-local failure containment and cleanup;
- lazy runtime and data loading;
- pure catalog metadata;
- no network-loaded code, plugin marketplace, generic event bus, backend, or
  second renderer.

## 8. Loading And Failure Behavior

The lobby and preview must make zero requests for Development, GeoNames, or
future mode-specific assets and chunks. A mode begins loading only after the
explicit enter action.

On exit, its playback, listeners, requests, and renderer resources must stop or
be released according to the mode's existing cleanup contract.

Failures remain local:

- a base-globe failure leaves a semantic lobby, Mode Atlas, language control,
  and retry action available;
- a mode chunk, data, calculation, or rendering failure leaves a local recovery
  state and an always-available return to the lobby;
- one failed mode cannot prevent entering another mode;
- an unknown V2 mode is a recoverable navigation state, not an application
  crash;
- archived modes remain readable and explain their lifecycle state.

## 9. Accessibility And Interaction

Desktop and mobile must complete the same lobby, preview, enter, observe, exit,
and mode-switching loop.

Required behavior includes:

- every orbit or strip label has an equivalent semantic list item and button;
- keyboard order does not depend on visual orbital position;
- opening and closing a preview traps and restores focus correctly;
- entering a mode moves focus to its title or first meaningful region;
- exiting returns focus to the initiating label when it remains present, or to
  a stable lobby heading otherwise;
- the globe retains its existing keyboard and semantic fallback behavior;
- reduced motion disables orbit/parallax animation without hiding content;
- the mobile strip uses adequate touch targets and native, predictable
  scrolling behavior;
- Chinese and English agree on question, scope, source, lifecycle, error, and
  archive meaning.

## 10. Verification Contract

The implementation is not complete until fresh final-commit evidence covers:

### Unit and contract checks

- the full legacy, V1, and V2 URL matrix;
- lobby, preview, enter, exit, back, and forward state transitions;
- unique catalog identifiers and valid tag, curation, maturity, and featured
  metadata;
- unknown and archived mode behavior;
- no mode-resource activation from lobby or preview;
- active-mode cleanup on exit and switching.

### Browser and product checks

- direct and hard-refresh entry to the bare lobby on desktop and mobile;
- globe rotation and point selection before choosing a mode;
- desktop featured orbit and mobile horizontal label strip;
- keyboard and pointer preview entry, focus restoration, and explicit mode
  activation;
- proof from network observation that lobby and preview do not fetch
  mode-specific chunks or data;
- entry into each existing mode and preservation of its current product loop;
- exit to the lobby with point and camera context preserved;
- historical unversioned and V1 share links;
- new V2 lobby and active-mode links;
- unknown and archived mode recovery;
- WebGL fallback, context loss, reduced motion, and mode-local error recovery.

The final candidate must pass `pnpm check`, the complete desktop/mobile
`pnpm test:e2e` gate, Pages artifact verification, and the applicable manual
product review. Tests may not be loosened, skipped, retried, or given larger
timeouts merely to make the migration green.

## 11. Implementation Sequence

Implementation is separately planned and authorized. Its required ordering is:

1. correct the remaining worktree wording drift in the continuation handoff and
   establish this document as the durable Shell V2 contract;
2. add failing URL V1/V2, catalog, lobby, preview, loading, and state-transition
   tests;
3. implement the neutral globe state and URL migration;
4. extend pure catalog metadata and build the desktop orbit, mobile strip,
   preview, and scalable Mode Atlas;
5. adapt all three existing modes without changing their scientific or product
   semantics;
6. complete failure, cleanup, accessibility, performance, browser, artifact,
   and documentation gates;
7. after the shell is accepted, return to the Historical Echoes data
   feasibility gate before designing a generalized static runtime contract.

## 12. Non-Goals

Shell V2 does not:

- implement Historical Echoes or another new observation mode;
- restart GHSL or restore the large migration snapshot;
- redesign the scientific meaning of Other Side, Development, or Sunline;
- introduce accounts, backend services, telemetry, cloud state, PWA/offline
  packaging, arbitrary layers, runtime plugins, or a marketplace;
- publish, deploy, tag, release, or change remote repository settings.
