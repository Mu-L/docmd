/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * Phase 3 PR 3.A — Exit-code contract
 *
 * Tests F6 (CLI exit codes are inconsistent) and M-12
 * (`docmd validate --json` returns exit 0 with errors).
 *
 * Every documented failure path must exit 1. CI pipelines that gate
 * on `docmd <cmd>` exit codes were silently passing broken builds
 * before this fix.
 *
 * Run: `node tests/runner.js`
 * --------------------------------------------------------------------
 */

import {
  DOCMD,
  TEST_ROOT,
  setup,
  writeFile,
  build,
  exitCodeOf,
  runTestFile
} from '../shared.js';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    failed++;
    failures.push(message);
    console.log(`    ❌ ${message}`);
  } else {
    passed++;
    console.log(`    ✅ ${message}`);
  }
}

export const test = runTestFile({
  name: 'Exit-code contract (Phase 3 PR 3.A — F6, M-12)',
  emoji: '🚦',
  run: () => {

    // F6 — build with an unknown plugin must exit 1 (was 0).
    {
      const dir = setup('exit-codes-26-build-unknown-plugin');
      writeFile(dir, 'docs/index.md', '# Hi\n');
      writeFile(dir, 'docmd.config.json', JSON.stringify({
        title: 'F6', src: './docs', out: './site',
        plugins: { 'nonexistent-plugin-xyz-f6': {} }
      }));
      const code = exitCodeOf(`node ${DOCMD} build`, dir);
      assert(code === 1, 'build with unknown plugin exits 1');
    }

    // F6 — migrate with no source must exit 1 (was 0).
    {
      const dir = setup('exit-codes-26-migrate-no-source');
      const code = exitCodeOf(`node ${DOCMD} migrate`, dir);
      assert(code === 1, 'migrate with no source exits 1');
    }

    // F6 — migrate --help must exit 0 (it's a successful no-op help print).
    {
      const dir = setup('exit-codes-26-migrate-help');
      const code = exitCodeOf(`node ${DOCMD} migrate --help`, dir);
      assert(code === 0, 'migrate --help exits 0');
    }

    // F6 — remove of a non-existent plugin must exit 1 (was 0).
    {
      const dir = setup('exit-codes-26-remove-nonexistent');
      const code = exitCodeOf(`node ${DOCMD} remove nonexistent-f6-plugin`, dir);
      assert(code === 1, 'remove nonexistent plugin exits 1');
    }

    // M-12 — validate --json with broken links must exit 1 (was 0).
    {
      const dir = setup('exit-codes-26-validate-json-errors');
      writeFile(dir, 'docs/index.md', '# P1\n\n[bad](/nope/)\n');
      const code = exitCodeOf(`node ${DOCMD} validate --json`, dir);
      assert(code === 1, 'validate --json with errors exits 1');
    }

    // M-12 — validate --json with NO errors exits 0.
    {
      const dir = setup('exit-codes-26-validate-json-clean');
      writeFile(dir, 'docs/index.md', '# P1\n\nAll links fine.\n');
      const code = exitCodeOf(`node ${DOCMD} validate --json`, dir);
      assert(code === 0, 'validate --json with no errors exits 0');
    }

    // Sanity — build (no error) still exits 0.
    {
      const dir = setup('exit-codes-26-build-ok');
      writeFile(dir, 'docs/index.md', '# Hi\n');
      const code = exitCodeOf(`node ${DOCMD} build`, dir);
      assert(code === 0, 'clean build exits 0');
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};