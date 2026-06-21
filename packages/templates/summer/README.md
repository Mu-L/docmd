# @docmd/template-summer

> A bright, hopeful, summer-feel layout for [docmd](https://docmd.io) **0.8.7+**.

Summer is the first in the [docmd template seasons](../) series. It is built on the new **template plugin system** introduced in 0.8.7, which means it is a regular `@docmd/*` package with the `template` capability.

## Highlights

- **Centred search bar** in the top header — the focal point of the layout
- **Menubar relocated** to the bottom of the logo bar (default docmd has it above)
- **Airier content** with right-rail TOC, more vertical rhythm
- **Centred footer** with `last updated` + edit-this-page
- **Built on `@docmd/ui` defaults** — only 3 partials overridden; the rest fall back automatically

## Install

```bash
npm install @docmd/template-summer
```

## Enable

```json
{
  "theme": {
    "template": "summer"
  }
}
```

Or pass the full package name (also accepted):

```json
{
  "theme": {
    "template": "@docmd/template-summer"
  }
}
```

## Per-page override

```markdown
---
title: "Changelog"
template: "template-changelog"
---
```

## Customise

Drop your own CSS into `theme.customCss` — it always wins at priority 15. Do not use `!important` so the user can always override your template.

```json
{
  "theme": {
    "template": "summer",
    "customCss": ["/assets/css/my-summer-tweaks.css"]
  }
}
```

## Slots this template overrides

| Slot | Source |
|---|---|
| `layout` | [`templates/layout.ejs`](templates/layout.ejs) |
| `menubar` | [`templates/partials/menubar.ejs`](templates/partials/menubar.ejs) |
| `footer` | [`templates/partials/footer.ejs`](templates/partials/footer.ejs) |

All other slots (sidebar, TOC, options menu, header, etc.) inherit from `@docmd/ui`.

## Asset priority

This template ships one CSS file and one JS file, both at **priority 10** (the new default for templates). The load order is:

1. `docmd-main.css` (0) — base
2. `docmd-theme-sky.css` etc. (5) — your theme
3. `summer.css` (10) — this template
4. Your `customCss` (15) — wins
5. Plugin CSS (20) — last

## Requirements

- `docmd >= 0.8.7`
- Node.js >= 18

## License

MIT