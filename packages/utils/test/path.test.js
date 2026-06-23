import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { safePath, asUserPath, normalisePath } from '../dist/path.js';

// ─── safePath ───────────────────────────────────────────────────────────

test('safePath: relative path resolves inside root', () => {
  const root = path.resolve('/tmp/docmd-test-root');
  assert.equal(safePath(root, 'docs/index.md'), path.join(root, 'docs/index.md'));
});

test('safePath: rejects path traversal with ../', () => {
  const root = path.resolve('/tmp/docmd-test-root');
  assert.throws(() => safePath(root, '../etc/passwd'), /escapes project root/);
});

test('safePath: rejects nested traversal that lands outside root', () => {
  const root = path.resolve('/tmp/docmd-test-root');
  assert.throws(() => safePath(root, 'docs/../../../etc/passwd'), /escapes project root/);
});

test('safePath: rejects absolute path outside root', () => {
  const root = path.resolve('/tmp/docmd-test-root');
  assert.throws(() => safePath(root, '/etc/passwd'), /escapes project root/);
});

test('safePath: root itself (.) resolves to root and is allowed', () => {
  const root = path.resolve('/tmp/docmd-test-root');
  assert.equal(safePath(root, '.'), root);
});

test('safePath: nested child path is allowed', () => {
  const root = path.resolve('/tmp/docmd-test-root');
  const expected = path.join(root, 'a', 'b', 'c.md');
  assert.equal(safePath(root, 'a/b/c.md'), expected);
});

// ─── asUserPath + UserPath brand ─────────────────────────────────────────

test('asUserPath: returns the same string at runtime', () => {
  const raw = 'config/x.yaml';
  const branded = asUserPath(raw);
  assert.equal(branded, raw);
  assert.equal(typeof branded, 'string');
});

test('UserPath: usable wherever string is expected', () => {
  const branded = asUserPath('a/b/c');
  assert.equal(String(branded), 'a/b/c');
  assert.equal(branded.length, 5);
  assert.equal(branded.startsWith('a/'), true);
});

test('asUserPath: empty string is allowed (branding only, not validation)', () => {
  const branded = asUserPath('');
  assert.equal(branded, '');
});

// ─── normalisePath ──────────────────────────────────────────────────────

test('normalisePath: leaves POSIX paths unchanged', () => {
  assert.equal(normalisePath('a/b/c'), 'a/b/c');
});

test('normalisePath: handles empty string', () => {
  assert.equal(normalisePath(''), '');
});

test('normalisePath: handles single segment', () => {
  assert.equal(normalisePath('only'), 'only');
});