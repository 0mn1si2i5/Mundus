# V1 release runbook

This runbook covers the reproducible GitHub Pages path for the V1 static site.
It does not authorize changing repository visibility; that remains a separate
product-owner gate in `MVP_RELEASE_PLAN.md`.

## Build and deploy

- Pull requests run the Pages `pages-artifact` job, including `pnpm check`, the
  complete desktop/mobile Playwright suite, artifact inspection, and upload of
  `dist/` only. Pull requests cannot deploy.
- A push to protected `main` repeats the same gate, uploads the exact artifact,
  and deploys it through the `github-pages` environment.
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
