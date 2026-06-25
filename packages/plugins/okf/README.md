# @docmd/plugin-okf

Generates an [Open Knowledge Format](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing) (OKF) bundle at build time so your documentation is consumable by AI agents — Gemini, Claude, GPT, Cursor, and any tool that speaks the vendor-neutral OKF spec.

OKF represents organisational knowledge as a directory of markdown files with YAML frontmatter, plus a typed manifest (`okf.yaml`), an interactive graph viewer, and a machine-readable bundle summary. The bundle sits next to your site (e.g. `site/okf/`) so agents can be pointed at it directly.

```js
// docmd.config.json

{
  "plugins": {
    "okf": {
      // config options, okf is enabled by default
    }
  }
}
```

Part of the **[docmd](https://github.com/docmd-io/docmd)** documentation engine.

## Output structure

```
site/okf/                          # Always emitted
├── okf.yaml                       # Typed manifest (bundle summary)
├── index.md                       # Karpathy-style catalog grouped by type
├── concepts/
│   └── <slug>.md                 # One markdown file per page
└── _meta/
    ├── bundle.json                # JSON mirror of okf.yaml
    └── lint-report.txt            # Warnings produced during generation

# Emitted only when `plugins.okf.graph: true`
├── graph/                         # Interactive viewer (open /okf/graph/)
│   ├── index.html                 # Force-directed graph viewer
│   ├── graph.json                 # Graph data (nodes + edges)
│   ├── graph.js                   # Viewer runtime (vanilla, no CDN deps)
│   └── graph.css                  # Viewer styles (theme-aware)
```

Each concept file carries the OKF-required `type` field in frontmatter plus the original markdown body verbatim, so an agent can both navigate the manifest and read full pages.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `outputDir` | `string` | `'okf'` | Bundle directory, relative to the site output. |
| `bundleName` | `string` | slugified `config.title` | Name used inside `okf.yaml` and the graph viewer title. |
| `defaultType` | `string` | `'concept'` | Type assigned to pages with no explicit type. |
| `typeField` | `string` | `'type'` | Frontmatter field name for OKF type. |
| `warnOnMissingType` | `boolean` | `true` | Emit a TUI warning for pages that fell back to `defaultType`. |
| `includeFullMarkdown` | `boolean` | `true` | Copy raw `.md` body into each concept file. |
| `graph` | `boolean` | `false` | Emit a `graph/` subdirectory containing `index.html` + `graph.js` + `graph.css` + `graph.json`. Opt-in since 0.8.8 — the OKF spec does not require a viewer, and shipping extra files by default adds noise to a clean bundle. The viewer is reachable at `/okf/graph/` without a custom filename, and fetches `graph.json` from the same directory at runtime, so `file://` also works. |
| `localeStrategy` | `'default-only' \| 'folders' \| 'mixed' \| 'latest-only'` | `'default-only'` | Single-locale by default (the bundle contains only pages in the default locale). Set to `'folders'` to nest concepts by locale id when i18n is enabled, or `'mixed'` / `'latest-only'` for the other strategies. |
| `versionStrategy` | `'folders' \| 'mixed' \| 'latest-only'` | `'latest-only'` | Nest concepts by version id when versioning is enabled. |
| `excludePatterns` | `string[]` | `[]` | Additional glob patterns to skip on top of `frontmatter.noindex` / `frontmatter.okf === false`. |

### Per-page opt-out

Pages can opt out of the OKF bundle in two ways:

```markdown
---
noindex: true   # also excludes from sitemap, llms.txt, etc.
---

---
okf: false       # only excludes from the OKF bundle
---
```

### Type resolution precedence

For every page the plugin picks a type with this precedence:

1. `frontmatter.okf.type` (nested)
2. `frontmatter.type` (top-level)
3. `frontmatter.okfType` (legacy)
4. Path-prefix inference (e.g. `/guides/foo` → `guide`)
5. `defaultType` (with a warning if `warnOnMissingType`)

The path-prefix map covers `guides/`, `api/`, `reference/`, `concepts/`, `runbooks/`, `datasets/`, `metrics/`, and `tables/`.

## Documentation

See **[docs.docmd.io](https://docs.docmd.io)** for full usage and API reference.

## License

MIT