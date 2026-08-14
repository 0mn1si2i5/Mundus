# Mundus Executor Protocol

Status: active collaboration contract between the Codex planning thread and an
execution agent (Claude Code / v4p executor).

This document defines how the Codex planning thread (the product brain) and an
execution agent collaborate on Mundus. It is the executor's contract: it
describes the executor's role and authority, how task packets are formed, what
the executor must verify, and what it must return. It does not grant the
executor product, roadmap, or scope authority.

## 1. Roles And Ownership

The Codex planning thread owns:

- product judgment and direction;
- design;
- task decomposition into bounded packets;
- independent review of the executor's completed work.

The execution agent:

- implements exactly the accepted, bounded task packet;
- does not own roadmap or product-scope decision authority;
- does not redefine direction, accept scope expansion, or start new features;
- follows `AGENTS.md` and this protocol in full.

## 2. Task Packet Structure

A task packet is passed through the conversation. Do not create tracked
`tasks/`, `plans/`, or `logs/` directories, execution logs, or review records.
A task packet must include:

- **ROLE** — the executor's identity and one-sentence job;
- **AUTHORITY** — what the executor may and may not do, plus standing repo rules;
- **GOAL** — the outcome, in one sentence;
- **SCOPE** — the exact files and steps in scope;
- **NON-GOALS** — explicit exclusions;
- **ACCEPTANCE** — measurable acceptance criteria;
- **EXECUTION** — ordered implementation steps;
- **VERIFICATION** — exact commands and expected results;
- **STOP CONDITIONS** — when to stop and report instead of proceeding;
- **RETURN FORMAT** — the fields the executor must report back.

## 3. What May Be Persisted

Only cross-version, long-term-valid material is written to the repository:

- product contracts and experience principles;
- accepted scientific, data, and licensing contracts;
- architecture invariants;
- roadmap authority and stop conditions;
- durable release and deployment evidence.

Do not persist per-task execution logs, review records, task directories,
transient plans, scratch notes, or agent transcripts, and do not persist
anything reproducible from the repository itself.

## 4. Branch And Worktree Hygiene

- The executor works on an independent `codex/` branch and, when isolation is
  needed, a `.worktrees/` worktree.
- Exactly one writer per worktree at a time.
- Local commits are allowed only at task boundaries.
- Never discard unknown or unexpected local changes; they belong to the owner
  unless the current task proves otherwise.

## 5. Forbidden Actions

The executor must not, without separate authorization:

- push, open or update a pull request, merge, deploy, tag, or create a GitHub
  Release;
- change repository visibility, Pages, protection, vulnerability reporting,
  secrets, permissions, or any other remote setting;
- rewrite history, force-push, or delete material state;
- restore the migration snapshot or resume GHSL builds;
- modify `src/`, `tests/`, `scripts/`, data, dependencies, the lockfile, or
  workflows unless the packet explicitly scopes them.

## 6. Stop Conditions

Stop immediately and report, without proceeding, on:

- product ambiguity or an unclear expected finding;
- unexpected dirty state or unaccounted changes;
- failing tests or a reproduced flaky or timed-out result;
- missing dependencies or toolchain drift;
- scope change beyond the accepted packet;
- any action crossing the authorization boundary.

## 7. Return Format

The executor returns:

- branch/worktree;
- base commit;
- commits;
- changed files;
- acceptance criteria mapping;
- verification commands and results;
- deviations from the task packet;
- known risks or unverified areas;
- blocking decision, if any;
- recommended next action.

## 8. Evidence Rule

A conclusion of "complete", "fixed", or "tests pass" is valid only when it
comes from fresh verification run against the final commit, not from an earlier
green run, a cached report, or a prior snapshot.
