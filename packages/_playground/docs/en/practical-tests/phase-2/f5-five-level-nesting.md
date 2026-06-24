---
title: "F5: 5-level nested callouts render all 5 levels"
description: "The pre-Phase 2 parser collapsed 5-level nested callouts into the outer level. Post-fix all 5 levels render in the output HTML."
okf:
  type: guide
---

# F5 — 5-level nested callouts

This page exercises the **F5 5-level nested callout fix** from
`battle-test-reports/test-report.md §F5`. The pattern below used
to collapse the inner levels — the user saw `<div class="callout
callout-info">l1</div>` with only the "deep" body and no
intermediate levels.

## The pattern

```markdown
::: callout info "l1"
::: callout tip "l2"
::: callout warning "l3"
::: callout danger "l4"
::: callout success "l5"
deep
:::
:::
:::
:::
:::
```

## The rendered result (post-fix)

::: callout info "l1"
::: callout tip "l2"
::: callout warning "l3"
::: callout danger "l4"
::: callout success "l5"
deep
:::
:::
:::
:::
:::

The container normaliser adds four implicit closes when the
user's single `:::` close closes the outer callout. Each inner
`callout` rule then matches its own body recursively.

## What the pre-fix output looked like

A single `<div class="callout callout-info">` containing only
the text "deep" — the inner callouts were dropped silently
because the depth counter never reached 0 at the expected
position.

## OKF classification

`okf.type: guide` — explicit. The page is treated as a single
`guide` concept in the OKF bundle. The nested callouts are
preserved in the page body verbatim (OKF copies `rawMarkdown`).
