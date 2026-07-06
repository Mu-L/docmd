/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * N-2 — `docmd deploy --force` flag must do something.
 *
 * Before the fix, `--force` was accepted in the CLI flags but never
 * read in the deployer. Every `docmd deploy --docker` silently
 * overwrote an existing `Dockerfile`. The fix: `--force` opts in to
 * overwriting; the default behaviour skips existing files with a
 * clear `TUI` line.
 *
 * Run: `node tests/runner.js --only=deploy`
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
  name: 'Deploy --force honours overwrite (N-2)',
  emoji: '🚢',
  run: () => {

    // N-2 — without --force, an existing Dockerfile is preserved.
    {
      const dir = setup('deploy-29-n2-no-force-skip');
      writeFile(dir, 'docs/index.md', '# Hi\n');
      writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'N2', src: './docs', out: './site' }, null, 2) + '\n');
      // Pre-seed a Dockerfile so the deployer would overwrite it.
      const existing = 'FROM existing:keep-me\n';
      writeFile(dir, 'Dockerfile', existing);

      let output = '';
      try {
        output = execSync(`node ${DOCMD} deploy --docker`, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
      } catch (e) {
        output = (typeof e.stdout === 'string' ? e.stdout : (e.stdout ? e.stdout.toString() : '')) +
                 (typeof e.stderr === 'string' ? e.stderr : (e.stderr ? e.stderr.toString() : ''));
      }

      const after = fs.readFileSync(path.join(dir, 'Dockerfile'), 'utf8');
      assert(after === existing, 'N-2: without --force, existing Dockerfile is preserved');
      assert(/skipped.*--force/i.test(output), 'N-2: TUI mentions --force when skipping');
    }

    // N-2 — with --force, an existing Dockerfile is overwritten.
    {
      const dir = setup('deploy-29-n2-force-overwrite');
      writeFile(dir, 'docs/index.md', '# Hi\n');
      writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'N2', src: './docs', out: './site' }, null, 2) + '\n');
      writeFile(dir, 'Dockerfile', 'FROM existing:keep-me\n');

      execSync(`node ${DOCMD} deploy --docker --force`, { cwd: dir, stdio: 'pipe' });
      const after = fs.readFileSync(path.join(dir, 'Dockerfile'), 'utf8');
      assert(after !== 'FROM existing:keep-me\n', 'N-2: with --force, existing Dockerfile is overwritten');
      assert(/FROM .+/.test(after), 'N-2: overwritten Dockerfile contains a real FROM directive');
    }

    // N-2 — without --force and no existing file, the deployer writes
    // a fresh Dockerfile (regression guard for the skip path).
    {
      const dir = setup('deploy-29-n2-no-force-fresh');
      writeFile(dir, 'docs/index.md', '# Hi\n');
      writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'N2', src: './docs', out: './site' }, null, 2) + '\n');

      execSync(`node ${DOCMD} deploy --docker`, { cwd: dir, stdio: 'pipe' });
      assert(fs.existsSync(path.join(dir, 'Dockerfile')), 'N-2: without --force and no existing file, Dockerfile is created');
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};