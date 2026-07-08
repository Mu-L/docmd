/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * Asset base-URL + engine-key regression tests
 *
 * Two related issues that broke sub-project (workspace) sites after
 * the 0.8.7 / 0.8.8 layout changes:
 *
 *   URL-1  `relativePathToRoot` is computed as `./` for a directory
 *          page (e.g. `/search/index.html`) but the document can
 *          also be served at `/search` (no trailing slash — `npx
 *          serve`, nginx, GitHub Pages, all behave this way). With
 *          no <base> tag, the browser uses the document URL as the
 *          base for relative resolution:
 *             /search            → ./assets/template/summer.css
 *                                  → /assets/template/summer.css (root, 404)
 *             /search/           → ./assets/template/summer.css
 *                                  → /search/assets/template/summer.css (OK)
 *          The fix adds <base href="./"> to every layout, which makes
 *          relative resolution use the document's *directory* in both
 *          cases.
 *
 *   URL-2  `engine: "rust"` is a documented top-level config option
 *          but the validator's KNOWN_KEYS list was missing it. Every
 *          build printed two `Unknown property "engine" in config`
 *          warnings (one per workspace project), which drowned the
 *          output in noise and looked like a real misconfiguration.
 *
 * Run: `node tests/runner.js --only=asset-base-url`
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
  name: 'Asset base-URL + engine-key',
  emoji: '🔗',
  run: async () => {

    // URL-1a: default layout emits a <base> tag using the absolute
    // siteRootAbs exposed by the renderer. Lock the requirement in by
    // source so a future template edit can't silently break the
    // no-trailing-slash case (e.g. serving `/search` resolves
    // `./assets/...` to `/search/assets/...` instead of root).
    {
      const layoutPath = path.resolve(import.meta.dirname, '..', '..', 'packages', 'ui', 'templates', 'layout.ejs');
      const source = fs.readFileSync(layoutPath, 'utf8');
      assert(/<base\s+href="<\%=\s*siteRootAbs\s*\%>"\s*>/.test(source),
        'URL-1a: default layout emits <base href="<%= siteRootAbs %>"> using the absolute site path');
    }

    // URL-1b: same for the summer template (the user-reported 404 path).
    {
      const layoutPath = path.resolve(import.meta.dirname, '..', '..', 'packages', 'templates', 'summer', 'templates', 'layout.ejs');
      const source = fs.readFileSync(layoutPath, 'utf8');
      assert(/<base\s+href="<\%=\s*siteRootAbs\s*\%>"\s*>/.test(source),
        'URL-1b: summer template emits <base href="<%= siteRootAbs %>"> for absolute path resolution');
      assert(/window\.DOCMD_SITE_ROOT\s*=\s*"<\%=\s*siteRootAbs\s*\%>"/.test(source),
        'URL-1b: summer template sets window.DOCMD_SITE_ROOT to siteRootAbs so JS plugins (search semantic client) resolve ./ URLs correctly');
    }

    // URL-1c: end-to-end build of a sub-project site (summer template)
    // and check that the rendered HTML contains the absolute <base> tag
    // and emits the correct template asset hrefs.
    {
      const proj = setup('asset-base-url-sub-project-summer');
      writeFile(proj, 'docs/index.md', '# Hi\n');
      writeFile(proj, 'docmd.config.json', JSON.stringify({
        title: 'URL-1c',
        src: './docs',
        out: './site',
        theme: { template: 'summer' }
      }, null, 2) + '\n');

      const result = build(proj);
      assert(result.ok, 'URL-1c: sub-project build with summer template succeeds');
      const html = fs.readFileSync(path.join(proj, 'site/index.html'), 'utf8');
      assert(/<base\s+href="\/"\s*>/.test(html),
        'URL-1c: rendered HTML contains <base href="/"> (root project) so ./assets/... resolves at any URL shape');
      assert(/href="\.\/assets\/template\/summer\.css/.test(html),
        'URL-1c: rendered HTML uses relative ./assets/template/summer.css');
      assert(/src="\.\/assets\/template\/summer\.js/.test(html),
        'URL-1c: rendered HTML uses relative ./assets/template/summer.js');
      assert(/window\.DOCMD_SITE_ROOT\s*=\s*"\/"/.test(html),
        'URL-1c: window.DOCMD_SITE_ROOT set to absolute "/"');
    }

    // URL-1d: end-to-end build of a default-template site. <base>
    // is present and the asset links are relative.
    {
      const proj = setup('asset-base-url-default-template');
      writeFile(proj, 'docs/index.md', '# Hi\n');
      writeFile(proj, 'docmd.config.json', JSON.stringify({
        title: 'URL-1d',
        src: './docs',
        out: './site'
      }, null, 2) + '\n');

      const result = build(proj);
      assert(result.ok, 'URL-1d: default-template build succeeds');
      const html = fs.readFileSync(path.join(proj, 'site/index.html'), 'utf8');
      assert(/<base\s+href="\/"\s*>/.test(html),
        'URL-1d: default-template HTML also contains <base href="/">');
    }

    // URL-1e: the workspace sub-site case — a /search project must
    // have <base href="/search/"> and DOCMD_SITE_ROOT = "/search/".
    // Without this, the search sub-site at `/search` (no slash) would
    // resolve `./assets/template/summer.css` to `/assets/...` (root)
    // instead of `/search/assets/...` (correct).
    {
      const proj = setup('asset-base-url-workspace-summer');
      fs.mkdirSync(path.join(proj, 'docs-main'), { recursive: true });
      writeFile(proj, 'docs-main/index.md', '# Main\n');
      writeFile(proj, 'docmd-main/docmd.config.json', JSON.stringify({
        title: 'URL-1e Main', src: '.', out: '../site'
      }, null, 2) + '\n');
      fs.mkdirSync(path.join(proj, 'docs-search'), { recursive: true });
      writeFile(proj, 'docs-search/index.md', '# Search\n');
      writeFile(proj, 'docmd-search/docmd.config.json', JSON.stringify({
        title: 'URL-1e Search',
        src: '.', out: '../site',
        theme: { template: 'summer' }
      }, null, 2) + '\n');
      writeFile(proj, 'docmd.config.json', JSON.stringify({
        workspace: {
          projects: [
            { title: 'main', prefix: '/', src: './docs-main' },
            { title: 'search', prefix: '/search', src: './docs-search' }
          ]
        }
      }, null, 2) + '\n');

      const result = build(proj);
      assert(result.ok, 'URL-1e: workspace build with summer sub-site succeeds');
      const searchHtml = fs.readFileSync(path.join(proj, 'site/search/index.html'), 'utf8');
      assert(/<base\s+href="\/search\/"\s*>/.test(searchHtml),
        'URL-1e: /search/ sub-site has <base href="/search/"> (absolute, not relative)');
      assert(/window\.DOCMD_SITE_ROOT\s*=\s*"\/search\/"/.test(searchHtml),
        'URL-1e: /search/ sub-site has window.DOCMD_SITE_ROOT = "/search/"');
    }

    // URL-2: `engine: "rust"` (and `engines: { rust: {...} }`) is in
    // KNOWN_KEYS so a project that requests the rust preview engine
    // does not print an "Unknown property" warning.
    {
      const proj = setup('asset-base-url-engine-key');
      writeFile(proj, 'docs/index.md', '# Hi\n');
      writeFile(proj, 'docmd.config.json', JSON.stringify({
        title: 'URL-2',
        src: './docs',
        out: './site',
        engine: 'rust'
      }, null, 2) + '\n');

      const result = build(proj);
      assert(result.ok, 'URL-2: build with engine: "rust" succeeds');
      assert(!/Unknown property "engine"/.test(result.output),
        'URL-2: no "Unknown property engine" warning (engine is in KNOWN_KEYS)');
    }

    // URL-2b: `engines` (the object form) is also in KNOWN_KEYS.
    {
      const proj = setup('asset-base-url-engines-key');
      writeFile(proj, 'docs/index.md', '# Hi\n');
      writeFile(proj, 'docmd.config.json', JSON.stringify({
        title: 'URL-2b',
        src: './docs',
        out: './site',
        engines: { rust: { /* would carry flags in a real config */ } }
      }, null, 2) + '\n');

      const result = build(proj);
      assert(result.ok, 'URL-2b: build with engines: { rust: ... } succeeds');
      assert(!/Unknown property "engines"/.test(result.output),
        'URL-2b: no "Unknown property engines" warning');
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};
