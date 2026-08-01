# Mundus Roadmap And Handoff Index

Status: active handoff index

This document is the repository-visible entry point for work after Mundus V1.
It defines which planning documents are authoritative, what may be executed,
and where an agent must stop for product-owner review. It is an index and
governance contract, not a detailed implementation plan.

## 1. Three Planning Layers

Mundus uses three planning layers. Never treat them as interchangeable.

### Layer A: Post-GHSL product direction

This file owns the high-level direction after GHSL. A direction listed here is
not approved implementation work. It must receive a focused design, product
approval, and a separate detailed plan before code or data work begins.

### Layer B: GHSL phase master plan

The local-only master plan is expected at:

`docs/superpowers/plans/2026-07-22-ghsl-human-morphology-master-plan.md`

It owns the order, dependencies, approval gates, and completion status of GHSL
Plans 1 through 7. It does not replace the accepted scientific design.

### Layer C: Last approved detailed plan

The terminal recovery plan is expected at:

`docs/superpowers/plans/2026-08-01-ghsl-plan1-48h-global-validation-recovery.md`

It records the task-level files, TDD steps, commands, expected failures and
successes, commit boundaries, long-job behavior, and terminal execution path.
It is not authorization to restart or resume Plan 1.

The files under `docs/superpowers/` are intentionally local-only through
`.git/info/exclude`. They must not be added to Git unless the product owner
explicitly changes that policy. Detailed migration and convergence plans there
are local execution aids; durable decisions and final evidence belong in
tracked documentation and PR #5.

The approved ignored V1.1 execution aid is in the primary checkout at
`/Users/bytedance/Desktop/Zen/Mundus/docs/superpowers/plans/2026-08-01-mundus-v1.1-parchment-atlas-convergence.md`.
Agents in linked worktrees read it there as read-only and must not copy or add
it. Tracked handoffs and Draft PR #5 remain the durable authority and evidence.

## 2. Authority Order

Use this order when documents disagree:

1. Current product-owner instruction and explicit approval gates.
2. Repository root `AGENTS.md` for Git, release, data, and remote-state safety.
3. This repository-visible handoff index and
   `docs/GHSL_EXECUTION_HANDOFF.md` for current status and sequencing.
4. If GHSL is explicitly reopened, the accepted design:
   `docs/superpowers/specs/2026-07-22-ghsl-human-morphology-overlay-design.md`.
5. If GHSL is explicitly reopened, the local master plan for phase dependencies.
6. The last approved detailed GHSL plan as historical execution evidence only.
7. Current Git, artifact, checkpoint, and test evidence.
8. Older roadmap and status text.

Current evidence overrides stale status snapshots, but implementation evidence
must never silently change an accepted scientific or product contract.

For current V1.1 convergence, the tracked terminal documents, Draft PR #5, and
the approved ignored convergence plan named above govern; absent ignored GHSL
source plans are not a blocker. If GHSL is explicitly reopened, stop until the
accepted design, master plan, and a newly approved detailed plan are available.
Never reconstruct scientific rules, budgets, or implementation tasks from older
roadmap prose.

## 3. Accepted GHSL Direction

Human Morphology is a globally complete shared observation overlay, not a
fourth mode. Its accepted core contract is:

- GHS-BUILT-S R2023A, epoch 2020, 100 m;
- inclusive 15% built-surface threshold;
- eight-neighbour connectivity;
- retained forms contain at least 100 participating source cells;
- arbitrary-point strict source-cell containment with no nearest-form fallback;
- authoritative source-run containment distinct from 200 m render outlines;
- deterministic multi-form `MHP1` base packs;
- optional `MHF1` fill sidecars with explicit outline-only fallback;
- a conservative zero-false-negative global index;
- whole-file static delivery without HTTP Range requests;
- no backend, general GIS, tile platform, plugin system, or fourth mode.

The population-density fourth-mode direction in `docs/EXECUTION_PLAN.md`
Milestones 3 and 4 is superseded by the accepted Human Morphology overlay
design. Do not execute those old milestone instructions.

## 4. GHSL Phase Sequence

The GHSL project is divided into seven separately approved plans:

| Plan                                      | Purpose                                                                                                                    | Start gate                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1. Global feasibility proof               | Rebuild and measure all retained forms; propose static-host, pack, index, fan-out, runner, fill, and worst-target ceilings | Accepted Human Morphology design                      |
| 2. Data formats and reproducible pipeline | Freeze production index, `MHP1`, `MHF1`, manifest, IDs, decoders, hashes, attribution, and full-data gate                  | Plan 1 technical GO and product-owner budget approval |
| 3. Shared runtime service                 | Strict lookup, lazy loading, target-only decode, request coalescing, bounded cache, retry, and stale-result isolation      | Reviewed Plan 2 assets and decoders                   |
| 4. Overlay state and Lenses UI            | URL state plus accessible desktop/mobile shared controls and failure states                                                | Stable Plan 3 service API                             |
| 5. Globe rendering                        | Single-Canvas etched outline, optional fill, quality fallback, disposal, and context restoration                           | Plans 2 and 3 plus visual approval                    |
| 6. Mode interpretations                   | Shared facts and at most one bounded finding in each existing mode                                                         | Plans 3, 4, and 5                                     |
| 7. Global promotion and release           | Reproducible global artifact, Pages rehearsal, browser gates, deployment, live smoke, and release evidence                 | Plans 1 through 6 complete                            |

Plan 1 reached the terminal `STOP_GLOBAL_MORPHOLOGY` decision. Plans 2 through 7
are frozen and blocked. Do not restart Plan 1 or prepare later detailed plans
unless the project is separately reopened and the applicable owner gates are
approved; measured Plan 1 evidence must inform any such decision.

## 5. Current Execution Checkpoint

Release identity is canonical:

- **V1.0.0** — verified public baseline at
  `a5ff99bc60fb7cd2e6e14f4d3bc4f54e5abfb4a1`;
- **V1.1.0 Parchment Atlas** — current unpublished local candidate: parchment
  presentation, drag cross-section, bilingual GeoNames search, bilateral city
  relations, and Natural Earth vector globe;
- **V1.2.0 Human Morphology** — reserved for the later shared GHSL overlay only
  after Plans 1–7 and owner gates complete.

`package.json` is private build metadata; its `0.1.0` value is not a product
release identity.

Plan 1 is terminal in:

- worktree: `.worktrees/codex-ghsl-global-proof`;
- branch: `codex/ghsl-global-proof`;
- terminal commit: `6e396d90ef215085a3d5bc8dbf602b6e4f239051`;
- parent implementation commit: `e2d060518438b9b4b7c86cef53bbd5aeecd94341`.

Verified terminal evidence at the 2026-08-01 checkpoint:

- the strict global audit passed for 15,576/15,576 tiles, 100,070 retained
  roots, 10,345,449 retained runs, and zero topology findings;
- representative review passed with 8,701 forms, 1,150,677 scoped authoritative
  runs, zero false negatives, and ten-region manual review;
- implementation commit `e2d060518438b9b4b7c86cef53bbd5aeecd94341`
  produced two independent containment and outline passes with exactly 100,070
  successful outlines in each build and no failed or pending outline records;
- Build A reached 10,000 fill records at about 9,261 records/hour, projecting
  about 10.81 hours for the fill stage and breaching the approved eight-hour
  ceiling;
- Build A was checkpointed during fill and Build B after outline. Neither is a
  complete formal build, and neither may be resumed, reused, copied, deleted,
  or represented as completed Build A/B evidence;
- the terminal decision is `STOP_GLOBAL_MORPHOLOGY`. Plans 2 through 7 are
  frozen and blocked unless separately reopened and approved.

The concise terminal evidence and preserved output paths are recorded in
`docs/GHSL_EXECUTION_HANDOFF.md`. Continue V1.1.0 Parchment Atlas convergence;
do not treat local GHSL plans as current execution instructions.

## 6. Required Execution Workflow

If GHSL is separately reopened, every approved detailed task must:

1. Work only in the approved isolated worktree and branch.
2. Use TDD: observe the focused failure before implementation.
3. Commit one purpose at a time when authorized by the active plan.
4. Run an independent specification review.
5. Correct every specification finding and re-review.
6. Run an independent code-quality review.
7. Correct every quality finding and re-review.
8. Run proportionate focused tests and the required repository gate.
9. Update the local master-plan and approved detailed-plan checkpoint.

Long global jobs must expose separate preflight, start, status, resume, verify,
and report operations. A timeout is not a failed job. Never start or resume a
job while status proves an existing owner process is live. This general policy
does not authorize resuming the terminal Plan 1 outputs.

## 7. Status Vocabulary

Use status terms precisely:

- **Direction recorded:** a high-level candidate only; no implementation.
- **Design accepted:** product/scientific architecture approved; implementation
  still requires a detailed plan.
- **Plan written:** local task instructions exist; implementation has not begun.
- **Plan approved:** the product owner authorized execution of that plan.
- **Task complete:** implementation plus specification and quality reviews pass.
- **Technical GO:** measured evidence is sufficient to request the next approval;
  it is not owner budget approval.
- **Budget approved:** the product owner accepted the measured hard ceilings.
- **Feature complete:** the applicable production, runtime, browser, artifact,
  deployment, and live gates all pass.
- **Project complete:** GHSL Plan 7 is deployed and live-verified. Plan 1, one
  global build, local tests, or visible outlines are not project completion.

## 8. Mandatory Stops

Stop and ask the product owner before:

- reopening or restarting GHSL Plan 1, or starting any of Plans 2 through 7;
- approving or loosening global file, byte, pack, fan-out, runner, fill, heap, or
  GPU ceilings;
- changing the source, threshold, connectivity, minimum component size, strict
  containment rule, or global-completeness requirement;
- reducing coverage to GeoNames-associated forms or a regional subset;
- introducing nearest-form fallback, a backend, HTTP Range dependency, or GIS
  tiles;
- starting GHSL Human Morphology runtime, URL, UI, or WebGL work before Plan 1
  is formally reopened and its budget gate passes;
- beginning a post-GHSL product direction without an accepted design and plan;
- pushing, opening a PR, deploying, tagging, releasing, or changing remote
  settings without the applicable authorization in `AGENTS.md`.

## 9. Post-GHSL High-Level Direction

After GHSL is globally complete and live, the next candidate product packet is a
cultural observation design and licensing spike using redistribution-safe
Wikidata and/or Pleiades sources. Its purpose is to test whether Mundus can add a
deep cultural-historical observation experience while preserving the museum
exhibit, scientific-instrument, and interactive-atlas character.

That packet is not yet designed or approved. Before implementation it must
define:

- one clear question and product loop rather than a general culture layer;
- source identity, licensing, attribution, snapshot, and redistribution policy;
- global or explicitly bounded coverage semantics and honest missing states;
- static-host, transfer, heap, GPU, and artifact-file budgets;
- bilingual narrative and caveats without authority or completeness inflation;
- compatibility with one Canvas, existing modes, semantic DOM, mobile,
  keyboard, reduced motion, WebGL fallback, sharing, and Pages deployment.

Also deferred after GHSL:

- general plugin or marketplace architecture;
- accounts, backend services, telemetry, and cloud user state;
- street-level GIS, navigation, weather, time-zone layers, and live-event data;
- arbitrary layer catalogs or camera-driven geographic vector tiles;
- PWA/offline packaging;
- any additional observation direction not separately designed and approved.

## 10. New-Agent Startup

A new agent must:

1. Read `AGENTS.md` and this file completely.
2. Read `docs/GHSL_EXECUTION_HANDOFF.md` as terminal evidence and status only.
3. Preserve the stopped Build A/B outputs without resuming, reusing, copying,
   deleting, or presenting them as complete formal builds.
4. Read the approved ignored local execution aid read-only from
   `/Users/bytedance/Desktop/Zen/Mundus/docs/superpowers/plans/2026-08-01-mundus-v1.1-parchment-atlas-convergence.md`,
   then continue V1.1.0 Parchment Atlas convergence in Draft PR #5. Do not copy
   or add the local plan; tracked handoffs and the PR remain durable.
5. Keep GHSL Plans 2 through 7 frozen unless the project is separately reopened
   and approved.

If GHSL or post-GHSL product work is later proposed, first obtain the applicable
owner approval, then use the accepted design and a focused detailed plan.
High-level direction in this file is never sufficient permission to implement.
