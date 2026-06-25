---
title: "OKF default-enabled + type inference"
description: "This page is included in the OKF bundle by default (no plugins.okf config needed), demonstrates the path-prefix type inference map, and shows the noindex + okf: false opt-out paths in the body."
---

# OKF — default-enabled + type inference

This page exercises the **OKF plugin (0.8.8)**:

- **Default-enabled** — the `site/okf/` bundle is generated
  even when `docmd.config.json` has no `plugins.okf` entry.
  See [`README.md` of `@docmd/plugin-okf`][okf-readme] for the
  callout.
- **Type inference** — pages under `/api/` are auto-classified
  as `api`, pages under `/guides/` as `guide`, etc. The path
  prefix map is documented in the OKF README.
- **Per-page opt-out** — pages with `noindex: true` or
  `okf: false` in frontmatter are excluded from the bundle.

[okf-readme]: ../../../../plugins/okf/README.md

## How OKF classifies this page

This page is at `/en/practical-tests/phase-3/okf-bundle-default/`
which doesn't match any of the type-inference prefixes
(`guides/`, `api/`, `reference/`, `concepts/`, `runbooks/`,
`datasets/`, `metrics/`, `tables/`). So OKF falls back to the
default type: `concept`. Look at `site/okf/okf.yaml` after
the build to see this page listed under the `concept` type.

## OKF: false opt-out

A page with this frontmatter would be excluded from the bundle:

```markdown
---
okf: false
---
```

We don't actually use that here (because we want to verify the
page IS in the bundle), but the OKF plugin's `onPostBuild`
filters pages where `p.frontmatter.okf === false`.

## `noindex: true` opt-out

A page with `noindex: true` is excluded from the OKF bundle
AND from the sitemap, search index, and llms.txt. This is the
standard docmd opt-out — applies to multiple plugins uniformly.

## What to inspect after the build

After running `pnpm docmd build` from `packages/_playground/`:

```bash
ls site/okf/concepts/ | head        # one .md per page
cat site/okf/okf.yaml | head -30   # typed manifest
open site/okf/graph.html            # interactive graph viewer
```

The `okf.yaml` file lists every concept in the bundle with its
type, path, locale, and version. The graph viewer renders a
force-directed graph of the concept relationships inferred from
internal markdown links.
