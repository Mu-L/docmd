---
title: "एफ1: नेस्टेड ग्रिड्स (Hindi locale test)"
description: "Hindi locale page testing F1 nested-grids fix + OKF locale strategy 'folders'. The page is at /hi/practical-tests/phase-2-f1-hindi/ so OKF nests it under hi/concepts/ in the bundle."
---

# एफ1 — नेस्टेड ग्रिड्स (Hindi locale test)

This page exercises the **F1 nested-grids fix** in the **Hindi
locale** (`hi`) to confirm the parser fix and the OKF locale
strategy both work for non-English content.

::: grids
    ::: grid
        ::: card "तेज़"
        बिजली की तेज़ी।
        :::
    ::: grid
        ::: card "सरल"
        ज़ीरो कॉन्फ़िग।
        :::
:::

## OKF locale strategy

When `localeStrategy: 'folders'` is set (the default), the OKF
plugin nests concepts under their locale in the bundle:

```
site/okf/
├── en/
│   └── concepts/
│       └── ...
├── hi/
│   └── concepts/
│       └── practical-tests-phase-2-f1-hindi.md
```

This page's slug is `practical-tests-phase-2-f1-hindi` and it
lives at `site/okf/hi/concepts/practical-tests-phase-2-f1-hindi.md`
after the build.
