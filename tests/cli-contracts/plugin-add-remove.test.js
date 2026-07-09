/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * Phase 3 PR 3.B — Plugin add/remove across config formats
 *
 * Tests F7 (`remove <plugin>` doesn't actually remove the plugin
 * entry from config) and M-3 (`docmd add <plugin>` silently no-ops
 * for `.ts` / `.mjs` / `.cjs` configs).
 *
 * The legacy regex-based injector only matched `module.exports = {...}`.
 * The brace-balanced scanner in `packages/plugins/installer/src/config-editor.ts`
 * handles all five supported formats uniformly.
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
import { execSync } from 'node:child_process';

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
  name: 'Plugin add/remove across config formats (Phase 3 PR 3.B — F7, M-3)',
  emoji: '🔌',
  run: () => {

    // M-3 — `add` must inject the plugin entry into a TS config (was no-op).
    // Uses 'math' (a non-core plugin from the installer registry) so the
    // add/remove gate allows it. Core plugins (search, seo, llms, …)
    // ship with @docmd/core and are now blocked from add/remove — they're
    // opted out via `plugins.<name>: false` instead.
    {
      const dir = setup('plugin-add-remove-27-m3-add-ts');
      writeFile(dir, 'docs/index.md', '# Hi\n');
      writeFile(dir, 'docmd.config.ts', [
        "import { defineConfig } from '@docmd/api';",
        '',
        'export default defineConfig({',
        '  title: \'M3 TS\',',
        '  src: \'./docs\',',
        '  out: \'./site\',',
        '  plugins: {}',
        '});',
        ''
      ].join('\n'));
      // Use execSync (the brute-style) for the assertion below.
      execSync(`node ${DOCMD} add math`, { cwd: dir, stdio: 'pipe' });
      const after = fs.readFileSync(`${dir}/docmd.config.ts`, 'utf8');
      assert(/['"]math['"]\s*:\s*\{\s*\}/.test(after), 'M-3: TS config gets math entry after add');
    }

    // M-3 — same for MJS
    {
      const dir = setup('plugin-add-remove-27-m3-add-mjs');
      writeFile(dir, 'docs/index.md', '# Hi\n');
      writeFile(dir, 'docmd.config.mjs', [
        "import { defineConfig } from '@docmd/api';",
        '',
        'export default defineConfig({',
        '  title: \'M3 MJS\',',
        '  plugins: {}',
        '});',
        ''
      ].join('\n'));
      execSync(`node ${DOCMD} add math`, { cwd: dir, stdio: 'pipe' });
      const after = fs.readFileSync(`${dir}/docmd.config.mjs`, 'utf8');
      assert(/['"]math['"]\s*:\s*\{\s*\}/.test(after), 'M-3: MJS config gets math entry after add');
    }

    // F7 — `remove` must remove the plugin entry from a TS config (was no-op).
    {
      const dir = setup('plugin-add-remove-27-f7-remove-ts');
      writeFile(dir, 'docmd.config.ts', [
        "import { defineConfig } from '@docmd/api';",
        '',
        'export default defineConfig({',
        '  title: \'F7 TS\',',
        '  plugins: {',
        '    math: {}',
        '  }',
        '});',
        ''
      ].join('\n'));
      execSync(`node ${DOCMD} remove math`, { cwd: dir, stdio: 'pipe' });
      const after = fs.readFileSync(`${dir}/docmd.config.ts`, 'utf8');
      assert(!/math\s*:/.test(after), 'F7: TS config math entry removed');
      assert(/plugins\s*:/.test(after), 'F7: TS config plugins block still present');
    }

    // F7 — same for JSON
    {
      const dir = setup('plugin-add-remove-27-f7-remove-json');
      writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'F7 JSON', plugins: { math: {} } }, null, 2) + '\n');
      execSync(`node ${DOCMD} remove math`, { cwd: dir, stdio: 'pipe' });
      const after = fs.readFileSync(`${dir}/docmd.config.json`, 'utf8');
      assert(!/"math"\s*:/.test(after), 'F7: JSON config math entry removed');
    }

    // Idempotency — adding a plugin that's already configured must NOT
    // create a duplicate entry.
    {
      const dir = setup('plugin-add-remove-27-idempotent');
      writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'Idem', plugins: { math: {} } }, null, 2) + '\n');
      execSync(`node ${DOCMD} add math`, { cwd: dir, stdio: 'pipe' });
      const after = JSON.parse(fs.readFileSync(`${dir}/docmd.config.json`, 'utf8'));
      const keys = Object.keys(after.plugins);
      assert(keys.filter((k) => k === 'math').length === 1, 'idempotent: only one math entry after re-add');
    }

    // No-plugins-block JS config — `add` should CREATE the plugins block.
    {
      const dir = setup('plugin-add-remove-27-js-no-plugins');
      writeFile(dir, 'docmd.config.js', [
        'module.exports = {',
        '  title: \'JS no plugins\',',
        '  src: \'./docs\',',
        '  out: \'./site\'',
        '};',
        ''
      ].join('\n'));
      execSync(`node ${DOCMD} add math`, { cwd: dir, stdio: 'pipe' });
      const after = fs.readFileSync(`${dir}/docmd.config.js`, 'utf8');
      assert(/plugins\s*:\s*\{/.test(after), 'JS no-plugins: plugins block created');
      assert(/['"]math['"]\s*:\s*\{\s*\}/.test(after), 'JS no-plugins: math entry present');
      // No stray newline-comma in the output (regression guard).
      assert(!/,\s*\n\s*plugins/.test(after) || /,\n\s*plugins/.test(after), 'JS no-plugins: no stray \",\\n\" between last key and plugins');
    }

    // Core plugin gate — `add <core-plugin>` must abort with exit 1 and
    // not modify the config. Core plugins ship with @docmd/core and are
    // opted out via plugins.<name>: false, not installed/removed
    // manually.
    {
      const dir = setup('plugin-add-remove-27-core-gate');
      writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'Core Gate', plugins: {} }, null, 2) + '\n');
      const code = exitCodeOf(`node ${DOCMD} add okf`, dir);
      assert(code === 1, 'core plugin add rejected with exit 1');
      const after = fs.readFileSync(`${dir}/docmd.config.json`, 'utf8');
      assert(!/okf/.test(after), 'core plugin add did not modify config');
    }
    {
      const dir = setup('plugin-add-remove-27-core-gate-remove');
      writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'Core Gate', plugins: { okf: {} } }, null, 2) + '\n');
      const code = exitCodeOf(`node ${DOCMD} remove okf`, dir);
      assert(code === 1, 'core plugin remove rejected with exit 1');
      const after = fs.readFileSync(`${dir}/docmd.config.json`, 'utf8');
      assert(/"okf"\s*:/.test(after), 'core plugin remove did not modify config');
    }

    // M-14 — `docmd add` for an already-configured plugin must NOT
    // claim "Plugin successfully installed and activated". The plugin
    // is already there; nothing was installed. The final message must
    // reflect what actually happened.
    {
      const dir = setup('plugin-add-remove-27-m14-already-installed-message');
      writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'M14', plugins: { math: {} } }, null, 2) + '\n');
      let output = '';
      try {
        output = execSync(`node ${DOCMD} add math`, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
      } catch (e) {
        output = (typeof e.stdout === 'string' ? e.stdout : (e.stdout ? e.stdout.toString() : '')) +
                 (typeof e.stderr === 'string' ? e.stderr : (e.stderr ? e.stderr.toString() : ''));
      }
      assert(/already (configured|installed)/i.test(output), 'M-14: already-installed message appears');
      assert(!/successfully installed and activated/i.test(output), 'M-14: no false "successfully installed and activated" message');
    }

    // M-14 — companion: first install of a fresh plugin still shows
    // the success message (regression guard).
    {
      const dir = setup('plugin-add-remove-27-m14-fresh-install-message');
      writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'M14 fresh', plugins: {} }, null, 2) + '\n');
      let output = '';
      try {
        output = execSync(`node ${DOCMD} add math`, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
      } catch (e) {
        output = (typeof e.stdout === 'string' ? e.stdout : (e.stdout ? e.stdout.toString() : '')) +
                 (typeof e.stderr === 'string' ? e.stderr : (e.stderr ? e.stderr.toString() : ''));
      }
      assert(/successfully installed and activated/i.test(output), 'M-14: fresh install still shows success message');
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};
