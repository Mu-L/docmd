---
title: "F2: self-closing button + orphan :::"
description: "The pre-Phase 2 parser treated self-closing ::: button as a non-self-closing container, corrupting the depth counter for everything that followed. Post-fix the orphan ::: is removed with a [normaliser] WARNING."
okf:
  type: guide
---

# F2 — self-closing button + orphan `:::`

This page exercises the **F2 self-closing tag fix** from
`battle-test-reports/test-report.md §F2`. The pattern below used
to leave an orphan `:::` visible in the page AND corrupt the
depth counter for any container that followed.

## The pattern

```markdown
::: card "Cards with self-closing buttons"
Some text.
::: button "Get Started" /getting-started
:::
```

## The rendered result (post-fix)

::: card "Cards with self-closing buttons"
Some text.
::: button "Get Started" /getting-started
:::

The `::: button` is a self-closing tag (per the parser's
`SELF_CLOSING_CONTAINER_NAMES` set). The orphan `:::` is
removed by the container normaliser with a `[normaliser] WARNING
...` line in the build log. The card is closed correctly.

## What the pre-fix output looked like

The `::: button` was pushed to the depth stack as a normal
container. The orphan `:::` decremented depth of the wrong
container (not the button, not the card — an arbitrary parent
in the parser's state). Any container after this point on the
page would have its open/close count misaligned.

## OKF classification

`okf.type: guide` — explicit. In the OKF bundle, this page is
classified as a `guide` and the frontmatter's `okf` block is
preserved.
