---
title: "LLMS and OKF: default-locale-only by default"
description: "Both the @docmd/plugin-llms and @docmd/plugin-okf plugins write the default locale's files at the bundle root by default. Non-default locales are only written when the user explicitly opts in via plugins.llms.i18n: true or plugins.okf.localeStrategy: 'folders'."
---

# LLMS and OKF — default-locale-only by default

This page documents the **i18n contract** for the two AI-agent
plugins shipped with docmd 0.8.8:

- `@docmd/plugin-llms` — generates `llms.txt` / `llms-full.txt` / `llms.json`
- `@docmd/plugin-okf` — generates the OKF bundle (`site/okf/`)

Both plugins used to write **per-locale** output by default. That
default was wrong for two reasons:

1. The `llms.txt` filename is the standard single-file name that
   downstream consumers (Cursor, Claude, GPT, etc.) look for.
   Splitting it into `llms.en.txt` + `llms.hi.txt` + `llms.fr.txt`
   broke every existing integration.

2. The OKF bundle is meant to be a "knowledge base" — the user
   doesn't want to push 6 locale variants of every concept to a
   vector store. They want the primary-language version, with
   non-default locales as opt-in extras.

## The new default

| Plugin | Default behaviour | File name |
|---|---|---|
| `llms` | Default locale only | `llms.txt`, `llms-full.txt`, `llms.json` |
| `okf`  | Default locale only | `site/okf/okf.yaml`, `site/okf/concepts/*.md`, etc. |

The default locale is whatever `config.i18n.default` resolves to.
Single-locale sites (no `config.i18n` block) are unaffected — they
get the same single set of files as before.

## Opting into multi-locale

Set the corresponding option in `docmd.config.json`:

```json
{
  "plugins": {
    "llms": { "i18n": true },
    "okf":  { "localeStrategy": "folders" }
  }
}
```

With both options set, the plugins write per-locale output:

```
site/llms.txt          ← default locale (en) — UNSUFFIXED
site/llms-full.txt     ← default locale (en) — UNSUFFIXED
site/llms.json         ← default locale (en) — UNSUFFIXED
site/llms.hi.txt       ← hi — suffixed
site/llms-full.hi.txt  ← hi — suffixed
site/llms.hi.json      ← hi — suffixed
site/llms.fr.txt       ← fr — suffixed
site/llms-full.fr.txt  ← fr — suffixed
site/llms.fr.json      ← fr — suffixed

site/okf/                              ← default locale
├── okf.yaml
├── index.md
├── concepts/
│   └── root.md
└── _meta/, graph.html, graph.json, ...

site/okf/hi/                           ← hi — suffixed directory
├── concepts/
│   └── hi.md

site/okf/fr/                           ← fr — suffixed directory
├── concepts/
│   └── fr.md
```

Notice the pattern: **the default locale never gets a suffix or a
subdirectory** — it sits at the bundle root where existing
consumers expect it. Only the non-default locales get the
`<locale>/` (OKF) or `.<locale>` (LLMS) suffix.

## How to verify

The current `_playground` is a single-locale project (en only),
so both plugins write a single set of files at the root — no
suffix, no subdirectory. To test multi-locale, set
`config.i18n.locales` to include more than one locale AND enable
the opt-in flags shown above.

## OKF classification

This page sits at `/en/practical-tests/phase-3/llms-and-okf-default-locale/`
which doesn't match any of the OKF type-inference prefixes
(`/api/`, `/guides/`, etc.). It falls back to the default type:
`concept`. In the OKF bundle, it lives at
`site/okf/concepts/llms-and-okf-default-locale.md`.
