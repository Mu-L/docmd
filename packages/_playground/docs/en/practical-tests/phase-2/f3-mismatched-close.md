---
title: "F3: mismatched close types"
description: "The pre-Phase 2 parser dumped the ::: callout opener as raw text when the page contained a ::: card opener in the middle. Post-fix the callout is auto-closed at EOF with a [normaliser] ERROR."
okf:
  type: guide
---

# F3 — mismatched close types

This page exercises the **F3 mismatched close types fix** from
`battle-test-reports/test-report.md §F3`. The pattern below used
to silently re-root the parser — the `::: callout` opener was
dumped as text, the `::: card` rendered standalone, and the
`:::` close was miscounted.

## The pattern

```markdown
::: callout info "x"
body
::: card "wrong close"
oops
:::
```

## The rendered result (post-fix)

::: callout info "x"
body
::: card "wrong close"
oops
:::

The `callout` rule matches its own body; the inner `card` rule
matches its own body; the trailing `:::` closes the card. The
outer callout is auto-closed at EOF with a `[normaliser] ERROR
... Unclosed <callout> from line 1 — auto-closed at EOF` line in
the build log.

## What the pre-fix output looked like

A `<p>::: callout info "x"<br>body</p>` paragraph (the callout
opener was dumped as text), followed by the card rendered
standalone — the callout's open/close count was off by 1 because
the inner `::: card` was miscounted as a depth-incrementing
container, so the `:::` close dropped the count to 1 instead of
0, and the callout rule never matched.

## OKF classification

`okf.type: guide` — explicit. This page deliberately has an
unclosed container; the OKF bundle still includes it (it
generates a per-page warning, but does not exclude the page).
