/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * #167 — Offline-mode internal links must work in every hosting shape.
 *
 * The bug: in `--offline` builds, the markdown link processor emitted
 * absolute paths (`<a href="/destination/">`) that only resolve on an
 * HTTP server, breaking `file://` access. The button container was
 * offline-aware but markdown links were not.
 *
 * The fix: the markdown processor now post-processes the rendered HTML
 * with the same `fixHtmlLinks` logic the button uses, so internal hrefs
 * are rewritten to relative `.html` paths in offline mode. Normal builds
 * are unchanged (clean URLs preserved).
 *
 * Run: `node tests/runner.js --only=offline-links`
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

function extractHrefs(html) {
  const out = [];
  // Match `href=` on `<a>` and `src=` on `<img>`. Both can target internal
  // routes and both need to be checked for the offline-mode rewrite.
  const re = /<a\s+[^>]*?\bhref\s*=\s*("([^"]*)"|'([^']*)')|<img\s+[^>]*?\bsrc\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push(m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5])));
  }
  return out;
}

export const test = runTestFile({
  name: 'Offline-mode internal links work in every hosting shape (#167)',
  emoji: '🔗',
  run: () => {

    // Root page (index.html at the build root) — the original bug repro.
    // Before the fix: offline build emitted `<a href="/destination/">` for
    // the markdown link. After: `./destination/index.html`.
    {
      const dir = setup('offline-links-31-167-root-page');
      writeFile(dir, 'docs/index.md', '# Home\n\n[link](/destination.md)\n');
      writeFile(dir, 'docs/destination.md', '# Destination\n');

      execSync(`node ${DOCMD} build --offline`, { cwd: dir, stdio: 'pipe' });
      const html = fs.readFileSync(path.join(dir, 'site/index.html'), 'utf8');
      const hrefs = extractHrefs(html);

      assert(hrefs.includes('./destination/index.html'), 'M-2: root-page markdown link rewritten to relative .html (offline mode)');
      assert(!hrefs.some((h) => h === '/destination/'), 'M-2: no absolute "/destination/" path leaked into offline HTML');

      // File existence check — the file:// test.
      const target = path.resolve(dir, 'site/destination/index.html');
      assert(fs.existsSync(target), 'M-2: rewritten target file actually exists on disk');
    }

    // Nested page (site/api/index.html) — depth-adjusted relative paths.
    // The fix must add `../` so the path navigates up correctly from the
    // subfolder in offline mode.
    {
      const dir = setup('offline-links-31-167-nested-page');
      writeFile(dir, 'docs/api/index.md', '# API\n\n[link](/destination.md)\n');
      writeFile(dir, 'docs/destination.md', '# Destination\n');

      execSync(`node ${DOCMD} build --offline`, { cwd: dir, stdio: 'pipe' });
      const html = fs.readFileSync(path.join(dir, 'site/api/index.html'), 'utf8');
      const hrefs = extractHrefs(html);

      assert(hrefs.includes('../destination/index.html'), 'M-2: nested-page markdown link gets "../" prefix (offline mode)');
      assert(!hrefs.some((h) => h === '/destination/'), 'M-2: no absolute path on the nested page either');

      const target = path.resolve(dir, 'site/destination/index.html');
      assert(fs.existsSync(target), 'M-2: nested-page target resolves correctly on disk');
    }

    // Normal (non-offline) build must be UNCHANGED — clean URLs preserved.
    // The fix must not regress HTTP-server deployments.
    {
      const dir = setup('offline-links-31-167-non-offline-unchanged');
      writeFile(dir, 'docs/index.md', '# Home\n\n[link](/destination.md)\n');
      writeFile(dir, 'docs/destination.md', '# Destination\n');

      execSync(`node ${DOCMD} build`, { cwd: dir, stdio: 'pipe' });
      const html = fs.readFileSync(path.join(dir, 'site/index.html'), 'utf8');
      const hrefs = extractHrefs(html);

      // In non-offline mode, the markdown link stays as the canonical
      // clean URL (no .html suffix). The button container may rewrite
      // its own href to a relative clean URL — both are fine.
      assert(!hrefs.some((h) => h.endsWith('.html') && !h.includes('#')), 'M-2: non-offline build still emits clean URLs (no .html suffix on internal hrefs)');
    }

    // External, hash-only, and asset hrefs must NEVER be rewritten.
    {
      const dir = setup('offline-links-31-167-passthrough');
      writeFile(dir, 'docs/index.md', [
        '# Home',
        '',
        '[external](https://example.com/page)',
        '[anchor](#section)',
        '![img](/assets/img.png)',
        '[internal](/destination.md)',
        ''
      ].join('\n'));
      writeFile(dir, 'docs/destination.md', '# Destination\n');

      execSync(`node ${DOCMD} build --offline`, { cwd: dir, stdio: 'pipe' });
      const html = fs.readFileSync(path.join(dir, 'site/index.html'), 'utf8');
      const hrefs = extractHrefs(html);

      assert(hrefs.includes('https://example.com/page'), 'M-2: external https URL is unchanged');
      assert(hrefs.some((h) => h === '#section' || h.startsWith('#section')), 'M-2: hash-only anchor is unchanged');
      // Asset paths ARE rewritten to relative for offline (file:// needs
      // relative paths even for images), but the `/` prefix is dropped so
      // they resolve to a real file on disk.
      assert(hrefs.some((h) => h.includes('assets/img.png') && !h.startsWith('/assets/')), 'M-2: asset path is rewritten to relative (no leading /) for file://');
      assert(hrefs.includes('./destination/index.html'), 'M-2: internal href rewritten to relative .html');
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};