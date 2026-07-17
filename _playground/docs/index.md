---
title: "docmd _playground"
description: "Manual integration playground for docmd."
---

# Welcome

This directory is the manual integration playground for [docmd](https://docmd.io). Edit any markdown file and reload the dev server to see the result.

## How this fits into the repo

- This directory is intentionally **outside** the pnpm workspace. Its `package.json` uses `file:local-tars/*.tgz` deps, so it installs the same way a real user would.
- Tarballs in `local-tars/` are produced by `pnpm prep`. Nothing else writes here.
- Automated tests do not touch this directory. Any test that needs the tarballs copies them to `/tmp/<run>/local-tars/` and runs there.

## Try it

```sh
pnpm prep    # regenerate tars (after any monorepo source change)
pnpm dev     # start the dev server
pnpm build   # produce site/ for static hosting
```