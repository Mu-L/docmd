---
title: "Phase 3 — CLI exit codes (F6, M-12)"
description: "The pre-Phase 3 docmd CLI exited 0 on many documented failure paths. Post-fix every documented error path exits 1. This page documents the contract."
---

# Phase 3 — CLI exit codes (F6, M-12)

This page documents the **Phase 3 PR 3.A exit-code contract fix**
from `battle-test-reports/test-report.md §F6` and
`battle-test-reports/more-report.md §M-12`.

## The contract

Every documented `docmd <command>` failure path MUST exit with
a non-zero code so CI pipelines can gate on it. Before this fix,
several paths printed a clear error message but exited 0,
silently passing broken builds.

## The 5 paths that were fixed

| Command | Failure case | Pre-fix exit | Post-fix exit |
|---|---|---|---|
| `docmd build` | Unknown plugin in config | 0 | 1 |
| `docmd migrate` | No `--docusaurus`/`--mkdocs`/etc. flag | 0 | 1 |
| `docmd migrate --help` | (it's a help print) | 0 | 0 (unchanged) |
| `docmd remove <nonexistent>` | Plugin not in registry | 0 | 1 |
| `docmd validate --json` | Broken links in any page | 0 | 1 |

## The mechanism

A new helper module `packages/core/src/utils/exit.ts` exports
three functions:

- `exitCodeFor(err)` — returns the numeric exit code. Today
  always 1 (operational error); the indirection lets us
  introduce code-2/3/4 later without rewriting every call site.
- `exitWithError(err, opts?)` — calls `TUI.error` (or prints
  JSON when `opts.json === true`) and `process.exit(code)`.
- `failWith(message, opts?)` — convenience wrapper for the
  "plain message, no Error object" case.

For `migrate` and `remove`, the `TUI.error(...); return;` pattern
was replaced with `process.exit(1)` (or, in `migrate.ts`, a
`exitWithError` call). For `build`, the new `getPluginLoadErrors()`
in `@docmd/api` returns a list of plugins that failed to load,
and `build.ts` throws if the list is non-empty — the existing
catch block turns the throw into `process.exit(1)`.

## How to verify

```bash
cd packages/_playground

# F6: unknown plugin → exit 1
mkdir -p /tmp/f6 && cd /tmp/f6
echo '{"title":"F6","plugins":{"nope":{}}}' > docmd.config.json
node ../../packages/core/dist/bin/docmd.js build
echo $?  # 1

# M-12: validate --json with broken links → exit 1
cd /tmp/m12 && echo '[bad](/nope)' > docs/index.md
node ../../packages/core/dist/bin/docmd.js validate --json
echo $?  # 1

# Sanity: --help still exits 0
node ../../packages/core/dist/bin/docmd.js migrate --help
echo $?  # 0
```

The test matrix is `scripts/brute-test.js` test 26 (7 assertions,
regression-tested in the categorised test suite under
`tests/cli-contracts/exit-codes.test.js`).
