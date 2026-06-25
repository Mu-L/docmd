---
title: "OKF type inference — no frontmatter needed"
description: "OKF classifies pages by URL path prefix even when frontmatter has no okf.type. /api/ → api, /guides/ → guide, etc. This page sits in /en/practical-tests/ which doesn't match any prefix, so it falls back to the default type 'concept'."
---

# OKF type inference — no frontmatter needed

This page exercises the **OKF type inference** feature: when a
page has no explicit `okf.type` in frontmatter, OKF infers a
type from the URL path prefix.

## The inference map

| URL prefix | Inferred type |
|---|---|
| `/api/` | `api` |
| `/guides/` | `guide` |
| `/reference/` | `reference` |
| `/concepts/` | `concept` |
| `/runbooks/` | `runbook` |
| `/datasets/` | `dataset` |
| `/metrics/` | `metric` |
| `/tables/` | `table` |
| (anything else) | `concept` (the defaultType) |

The map is implemented in `packages/plugins/okf/src/index.ts`
`PATH_TYPE_MAP`.

## This page's inferred type

This page is at `/en/practical-tests/phase-3/okf-type-inference/`.
That path doesn't match any of the inference prefixes. The
page has no `okf.type` in frontmatter, so OKF falls back to the
default type: **`concept`**. Look at `site/okf/okf.yaml` after
the build to see this page classified under the `concept`
type.

## What happens with explicit frontmatter

If this page had:

```yaml
---
okf:
  type: api
---
```

…then OKF would classify it as `api` (explicit overrides
inferred). The precedence in `resolveType()` is:

1. `frontmatter.okf.type` (nested) — explicit
2. `frontmatter.<typeField>` (top-level) — usually `type:` in
   modern docmd pages
3. `frontmatter.okfType` (legacy) — old alias
4. Path-prefix inference (this section)
5. `defaultType` from config (default: `concept`)

## How to verify

After `pnpm docmd build` from `packages/_playground/`:

```bash
grep -A 2 "okf-type-inference" site/okf/okf.yaml
# Should list this page with type: concept
```

To see explicit-vs-inferred, edit the frontmatter of this page
to add `okf.type: guide` and rebuild. The YAML will show
`type: guide` instead of `type: concept`.
