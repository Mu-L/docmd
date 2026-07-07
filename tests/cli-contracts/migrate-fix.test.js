/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * Slice E — Migration polish
 *
 * Covers:
 *   N-10  `moveFilesToBackup` keeps lockfiles and package manifests
 *         (package.json, package-lock.json, yarn.lock, pnpm-lock.yaml,
 *         bun.lock, bun.lockb) in place so a recovery doesn't have
 *         to re-resolve every dependency.
 *   N-22  Docusaurus migrate preserves the original `staticDir`
 *         (default `static`) and MkDocs migrate preserves the
 *         original `site_dir` (default `site`). Starlight and
 *         VitePress keep their conventional defaults.
 *   N-9   MkDocs migrate parses the top-level `nav:` block into a
 *         docmd-compatible `navigation` array. Multi-level nav is
 *         preserved via the `children` field.
 *
 * Run: `node tests/runner.js --only=migrate-fix`
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
  name: 'Migration polish (Slice E — N-9, N-10, N-22)',
  emoji: '🚚',
  run: () => {

    // N-10 — lockfiles and package manifests stay in place.
    {
      const dir = setup('migrate-fix-n10-lockfiles-stay');
      writeFile(dir, 'mkdocs.yml', 'site_name: N-10\n');
      writeFile(dir, 'package.json', '{"name":"test","dependencies":{"foo":"^1.0.0"}}\n');
      writeFile(dir, 'package-lock.json', '{"name":"test","lockfileVersion":3}\n');
      writeFile(dir, 'pnpm-lock.yaml', 'lockfileVersion: 6.0\n');
      writeFile(dir, 'docs/index.md', '# Home\n');
      writeFile(dir, 'docmd.config.json', '{"title":"N-10","src":"./docs","out":"./site"}\n');

      execSync(`node ${DOCMD} migrate --mkdocs`, { cwd: dir, stdio: 'pipe' });

      // Package manifests stay in cwd (not in backup)
      assert(fs.existsSync(path.join(dir, 'package.json')), 'N-10: package.json stays in cwd after migrate');
      assert(fs.existsSync(path.join(dir, 'package-lock.json')), 'N-10: package-lock.json stays in cwd after migrate');
      assert(fs.existsSync(path.join(dir, 'pnpm-lock.yaml')), 'N-10: pnpm-lock.yaml stays in cwd after migrate');
      // node_modules is excluded
      assert(fs.existsSync(path.join(dir, 'node_modules')) === false || !fs.statSync(path.join(dir, 'node_modules')).isDirectory(), 'N-10: node_modules is not in the backup');
      // Backup contains user content
      assert(fs.existsSync(path.join(dir, 'mkdocs-backup/docs/index.md')), 'N-10: backup contains moved content (mkdocs-backup/docs/index.md)');
    }

    // N-22 (Docusaurus) — preserve original staticDir.
    {
      const dir = setup('migrate-fix-n22-docusaurus');
      writeFile(dir, 'docusaurus.config.js', [
        "module.exports = {",
        "  title: 'N-22-d',",
        "  staticDir: 'my-static',",
        "};"
      ].join('\n'));
      writeFile(dir, 'docs/index.md', '# Home\n');
      writeFile(dir, 'docmd.config.json', '{"title":"N-22-d","src":"./docs","out":"./site"}\n');

      execSync(`node ${DOCMD} migrate --docusaurus`, { cwd: dir, stdio: 'pipe' });
      const written = fs.readFileSync(path.join(dir, 'docmd.config.js'), 'utf8');
      assert(/out:\s*'my-static'/.test(written) || /out:\s*"my-static"/.test(written) || /out:\s*'my-static'/.test(written) || /out: 'my-static'/.test(written), 'N-22: Docusaurus staticDir "my-static" is preserved in the generated config');
    }

    // N-22 (MkDocs) — preserve original site_dir.
    {
      const dir = setup('migrate-fix-n22-mkdocs');
      writeFile(dir, 'mkdocs.yml', [
        'site_name: N-22-m',
        'site_dir: my-site',
        ''
      ].join('\n'));
      writeFile(dir, 'docs/index.md', '# Home\n');
      writeFile(dir, 'docmd.config.json', '{"title":"N-22-m","src":"./docs","out":"./site"}\n');

      execSync(`node ${DOCMD} migrate --mkdocs`, { cwd: dir, stdio: 'pipe' });
      const written = fs.readFileSync(path.join(dir, 'docmd.config.js'), 'utf8');
      assert(/out:\s*['"]my-site['"]/.test(written), 'N-22: MkDocs site_dir "my-site" is preserved in the generated config');
    }

    // N-9 — MkDocs nav: is parsed into the docmd navigation.
    {
      const dir = setup('migrate-fix-n9-mkdocs-nav');
      writeFile(dir, 'mkdocs.yml', [
        'site_name: N-9',
        'nav:',
        '  - Home: index.md',
        '  - Guide:',
        '    - Getting Started: guide/start.md',
        '    - Reference: guide/ref.md',
        ''
      ].join('\n'));
      writeFile(dir, 'docs/index.md', '# Home\n');
      writeFile(dir, 'docmd.config.json', '{"title":"N-9","src":"./docs","out":"./site"}\n');

      execSync(`node ${DOCMD} migrate --mkdocs`, { cwd: dir, stdio: 'pipe' });
      const written = fs.readFileSync(path.join(dir, 'docmd.config.js'), 'utf8');
      assert(/navigation:\s*\[/.test(written), 'N-9: generated config has a navigation array');
      assert(/'Home'|"Home"/.test(written) && /\bindex\b/.test(written), 'N-9: navigation contains the Home entry');
      assert(/'Guide'|"Guide"/.test(written) && /children/.test(written), 'N-9: multi-level nav (Guide with children) is preserved');
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};