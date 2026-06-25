/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * Phase 3 PR 3.C — Validate rewrite + workspace errors + init example
 *
 * Tests:
 *   - M-1: `docmd validate` trailing-slash false-positives
 *   - F8: workspace validation throws raw stack traces
 *   - F9: default init `index.md` has a broken `::: button` example
 *
 * Run: `node tests/runner.js`
 * --------------------------------------------------------------------
 */

import {
  DOCMD,
  setup,
  writeFile,
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
  name: 'Validate rewrite + workspace errors + init example (Phase 3 PR 3.C — F8, F9, M-1)',
  emoji: '📐',
  run: () => {

    // M-1 — `validate` must not false-positive on a valid link with a
    // trailing slash. Pre-fix: `[page 2](/page-2/)` was reported as
    // broken because the code did `fs.existsSync('docs/page-2/.md')`
    // (always false). Post-fix: the trailing slash is stripped before
    // the existence checks, and the link resolves to `docs/page-2.md`.
    {
      const dir = setup('validate-workspace-28-m1-trailing-slash-ok');
      writeFile(dir, 'docs/index.md', '# P1\n\n[page 2](/page-2/).\n');
      writeFile(dir, 'docs/page-2.md', '# P2\n');
      const code = exitCodeOf(`node ${DOCMD} validate`, dir);
      assert(code === 0, 'M-1: trailing-slash link to existing .md is valid (exit 0)');
    }

    // M-1 — genuine broken link is still caught.
    {
      const dir = setup('validate-workspace-28-m1-broken-still-caught');
      writeFile(dir, 'docs/index.md', '# P1\n\n[bad](/nope/)\n');
      const code = exitCodeOf(`node ${DOCMD} validate`, dir);
      assert(code === 1, 'M-1: genuinely broken link still exits 1');
    }

    // F8 — workspace validation errors exit 1 with a clean TUI message,
    // not a raw stack trace.
    {
      const dir = setup('validate-workspace-28-f8-workspace-error');
      writeFile(dir, 'docmd.config.json', JSON.stringify({
        title: 'F8',
        src: './docs',
        out: './site',
        workspace: {
          projects: [{ src: './totally-missing-f8', prefix: '/' }]
        }
      }));
      const code = exitCodeOf(`node ${DOCMD} build`, dir);
      assert(code === 1, 'F8: workspace with missing source dir exits 1');
    }

    // F8 — duplicate-prefix error also exits 1.
    {
      const dir = setup('validate-workspace-28-f8-workspace-duplicate');
      writeFile(dir, 'docmd.config.json', JSON.stringify({
        title: 'F8 dup',
        src: './docs',
        out: './site',
        workspace: {
          projects: [
            { src: './docs', prefix: '/api' },
            { src: './docs', prefix: '/api' }
          ]
        }
      }));
      const code = exitCodeOf(`node ${DOCMD} build`, dir);
      assert(code === 1, 'F8: duplicate workspace prefix exits 1');
    }

    // F9 — default init `index.md` must NOT contain the F2 trap pattern
    // (`::: card ... ::: button ... :::` with the orphan `:::`).
    // We check the bundled `initProject` source rather than running
    // `init` (which would write to disk) — we just confirm the
    // template string no longer teaches the F2 pattern.
    {
      const initSrc = fs.readFileSync(
        path.resolve(import.meta.dirname, '..', '..', 'packages/core/dist/commands/init.js'),
        'utf8'
      );
      // The broken pattern was: `::: button "View Documentation" https://...`
      // followed by a `:::` close. The replacement uses
      // `[View the docs →](https://docmd.io){.docmd-button}` instead.
      assert(!/button "View Documentation"/.test(initSrc), 'F9: bundled init no longer contains broken `::: button ... :::` trap');
      assert(/\{\.docmd-button\}/.test(initSrc), 'F9: bundled init uses `{.docmd-button}` styled link');
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};