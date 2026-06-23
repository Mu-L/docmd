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

import { execSync, spawn } from 'child_process';
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

// ─── TEST S7: OpenAPI plugin rejects spec path that escapes project root (S-2) ──
console.log('\n🔒 Test S7: OpenAPI plugin safePath enforcement (Phase 1.A, S-2)');
{
  // Place a canary file outside the project
  const canaryDir = '/tmp/docmd-openapi-canary';
  fs.mkdirSync(canaryDir, { recursive: true });
  const canaryPath = path.join(canaryDir, 'canary-spec.json');
  fs.writeFileSync(canaryPath, JSON.stringify({
    openapi: '3.0.0',
    info: { title: 'CANARY-PATH-TRAVERSAL-PROOF', version: '1.0.0' },
    paths: { '/canary': { get: { summary: 'Path traversal confirmed' } } }
  }));

  const dir = setup('s7-openapi-traversal');
  writeFile(dir, 'docmd.config.json', JSON.stringify({
    title: 'OA PoC',
    plugins: { openapi: {} }
  }));
  writeFile(dir, 'docs/poc.md', [
    '# PoC',
    '',
    '```openapi',
    canaryPath,
    '```',
    ''
  ].join('\n'));
  const r = build(dir);
  assert('build succeeds', r.ok, r.output);
  const html = readSite(dir, 'poc/index.html');
  assert('canary title NOT in output', html && !html.includes('CANARY-PATH-TRAVERSAL-PROOF'));
  assert('canary summary NOT in output', html && !html.includes('Path traversal confirmed'));
  assert('error message shown instead', html && html.includes('oa-error'));
  assert('error mentions path escape', html && /escapes project root/i.test(html));
}

// ─── TEST S8: OpenAPI plugin accepts in-project spec ─────────────────────
console.log('\n🔒 Test S8: OpenAPI plugin accepts in-project spec (regression)');
{
  const dir = setup('s8-openapi-allowed');
  // Note: the plugin computes srcDir from process.cwd() (pre-existing quirk:
  // markdownSetup reads options.config.src, but the plugin options object is
  // config.plugins.openapi which has no .config field). Spec must live at
  // project root for the regression test.
  writeFile(dir, 'specs-ok.json', JSON.stringify({
    openapi: '3.0.0',
    info: { title: 'OK-Spec', version: '1.0.0' },
    paths: { '/ok': { get: { summary: 'Allowed' } } }
  }));
  writeFile(dir, 'docmd.config.json', JSON.stringify({
    title: 'OA OK',
    plugins: { openapi: {} }
  }));
  writeFile(dir, 'docs/poc.md', [
    '# PoC',
    '',
    '```openapi',
    './specs-ok.json',
    '```',
    ''
  ].join('\n'));
  const r = build(dir);
  assert('build succeeds', r.ok, r.output);
  const html = readSite(dir, 'poc/index.html');
  assert('OK-Spec rendered', html && html.includes('OK-Spec'));
  assert('Allowed summary rendered', html && html.includes('Allowed'));
}

// ─── TEST S9: Plugin loader rejects local-path that escapes project root (T-S8) ─
console.log('\n🔒 Test S9: Plugin loader rejects local-path escape (Phase 1.A, T-S8)');
{
  // Place a malicious plugin OUTSIDE the project root
  const evilDir = '/tmp/docmd-evil-plugin';
  fs.mkdirSync(path.join(evilDir, 'evil'), { recursive: true });
  fs.writeFileSync(path.join(evilDir, 'evil', 'package.json'), JSON.stringify({
    name: 'evil', version: '1.0.0', main: 'index.js'
  }));
  fs.writeFileSync(path.join(evilDir, 'evil', 'index.js'), [
    'export default {',
    '  plugin: { name: "evil", version: "1.0.0", capabilities: [] },',
    '  onConfigResolved: async (config) => { config.title = "PWNED-VIA-PATH-ESCAPE"; }',
    '};'
  ].join('\n'));

  const dir = setup('s9-plugin-path-escape');
  writeFile(dir, 'docmd.config.json', JSON.stringify({
    title: 'Legit Title',
    plugins: { '../evil': {} }  // Tries to escape via ../
  }));
  writeFile(dir, 'docs/index.md', '# Hi\n');
  const r = build(dir);
  // The build may succeed (with a plugin error logged) but the title must NOT be overwritten
  const html = readSite(dir, 'index.html');
  assert('evil plugin did not execute', html && !html.includes('PWNED-VIA-PATH-ESCAPE'));
  assert('original title preserved', html && html.includes('Legit Title'));
}

// ─── TEST S10: MCP read_doc rejects path traversal (Phase 1.A, S-3) ───────
console.log('\n🔒 Test S10: MCP read_doc rejects path traversal (Phase 1.A, S-3)');

// Spawn the MCP server as a subprocess and exchange JSON-RPC messages over stdio.
function callMcp(cwd, messages) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [DOCMD, 'mcp'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const responses = new Map();
    let stdoutBuf = '';
    let stderrBuf = '';

    proc.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id != null) responses.set(msg.id, msg);
        } catch {}
      }
    });
    proc.stderr.on('data', (chunk) => { stderrBuf += chunk.toString(); });
    proc.on('error', reject);

    let i = 0;
    function sendNext() {
      if (i >= messages.length) {
        proc.stdin.end();
        setTimeout(() => {
          proc.kill('SIGTERM');
          resolve({ responses, stderr: stderrBuf });
        }, 800);
        return;
      }
      proc.stdin.write(JSON.stringify(messages[i]) + '\n');
      i++;
      setTimeout(sendNext, 100);
    }
    sendNext();
  });
}

const cases = [
  { id: 2, route: '/etc/passwd',                 expectError: /Absolute paths are not allowed/ },
  { id: 3, route: '/tmp/should-not-exist.txt',   expectError: /Absolute paths are not allowed/ },
  { id: 4, route: '../../../etc/passwd',         expectError: /escapes project root/ },
  { id: 5, route: 'docs/index.md',               expectValid: '# MCP test content' }
];

(async () => {
  const dir = setup('s10-mcp-read-doc');
  writeFile(dir, 'docmd.config.json', JSON.stringify({ title: 'MCP test' }));
  writeFile(dir, 'docs/index.md', '# MCP test content\n');

  const messages = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } } },
    ...cases.map(c => ({
      jsonrpc: '2.0', id: c.id, method: 'tools/call',
      params: { name: 'read_doc', arguments: { route: c.route } }
    }))
  ];

  const { responses } = await callMcp(dir, messages);

  assert('initialize response received', responses.has(1));

  for (const c of cases) {
    const r = responses.get(c.id);
    const text = r?.result?.content?.[0]?.text || r?.error?.message || '';
    if (c.expectError) {
      assert(`read_doc rejects "${c.route}"`, c.expectError.test(text), `got: ${text.slice(0, 80)}`);
    }
    if (c.expectValid) {
      assert(`read_doc accepts "${c.route}"`, text.includes(c.expectValid), `got: ${text.slice(0, 80)}`);
    }
  }

  // Final summary run after async S10
  console.log('\n' + '═'.repeat(50));
  console.log(`  ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  if (failures.length > 0) {
    console.log(`\n  Failures:`);
    failures.forEach(f => console.log(`    ${FAIL} ${f}`));
  }
  console.log('═'.repeat(50) + '\n');
  process.exit(failed > 0 ? 1 : 0);
})();