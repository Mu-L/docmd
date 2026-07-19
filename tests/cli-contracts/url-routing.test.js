/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * URL Routing integration tests
 * 
 * Verifies:
 *   1. CSS rule for no-toc in docmd-main.css and summer.css.
 *   2. Page-relative links in workspace subdirectory pages resolve to the correct path.
 *   3. Custom asset paths and links in Markdown under subpath builds (e.g. GitHub Pages).
 * 
 * Run: `node tests/runner.js --only=url-routing`
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

function extractHrefsAndSrcs(html) {
  const hrefs = [];
  const srcs = [];
  const hrefRe = /href=["']([^"']*)["']/gi;
  const srcRe = /src=["']([^"']*)["']/gi;
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    hrefs.push(m[1]);
  }
  while ((m = srcRe.exec(html)) !== null) {
    srcs.push(m[1]);
  }
  return { hrefs, srcs };
}

export const test = runTestFile({
  name: 'URL routing architecture stability',
  emoji: '🗺️',
  run: () => {
    const rootDir = path.resolve(import.meta.dirname, '..', '..');

    // 1. Dynamic TOC Class CSS support
    {
      const docmdMainCssPath = path.join(rootDir, 'packages/ui/assets/css/docmd-main.css');
      const docmdMainCss = fs.readFileSync(docmdMainCssPath, 'utf8');
      assert(docmdMainCss.includes('.no-toc .toc-sidebar'), 'TOC CSS: docmd-main.css has .no-toc .toc-sidebar rule');

      const docmdMainJsPath = path.join(rootDir, 'packages/ui/assets/js/docmd-main.js');
      const docmdMainJs = fs.readFileSync(docmdMainJsPath, 'utf8');
      assert(docmdMainJs.includes('function updateTocClass()'), 'TOC JS: docmd-main.js has updateTocClass defined');
      assert(docmdMainJs.includes('updateTocClass()'), 'TOC JS: docmd-main.js calls updateTocClass');
    }

    // 2. Page-relative links in workspace project subdirectory resolve correctly (#184)
    {
      const dir = setup('url-routing-workspace-nested-links');
      
      // Setup workspace structure
      fs.mkdirSync(path.join(dir, 'docs-main'), { recursive: true });
      writeFile(dir, 'docs-main/index.md', '# Main Home\n');
      writeFile(dir, 'docs-main/docmd.config.json', JSON.stringify({
        title: 'Main',
        src: '.',
        out: '../site'
      }) + '\n');

      fs.mkdirSync(path.join(dir, 'docs-proj1/nested/subdir'), { recursive: true });
      writeFile(dir, 'docs-proj1/nested/subdir/page-a.md', '# Page A\n\n[link to page B](page-b.md)\n');
      writeFile(dir, 'docs-proj1/nested/subdir/page-b.md', '# Page B\n');
      
      writeFile(dir, 'docs-proj1/docmd.config.json', JSON.stringify({
        title: 'Proj1',
        src: '.',
        out: '../site'
      }) + '\n');

      writeFile(dir, 'docmd.config.json', JSON.stringify({
        workspace: {
          projects: [
            { title: 'main', prefix: '/', src: './docs-main' },
            { title: 'proj1', prefix: '/proj1', src: './docs-proj1' }
          ]
        }
      }) + '\n');


      execSync(`node ${DOCMD} build`, { cwd: dir, stdio: 'pipe' });

      const pageAHtml = fs.readFileSync(path.join(dir, 'site/proj1/nested/subdir/page-a/index.html'), 'utf8');
      const { hrefs } = extractHrefsAndSrcs(pageAHtml);

      // In workspace build:
      // The base is '/proj1/'
      // From '/proj1/nested/subdir/page-a/', the link 'page-b.md' is a relative link (no leading slash).
      // Under url-utils logic, it should resolve to '/proj1/nested/subdir/page-b/' or relative '../page-b/'.
      // If we use buildRelativeUrl/buildContextualUrl with context.pathname, it rewrites to '/proj1/nested/subdir/page-b/'.
      const targetLink = hrefs.find(h => h.includes('page-b'));
      assert(targetLink === '/proj1/nested/subdir/page-b/', `Workspace nested link: relative link resolves correctly to absolute subpath (got: ${targetLink})`);
    }

    // 3. Custom assets and links under subpath builds (e.g. GitHub Pages) (#175)
    {
      const dir = setup('url-routing-subpath-assets');
      
      writeFile(dir, 'docs/index.md', '# Home\n\n![custom image](/assets/img.png)\n[custom link](/guide/page.md)\n');
      fs.mkdirSync(path.join(dir, 'docs/guide'), { recursive: true });
      writeFile(dir, 'docs/guide/page.md', '# Guide Page\n');

      writeFile(dir, 'docmd.config.json', JSON.stringify({
        title: 'Subpath Site',
        src: './docs',
        out: './site',
        url: 'https://mgks.github.io/some-project'
      }) + '\n');

      execSync(`node ${DOCMD} build`, { cwd: dir, stdio: 'pipe' });

      const indexHtml = fs.readFileSync(path.join(dir, 'site/index.html'), 'utf8');
      const { hrefs, srcs } = extractHrefsAndSrcs(indexHtml);

      // Verify <base href="/some-project/"> is emitted
      assert(indexHtml.includes('<base href="/some-project/">'), 'Subpath build: base tag matches the project subpath');

      // Verify custom image resolves with the subpath prefix
      const imgsrc = srcs.find(s => s.includes('img.png'));
      assert(imgsrc === '/some-project/assets/img.png', `Subpath build: custom root-relative image is rewritten with subpath prefix (got: ${imgsrc})`);

      // Verify custom link resolves with the subpath prefix
      const targetLink = hrefs.find(h => h.includes('guide'));
      assert(targetLink === '/some-project/guide/page/', `Subpath build: custom root-relative link is rewritten with subpath prefix (got: ${targetLink})`);
    }

    // 4. Auto navigation clickable folders and index deduplication (#184 / i18n auto nav)
    {
      const dir = setup('url-routing-auto-nav-folders');
      writeFile(dir, 'docs/index.md', '# Home\n');
      
      fs.mkdirSync(path.join(dir, 'docs/de'), { recursive: true });
      writeFile(dir, 'docs/de/index.md', '# De Home\n');
      writeFile(dir, 'docs/de/page-a.md', '# De Page A\n');

      fs.mkdirSync(path.join(dir, 'docs/fr'), { recursive: true });
      writeFile(dir, 'docs/fr/index.md', '# Fr Home\n');

      writeFile(dir, 'docmd.config.json', JSON.stringify({
        title: 'Auto Nav Test',
        src: './docs',
        out: './site'
      }) + '\n');

      execSync(`node ${DOCMD} build`, { cwd: dir, stdio: 'pipe' });

      const indexHtml = fs.readFileSync(path.join(dir, 'site/index.html'), 'utf8');

      // 1. The folder 'de' has other pages besides index.md.
      // So 'De' is collapsible and has path pointing to './de/'
      assert(indexHtml.includes('href="./de/"') && indexHtml.includes('collapsible'), 
        'Auto Nav: Folder "de" with children is collapsible and has a clickable link to "./de/"');

      // 2. The folder 'de' should not contain a redundant child link to 'De Home' or './de/' under its submenu
      const deSubmenuStart = indexHtml.indexOf('href="./de/"');
      const deSubmenuEnd = indexHtml.indexOf('</ul>', deSubmenuStart);
      const deSubmenu = indexHtml.slice(deSubmenuStart, deSubmenuEnd);
      // It should not have a nested <a> pointing to "./de/" inside the submenu
      const occurrenceCount = (deSubmenu.match(/href="\.\/de\/"/g) || []).length;
      assert(occurrenceCount === 1, 'Auto Nav: Folder "de" does not contain a redundant child link to its own index page');

      // 3. The folder 'fr' only has index.md. So it is rendered as a simple, non-collapsible link pointing to './fr/'
      // Find the list item containing './fr/' and verify it doesn't have collapsible class
      const frIndex = indexHtml.indexOf('href="./fr/"');
      const frLiStart = indexHtml.lastIndexOf('<li', frIndex);
      const frLiEnd = indexHtml.indexOf('>', frLiStart);
      const frLiTag = indexHtml.slice(frLiStart, frLiEnd);
      assert(!frLiTag.includes('collapsible'), 'Auto Nav: Folder "fr" with only an index page is rendered as a simple non-collapsible link');
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};