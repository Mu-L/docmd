#!/usr/bin/env node
/**
 * docmd Security Test Suite
 * ==========================
 * End-to-end tests for the Phase 0 security primitives:
 *   - security.html = 'escape' (default) | 'allow' | 'strip'
 *   - escape helpers (escHtml / attrEsc / jsonInject / scriptLiteral) integration
 *   - safePath() path-traversal guard
 *
 * Run: node scripts/brute-test-security.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DOCMD = path.resolve(import.meta.dirname, '../packages/core/dist/bin/docmd.js');
const TEST_ROOT = '/tmp/docmd-brute-security';
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

function build(dir) {
  try {
    execSync(`node ${DOCMD} build`, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
    return { ok: true, output: '' };
  } catch (e) {
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

// ─── TEST S1: Default security.html = 'escape' blocks raw HTML ──────────
console.log('\n🔒 Test S1: Default html policy is escape (Phase 0.D)');
{
  const dir = setup('s1-default-escape');
  writeFile(dir, 'docs/index.md', [
    '---',
    'title: Raw HTML Test',
    '---',
    '',
    '# Heading',
    '',
    '<script>alert("xss")</script>',
    '',
    '<details><summary>Click</summary>Hidden</details>',
    ''
  ].join('\n'));
  const r = build(dir);
  assert('build succeeds', r.ok, r.output);
  const html = readSite(dir, 'index.html');
  assert('output exists', html !== null);
  assert('default policy escapes the user canary', html && !html.includes('alert("xss")'));
  assert('default policy escapes <details>', html && !html.includes('<details>'));
  assert('escaped output shows &lt;script&gt;', html && html.includes('&lt;script&gt;'));
}

// ─── TEST S2: Explicit 'allow' policy passes raw HTML through ───────────
console.log('\n🔒 Test S2: security.html = "allow" passes raw HTML');
{
  const dir = setup('s2-allow');
  writeFile(dir, 'docmd.config.json', JSON.stringify({
    title: 'Allow',
    security: { html: 'allow' }
  }));
  writeFile(dir, 'docs/index.md', [
    '# Heading',
    '',
    '<script>alert("xss")</script>',
    ''
  ].join('\n'));
  const r = build(dir);
  assert('build succeeds', r.ok, r.output);
  const html = readSite(dir, 'index.html');
  assert('allow policy keeps <script>', html && html.includes('<script>alert'));
}

// ─── TEST S3: Explicit 'strip' policy removes raw HTML entirely ─────────
console.log('\n🔒 Test S3: security.html = "strip" removes raw HTML');
{
  const dir = setup('s3-strip');
  writeFile(dir, 'docmd.config.json', JSON.stringify({
    title: 'Strip',
    security: { html: 'strip' }
  }));
  writeFile(dir, 'docs/index.md', [
    '# Heading',
    '',
    'before',
    '',
    '<script>alert("xss")</script>',
    '',
    '<details><summary>x</summary>y</details>',
    '',
    'after'
  ].join('\n'));
  const r = build(dir);
  assert('build succeeds', r.ok, r.output);
  const html = readSite(dir, 'index.html');
  assert('strip policy removes the user canary', html && !html.includes('alert("xss")'));
  assert('strip policy removes <details>', html && !html.includes('<details>'));
  assert('strip policy removes </details>', html && !html.includes('</details>'));
  assert('strip policy keeps surrounding text', html && html.includes('before') && html.includes('after'));
}

// ─── TEST S4: Invalid policy value falls back to 'escape' ────────────────
console.log('\n🔒 Test S4: Invalid policy value defaults to escape');
{
  const dir = setup('s4-invalid-policy');
  writeFile(dir, 'docmd.config.json', JSON.stringify({
    title: 'Invalid',
    security: { html: 'bogus' }
  }));
  writeFile(dir, 'docs/index.md', '# Hi\n\n<script>x</script>\n');
  const r = build(dir);
  assert('build succeeds with bogus policy', r.ok, r.output);
  const html = readSite(dir, 'index.html');
  assert('bogus value falls back to escape', html && !html.includes('<script>x'));
}

// ─── TEST S5: No security config still defaults to escape ───────────────
console.log('\n🔒 Test S5: No security block at all defaults to escape');
{
  const dir = setup('s5-no-security');
  writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'No Security' }));
  writeFile(dir, 'docs/index.md', '# Hi\n\n<script>x</script>\n');
  const r = build(dir);
  assert('build succeeds with no security block', r.ok, r.output);
  const html = readSite(dir, 'index.html');
  assert('no security block falls back to escape', html && !html.includes('<script>x'));
}

// ─── TEST S6: Markdown text outside HTML is unaffected by the policy ─────
console.log('\n🔒 Test S6: Markdown rendering unaffected by HTML policy');
{
  const dir = setup('s6-markdown-unaffected');
  writeFile(dir, 'docmd.config.json', JSON.stringify({
    title: 'Markdown',
    security: { html: 'strip' }
  }));
  writeFile(dir, 'docs/index.md', [
    '# Title',
    '',
    'Paragraph with **bold** and *italic*.',
    '',
    '- list item one',
    '- list item two',
    '',
    '`inline code` and a [link](https://example.com).'
  ].join('\n'));
  const r = build(dir);
  assert('build succeeds', r.ok, r.output);
  const html = readSite(dir, 'index.html');
  assert('heading renders as <h1>', html && html.includes('<h1'));
  assert('bold renders as <strong>', html && html.includes('<strong>'));
  assert('italic renders as <em>', html && html.includes('<em>'));
  assert('link renders as <a href', html && html.includes('href="https://example.com"'));
  assert('inline code renders as <code>', html && html.includes('<code>'));
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