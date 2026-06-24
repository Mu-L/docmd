---
title: "T-S3: XSS payloads in frontmatter are HTML-escaped"
description: "The pre-Phase 1 build rendered XSS payloads in frontmatter title and description fields as live HTML in og:/twitter: meta tags and the page <title>. Post-fix every interpolation goes through attrEsc() or escHtml()."
---

# T-S3 — XSS payloads in frontmatter are HTML-escaped

This page exercises the **T-S3 XSS via og:/twitter: meta tags
fix** from `battle-test-reports/test-report.md §S3` and
`§T-S3`. The frontmatter below contains classic XSS payloads.
Pre-Phase 1 they were rendered as live HTML in the generated
page. Post-fix they are HTML-escaped everywhere they appear.

## The pattern

The frontmatter of this page contains:

```yaml
---
title: '"><img src=x onerror=alert(1)> - Site'
description: '<script>alert("fm-xss")</script> Page description'
---
```

## The rendered result (post-fix)

The `<title>` of the generated page contains the escaped version:

```html
<title>&quot;&gt;&lt;img src=x onerror=alert(1)&gt; - Site</title>
```

The og:title / twitter:title meta tags:

```html
<meta property="og:title" content="&quot;&gt;&lt;img src=x onerror=alert(1)&gt; - Site">
<meta name="twitter:title" content="&quot;&gt;&lt;img src=x onerror=alert(1)&gt; - Site">
```

No live `<script>alert(1)</script>` in the page. No `onerror`
handler. The payloads are visible in the browser as literal
text — exactly what the user typed.

## What the pre-fix output looked like

```html
<title>"><img src=x onerror=alert(1)> - Site</title>
<meta property="og:title" content=""><img src=x onerror=alert(1)> - Site">
```

The XSS payload fired as soon as the page loaded. CI pipelines
that scanned for `<script>alert(` would have flagged it, but
the escaped version is what users see in their browser now.

## How to verify

```bash
cd packages/_playground
node ../../packages/core/dist/bin/docmd.js build
grep -c "onerror" site/en/practical-tests/phase-3/xss-in-frontmatter/index.html
# 0
grep -c "&lt;img src=x" site/en/practical-tests/phase-3/xss-in-frontmatter/index.html
# at least 1 (the escaped version)
```

The fix lives in:
- `packages/plugins/seo/src/index.ts` (og:title, twitter:title)
- `packages/plugins/pwa/src/index.ts` (themeColor — separate fix)
- `packages/plugins/analytics/src/index.ts` (measurementId)
- `packages/core/src/utils/exit.ts` (generalised esc helpers from
  Phase 0 + Phase 3 PR 3.A)
