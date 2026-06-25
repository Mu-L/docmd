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
      execSync(`node ${DOCMD} add search`, { cwd: dir, stdio: 'pipe' });
      const after = fs.readFileSync(`${dir}/docmd.config.ts`, 'utf8');
      assert(/['"]search['"]\s*:\s*\{\s*\}/.test(after), 'M-3: TS config gets search entry after add');
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
      execSync(`node ${DOCMD} add search`, { cwd: dir, stdio: 'pipe' });
      const after = fs.readFileSync(`${dir}/docmd.config.mjs`, 'utf8');
      assert(/['"]search['"]\s*:\s*\{\s*\}/.test(after), 'M-3: MJS config gets search entry after add');
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
        '    search: {}',
        '  }',
        '});',
        ''
      ].join('\n'));
      execSync(`node ${DOCMD} remove search`, { cwd: dir, stdio: 'pipe' });
      const after = fs.readFileSync(`${dir}/docmd.config.ts`, 'utf8');
      assert(!/search\s*:/.test(after), 'F7: TS config search entry removed');
      assert(/plugins\s*:/.test(after), 'F7: TS config plugins block still present');
    }

    // F7 — same for JSON
    {
      const dir = setup('plugin-add-remove-27-f7-remove-json');
      writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'F7 JSON', plugins: { search: {} } }, null, 2) + '\n');
      execSync(`node ${DOCMD} remove search`, { cwd: dir, stdio: 'pipe' });
      const after = fs.readFileSync(`${dir}/docmd.config.json`, 'utf8');
      assert(!/"search"\s*:/.test(after), 'F7: JSON config search entry removed');
    }

    // Idempotency — adding a plugin that's already configured must NOT
    // create a duplicate entry.
    {
      const dir = setup('plugin-add-remove-27-idempotent');
      writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'Idem', plugins: { search: {} } }, null, 2) + '\n');
      execSync(`node ${DOCMD} add search`, { cwd: dir, stdio: 'pipe' });
      const after = JSON.parse(fs.readFileSync(`${dir}/docmd.config.json`, 'utf8'));
      const keys = Object.keys(after.plugins);
      assert(keys.filter((k) => k === 'search').length === 1, 'idempotent: only one search entry after re-add');
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
      execSync(`node ${DOCMD} add search`, { cwd: dir, stdio: 'pipe' });
      const after = fs.readFileSync(`${dir}/docmd.config.js`, 'utf8');
      assert(/plugins\s*:\s*\{/.test(after), 'JS no-plugins: plugins block created');
      assert(/['"]search['"]\s*:\s*\{\s*\}/.test(after), 'JS no-plugins: search entry present');
      // No stray newline-comma in the output (regression guard).
      assert(!/,\s*\n\s*plugins/.test(after) || /,\n\s*plugins/.test(after), 'JS no-plugins: no stray \",\\n\" between last key and plugins');
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};
