/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * Release 0.9.6 fixes regression suite:
 *   - PR #229: Auto-installed plugins/templates set rawModule = reloaded
 *   - Issue #227: External nav links render unescaped target/rel (<%-) and docmd-main.js handles quotes
 *   - Issue #226: findFilesRecursive ignores gitignored and excluded files
 *   - Issue #228: AI Assistant stream replacement protocol and synthesis fallbacks
 *   - Security: sharp and adm-zip pinned in overrides and PEER_DEPS
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
  name: 'Release 0.9.6 fixes (PR #229, #227, #226, #228, Security)',
  emoji: '🚀',
  run: async () => {
    // 1. PR #229: tryLoadAfterInstall sets rawModule = reloaded in hooks.ts
    {
      const hooksSrc = fs.readFileSync(path.resolve('packages/api/src/hooks.ts'), 'utf8');
      assert(
        hooksSrc.includes('const reloaded = await tryLoadAfterInstall') &&
        hooksSrc.includes('rawModule = reloaded;'),
        'PR #229: hooks.ts assigns rawModule = reloaded after tryLoadAfterInstall'
      );
    }

    // 2. Issue #227: Navigation EJS renders unescaped target/rel (<%-), and docmd-main.js normalizes target
    {
      const navEjs = fs.readFileSync(path.resolve('packages/ui/templates/navigation.ejs'), 'utf8');
      assert(
        navEjs.includes('<%- isExternal ? \'target="_blank" rel="noopener"\' : \'\' %>'),
        'Issue #227: navigation.ejs uses <%- to render unescaped target/rel attributes'
      );

      const mainJs = fs.readFileSync(path.resolve('packages/ui/assets/js/docmd-main.js'), 'utf8');
      assert(
        mainJs.includes("rawTarget = (link.getAttribute('target') || link.target || '').replace(/^[\"']|[\"']$/g, '')"),
        'Issue #227: docmd-main.js normalizes target attribute by stripping surrounding quotes'
      );
      assert(
        mainJs.includes("rel.includes('noopener')"),
        'Issue #227: docmd-main.js respects rel="noopener" on external links'
      );
    }

    // 3. Issue #226: findFilesRecursive respects .gitignore and config.exclude
    {
      const { findFilesRecursive } = await import('../../packages/core/dist/engine/assets.js');
      const testDir = path.resolve('tests/_tmp_ignore_test_' + Date.now());
      fs.mkdirSync(path.join(testDir, 'docs', 'drafts'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'docs', 'published'), { recursive: true });

      fs.writeFileSync(path.join(testDir, '.gitignore'), 'drafts/\n*.secret.md\n# comment\n');
      fs.writeFileSync(path.join(testDir, 'docs', 'drafts', 'wip.md'), '# Draft');
      fs.writeFileSync(path.join(testDir, 'docs', 'published', 'guide.md'), '# Guide');
      fs.writeFileSync(path.join(testDir, 'docs', 'published', 'passwords.secret.md'), '# Secret');
      fs.writeFileSync(path.join(testDir, 'docs', 'published', 'custom-excluded.md'), '# Custom Excluded');

      const foundFiles = await findFilesRecursive(
        path.join(testDir, 'docs'),
        ['.md'],
        ['custom-excluded.md']
      );
      const relativeFound = foundFiles.map(f => path.relative(testDir, f).replace(/\\/g, '/'));

      assert(relativeFound.includes('docs/published/guide.md'), 'findFilesRecursive includes non-ignored markdown file');
      assert(!relativeFound.some(f => f.includes('drafts')), 'findFilesRecursive excludes gitignored folder drafts/');
      assert(!relativeFound.some(f => f.endsWith('.secret.md')), 'findFilesRecursive excludes gitignored pattern *.secret.md');
      assert(!relativeFound.some(f => f.includes('custom-excluded.md')), 'findFilesRecursive excludes custom extraExclude pattern');

      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // 4. Issue #228: AI Assistant stream replacement metadata and synthesis fallback
    {
      const { DocmdAssistantEngine } = await import(path.resolve('../docmd-assistant/dist/index.js'));
      const engine = new DocmdAssistantEngine();
      assert(typeof engine.sendMessageStream === 'function', 'DocmdAssistantEngine exposes sendMessageStream method');

      const assistantTypes = fs.readFileSync(path.resolve('../docmd-assistant/src/types.ts'), 'utf8');
      assert(
        assistantTypes.includes('meta?: { replace?: boolean; turn?: number; isFinal?: boolean }'),
        'Issue #228: StreamCallbacks.onChunk accepts replace and turn metadata'
      );
    }

    // 5. Security: Sharp, adm-zip, and peer dependencies
    {
      const rootPkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
      assert(rootPkg.pnpm?.overrides?.sharp === '^0.35.4', 'Root package.json overrides sharp to ^0.35.4 (Alert #40)');
      assert(rootPkg.pnpm?.overrides?.['adm-zip'] === '>=0.6.0' || rootPkg.pnpm?.overrides?.['adm-zip'] === '>=0.6.1', 'Root package.json overrides adm-zip to >=0.6.0 or >=0.6.1 (Alert #39)');

      const searchPluginSrc = fs.readFileSync(path.resolve('packages/plugins/search/src/index.ts'), 'utf8');
      assert(searchPluginSrc.includes("'sharp@^0.35.4'"), 'Search plugin PEER_DEPS includes sharp@^0.35.4');
      assert(searchPluginSrc.includes("'onnxruntime-node@^1.27.0'"), 'Search plugin PEER_DEPS includes onnxruntime-node@^1.27.0');
      assert(searchPluginSrc.includes("'@huggingface/transformers@^4.2.0'"), 'Search plugin PEER_DEPS includes @huggingface/transformers@^4.2.0');
    }

    // 6. Issue #232: OKF concept description and keywords/tags resolution
    {
      const proj = setup('okf-issue-232-metadata');
      writeFile(proj, 'docs/index.md', [
        '---',
        'title: "Home Concept"',
        'description: "Overview description for OKF"',
        'keywords: ["knowledge", "manifest"]',
        'tags: ["core"]',
        '---',
        '# Home Concept\n\nContent here.'
      ].join('\n') + '\n');
      writeFile(proj, 'docs/guides/quickstart.md', [
        '---',
        'title: "Quickstart Guide"',
        'description: "Getting started with docmd"',
        'keywords: "quickstart, guides"',
        '---',
        '# Quickstart\n\nGuide content.'
      ].join('\n') + '\n');
      writeFile(proj, 'docmd.config.json', JSON.stringify({
        title: 'OKF Test',
        src: './docs',
        out: './site',
        plugins: {
          okf: {}
        }
      }, null, 2) + '\n');

      const result = build(proj);
      assert(result.ok, 'Issue #232: build succeeds with OKF plugin');

      const okfYaml = fs.readFileSync(path.join(proj, 'site/okf/okf.yaml'), 'utf8');
      assert(okfYaml.includes('description: "Overview description for OKF"'), 'Issue #232: okf.yaml concepts contain page description');
      assert(okfYaml.includes('description: "Getting started with docmd"'), 'Issue #232: okf.yaml guides contain page description');

      const bundleJson = JSON.parse(fs.readFileSync(path.join(proj, 'site/okf/_meta/bundle.json'), 'utf8'));
      const homeConcept = bundleJson.concepts.find(c => c.id === 'root');
      const quickConcept = bundleJson.concepts.find(c => c.id === 'guides-quickstart');

      assert(homeConcept && homeConcept.description === 'Overview description for OKF', 'Issue #232: bundle.json has concept description');
      assert(homeConcept && homeConcept.tags.includes('core') && homeConcept.tags.includes('knowledge'), 'Issue #232: tags merged from both tags and keywords');
      assert(quickConcept && quickConcept.tags.includes('quickstart') && quickConcept.tags.includes('guides'), 'Issue #232: tags parsed from comma-separated keywords string');
    }
  }
});

export const results = {
  get passed() { return passed; },
  get failed() { return failed; },
  get failures() { return failures; }
};
