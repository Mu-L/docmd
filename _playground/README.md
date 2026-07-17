# docmd _playground

Manual integration playground for docmd. Lives outside the monorepo workspace machinery on purpose — its `package.json` uses `file:local-tars/*.tgz` deps and is installed with `npm` (not `pnpm`), so it gets a clean install of the published-shape tarballs the same way a real user would.

## How it works

1. `pnpm prep` (release prep pipeline) builds every `@docmd/*` package, packs tarballs into `_playground/local-tars/`, and replaces the existing files. This is the **only** place tars are generated.
2. `pnpm dev` and `pnpm build` consume the existing tars. If tars are missing, both commands error and ask you to run `pnpm prep` first.
3. Automated tests (`pnpm prep`) do **not** install in this directory. Any test that needs the tars copies them into `/tmp/<run>/local-tars/` and runs there.

## Quick start

```sh
pnpm prep          # generates tars into _playground/local-tars/
pnpm dev           # installs in _playground/ and starts the dev server
pnpm build         # installs in _playground/ and runs a one-shot build
```

After the first `pnpm dev` or `pnpm build`, `_playground/node_modules/` is populated. Subsequent runs reuse the install and skip npm.

## Layout

- `docmd.config.json` — committed test fixture config.
- `docs/` — committed sample markdown.
- `package.json` — `file:local-tars/*.tgz` deps, versioned to match the tars that `pnpm prep` produces. `tools/sim.mjs --regen-tars` rewrites the version segments on every prep.
- `local-tars/` — gitignored; populated by `pnpm prep`.
- `node_modules/` / `site/` / `.docmd-search/` — gitignored; populated by `pnpm dev` / `pnpm build`.