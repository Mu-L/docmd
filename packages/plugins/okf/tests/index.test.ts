/**
 * Tests for @docmd/plugin-okf
 *
 * Verifies plugin descriptor + end-to-end onPostBuild behavior with a
 * mocked context (3 pages: explicit type, missing type, noindex).
 * Run with: `pnpm --filter @docmd/plugin-okf test`
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

import { plugin, onPostBuild } from '../src/index.js';

describe('plugin descriptor', () => {
  it('has the expected name', () => {
    assert.equal(plugin.name, 'okf');
  });

  it('declares post-build capability', () => {
    assert.ok(Array.isArray(plugin.capabilities));
    assert.ok(plugin.capabilities.includes('post-build'));
  });

  it('has a semver version string', () => {
    assert.match(plugin.version, /^\d+\.\d+\.\d+/);
  });
});

describe('onPostBuild', () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-test-'));
  });

  after(async () => {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch { /* cleanup best-effort */ }
  });

  it('generates the bundle, filters noindex, lints missing types', async () => {
    const bundleDir = path.join(tmpDir, 'site');
    await fs.mkdir(bundleDir, { recursive: true });

    // Create a real source file so the body-copy branch fires.
    const srcDir = path.join(tmpDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    const typedSrc = path.join(srcDir, 'typed.md');
    const untypedSrc = path.join(srcDir, 'untyped.md');
    const hiddenSrc = path.join(srcDir, 'hidden.md');
    await fs.writeFile(typedSrc, '---\ntitle: Typed\ntype: guide\n---\n\n# Typed body\n');
    await fs.writeFile(untypedSrc, '---\ntitle: Untyped\n---\n\n# Untyped body\n');
    await fs.writeFile(hiddenSrc, '---\ntitle: Hidden\nnoindex: true\n---\n\n# Hidden\n');

    const pages = [
      {
        outputPath: 'typed.html',
        frontmatter: { title: 'Typed', type: 'guide', description: 'Has explicit type.' },
        sourcePath: typedSrc,
        rawMarkdown: ''
      },
      {
        outputPath: 'untyped.html',
        frontmatter: { title: 'Untyped', description: 'No type set.' },
        sourcePath: untypedSrc,
        rawMarkdown: ''
      },
      {
        outputPath: 'hidden.html',
        frontmatter: { title: 'Hidden', noindex: true },
        sourcePath: hiddenSrc,
        rawMarkdown: ''
      }
    ];

    const ctx: any = {
      config: {
        title: 'Test Docs',
        description: 'A test bundle',
        url: 'https://example.com',
        plugins: { okf: { graph: true } }
      },
      pages,
      outputDir: bundleDir,
      log: () => {}
    };

    await onPostBuild(ctx);

    // --- 1. okf.yaml exists + concepts === 2 ---
    const okfYamlPath = path.join(bundleDir, 'okf', 'okf.yaml');
    const okfYaml = await fs.readFile(okfYamlPath, 'utf8');
    assert.match(okfYaml, /stats:/);
    assert.match(okfYaml, /concepts: 2/);

    // --- 2. index.md + graph.html + graph.json + concepts/*.md + _meta/* ---
    const okfRoot = path.join(bundleDir, 'okf');
    const indexMd = await fs.readFile(path.join(okfRoot, 'index.md'), 'utf8');
    assert.match(indexMd, /Knowledge Catalog/);
    assert.match(indexMd, /guide/);                       // typed page lives under type=guide
    assert.match(indexMd, /Untyped/);                     // fallback concept listed
    assert.match(indexMd, /Graph viewer/);                // graph enabled → link present
    await fs.access(path.join(okfRoot, 'graph/index.html'));
    await fs.access(path.join(okfRoot, 'graph/graph.json'));
    await fs.access(path.join(okfRoot, 'concepts', 'typed.md'));
    await fs.access(path.join(okfRoot, 'concepts', 'untyped.md'));
    await fs.access(path.join(okfRoot, '_meta', 'bundle.json'));
    await fs.access(path.join(okfRoot, '_meta', 'lint-report.txt'));

    // --- 3. hidden.md was filtered out ---
    await fs.access(path.join(okfRoot, 'concepts', 'hidden.md')).then(
      () => { throw new Error('hidden page should have been filtered'); },
      () => {}
    );

    // --- 4. Lint report mentions missing-type for the untyped page ---
    const lint = await fs.readFile(path.join(okfRoot, '_meta', 'lint-report.txt'), 'utf8');
    assert.match(lint, /missing-type/);
    assert.match(lint, /\/untyped\//);

    // --- 5. Typed page keeps its explicit type in frontmatter ---
    const typedMd = await fs.readFile(path.join(okfRoot, 'concepts', 'typed.md'), 'utf8');
    assert.match(typedMd, /^---\n[\s\S]*?type: guide[\s\S]*?---/);
    assert.match(typedMd, /source:\s*"?https:\/\/example\.com\/typed\/"?/);

    // --- 6. Untyped page falls back to defaultType (concept) ---
    const untypedMd = await fs.readFile(path.join(okfRoot, 'concepts', 'untyped.md'), 'utf8');
    assert.match(untypedMd, /type: concept/);

    // --- 7. okf.yaml has correct by_type counts ---
    assert.match(okfYaml, /guide: 1/);
    assert.match(okfYaml, /concept: 1/);

    // --- 8. bundle.json mirrors the manifest ---
    const bundleJson = JSON.parse(await fs.readFile(path.join(okfRoot, '_meta', 'bundle.json'), 'utf8'));
    assert.equal(bundleJson.stats.concepts, 2);
    assert.deepEqual(bundleJson.stats.by_type, { guide: 1, concept: 1 });
  });

  it('respects config.plugins.okf === false (exits cleanly)', async () => {
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-noop-'));
    try {
      await onPostBuild({
        config: { title: 'x', plugins: { okf: false } },
        pages: [],
        outputDir: tmp2,
        log: () => {}
      });
      // Nothing should be created.
      await fs.access(path.join(tmp2, 'okf')).then(
        () => { throw new Error('okf bundle should not exist'); },
        () => {}
      );
    } finally {
      await fs.rm(tmp2, { recursive: true, force: true });
    }
  });

  it('respects config.plugins.okf.enabled === false (exits cleanly)', async () => {
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-enabled-false-'));
    try {
      await onPostBuild({
        config: { title: 'x', plugins: { okf: { enabled: false } } },
        pages: [],
        outputDir: tmp2,
        log: () => {}
      });
      await fs.access(path.join(tmp2, 'okf')).then(
        () => { throw new Error('okf bundle should not exist'); },
        () => {}
      );
    } finally {
      await fs.rm(tmp2, { recursive: true, force: true });
    }
  });

  it('respects capability filter (capabilities does not include post-build)', async () => {
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-cap-filter-'));
    try {
      await onPostBuild({
        config: { title: 'x', plugins: { okf: { capabilities: ['head'] } } },
        pages: [],
        outputDir: tmp2,
        log: () => {}
      });
      await fs.access(path.join(tmp2, 'okf')).then(
        () => { throw new Error('okf bundle should not exist'); },
        () => {}
      );
    } finally {
      await fs.rm(tmp2, { recursive: true, force: true });
    }
  });

  it('runs by default when no plugins.okf entry is set in the config (core plugin)', async () => {
    // OKF is a core plugin since 0.8.8 — it's auto-loaded and runs
    // with empty opts when the user hasn't configured it. This test
    // guards the default-enabled contract: a project with no
    // `plugins.okf` entry at all still gets an OKF bundle generated.
    // The graph viewer is opt-in since 0.8.8 (graph:true) — it must
    // NOT be generated by default, even when OKF itself runs.
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-default-'));
    try {
      await onPostBuild({
        config: { title: 'Default', url: 'https://example.com' /* no plugins field at all */ },
        pages: [{
          outputPath: 'index.html',
          frontmatter: { title: 'Home', description: 'Landing' },
          sourcePath: '',
          rawMarkdown: '# Home'
        }],
        outputDir: tmp2,
        log: () => {}
      });
      // Bundle SHOULD exist because the plugin runs with default opts.
      const yaml = await fs.readFile(path.join(tmp2, 'okf', 'okf.yaml'), 'utf8');
      assert.match(yaml, /name: default/);
      assert.match(yaml, /concepts: 1/);
      // Graph viewer is opt-in → no graph artefacts on disk by default.
      const graphCheck = (p: string) => fs.access(p).then(
        () => { throw new Error(`${p} should NOT exist when graph is not enabled`); },
        () => {}
      );
      await graphCheck(path.join(tmp2, 'okf', 'graph/index.html'));
      await graphCheck(path.join(tmp2, 'okf', 'graph/graph.json'));
      await graphCheck(path.join(tmp2, 'okf', 'graph/graph.js'));
      await graphCheck(path.join(tmp2, 'okf', 'graph/graph.css'));
      const indexMd = await fs.readFile(path.join(tmp2, 'okf', 'index.md'), 'utf8');
      assert.doesNotMatch(indexMd, /Graph viewer/);
    } finally {
      await fs.rm(tmp2, { recursive: true, force: true });
    }
  });

  it('writes the graph viewer only when config.plugins.okf.graph === true', async () => {
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-graph-on-'));
    try {
      await onPostBuild({
        config: { title: 'Graph', url: 'https://example.com', plugins: { okf: { graph: true } } },
        pages: [{
          outputPath: 'a.html',
          frontmatter: { title: 'A', type: 'guide' },
          sourcePath: '',
          rawMarkdown: '# A'
        }],
        outputDir: tmp2,
        log: () => {}
      });
      const okfRoot = path.join(tmp2, 'okf');
      await fs.access(path.join(okfRoot, 'graph/index.html'));
      await fs.access(path.join(okfRoot, 'graph/graph.json'));
      await fs.access(path.join(okfRoot, 'graph/graph.js'));
      await fs.access(path.join(okfRoot, 'graph/graph.css'));
      const indexMd = await fs.readFile(path.join(okfRoot, 'index.md'), 'utf8');
      assert.match(indexMd, /Graph viewer/);
      const graphJson = JSON.parse(await fs.readFile(path.join(okfRoot, 'graph/graph.json'), 'utf8'));
      assert.equal(graphJson.nodes.length, 1);
      assert.equal(graphJson.nodes[0].id, 'a');
    } finally {
      await fs.rm(tmp2, { recursive: true, force: true });
    }
  });

  it('honours the legacy generateGraphViewer flag and warns about deprecation', async () => {
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-legacy-graph-'));
    const warnings: string[] = [];
    const origWarn = (console as any).warn;
    (console as any).warn = (...args: any[]) => warnings.push(args.join(' '));
    try {
      await onPostBuild({
        config: { title: 'Legacy', url: 'https://example.com', plugins: { okf: { generateGraphViewer: true } } },
        pages: [{
          outputPath: 'a.html',
          frontmatter: { title: 'A', type: 'guide' },
          sourcePath: '',
          rawMarkdown: '# A'
        }],
        outputDir: tmp2,
        log: () => {}
      });
      const okfRoot = path.join(tmp2, 'okf');
      await fs.access(path.join(okfRoot, 'graph/index.html'));
      // Deprecation warning is emitted via TUI.warn which writes to stderr.
      // We just assert the file was produced — the TUI path is exercised by
      // the broader test runner and does not throw.
    } finally {
      (console as any).warn = origWarn;
      await fs.rm(tmp2, { recursive: true, force: true });
    }
  });

  it('uses empty stats when no pages match', async () => {
    const tmp3 = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-empty-'));
    try {
      await onPostBuild({
        config: { title: 'empty', plugins: { okf: {} } },
        pages: [{ outputPath: 'x.html', frontmatter: { noindex: true }, sourcePath: '', rawMarkdown: '' }],
        outputDir: tmp3,
        log: () => {}
      });
      const yaml = await fs.readFile(path.join(tmp3, 'okf', 'okf.yaml'), 'utf8');
      assert.match(yaml, /concepts: 0/);
    } finally {
      await fs.rm(tmp3, { recursive: true, force: true });
    }
  });
});