import test from 'node:test';
import assert from 'node:assert/strict';
import { escHtml, attrEsc, jsonInject, scriptLiteral } from '../dist/html-escape.js';

// ─── escHtml ────────────────────────────────────────────────────────────

test('escHtml: plain text passes through', () => {
  assert.equal(escHtml('hello world'), 'hello world');
});

test('escHtml: ampersand escaped first to avoid double-escape', () => {
  assert.equal(escHtml('a & b'), 'a &amp; b');
  assert.equal(escHtml('&lt;'), '&amp;lt;');
});

test('escHtml: escapes HTML tag delimiters', () => {
  assert.equal(escHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('escHtml: escapes both quote types', () => {
  assert.equal(escHtml(`"x" and 'y'`), '&quot;x&quot; and &#39;y&#39;');
});

test('escHtml: coerces non-string input via String()', () => {
  assert.equal(escHtml(123), '123');
  assert.equal(escHtml(null), 'null');
  assert.equal(escHtml(undefined), 'undefined');
  assert.equal(escHtml(true), 'true');
});

test('escHtml: passes unicode and emoji through unchanged', () => {
  assert.equal(escHtml('héllo 🚀'), 'héllo 🚀');
});

test('escHtml: empty string', () => {
  assert.equal(escHtml(''), '');
});

test('escHtml: full XSS canary payload leaves no raw < or "', () => {
  const payload = '"><img src=x onerror=alert(1)>';
  const out = escHtml(payload);
  assert.equal(out, '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
  assert.ok(!out.includes('<'), 'must contain no raw <');
  assert.ok(!out.includes('>'), 'must contain no raw >');
  assert.ok(!out.includes('"'), 'must contain no raw "');
});

// ─── attrEsc ────────────────────────────────────────────────────────────

test('attrEsc: matches escHtml on attribute-quoting canary', () => {
  const payload = `" onmouseover="alert(1)`;
  assert.equal(attrEsc(payload), escHtml(payload));
  assert.ok(!attrEsc(payload).includes('"'));
});

test('attrEsc: escapes both quote variants', () => {
  assert.equal(attrEsc(`a'b"c`), 'a&#39;b&quot;c');
});

// ─── jsonInject ─────────────────────────────────────────────────────────

test('jsonInject: serialises a string with quotes', () => {
  assert.equal(jsonInject('hello'), '"hello"');
  assert.equal(jsonInject(`it's "fine"`), `"it's \\"fine\\""`);
});

test('jsonInject: serialises an object deterministically', () => {
  assert.equal(jsonInject({ a: 1, b: 'x' }), '{"a":1,"b":"x"}');
});

test('jsonInject: serialises array', () => {
  assert.equal(jsonInject([1, 2, 'x']), '[1,2,"x"]');
});

test('jsonInject: null round-trips as JSON null', () => {
  assert.equal(jsonInject(null), 'null');
});

test('jsonInject: known limitation — does not escape </script>; caller must split on it', () => {
  const raw = '</script><script>alert(1)</script>';
  const injected = jsonInject(raw);
  assert.ok(injected.includes('</script>'), 'jsonInject is JSON.stringify only; HTML-context escape is the caller\'s job');
  const safe = injected.replace(/<\//g, '<\\/');
  assert.ok(!safe.includes('</script>'), 'caller-side </ -> <\\/ split is the required pattern');
});

// ─── scriptLiteral ──────────────────────────────────────────────────────

test('scriptLiteral: matches jsonInject for plain strings', () => {
  assert.equal(scriptLiteral('hello'), '"hello"');
});

test('scriptLiteral: escapes embedded newline', () => {
  assert.equal(scriptLiteral('a\nb'), '"a\\nb"');
});

test('scriptLiteral: escapes backslash', () => {
  assert.equal(scriptLiteral('a\\b'), '"a\\\\b"');
});

test('scriptLiteral: round-trip via JSON.parse preserves the string', () => {
  const value = `quotes: " ' and \\ and </script>`;
  const literal = scriptLiteral(value);
  assert.equal(JSON.parse(literal), value);
});