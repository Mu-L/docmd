/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * Mega Integration Test
 *
 * One project that exercises EVERY docmd feature at once:
 *   - workspaces (main + api sub-projects)
 *   - i18n (en default, fr secondary)
 *   - versioning (v2 default, v1 fallback)
 *   - plugins (math, sitemap, llms, seo, pwa, search, mermaid)
 *   - navigation overrides (api project)
 *   - custom assets
 *
 * Replaces the legacy failsafe's "Mega Integration Test (V5.0)" section
 * so the work lives once and runs as part of the categorised suite.
 *
 * Run: `node tests/runner.js`
 * --------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'path';
import {
  DOCMD,
  setup,
  writeFile,
  build,
  readSite,
  runTestFile
} from './shared.js';

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

function existsOnDisk(root, relPath) {
  return fs.existsSync(path.join(root, relPath));
}

export const test = runTestFile({
  name: 'Mega integration (workspaces + i18n + versioning + plugins)',
  emoji: '🏗️',
  run: () => {
    const dir = setup('mega-integration');
    fs.mkdirSync(path.join(dir, 'main/docs/en'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'main/docs/fr'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'main/docs-v1/en'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'main/assets/css'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'api/docs/en'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'api/assets'), { recursive: true });

    writeFile(
      dir,
      'main/docmd.config.js',
      `export default {
        title: 'Mega Docs',
        url: 'https://example.com',
        src: 'docs',
        out: 'site',
        plugins: { math: {}, sitemap: {}, llms: {}, seo: {}, pwa: {} },
        versions: { current: 'v2', all: [
          { id: 'v2', dir: 'docs', label: 'v2.0' },
          { id: 'v1', dir: 'docs-v1', label: 'v1.0' }
        ]},
        i18n: { default: 'en', locales: [
          { id: 'en', label: 'English' },
          { id: 'fr', label: 'Français' }
        ]}
      }`
    );

    writeFile(
      dir,
      'api/docmd.config.js',
      `export default {
        title: 'API Reference',
        url: 'https://example.com/api',
        src: 'docs',
        navigation: [
          { title: 'Home', path: '/' },
          { title: 'Endpoints', path: '/endpoints' }
        ],
        plugins: { search: {}, mermaid: {} }
      }`
    );

    writeFile(
      dir,
      'docmd.config.js',
      `export default {
        workspace: {
          projects: [
            { prefix: '/', src: 'main' },
            { prefix: '/api', src: 'api' }
          ]
        }
      }`
    );

    writeFile(
      dir,
      'main/docs/en/index.md',
      `---
title: Home
description: Welcome to Mega Docs
---
# Welcome
This is the home page.`
    );

    writeFile(
      dir,
      'main/docs/en/guide.md',
      `---
title: Guide
description: User guide
---
# Guide
## Getting Started
Follow these steps.`
    );

    writeFile(
      dir,
      'main/docs/en/math.md',
      `---
title: Math
---
# Math Test
Inline math: $E = mc^2$
Block math:
$$
\\\\int_{-\\\\infty}^{\\\\infty} e^{-x^2} dx = \\\\sqrt{\\\\pi}
$$`
    );

    writeFile(
      dir,
      'main/docs/en/mermaid.md',
      `---
title: Diagrams
---
# Diagrams
\`\`\`mermaid
graph TD
  A[Start] --> B[End]
\`\`\``
    );

    writeFile(
      dir,
      'main/docs/fr/index.md',
      `# Accueil
Bienvenue!`
    );

    writeFile(
      dir,
      'main/docs-v1/en/index.md',
      `# v1 Home
Old version.`
    );

    writeFile(
      dir,
      'api/docs/en/index.md',
      `---
title: API Index
---
# API Reference
## Endpoints
GET /users`
    );

    writeFile(
      dir,
      'api/docs/en/endpoints.md',
      `---
title: Endpoints
---
# Endpoints
GET /users
POST /users`
    );

    writeFile(
      dir,
      'main/assets/css/custom.css',
      `.mega{color:#0ea5e9}`
    );

    const ok = build(dir);
    assert(ok, 'mega integration build');

    const site = path.join(dir, 'site');

    // Main project
    assert(existsOnDisk(site, 'index.html'), 'Main project root index');
    assert(
      existsOnDisk(site, 'guide/index.html') || existsOnDisk(site, 'guide.html'),
      'Main project guide page'
    );

    // API project — auto-detected i18n from `api/docs/en/` folder structure,
    // so the index lives under /api/en/ even though the api project has no
    // explicit i18n config.
    assert(existsOnDisk(site, 'api/en/index.html'), 'API project index');
    assert(
      existsOnDisk(site, 'api/en/endpoints/index.html') ||
        existsOnDisk(site, 'api/en/endpoints.html'),
      'API endpoints page'
    );

    // French locale
    assert(existsOnDisk(site, 'fr/index.html'), 'French locale index');
    assert(
      existsOnDisk(site, 'fr/guide/index.html') ||
        existsOnDisk(site, 'fr/guide.html'),
      'French locale guide'
    );

    // Versioning
    assert(
      existsOnDisk(site, 'v1/index.html') || existsOnDisk(site, '1.0/index.html'),
      'v1 index'
    );
    const v1HasGuide =
      existsOnDisk(site, 'v1/guide/index.html') ||
      existsOnDisk(site, 'v1/guide.html') ||
      existsOnDisk(site, '1.0/guide/index.html');
    assert(!v1HasGuide, 'v1 guide fallback (should NOT exist in v1)');

    // Generated artefacts
    assert(existsOnDisk(site, 'search-index.json'), 'Search index generated');
    assert(existsOnDisk(site, 'sitemap.xml'), 'Sitemap generated');
    assert(existsOnDisk(site, 'llms.txt'), 'LLMs txt generated');
    assert(existsOnDisk(site, 'llms-full.txt'), 'LLMs full txt generated');
    assert(
      existsOnDisk(site, 'manifest.webmanifest') ||
        existsOnDisk(site, 'manifest.json'),
      'PWA manifest generated'
    );
    assert(
      existsOnDisk(site, 'service-worker.js') ||
        existsOnDisk(site, 'sw.js'),
      'Service worker generated'
    );

    // Search index content — the MiniSearch export is an object with a
    // `documentCount` field, not a flat array.
    const searchIdx = readSite(dir, 'search-index.json');
    if (searchIdx) {
      const parsed = JSON.parse(searchIdx);
      const count =
        parsed.documentCount ??
        (Array.isArray(parsed) ? parsed.length : null) ??
        parsed.docs?.length ??
        parsed.documents?.length ??
        0;
      assert(count > 0, 'Search index has content');
    } else {
      assert(false, 'Search index has content');
    }

    // Sitemap URLs
    const sitemap = readSite(dir, 'sitemap.xml');
    if (sitemap) {
      assert(sitemap.includes('example.com'), 'Sitemap has root URL');
      assert(
        sitemap.includes('/fr/') || sitemap.includes('fr/'),
        'Sitemap has French URL'
      );
    } else {
      assert(false, 'Sitemap has root URL');
      assert(false, 'Sitemap has French URL');
    }

    // LLMS content
    const llms = readSite(dir, 'llms.txt');
    assert(llms && llms.includes('[') && llms.includes(']('), 'LLMs txt has links');

    // Math page
    const mathPage = readSite(dir, 'math/index.html') || readSite(dir, 'math.html');
    assert(mathPage && /math|equation|inline/i.test(mathPage), 'Math page has math content');

    // Mermaid page
    const mermaidPage =
      readSite(dir, 'mermaid/index.html') || readSite(dir, 'mermaid.html');
    assert(
      mermaidPage && /mermaid|svg/i.test(mermaidPage),
      'Mermaid page has diagram'
    );

    // SEO meta tags
    const indexPage = readSite(dir, 'index.html');
    assert(
      indexPage && /<meta\s+name=["']description["']/i.test(indexPage),
      'SEO meta tags present'
    );

    // Custom assets
    assert(existsOnDisk(site, 'assets/css/custom.css'), 'Custom assets copied');
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return [...failures]; }
};