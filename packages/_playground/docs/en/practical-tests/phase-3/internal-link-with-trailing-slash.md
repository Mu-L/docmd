---
title: "M-1: internal link with trailing slash"
description: "The pre-Phase 3 docmd validate command false-positived every internal link with a trailing slash. Post-fix the trailing slash is stripped before the .md existence check."
---

# M-1 — internal link with trailing slash

This page exercises the **M-1 trailing-slash false-positive fix**
from `battle-test-reports/more-report.md §M-1`. The link below
used to be reported as a broken link by `docmd validate` even
though the target file existed.

## The pattern

A markdown link with a trailing slash to a sibling page (one
directory up, then down into `phase-2`):

```markdown
Links to [F1 grids test](../phase-2/f1-nested-grids/).
```

## The rendered result (post-fix)

Links to [F1 grids test](../phase-2/f1-nested-grids/).

The link's `href` is `../../phase-2/f1-nested-grids/`. The build
treats this as equivalent to `../../phase-2/f1-nested-grids`
(without slash) — both resolve to the same generated HTML page.
`docmd validate` now agrees.

## What the pre-fix output looked like

`docmd validate` reported:

```
[docs/en/practical-tests/phase-3/internal-link-with-trailing-slash.md:N]
  ../../phase-2/f1-nested-grids/ -> Broken link: target resolved to
  docs/en/practical-tests/phase-2/f1-nested-grids does not exist
```

The validator did `fs.existsSync('docs/en/practical-tests/phase-2/f1-nested-grids/.md')`
which is always false. CI pipelines that gated on
`docmd validate` exited 0 (because exit 0 is the default for
no-broken-links), so broken-link regressions slipped through.

## How to verify

```bash
cd packages/_playground
node ../../packages/core/dist/bin/docmd.js validate
# exit 0 — no broken links
node ../../packages/core/dist/bin/docmd.js validate --json | jq '.errors | length'
# 0
```

The fix lives in `packages/core/src/commands/mcp.ts`
`validateLinks()` — a single `stripped` variable drops the
trailing `/` before the four `fs.existsSync` checks.
