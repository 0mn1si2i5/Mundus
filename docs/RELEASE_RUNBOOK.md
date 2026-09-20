# V1 release runbook

Status: V1.0.0 historical runbook. The procedure remains a rollback/reference
baseline, but current release identity and authorization gates are recorded in
`ROADMAP_HANDOFF.md`.

This runbook covers the reproducible GitHub Pages path for the V1 static site.
It does not authorize changing repository visibility; that remains a separate
product-owner gate in `MVP_RELEASE_PLAN.md`.

## Build and deploy

- Pull requests run the required CI source and full-vector checks in parallel.
  The Pages `pages-artifact` job independently runs `pnpm check` so the exact
  `dist/` it uploads has passed source, data, build, and artifact gates in the
  same job. It then runs the complete desktop/mobile Playwright suite against
  that `dist` and uploads it; pull requests cannot deploy. The source and
  vector checks therefore run in both workflows by design: GitHub required
  checks remain independent, while the Pages artifact remains self-verified.
- The separate CI `browser-smoke` job runs three `@smoke` Chromium cases for a
  fast signal. It does not replace the complete desktop/mobile suite in the
  Pages artifact job.
- A push to protected `main` must pass all required checks, then uploads the
  exact Pages artifact and deploys it through the `github-pages` environment.
- The deployment job alone receives `pages: write` and `id-token: write`.
- The live-smoke job uses the URL returned by `actions/deploy-pages` and checks
  HTTP success, the expected title, loaded resources, and a completed frame
  sample from the initial Other Side canvas on desktop and mobile viewports.

The workflow pins Node.js 22.23.1, pnpm 11.7.0, and immutable commits for the
official GitHub and pnpm actions. Production source maps are prohibited. The
artifact must include the code license, conservative production dependency
inventory, and exact bundled dependency notices.

## Private rehearsal

Before public visibility, a successful pull-request `pages-artifact` job is the
accepted rehearsal when private Pages is unavailable. Download and unzip that
workflow artifact, extract the enclosed `artifact.tar`, and run the verifier on
the directory containing the extracted `index.html`:

```bash
pnpm release:verify /path/to/unpacked-artifact
```

Do not describe the site as live until the deployment and live-smoke jobs both
pass on public `main`.

## Rollback

Never edit hosted files manually. Identify the last successful Pages workflow
whose commit and artifact passed live smoke, then redeploy that exact run with
`gh run rerun <run-id>`. Immediately open a reviewed revert or corrective PR so
protected `main` again represents the intended production state. Record the
redeployed run URL and commit SHA in the release incident or follow-up PR.
