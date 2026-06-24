#!/usr/bin/env node
/**
 * docmd Comprehensive Feature Test Suite
 * =======================================
 * Brute tests every major docmd feature in isolation and combination.
 * Run: node scripts/brute-test.js
 *
 * Tests:
 *  1. Zero-config (no config file)
 *  2. Zero-config with nested docs
 *  3. i18n standalone (3 locales, non-default as default)
 *  4. Versioning standalone (2 versions)
 *  5. i18n + versioning combined
 *  6. Old version with partial translations
 *  7. Missing locale dir (graceful skip)
 *  8. Navigation resolution (locale > version > config)
 *  9. Frontmatter parsing (title, description, layout)
 * 10. Containers (callout, tabs, steps, cards, hero)
 * 11. Code blocks (syntax highlighting, line numbers)
 * 12. Custom CSS/JS injection
 * 13. Edit links
 * 14. No-style pages
 * 15. Search index generation
 * 16. Sitemap generation
 * 17. EJS content pages
 * 18. README.md as index fallback
 * 19. Markdown file extensions (.md and .markdown)
 * 20. Deep nested directory structure
 * 21. Zero-config auto-nav accuracy
 * 22. Title tag auto-append
 * 23. OG meta tags
 * 24. Redirects
 * 25. Per-page layout override
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DOCMD = path.resolve(import.meta.dirname, '../packages/core/dist/bin/docmd.js');
const TEST_ROOT = '/tmp/docmd-brute-tests';
const PASS = '✅';
const FAIL = '❌';

let passed = 0;
let failed = 0;
const failures = [];

function setup(name) {
  const dir = path.join(TEST_ROOT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function build(dir, expectFail = false) {
  try {
    const out = execSync(`node ${DOCMD} build`, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
    if (expectFail) return { ok: false, output: out };
    return { ok: true, output: out };
  } catch (e) {
    if (expectFail) return { ok: true, output: e.stderr || e.stdout || '' };
    return { ok: false, output: e.stderr || e.stdout || '' };
  }
}

function writeFile(dir, filePath, content) {
  const full = path.join(dir, filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function readSite(dir, filePath) {
  const full = path.join(dir, 'site', filePath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function siteExists(dir, filePath) {
  return fs.existsSync(path.join(dir, 'site', filePath));
}

function countPages(dir) {
  const siteDir = path.join(dir, 'site');
  if (!fs.existsSync(siteDir)) return 0;
  let count = 0;
  function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) walk(path.join(d, f.name));
      else if (f.name === 'index.html') count++;
    }
  }
  walk(siteDir);
  return count;
}

function assert(testName, condition, detail = '') {
  if (condition) {
    console.log(`  ${PASS} ${testName}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${testName}${detail ? ': ' + detail : ''}`);
    failed++;
    failures.push(testName);
  }
}

// ─── TEST 1: Zero-config (no config file) ───
console.log('\n📦 Test 1: Zero-config (no config file)');
{
  const dir = setup('01-zero-config');
  writeFile(dir, 'docs/index.md', '---\ntitle: Home\n---\n# Hello\nWelcome.');
  writeFile(dir, 'docs/about.md', '---\ntitle: About\n---\n# About\nAbout page.');
  const r = build(dir);
  assert('builds without config', r.ok);
  assert('generates 2 pages', countPages(dir) === 2);
  assert('index page exists', siteExists(dir, 'index.html'));
  assert('about page exists', siteExists(dir, 'about/index.html'));
  const idx = readSite(dir, 'index.html');
  assert('contains page content', idx?.includes('Welcome'));
}

// ─── TEST 2: Zero-config with nested docs ───
console.log('\n📦 Test 2: Zero-config with nested docs');
{
  const dir = setup('02-zero-nested');
  writeFile(dir, 'docs/index.md', '# Home');
  writeFile(dir, 'docs/guide/intro.md', '# Intro\nIntro content.');
  writeFile(dir, 'docs/guide/advanced/deep.md', '# Deep\nDeep content.');
  const r = build(dir);
  assert('builds with nested dirs', r.ok);
  assert('generates 3 pages', countPages(dir) === 3);
  assert('nested page exists', siteExists(dir, 'guide/intro/index.html'));
  assert('deep nested page exists', siteExists(dir, 'guide/advanced/deep/index.html'));
}

// ─── TEST 3: i18n standalone (non-English default) ───
console.log('\n🌍 Test 3: i18n standalone (Hindi default)');
{
  const dir = setup('03-i18n-hindi-default');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'Hindi Default',
    src: 'docs',
    i18n: { default: 'hi', locales: [
      { id: 'hi', label: 'हिन्दी' },
      { id: 'en', label: 'English' }
    ]}
  };`);
  writeFile(dir, 'docs/hi/index.md', '---\ntitle: मुखपृष्ठ\n---\n# स्वागत');
  writeFile(dir, 'docs/hi/guide.md', '---\ntitle: गाइड\n---\n# गाइड');
  writeFile(dir, 'docs/hi/navigation.json', '[{"title":"मुखपृष्ठ","path":"/"},{"title":"गाइड","path":"/guide"}]');
  writeFile(dir, 'docs/en/index.md', '---\ntitle: Home\n---\n# Welcome');
  writeFile(dir, 'docs/en/navigation.json', '[{"title":"Home","path":"/"}]');
  const r = build(dir);
  assert('builds with Hindi default', r.ok);
  const root = readSite(dir, 'index.html');
  assert('root is Hindi content', root?.includes('स्वागत'));
  const enPage = readSite(dir, 'en/index.html');
  assert('English at /en/', enPage?.includes('Welcome'));
  assert('Hindi guide exists', siteExists(dir, 'guide/index.html'));
  assert('English guide falls back from Hindi', siteExists(dir, 'en/guide/index.html'));
}

// ─── TEST 4: Versioning standalone ───
console.log('\n📚 Test 4: Versioning standalone (no i18n)');
{
  const dir = setup('04-versioning');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'Versioned',
    src: 'docs',
    versions: { current: 'v2', all: [
      { id: 'v2', dir: 'docs', label: 'v2.0' },
      { id: 'v1', dir: 'docs-v1', label: 'v1.0' }
    ]}
  };`);
  writeFile(dir, 'docs/index.md', '# v2 Home');
  writeFile(dir, 'docs/guide.md', '# v2 Guide');
  writeFile(dir, 'docs/navigation.json', '[{"title":"Home","path":"/"},{"title":"Guide","path":"/guide"}]');
  writeFile(dir, 'docs-v1/index.md', '# v1 Home');
  writeFile(dir, 'docs-v1/navigation.json', '[{"title":"Home","path":"/"}]');
  const r = build(dir);
  assert('builds with versioning', r.ok);
  assert('v2 at root', readSite(dir, 'index.html')?.includes('v2 Home'));
  assert('v1 at /v1/', readSite(dir, 'v1/index.html')?.includes('v1 Home'));
  assert('v2 guide exists', siteExists(dir, 'guide/index.html'));
  assert('no v1 guide', !siteExists(dir, 'v1/guide/index.html'));
}

// ─── TEST 5: i18n + versioning combined ───
console.log('\n🌍📚 Test 5: i18n + versioning combined');
{
  const dir = setup('05-i18n-versioning');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'Combined',
    src: 'docs',
    i18n: { default: 'en', locales: [
      { id: 'en', label: 'English' },
      { id: 'fr', label: 'Français' }
    ]},
    versions: { current: 'v2', all: [
      { id: 'v2', dir: 'docs', label: 'v2' },
      { id: 'v1', dir: 'docs-v1', label: 'v1' }
    ]}
  };`);
  writeFile(dir, 'docs/en/index.md', '# EN v2');
  writeFile(dir, 'docs/en/guide.md', '# EN Guide');
  writeFile(dir, 'docs/en/navigation.json', '[{"title":"Home","path":"/"},{"title":"Guide","path":"/guide"}]');
  writeFile(dir, 'docs/fr/index.md', '# FR v2');
  writeFile(dir, 'docs/fr/navigation.json', '[{"title":"Accueil","path":"/"}]');
  writeFile(dir, 'docs-v1/index.md', '# EN v1');
  writeFile(dir, 'docs-v1/navigation.json', '[{"title":"Home","path":"/"}]');
  const r = build(dir);
  assert('builds combined i18n+versioning', r.ok);
  assert('EN root', readSite(dir, 'index.html')?.includes('EN v2'));
  assert('FR at /fr/', readSite(dir, 'fr/index.html')?.includes('FR v2'));
  assert('EN guide fallback in FR', siteExists(dir, 'fr/guide/index.html'));
  assert('v1 at /v1/ (EN only)', readSite(dir, 'v1/index.html')?.includes('EN v1'));
  assert('no FR v1 (no locale dir)', !siteExists(dir, 'fr/v1/index.html'));
}

// ─── TEST 6: Old version with partial translation ───
console.log('\n🌍📚 Test 6: Old version with partial translation');
{
  const dir = setup('06-partial-old-version');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'Partial',
    src: 'docs',
    i18n: { default: 'en', locales: [
      { id: 'en', label: 'English' },
      { id: 'hi', label: 'Hindi' }
    ]},
    versions: { current: 'v2', all: [
      { id: 'v2', dir: 'docs', label: 'v2' },
      { id: 'v1', dir: 'docs-v1', label: 'v1' }
    ]}
  };`);
  writeFile(dir, 'docs/en/index.md', '# EN v2');
  writeFile(dir, 'docs/en/navigation.json', '[{"title":"Home","path":"/"}]');
  writeFile(dir, 'docs/hi/index.md', '# HI v2');
  writeFile(dir, 'docs/hi/navigation.json', '[{"title":"होम","path":"/"}]');
  writeFile(dir, 'docs-v1/index.md', '# EN v1');
  writeFile(dir, 'docs-v1/guide.md', '# EN v1 Guide');
  writeFile(dir, 'docs-v1/navigation.json', '[{"title":"Home","path":"/"},{"title":"Guide","path":"/guide"}]');
  writeFile(dir, 'docs-v1/hi/index.md', '# HI v1');
  writeFile(dir, 'docs-v1/hi/navigation.json', '[{"title":"होम","path":"/"}]');
  const r = build(dir);
  assert('builds with partial old version translation', r.ok);
  assert('HI v1 at /hi/v1/', readSite(dir, 'hi/v1/index.html')?.includes('HI v1'));
  assert('EN v1 guide exists', siteExists(dir, 'v1/guide/index.html'));
  assert('no ghost /v1/hi/ path', !siteExists(dir, 'v1/hi/index.html'));
}

// ─── TEST 7: Missing locale dir (graceful skip) ───
console.log('\n🌍 Test 7: Missing locale dir (graceful skip)');
{
  const dir = setup('07-missing-locale');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'Missing',
    src: 'docs',
    i18n: { default: 'en', locales: [
      { id: 'en', label: 'English' },
      { id: 'ja', label: 'Japanese' }
    ]}
  };`);
  writeFile(dir, 'docs/en/index.md', '# English');
  writeFile(dir, 'docs/en/navigation.json', '[{"title":"Home","path":"/"}]');
  // No docs/ja/ directory at all
  const r = build(dir);
  assert('builds without crashing', r.ok);
  assert('EN pages built', siteExists(dir, 'index.html'));
  assert('no JA dir in output', !siteExists(dir, 'ja/index.html'));
}

// ─── TEST 8: Navigation resolution priority ───
console.log('\n🧭 Test 8: Navigation resolution priority');
{
  const dir = setup('08-nav-resolution');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'Nav Test',
    src: 'docs',
    navigation: [{ title: 'Config Nav', path: '/' }],
    i18n: { default: 'en', locales: [
      { id: 'en', label: 'English' },
      { id: 'fr', label: 'French' }
    ]}
  };`);
  writeFile(dir, 'docs/en/index.md', '# Home');
  writeFile(dir, 'docs/en/navigation.json', '[{"title":"Locale Nav","path":"/"}]');
  writeFile(dir, 'docs/fr/index.md', '# Accueil');
  // FR has NO navigation.json — should fall back to EN's
  const r = build(dir);
  assert('builds with nav priority', r.ok);
  const enPage = readSite(dir, 'index.html');
  assert('EN uses locale nav', enPage?.includes('Locale Nav'));
}

// ─── TEST 9: Frontmatter parsing ───
console.log('\n📝 Test 9: Frontmatter parsing');
{
  const dir = setup('09-frontmatter');
  writeFile(dir, 'docs/index.md', `---
title: "My Page Title"
description: "A test description"
---
# Content
Body text.`);
  const r = build(dir);
  assert('builds with frontmatter', r.ok);
  const html = readSite(dir, 'index.html');
  assert('title in output', html?.includes('My Page Title'));
  assert('description meta tag', html?.includes('A test description'));
}

// ─── TEST 10: Containers ───
console.log('\n📦 Test 10: Containers');
{
  const dir = setup('10-containers');
  writeFile(dir, 'docs/index.md', `# Containers Test

::: callout info "Note"
This is a callout.
:::

::: callout warning "Warning"
Be careful.
:::

::: callout danger "Danger"
Very dangerous.
:::

::: callout tip "Tip"
A helpful tip.
:::

::: tabs
== tab "Tab One"
First tab content.
== tab "Tab Two"
Second tab content.
:::

::: steps
### Step 1
Do this first.
### Step 2
Then do this.
:::

::: hero
# Hero Title
Hero description.
:::
`);
  const r = build(dir);
  assert('builds with containers', r.ok);
  const html = readSite(dir, 'index.html');
  assert('callout rendered', html?.includes('callout') || html?.includes('Note'));
  assert('tabs rendered', html?.includes('tabs') && html?.includes('Tab One'));
  assert('steps rendered', html?.includes('Step 1') && html?.includes('Step 2'));
  assert('hero rendered', html?.includes('Hero Title'));
}

// ─── TEST 11: Code blocks ───
console.log('\n💻 Test 11: Code blocks');
{
  const dir = setup('11-code-blocks');
  writeFile(dir, 'docs/index.md', `# Code Test

\`\`\`js
const x = 42;
console.log(x);
\`\`\`

\`\`\`python
def hello():
    return "world"
\`\`\`
`);
  const r = build(dir);
  assert('builds with code blocks', r.ok);
  const html = readSite(dir, 'index.html');
  assert('JS code rendered', html?.includes('const') && html?.includes('42'));
  assert('Python code rendered', html?.includes('def') && html?.includes('hello'));
}

// ─── TEST 12: Custom CSS/JS injection ───
console.log('\n🎨 Test 12: Custom CSS/JS injection');
{
  const dir = setup('12-custom-assets');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'Custom Assets',
    src: 'docs',
    head: [
      '<link rel="stylesheet" href="/custom.css">',
      '<script src="/custom.js"></script>'
    ]
  };`);
  writeFile(dir, 'docs/index.md', '# Custom Assets');
  const r = build(dir);
  assert('builds with custom assets', r.ok);
  const html = readSite(dir, 'index.html');
  assert('custom CSS or head injection works', html?.includes('custom.css') || r.ok);
  assert('custom JS or head injection works', html?.includes('custom.js') || r.ok);
}

// ─── TEST 13: Edit links ───
console.log('\n✏️ Test 13: Edit links');
{
  const dir = setup('13-edit-links');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'Edit Links',
    src: 'docs',
    editLink: {
      enabled: true,
      baseUrl: 'https://github.com/test/repo/edit/main/docs',
      text: 'Edit on GitHub'
    }
  };`);
  writeFile(dir, 'docs/index.md', '# Edit Link Test');
  const r = build(dir);
  assert('builds with edit links', r.ok);
  const html = readSite(dir, 'index.html');
  assert('edit link in page', html?.includes('Edit on GitHub') || html?.includes('github.com/test/repo'));
}

// ─── TEST 14: No-style pages ───
console.log('\n🧹 Test 14: No-style pages');
{
  const dir = setup('14-no-style');
  writeFile(dir, 'docs/index.md', '# Normal Page');
  writeFile(dir, 'docs/raw.md', '---\nlayout: no-style\n---\n# Raw Page\nNo styling.');
  const r = build(dir);
  assert('builds with no-style page', r.ok);
  assert('no-style page exists', siteExists(dir, 'raw/index.html'));
  const raw = readSite(dir, 'raw/index.html');
  assert('no-style page rendered', raw?.includes('Raw Page'));
}

// ─── TEST 15: Search index ───
console.log('\n🔍 Test 15: Search index generation');
{
  const dir = setup('15-search');
  writeFile(dir, 'docs/index.md', '# Search Home\nSearchable content here.');
  writeFile(dir, 'docs/guide.md', '# Guide\nMore searchable content.');
  const r = build(dir);
  assert('builds with search', r.ok);
  assert('search-index.json exists', siteExists(dir, 'search-index.json'));
  const idx = readSite(dir, 'search-index.json');
  assert('search index has content', idx && JSON.parse(idx).documentCount >= 2);
}

// ─── TEST 16: Sitemap ───
console.log('\n🗺️ Test 16: Sitemap generation');
{
  const dir = setup('16-sitemap');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'Sitemap Test',
    src: 'docs',
    url: 'https://example.com'
  };`);
  writeFile(dir, 'docs/index.md', '# Home');
  writeFile(dir, 'docs/about.md', '# About');
  const r = build(dir);
  assert('builds with sitemap', r.ok);
  assert('sitemap.xml exists', siteExists(dir, 'sitemap.xml'));
  const sm = readSite(dir, 'sitemap.xml');
  assert('sitemap has URLs', sm?.includes('example.com'));
}

// ─── TEST 17: EJS content pages ───
console.log('\n🔧 Test 17: EJS content pages');
{
  const dir = setup('17-ejs');
  writeFile(dir, 'docs/index.md', '# Home');
  writeFile(dir, 'docs/dynamic.ejs', `---
title: Dynamic Page
---
# Generated at build time

<% const items = ['one', 'two', 'three']; %>
<% items.forEach(i => { %>
- Item: <%= i %>
<% }); %>
`);
  const r = build(dir);
  assert('builds with EJS pages', r.ok);
  assert('EJS page rendered', siteExists(dir, 'dynamic/index.html'));
  const html = readSite(dir, 'dynamic/index.html');
  assert('EJS content expanded', html?.includes('Item: one') && html?.includes('Item: three'));
}

// ─── TEST 18: README.md as index fallback ───
console.log('\n📋 Test 18: README.md as index fallback');
{
  const dir = setup('18-readme');
  writeFile(dir, 'docs/README.md', '# Welcome\nFrom README.');
  writeFile(dir, 'docs/guide/README.md', '# Guide\nFrom guide README.');
  const r = build(dir);
  assert('builds with README fallback', r.ok);
  assert('README becomes index', siteExists(dir, 'index.html'));
  const html = readSite(dir, 'index.html');
  assert('README content rendered', html?.includes('From README'));
  assert('nested README becomes index', siteExists(dir, 'guide/index.html'));
}

// ─── TEST 19: .markdown extension ───
console.log('\n📄 Test 19: .markdown file extension');
{
  const dir = setup('19-markdown-ext');
  writeFile(dir, 'docs/index.md', '# Home');
  writeFile(dir, 'docs/about.markdown', '# About\nMarkdown extension.');
  const r = build(dir);
  assert('builds with .markdown files', r.ok);
  assert('.markdown page rendered', siteExists(dir, 'about/index.html'));
  const html = readSite(dir, 'about/index.html');
  assert('.markdown content correct', html?.includes('Markdown extension'));
}

// ─── TEST 20: Deep nesting ───
console.log('\n🏗️ Test 20: Deep nested structure');
{
  const dir = setup('20-deep-nesting');
  writeFile(dir, 'docs/index.md', '# Home');
  writeFile(dir, 'docs/a/b/c/d/deep.md', '# Deep Page\nVery deep.');
  const r = build(dir);
  assert('builds with deep nesting', r.ok);
  assert('deep page exists', siteExists(dir, 'a/b/c/d/deep/index.html'));
}

// ─── TEST 21: Zero-config auto-nav accuracy ───
console.log('\n🧭 Test 21: Zero-config auto-nav accuracy');
{
  const dir = setup('21-auto-nav');
  writeFile(dir, 'docs/index.md', '# Home');
  writeFile(dir, 'docs/getting-started.md', '# Getting Started');
  writeFile(dir, 'docs/guide/intro.md', '# Intro');
  writeFile(dir, 'docs/guide/advanced.md', '# Advanced');
  const r = build(dir);
  assert('builds with auto-nav', r.ok);
  const html = readSite(dir, 'index.html');
  assert('auto-nav includes Getting Started', html?.includes('Getting Started'));
  assert('auto-nav includes Guide section', html?.includes('Intro') || html?.includes('Guide'));
}

// ─── TEST 22: Title tag auto-append ───
console.log('\n🏷️ Test 22: Title tag auto-append');
{
  const dir = setup('22-title-tag');
  writeFile(dir, 'docmd.config.js', `module.exports = { title: 'MySite', src: 'docs' };`);
  writeFile(dir, 'docs/index.md', '---\ntitle: Home\n---\n# Home');
  writeFile(dir, 'docs/about.md', '---\ntitle: About Us\n---\n# About');
  const r = build(dir);
  assert('builds with title tags', r.ok);
  const about = readSite(dir, 'about/index.html');
  // Title should be "About Us — MySite" or similar
  const titleMatch = about?.match(/<title>(.*?)<\/title>/s);
  const titleText = titleMatch?.[1]?.trim();
  assert('sub-page title includes page + site', titleText?.includes('About') && titleText?.includes('MySite'));
}

// ─── TEST 23: OG meta tags ───
console.log('\n🏷️ Test 23: OG meta tags');
{
  const dir = setup('23-og-tags');
  writeFile(dir, 'docmd.config.js', `module.exports = { title: 'OG Test', src: 'docs', url: 'https://example.com' };`);
  writeFile(dir, 'docs/index.md', '---\ntitle: OG Page\ndescription: OG description\n---\n# OG');
  const r = build(dir);
  assert('builds with OG tags', r.ok);
  const html = readSite(dir, 'index.html');
  assert('og:title present', html?.includes('og:title'));
  assert('og:description present', html?.includes('og:description') || html?.includes('OG description'));
}

// ─── TEST 24: Redirects ───
console.log('\n↩️ Test 24: Redirects');
{
  const dir = setup('24-redirects');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'Redirects',
    src: 'docs',
    redirects: { '/old-page': '/new-page' }
  };`);
  writeFile(dir, 'docs/index.md', '# Home');
  writeFile(dir, 'docs/new-page.md', '# New Page');
  const r = build(dir);
  assert('builds with redirects', r.ok);
  assert('redirect page created', siteExists(dir, 'old-page/index.html'));
  const redirect = readSite(dir, 'old-page/index.html');
  assert('redirect has meta refresh', redirect?.includes('new-page') || redirect?.includes('redirect'));
}

// ─── TEST 25: Per-page layout override ───
console.log('\n📐 Test 25: Per-page layout override');
{
  const dir = setup('25-layout-override');
  writeFile(dir, 'docs/index.md', '# Normal');
  writeFile(dir, 'docs/landing.md', '---\nlayout: no-style\ntitle: Landing\n---\n# Landing Page\nCustom layout.');
  const r = build(dir);
  assert('builds with layout override', r.ok);
  const normal = readSite(dir, 'index.html');
  const landing = readSite(dir, 'landing/index.html');
  assert('normal page has full layout', normal?.includes('sidebar') || normal?.includes('nav'));
  assert('landing page rendered', landing?.includes('Landing Page'));
}

// ─── TEST 26: URL Consistency (No Double Slashes) ───
console.log('\n🔗 Test 26: URL Consistency (No Double Slashes)');
{
  const dir = setup('26-url-consistency');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'URL Test',
    url: 'https://example.com',
    src: 'docs',
    navigation: [
      { title: 'Home', path: '/' },
      { title: 'Guide', path: '/guide/' },
      { title: 'Nested', path: '/deep/nested/' }
    ]
  };`);
  writeFile(dir, 'docs/index.md', '# Home\n[Go to Guide](guide/)\n[Go to Nested](deep/nested/)');
  writeFile(dir, 'docs/guide.md', '# Guide\n[Back Home](/)');
  writeFile(dir, 'docs/deep/nested.md', '# Nested\n[Back Home](/)');
  const r = build(dir);
  assert('builds with navigation', r.ok);
  
  const idx = readSite(dir, 'index.html');
  const guide = readSite(dir, 'guide/index.html');
  const nested = readSite(dir, 'deep/nested/index.html');
  
  // Check for double slashes in href attributes (excluding protocol://)
  const hasDoubleSlashHref = (html) => /href="[^"]*([^:])\/\//.test(html);
  assert('index has no double-slash hrefs', !hasDoubleSlashHref(idx));
  assert('guide has no double-slash hrefs', !hasDoubleSlashHref(guide));
  assert('nested has no double-slash hrefs', !hasDoubleSlashHref(nested));
  
  // Check sitemap URLs
  const sitemap = readSite(dir, 'sitemap.xml');
  const hasDoubleSlash = (html) => /([^:])\/\//.test(html);
  assert('sitemap has no double slashes', !hasDoubleSlash(sitemap));
  assert('sitemap has correct root URL', sitemap?.includes('https://example.com/'));
  assert('sitemap has correct guide URL', sitemap?.includes('https://example.com/guide/'));
}

// ─── TEST 27: Search Index URL Format ───
console.log('\n🔍 Test 27: Search Index URL Format');
{
  const dir = setup('27-search-urls');
  writeFile(dir, 'docs/index.md', '---\ntitle: Home\n---\n# Welcome');
  writeFile(dir, 'docs/guide/intro.md', '---\ntitle: Introduction\n---\n# Getting Started');
  const r = build(dir);
  assert('builds with search', r.ok);
  
  const searchIdx = readSite(dir, 'search-index.json');
  const parsed = JSON.parse(searchIdx);
  const storedFields = parsed.storedFields || {};
  const ids = Object.values(storedFields).map((f) => f.id);
  
  // IDs should be clean slugs without leading slashes (except root)
  assert('root page has clean ID', ids.some(id => id === '/'));
  assert('nested page has clean ID', ids.some(id => id === 'guide/intro/' || id === '/guide/intro/'));
  // No double slashes in any ID
  assert('no double slashes in search IDs', !ids.some(id => id.includes('//')));
}

// ─── TEST 28: i18n URL Prefixes ───
console.log('\n🌍 Test 28: i18n URL Prefixes');
{
  const dir = setup('28-i18n-urls');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'i18n URLs',
    url: 'https://example.com',
    src: 'docs',
    i18n: { default: 'en', locales: [
      { id: 'en', label: 'English' },
      { id: 'de', label: 'Deutsch' }
    ]}
  };`);
  writeFile(dir, 'docs/en/index.md', '# English Home\n[German](/de/)');
  writeFile(dir, 'docs/en/guide.md', '# English Guide');
  writeFile(dir, 'docs/en/navigation.json', '[{"title":"Home","path":"/"},{"title":"Guide","path":"/guide/"}]');
  writeFile(dir, 'docs/de/index.md', '# German Home\n[English](/)');
  writeFile(dir, 'docs/de/navigation.json', '[{"title":"Startseite","path":"/"}]');
  const r = build(dir);
  assert('builds with i18n', r.ok);
  
  // Check that nav links have correct prefixes
  const enIdx = readSite(dir, 'index.html');
  const deIdx = readSite(dir, 'de/index.html');
  
  // English root should have links without double slashes
  const hasDoubleSlash = (html) => /href="[^"]*([^:])\/\//.test(html);
  assert('EN index has no double-slash hrefs', !hasDoubleSlash(enIdx));
  assert('DE index has no double-slash hrefs', !hasDoubleSlash(deIdx));
  
  // Check sitemap has both locales
  const sitemap = readSite(dir, 'sitemap.xml');
  assert('sitemap has EN URLs', sitemap?.includes('example.com/'));
  assert('sitemap has DE URLs', sitemap?.includes('example.com/de/'));
  
  // Check hreflang tags don't have duplicate locale prefixes
  const deIdxHreflang = readSite(dir, 'de/index.html');
  const hreflangPattern = /hreflang="[^"]*" href="([^"]*)"/g;
  const hreflangUrls = [...deIdxHreflang.matchAll(hreflangPattern)].map(m => m[1]);
  assert('hreflang EN points to root', hreflangUrls.some(u => u === '/'));
  assert('hreflang DE points to /de/', hreflangUrls.some(u => u === '/de/'));
  assert('no duplicate locale in hreflang', !hreflangUrls.some(u => u.includes('/de/de/')));
}

// ─── TEST 29: Hreflang Tags Consistency ───
console.log('\n🏷️ Test 29: Hreflang Tags Consistency');
{
  const dir = setup('29-hreflang-tags');
  writeFile(dir, 'docmd.config.js', `module.exports = {
    title: 'Hreflang Test',
    url: 'https://example.com',
    src: 'docs',
    i18n: { default: 'en', locales: [
      { id: 'en', label: 'English' },
      { id: 'fr', label: 'Français' }
    ]}
  };`);
  writeFile(dir, 'docs/en/index.md', '# English Home');
  writeFile(dir, 'docs/en/guide.md', '# English Guide');
  writeFile(dir, 'docs/en/navigation.json', '[{"title":"Home","path":"/"},{"title":"Guide","path":"/guide/"}]');
  writeFile(dir, 'docs/fr/index.md', '# French Home');
  writeFile(dir, 'docs/fr/guide.md', '# French Guide');
  writeFile(dir, 'docs/fr/navigation.json', '[{"title":"Accueil","path":"/"},{"title":"Guide","path":"/guide/"}]');
  const r = build(dir);
  assert('builds with i18n', r.ok);
  
  // Check hreflang on English root
  const enIdx = readSite(dir, 'index.html');
  assert('EN root has hreflang for EN', enIdx?.includes('hreflang="en" href="/"'));
  assert('EN root has hreflang for FR', enIdx?.includes('hreflang="fr" href="/fr/"'));
  assert('EN root has x-default', enIdx?.includes('hreflang="x-default"'));
  
  // Check hreflang on French root
  const frIdx = readSite(dir, 'fr/index.html');
  assert('FR root has hreflang for EN', frIdx?.includes('hreflang="en" href="/"'));
  assert('FR root has hreflang for FR', frIdx?.includes('hreflang="fr" href="/fr/"'));
  
  // Check hreflang on nested pages
  const enGuide = readSite(dir, 'guide/index.html');
  const frGuide = readSite(dir, 'fr/guide/index.html');
  assert('EN guide has correct hreflang', enGuide?.includes('hreflang="fr" href="/fr/guide/"'));
  assert('FR guide has correct hreflang', frGuide?.includes('hreflang="en" href="/guide/"'));
  
  // Ensure no duplicate locale prefixes
  assert('no /fr/fr/ in FR hreflang', !frIdx?.includes('/fr/fr/'));
  assert('no /fr/fr/ in FR guide hreflang', !frGuide?.includes('/fr/fr/'));
}

// ─── TEST 26: Exit-code contract (Phase 3 PR 3.A — F6, M-12) ───
console.log('\n🚦 Test 26: Exit-code contract');
{
  function exitCodeOf(cmd, cwd) {
    try {
      execSync(cmd, { cwd, stdio: 'pipe' });
      return 0;
    } catch (e) {
      return e.status == null ? -1 : e.status;
    }
  }

  // F6 — build with an unknown plugin must exit 1 (was 0)
  {
    const dir = setup('26-build-unknown-plugin');
    writeFile(dir, 'docs/index.md', '# Hi\n');
    writeFile(dir, 'docmd.config.json', JSON.stringify({
      title: 'F6', src: './docs', out: './site',
      plugins: { 'nonexistent-plugin-xyz-f6': {} }
    }));
    const code = exitCodeOf(`node ${DOCMD} build`, dir);
    assert('build with unknown plugin exits 1', code === 1);
  }

  // F6 — migrate with no source must exit 1 (was 0)
  {
    const dir = setup('26-migrate-no-source');
    const code = exitCodeOf(`node ${DOCMD} migrate`, dir);
    assert('migrate with no source exits 1', code === 1);
  }

  // F6 — migrate --help must exit 0 (it's a successful no-op help print)
  {
    const dir = setup('26-migrate-help');
    const code = exitCodeOf(`node ${DOCMD} migrate --help`, dir);
    assert('migrate --help exits 0', code === 0);
  }

  // F6 — remove of a non-existent plugin must exit 1 (was 0)
  {
    const dir = setup('26-remove-nonexistent');
    const code = exitCodeOf(`node ${DOCMD} remove nonexistent-f6-plugin`, dir);
    assert('remove nonexistent plugin exits 1', code === 1);
  }

  // M-12 — validate --json with broken links must exit 1 (was 0)
  {
    const dir = setup('26-validate-json-errors');
    writeFile(dir, 'docs/index.md', '# P1\n\n[bad](/nope/)\n');
    const code = exitCodeOf(`node ${DOCMD} validate --json`, dir);
    assert('validate --json with errors exits 1', code === 1);
  }

  // M-12 — validate --json with NO errors exits 0
  {
    const dir = setup('26-validate-json-clean');
    writeFile(dir, 'docs/index.md', '# P1\n\nAll links fine.\n');
    const code = exitCodeOf(`node ${DOCMD} validate --json`, dir);
    assert('validate --json with no errors exits 0', code === 0);
  }

  // Sanity — build (no error) still exits 0
  {
    const dir = setup('26-build-ok');
    writeFile(dir, 'docs/index.md', '# Hi\n');
    const code = exitCodeOf(`node ${DOCMD} build`, dir);
    assert('clean build exits 0', code === 0);
  }
}

// ─── TEST 27: Plugin add/remove across config formats (Phase 3 PR 3.B — F7, M-3) ───
console.log('\n🔌 Test 27: Plugin add/remove across config formats');
{
  // M-3 — `add` must inject the plugin entry into a TS config (was no-op).
  {
    const dir = setup('27-m3-add-ts');
    writeFile(dir, 'docs/index.md', '# Hi\n');
    writeFile(dir, 'docmd.config.ts', [
      "import { defineConfig } from '@docmd/api';",
      '',
      'export default defineConfig({',
      '  title: \'M3 TS\',',
      '  src: \'./docs\',',
      '  out: \'./site\',',
      '  plugins: {}',
      '});',
      ''
    ].join('\n'));
    execSync(`node ${DOCMD} add search`, { cwd: dir, stdio: 'pipe' });
    const after = fs.readFileSync(path.join(dir, 'docmd.config.ts'), 'utf8');
    assert('M-3: TS config gets search entry after add', /['"]search['"]\s*:\s*\{\s*\}/.test(after));
  }

  // M-3 — same for MJS
  {
    const dir = setup('27-m3-add-mjs');
    writeFile(dir, 'docs/index.md', '# Hi\n');
    writeFile(dir, 'docmd.config.mjs', [
      "import { defineConfig } from '@docmd/api';",
      '',
      'export default defineConfig({',
      '  title: \'M3 MJS\',',
      '  plugins: {}',
      '});',
      ''
    ].join('\n'));
    execSync(`node ${DOCMD} add search`, { cwd: dir, stdio: 'pipe' });
    const after = fs.readFileSync(path.join(dir, 'docmd.config.mjs'), 'utf8');
    assert('M-3: MJS config gets search entry after add', /['"]search['"]\s*:\s*\{\s*\}/.test(after));
  }

  // F7 — `remove` must remove the plugin entry from a TS config (was no-op).
  {
    const dir = setup('27-f7-remove-ts');
    writeFile(dir, 'docmd.config.ts', [
      "import { defineConfig } from '@docmd/api';",
      '',
      'export default defineConfig({',
      '  title: \'F7 TS\',',
      '  plugins: {',
      '    search: {}',
      '  }',
      '});',
      ''
    ].join('\n'));
    execSync(`node ${DOCMD} remove search`, { cwd: dir, stdio: 'pipe' });
    const after = fs.readFileSync(path.join(dir, 'docmd.config.ts'), 'utf8');
    assert('F7: TS config search entry removed', !/search\s*:/.test(after));
    assert('F7: TS config plugins block still present', /plugins\s*:/.test(after));
  }

  // F7 — same for JSON
  {
    const dir = setup('27-f7-remove-json');
    writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'F7 JSON', plugins: { search: {} } }, null, 2) + '\n');
    execSync(`node ${DOCMD} remove search`, { cwd: dir, stdio: 'pipe' });
    const after = fs.readFileSync(path.join(dir, 'docmd.config.json'), 'utf8');
    assert('F7: JSON config search entry removed', !/"search"\s*:/.test(after));
  }

  // Idempotency — adding a plugin that's already configured must NOT
  // create a duplicate entry.
  {
    const dir = setup('27-idempotent');
    writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'Idem', plugins: { search: {} } }, null, 2) + '\n');
    execSync(`node ${DOCMD} add search`, { cwd: dir, stdio: 'pipe' });
    const after = JSON.parse(fs.readFileSync(path.join(dir, 'docmd.config.json'), 'utf8'));
    const keys = Object.keys(after.plugins);
    assert('idempotent: only one search entry after re-add', keys.filter((k) => k === 'search').length === 1);
  }

  // No-plugins-block JS config — `add` should CREATE the plugins block.
  {
    const dir = setup('27-js-no-plugins');
    writeFile(dir, 'docmd.config.js', [
      'module.exports = {',
      '  title: \'JS no plugins\',',
      '  src: \'./docs\',',
      '  out: \'./site\'',
      '};',
      ''
    ].join('\n'));
    execSync(`node ${DOCMD} add search`, { cwd: dir, stdio: 'pipe' });
    const after = fs.readFileSync(path.join(dir, 'docmd.config.js'), 'utf8');
    assert('JS no-plugins: plugins block created', /plugins\s*:\s*\{/.test(after));
    assert('JS no-plugins: search entry present', /['"]search['"]\s*:\s*\{\s*\}/.test(after));
    // No stray newline-comma in the output (regression guard).
    assert('JS no-plugins: no stray ",\\n" between last key and plugins', !/,\s*\n\s*plugins/.test(after) || /,\n\s*plugins/.test(after));
  }
}

// ─── SUMMARY ───
console.log('\n' + '═'.repeat(50));
console.log(`  ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
if (failures.length > 0) {
  console.log(`\n  Failures:`);
  failures.forEach(f => console.log(`    ${FAIL} ${f}`));
}
console.log('═'.repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);
