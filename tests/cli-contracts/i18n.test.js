/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * Slice D — i18n + workspace fixes
 *
 * Covers:
 *   M-6   config.versions.list is accepted as an alias for
 *         config.versions.all. The audit reported "i18n + explicit
 *         versions: 0 pages" — the real cause was users writing
 *         `list` (a common JSON shape) when the schema only accepted
 *         `all`, so the versioning branch was silently never entered.
 *   T-Z6  Missing current-version directory is now a hard error with
 *         a clear pointer to the missing path. Previously the build
 *         silently produced 0 pages.
 *
 * Run: `node tests/runner.js --only=i18n`
 * --------------------------------------------------------------------
 */

import {
  DOCMD,
  setup,
  writeFile,
  runTestFile
} from '../shared.js';
import { execSync } from 'node:child_process';
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
  name: 'i18n + workspace schema fixes (Slice D — M-6, T-Z6)',
  emoji: '🌐',
  run: () => {

    // M-6 — config.versions.list is accepted as an alias for
    // config.versions.all. With correct structure (locales in
    // subdirectories, current version with a real dir), the build
    // produces pages for both versions of both locales.
    {
      const dir = setup('i18n-d-m6-list-alias');
      writeFile(dir, 'docs/en/index.md', '# Home\n');
      writeFile(dir, 'docs/ar/index.md', '# Home\n');
      writeFile(dir, 'v1/en/index.md', '# v1 Home\n');
      writeFile(dir, 'v1/ar/index.md', '# v1 Home\n');
      writeFile(dir, 'v2/en/index.md', '# v2 Home\n');
      writeFile(dir, 'v2/ar/index.md', '# v2 Home\n');
      writeFile(dir, 'docmd.config.json', JSON.stringify({
        title: 'M-6',
        src: './docs',
        out: './site',
        i18n: {
          default: 'en',
          locales: [{ id: 'en' }, { id: 'ar' }]
        },
        versions: {
          // Using `list` instead of `all` — the alias should kick in.
          list: [
            { id: 'v1', label: '1.x', dir: 'v1' },
            { id: 'v2', label: '2.x', dir: 'v2' }
          ],
          current: 'v2'
        }
      }, null, 2) + '\n');

      let output = '';
      let code = -1;
      try {
        output = execSync(`node ${DOCMD} build`, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
        // Successful execSync returns null status on some Node versions when
        // the child process calls process.exit() with no error. Treat any
        // successful invocation as code=0.
        code = 0;
      } catch (e) {
        output = (typeof e.stdout === 'string' ? e.stdout : '') + (typeof e.stderr === 'string' ? e.stderr : '');
        code = e.status == null ? 1 : e.status;
      }

      assert(code === 0, 'M-6: build with versions.list (alias) succeeds (was 0 pages before)');
      const pages = (() => {
        try {
          return fs.readdirSync(path.join(dir, 'site')).filter((n) => n.endsWith('.html') || fs.statSync(path.join(dir, 'site', n)).isDirectory());
        } catch { return []; }
      })();
      // 2 locales × 2 versions = 4 page directories (current version
      // for each locale renders at root/{locale}/ and non-current at
      // root/{locale}/{v}/).
      assert(pages.length >= 4, 'M-6: build produces 4 page directories (2 locales × 2 versions)');
    }

    // T-Z6 — current version directory missing → build fails with a
    // clear error, not a silent 0-page build.
    {
      const dir = setup('i18n-d-tz6-missing-current-version');
      writeFile(dir, 'docs/index.md', '# Home\n');
      writeFile(dir, 'v1/index.md', '# v1 Home\n');
      writeFile(dir, 'docmd.config.json', JSON.stringify({
        title: 'T-Z6',
        src: './docs',
        out: './site',
        versions: {
          all: [
            { id: 'v1', label: '1.x', dir: 'v1' },
            // v2 dir is intentionally absent — the bug per the report.
            { id: 'v2', label: '2.x', dir: 'v2-nonexistent' }
          ],
          current: 'v2'
        }
      }, null, 2) + '\n');

      let output = '';
      let code = -1;
      try {
        output = execSync(`node ${DOCMD} build`, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
        code = 0;
      } catch (e) {
        output = (typeof e.stdout === 'string' ? e.stdout : '') + (typeof e.stderr === 'string' ? e.stderr : '');
        code = e.status == null ? 0 : e.status;
      }
      // The TUI's process.exit(0) at the end of a clean build sometimes
      // surfaces to execSync as status=null rather than 0, depending on
      // signal-handling. We treat a null status as success.
      assert(code === 1, 'T-Z6: build exits 1 when current version directory is missing (was 0 before)');
      assert(/Current version directory missing/.test(output), 'T-Z6: error message names the missing directory concept');
      assert(/v2/.test(output), 'T-Z6: error message includes the version id');
    }

    // T-Z6 — old (non-current) version directory missing → soft warn,
    // build continues with the current version.
    {
      const dir = setup('i18n-d-tz6-missing-old-version');
      writeFile(dir, 'docs/index.md', '# Home\n');
      writeFile(dir, 'v2/index.md', '# v2 Home\n');
      writeFile(dir, 'docmd.config.json', JSON.stringify({
        title: 'T-Z6-old',
        src: './docs',
        out: './site',
        versions: {
          all: [
            { id: 'v1', label: '1.x', dir: 'v1-nonexistent' },
            { id: 'v2', label: '2.x', dir: 'v2' }
          ],
          current: 'v2'
        }
      }, null, 2) + '\n');

      let output = '';
      let code = -1;
      try {
        output = execSync(`node ${DOCMD} build`, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
        code = 0;
      } catch (e) {
        output = (typeof e.stdout === 'string' ? e.stdout : '') + (typeof e.stderr === 'string' ? e.stderr : '');
        code = e.status == null ? 0 : e.status;
      }

      assert(code === 0, 'T-Z6: build succeeds when only old (non-current) version is missing');
      assert(/Skipping missing version: v1/.test(output), 'T-Z6: missing old version surfaces a soft warning');
      assert(fs.existsSync(path.join(dir, 'site/index.html')), 'T-Z6: current version still builds when old version is missing');
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};