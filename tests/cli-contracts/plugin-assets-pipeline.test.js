/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * Plugin asset pipeline — async/await + capability regression tests
 *
 * Covers the regression bugs that broke plugin CSS/JS loading
 * after the Slice C.1+C.2 safeCall refactor:
 *
 *   PAA-1  getAssets consumer in core/src/commands/build.ts must
 *          await the async wrapper around getAssetsFn. Without the
 *          await, `assets` is a Promise and `Array.isArray(assets)`
 *          is false, so every plugin's `src`/`dest` copy is silently
 *          skipped — search, git, mermaid, math, openapi CSS/JS never
 *          land in site/assets/.
 *
 *   PAA-2  getAssets consumer in core/src/engine/generator.ts must
 *          await the same wrapper. Without the await, no <script>
 *          or <link> tag is ever added to the page <head>/<body>,
 *          so even if a file exists in the source tree it never
 *          gets loaded by the browser.
 *
 *   PAA-3  Plugin `assets` capability is the right key in the
 *          registerPlugin gate (a previous local edit had `'assets'`
 *          being passed to hasCapabilityForHook which expects a hook
 *          name; the gate then returned false and every plugin's
 *          getAssets was skipped with a "didn't declare" warning).
 *
 * Uses the built-in @docmd/plugin-search, plugin-git, plugin-mermaid,
 * plugin-math, plugin-openapi as the test subjects because their
 * getAssets hooks cover the full matrix (local-copy src/dest, CDN
 * url, conditional pageHtmlMatches).
 *
 * Run: `node tests/runner.js --only=plugin-assets-pipeline`
 * --------------------------------------------------------------------
 */

import {
  DOCMD,
  setup,
  writeFile,
  build,
  runTestFile
} from '../shared.js';
import fs from 'node:fs';
import path from 'path';

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
  name: 'Plugin asset pipeline (await + capability)',
  emoji: '🧩',
  run: async () => {

    // PAA-1: plugin assets with `src`/`dest` get copied to site/.
    // The search plugin ships `assets/js/docmd-search.js` (src/dest).
    {
      const proj = setup('plugin-assets-pipeline-paa1-copy');
      writeFile(proj, 'docs/index.md', '# Hi\n');
      writeFile(proj, 'docmd.config.json', JSON.stringify({
        title: 'PAA-1',
        src: './docs',
        out: './site',
        plugins: { search: {} }
      }, null, 2) + '\n');

      const result = build(proj);
      assert(result.ok, 'PAA-1: build succeeds with the search plugin');
      assert(fs.existsSync(path.join(proj, 'site/assets/js/docmd-search.js')),
        'PAA-1: search plugin getAssets src/dest is copied to site/assets/js/docmd-search.js');
      // PAA-3: the search plugin declares the assets capability in its
      // descriptor. A correct gate must NOT print the "didn't declare"
      // warning; a buggy gate (one that passed the wrong key to
      // hasCapabilityForHook) would.
      assert(!/didn't declare "assets" capability/.test(result.output),
        'PAA-3: no "didn\'t declare assets capability" warning for a plugin that declares it');
    }

    // PAA-2: a plugin's CDN-style `url` asset becomes a real <link> or
    // <script> tag in the rendered HTML, AND a local-copy src/dest
    // asset becomes a real <script src="./assets/..."> tag. This proves
    // the generator's loop awaits the async hook and pushes the tag
    // into the right bucket.
    {
      const proj = setup('plugin-assets-pipeline-paa2-link');
      writeFile(proj, 'docs/index.md', '# Hi\n');
      writeFile(proj, 'docmd.config.json', JSON.stringify({
        title: 'PAA-2',
        src: './docs',
        out: './site',
        plugins: {
          search: { semantic: false },
          git: { repo: 'https://github.com/docmd-io/docmd' },
          math: {}
        }
      }, null, 2) + '\n');

      const result = build(proj);
      assert(result.ok, 'PAA-2: build succeeds with search + git + math');
      const htmlPath = path.join(proj, 'site/index.html');
      assert(fs.existsSync(htmlPath), 'PAA-2: site/index.html generated');
      const html = fs.readFileSync(htmlPath, 'utf8');

      // search: MiniSearch CDN + local docmd-search.js
      assert(/<script[^>]+src="https:\/\/cdn\.jsdelivr\.net\/npm\/minisearch/.test(html),
        'PAA-2: search plugin CDN (MiniSearch) <script> tag emitted');
      assert(/<script[^>]+src="\.\/assets\/js\/docmd-search\.js/.test(html),
        'PAA-2: search plugin local-copy <script src="./assets/js/docmd-search.js"> tag emitted');

      // git: local docmd-git.js + docmd-git.css
      assert(/<script[^>]+src="\.\/assets\/js\/docmd-git\.js/.test(html),
        'PAA-2: git plugin local-copy <script src="./assets/js/docmd-git.js"> tag emitted');
      assert(/<link[^>]+href="\.\/assets\/css\/docmd-git\.css/.test(html),
        'PAA-2: git plugin local-copy <link href="./assets/css/docmd-git.css"> tag emitted');
    }

    // PAA-2b: when a page DOES contain math, the math plugin's
    // conditional CDN link is emitted (proves the condition filter
    // and the awaited loop cooperate).
    {
      const proj = setup('plugin-assets-pipeline-paa2b-conditional');
      writeFile(proj, 'docs/index.md', '# Math\n\n$$\\int_0^1 x^2 dx$$\n');
      writeFile(proj, 'docmd.config.json', JSON.stringify({
        title: 'PAA-2b',
        src: './docs',
        out: './site',
        plugins: { math: {} }
      }, null, 2) + '\n');

      const result = build(proj);
      assert(result.ok, 'PAA-2b: build succeeds with the math plugin');
      const html = fs.readFileSync(path.join(proj, 'site/index.html'), 'utf8');
      assert(/<link[^>]+href="https:\/\/cdn\.jsdelivr\.net\/npm\/katex/.test(html),
        'PAA-2b: math plugin conditional CDN <link> emitted on a page with math content');
    }

    // PAA-1b: all four plugin asset files actually land on disk in
    // site/ (the copy half of the pipeline).
    {
      const proj = setup('plugin-assets-pipeline-paa1b-all-files');
      writeFile(proj, 'docs/index.md', '# Hi\n');
      writeFile(proj, 'docmd.config.json', JSON.stringify({
        title: 'PAA-1b',
        src: './docs',
        out: './site',
        plugins: {
          search: { semantic: true },
          git: { repo: 'https://github.com/docmd-io/docmd' },
          mermaid: {},
          openapi: {}
        }
      }, null, 2) + '\n');

      const result = build(proj);
      assert(result.ok, 'PAA-1b: build succeeds with search+git+mermaid+openapi');
      const copied = [
        'assets/js/docmd-search.js',
        'assets/js/docmd-git.js',
        'assets/css/docmd-git.css',
        'assets/css/docmd-openapi.css',
        '.docmd-search-client.js'  // semantic mode root-level drop
      ];
      for (const rel of copied) {
        assert(fs.existsSync(path.join(proj, 'site', rel)),
          `PAA-1b: ${rel} is present in site/ after the build`);
      }
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};
