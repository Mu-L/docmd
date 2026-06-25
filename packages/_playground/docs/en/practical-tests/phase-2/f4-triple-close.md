---
title: "F4: triple close erases content"
description: "The pre-Phase 2 parser left bare ::: lines visible in the page as <p>:::</p> paragraphs. Post-fix the orphans are removed with [normaliser] WARNINGs."
okf:
  type: guide
---

# F4 — triple close erases content

This page exercises the **F4 triple-close / orphan `:::` fix**
from `battle-test-reports/test-report.md §F4`. The pattern below
used to leak `<p>:::</p>` paragraphs into the rendered page.

## The pattern

```markdown
::: callout info "x"
body
:::
:::
:::
```

## The rendered result (post-fix)

::: callout info "x"
body
:::
:::
:::

The first `:::` closes the callout (matching). The second and
third are stray — the normaliser removes them with two
`[normaliser] WARNING ... Stray \`:::\` removed` lines in the
build log. The rendered page contains the callout block and
NOTHING ELSE (no orphan `<p>:::</p>` leak).

## What the pre-fix output looked like

The callout rendered correctly (one close matched the opener).
But the next two `:::` lines were outside any container, so
markdown-it rendered them as a single paragraph:
`<p>:::<br>:::</p>`. Users saw two `:::` characters inline with
their content — a visible artefact of the parser's loose
matching.

## OKF classification

`okf.type: guide` — explicit. Despite the unclosed trailing
container, the page IS included in the OKF bundle (the orphan
removal happens in the page body, not in frontmatter; OKF
itself has no unclosed containers).
