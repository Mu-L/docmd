/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * Slice C.3 — Public API additions
 *
 * Covers:
 *   D-H4  createSourceTools.getBlocks(file) — enumerate all top-level
 *        blocks in a file (paragraph-level split on blank lines).
 *   D-H6  Live editor uses safePath from @docmd/api to resolve the
 *        requested URL against the public dir, with a 403 fallback on
 *        path-escape attempts.
 *   D-M3  onBeforeRender and onPageReady receive the same page shape
 *        (urlContext + config are now both included in onBeforeRender).
 *   D-M4  The duplicate safePath in packages/api/src/source.ts is gone —
 *        we now import the canonical one from @docmd/utils.
 *
 * Run: `node tests/runner.js --only=source-tools`
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
  name: 'Source tools + page shape consistency (Slice C.3)',
  emoji: '🧰',
  run: async () => {

    // D-H4 — createSourceTools exposes a getBlocks(file) entry point.
    // Source tools are a runtime concept (the live editor hands a tools
    // instance to plugins via WebSocket RPC), so we test the surface via
    // direct import + invocation. The tool is created with a small
    // fixture and getBlocks is called against it.
    {
      const tmpDir = setup('source-tools-c3-dh4-getblocks');
      writeFile(tmpDir, 'docs/index.md', [
        '# Heading 1',
        '',
        'First paragraph block.',
        '',
        'Second paragraph block.',
        '',
        '- List item one',
        '- List item two',
        '',
        'Third block after the list.',
        ''
      ].join('\n'));

      // Import the helper directly. We use a relative path to the
      // monorepo so the import resolves without needing a node_modules
      // install in the fixture.
      const apiPath = path.resolve(import.meta.dirname, '..', '..', 'packages', 'api', 'dist', 'index.js');
      const { createSourceTools } = await import(apiPath);
      const tools = createSourceTools({ projectRoot: tmpDir });
      const blocks = await tools.getBlocks('docs/index.md');

      // 5 blocks: heading, p1, p2, list (multi-line), p3.
      assert(blocks.length === 5, 'D-H4: getBlocks returns 5 blocks (heading + 2 paragraphs + list + 3rd paragraph)');
      const starts = blocks.map((b) => b.line.start).join(',');
      assert(/^0,2,4,6,9$/.test(starts), 'D-H4: block line.start values match the blank-line-split boundaries');
    }

    // D-M3 — onBeforeRender and onPageReady receive the same page
    // shape. We inspect the generator source for the construction of
    // both pageContext objects and assert the key sets match.
    {
      const genSrc = fs.readFileSync(
        path.resolve(import.meta.dirname, '..', '..', 'packages', 'core', 'src', 'engine', 'generator.ts'),
        'utf8'
      );
      // The onBeforeRender pageContext block (Phase 3A) must include
      // `urlContext` and `config` keys. This is the D-M3 fix.
      const beforeMatch = genSrc.match(/Phase 3A[\s\S]*?const pageContext = \{([\s\S]*?)\};[\s\S]*?onBeforeRender/);
      assert(beforeMatch && /urlContext/.test(beforeMatch[1]), 'D-M3: onBeforeRender pageContext includes urlContext');
      assert(beforeMatch && /\bconfig\b/.test(beforeMatch[1]), 'D-M3: onBeforeRender pageContext includes config');
      // The onPageReady pageObj is declared right before the loop. Look
      // for `const pageObj = {` followed by the loop.
      const readyMatch = genSrc.match(/const pageObj = \{([\s\S]*?)\};[\s\S]*?for \(const fn of hooks\.onPageReady\)/);
      assert(readyMatch && /urlContext/.test(readyMatch[1]), 'D-M3: onPageReady pageObj includes urlContext');
      assert(readyMatch && /\bconfig\b/.test(readyMatch[1]), 'D-M3: onPageReady pageObj includes config');
    }

    // D-H6 — the live editor's static-file handler uses the canonical
    // safePath and 403s on path-escape attempts. We test this by
    // directly importing the live editor's exported server and issuing
    // a request with a traversal attempt.
    {
      // The live editor is a CLI binary; testing it through the binary
      // would require a running server. Instead, we unit-test the
      // safePath dependency: the live editor's `index.ts` imports
      // `safePath` from `@docmd/api` (this is the contract we want to
      // preserve). The previous path was `path.join` + ad-hoc stripper
      // which happened to be safe by accident.
      const liveIndex = fs.readFileSync(
        path.resolve(import.meta.dirname, '..', '..', 'packages', 'live', 'src', 'index.ts'),
        'utf8'
      );
      assert(/import \{ safePath as canonicalSafePath \} from .@docmd\/api.;/.test(liveIndex), 'D-H6: live editor imports safePath from @docmd/api');
      // The old `path.join(publicDir, safePath)` is gone — the canonical
      // safePath call replaces it.
      assert(!/path\.join\(publicDir, safePath\)/.test(liveIndex), 'D-H6: live editor no longer uses raw path.join(publicDir, safePath)');
    }

    // D-M4 — packages/api/src/source.ts no longer has a local
    // safePath duplicate; it imports the canonical one from
    // @docmd/utils (which @docmd/api re-exports).
    {
      const sourceSrc = fs.readFileSync(
        path.resolve(import.meta.dirname, '..', '..', 'packages', 'api', 'src', 'source.ts'),
        'utf8'
      );
      assert(/import\s*\{\s*safePath\s*\}\s*from\s*'@docmd\/utils'/.test(sourceSrc), 'D-M4: source.ts imports safePath from @docmd/utils');
      // No local `function safePath` declaration in source.ts.
      assert(!/^function\s+safePath\s*\(/.test(sourceSrc), 'D-M4: source.ts no longer declares a local safePath');
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};