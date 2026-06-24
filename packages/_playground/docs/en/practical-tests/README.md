---
title: "Practical test index"
description: "Test pages that exercise every Phase 1–3 fix and the OKF plugin in the actual _playground build."
noindex: false
---

# Practical test index

These pages are **deliberately constructed test fixtures** that
exercise every fix shipped in 0.8.8. They live inside the
`_playground` site (alongside the real docs) and are included in
every build. Each page is annotated with a header block that
names the test and the report section it covers.

The intent is that running `pnpm docmd build` from
`packages/_playground/` produces an output where every Phase
1–3 + OKF fix is observable in a real build, not just in unit
tests.

## What each page tests

| Page | Phase | Fix |
|---|---|---|
| [`phase-2/f1-nested-grids`](./phase-2/f1-nested-grids) | 2 | F1 — `::: grids` + N× `::: grid` + 1 close per card |
| [`phase-2/f2-self-closing-button`](./phase-2/f2-self-closing-button) | 2 | F2 — self-closing `::: button` + orphan `:::` |
| [`phase-2/f3-mismatched-close`](./phase-2/f3-mismatched-close) | 2 | F3 — `::: callout` closed by `::: card` |
| [`phase-2/f4-triple-close`](./phase-2/f4-triple-close) | 2 | F4 — triple `:::` after balanced callout |
| [`phase-2/f5-five-level-nesting`](./phase-2/f5-five-level-nesting) | 2 | F5 — 5-level nested callouts render all 5 levels |
| [`phase-3/okf-bundle-default`](./phase-3/okf-bundle-default) | 3 + OKF | OKF default-enabled, type inference, noindex opt-out |
| [`phase-3/internal-link-with-trailing-slash`](./phase-3/internal-link-with-trailing-slash) | 3 | M-1 — `validate` accepts trailing-slash links |
| [`phase-3/xss-in-frontmatter`](./phase-3/xss-in-frontmatter) | 1 | T-S3 / S-4 / S-5 — frontmatter XSS payloads escaped |

> Each page documents, in its own body, what it would render as
> *before* the fix and what it renders as *after* the fix.

## How to verify

```bash
cd packages/_playground
node ../../packages/core/dist/bin/docmd.js build
# OKF bundle at site/okf/ (default-enabled — no config needed)
# Generated output in site/
node ../../packages/core/dist/bin/docmd.js validate
# exit 0 — internal-link-with-trailing-slash.md links to a real page
node ../../packages/core/dist/bin/docmd.js validate --json
# exit 0 (no errors) — JSON output unchanged
```

After the build, the OKF bundle at `site/okf/` includes a
`concepts/` directory containing one entry per page. Inspect
`site/okf/okf.yaml` to see the typed manifest.