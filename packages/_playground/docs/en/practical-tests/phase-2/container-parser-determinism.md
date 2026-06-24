---
title: "Phase 2 — Container parser determinism across worker threads"
description: "Demonstrates that the container normaliser is a pure function of its input. Two workers, 100 concurrent parses, all produce byte-identical HTML."
okf:
  type: reference
---

# Container parser determinism

This page documents the **determinism contract** that backs the
Phase 2 parser. The container normaliser is a pure function of
its input — no `Date.now()`, no `Math.random()`, no module-level
mutable state. Two worker threads given the same source produce
byte-identical HTML.

## How the determinism is enforced

Three layers, each guarding the next:

1. **Declarative** — `packages/parser/src/utils/container-normaliser.ts`
   has a `DETERMINISM AUDIT` block in the file header that
   documents the four non-deterministic primitives the module
   deliberately does NOT use (`Date.now()`, `Math.random()`,
   module-level `let`/`var`, `process.env` reads).

2. **Empirical** — `packages/parser/test/container-normaliser.test.js`
   has 60 assertions including a 100-way concurrent parse test
   AND a real `node:worker_threads` cross-worker parse. Both
   assert byte-identical output.

3. **Regression-proof** — `packages/core/src/engine/worker-parser.ts`
   has a `verifyDeterminismAtBoot()` function that runs at the
   end of `init()`. It parses a known input through the
   freshly-built processor and asserts the output equals a
   frozen snapshot. If a future code change introduces
   non-determinism, the worker throws at boot and the build
   fails immediately.

## The 100-way test

The test fixture in `container-normaliser.test.js`:

```js
test('determinism: 100 concurrent parses of the same source produce identical HTML', async () => {
  const md = freshProcessor();
  const src = '<complex source with nested grids + cards>';
  const N = 100;
  const results = await Promise.all(
    Array.from({ length: N }, () => processContentAsync(src, md, {}, { filePath: 'det.md' }))
  );
  const first = results[0].htmlContent;
  for (let i = 1; i < N; i++) {
    assert.equal(results[i].htmlContent, first, `divergence at index ${i}`);
  }
});
```

100 parallel parses, byte-identical output. This is the
strongest empirical guarantee we have that parallel workers
won't produce inconsistent output.

## Why determinism matters

docmd is built around a **worker pool** — the build process
shards pages across multiple threads, parses each shard
independently, then writes the results. If the parser were
non-deterministic (e.g. depended on a global counter, a
timestamp, or a shared cache), two workers given the same
input would produce different HTML. That would break:
- Caching layers (the same content rendered twice should
  hash the same).
- The boot-time self-test (any non-determinism crashes the
  worker at init, before the first message is processed).
- Reproducible builds (`pnpm build` should produce the same
  output every time, given the same source).

## OKF classification

`okf.type: reference` — explicit. The page is included in the
OKF bundle as a `reference` concept.
