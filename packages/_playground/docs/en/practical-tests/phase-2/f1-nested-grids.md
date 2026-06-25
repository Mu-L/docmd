---
title: "F1: nested grids with one close per card"
description: "The pre-Phase 2 parser dumped the whole grids block as raw <p>::: grids<br>::: grid<br>...<br>:::</p> text. Post-fix it renders four grid-items, each containing one card."
okf:
  type: guide
---

# F1 — nested grids with one close per card

This page exercises the **F1 container parser fix** from
`battle-test-reports/test-report.md §F1`. The pattern below used
to be the user-reported "grids don't work" bug.

## The pattern

```markdown
::: grids
    ::: grid
        ::: card "Fast"
        Lightning fast.
        :::
    ::: grid
        ::: card "Simple"
        Zero config.
        :::
    ::: grid
        ::: card "Open"
        Fully open source.
        :::
    ::: grid
        ::: card "Live"
        Edit in browser.
        :::
:::
```

## The rendered result (post-fix)

::: grids
    ::: grid
        ::: card "Fast"
        Lightning fast.
        :::
    ::: grid
        ::: card "Simple"
        Zero config.
        :::
    ::: grid
        ::: card "Open"
        Fully open source.
        :::
    ::: grid
        ::: card "Live"
        Edit in browser.
        :::
:::

The normaliser balances the missing closes so the `grids` rule
matches and the inner `grid` and `card` rules can do their work.

## What the pre-fix output looked like

A single `<p>::: grids<br>::: grid<br>::: card "Fast"<br>...<br>:::</p>`
text block. The whole nested structure was dumped as a
paragraph of source code.

## OKF classification

This page declares `okf.type: guide` explicitly. In the OKF
bundle, it lives in `concepts/practical-tests-phase-2-f1-nested-grids.md`
with the `type: guide` field set.
