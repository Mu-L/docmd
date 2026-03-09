/**
 * Tests for common-containers indentation/nesting fix
 * Issue #74: not all containers reset indentation
 */

const { createMarkdownProcessor } = require('../markdown-processor');

let md;

beforeEach(() => {
  md = createMarkdownProcessor();
});

// Helper: assert output contains the expected container class and not a <pre><code> block
function assertContainerNotCodeBlock(html, containerClass) {
  expect(html).toContain(`class="${containerClass}`);
  expect(html).not.toContain('<pre><code>:::');
  expect(html).not.toContain('<pre class="hljs"><code>:::');
}

// ─── Single nesting ────────────────────────────────────────────────────────────

test('callout nested inside card renders as container not code block', () => {
  const input = [
    '::: card success',
    '  ::: callout info',
    '  Content',
    '  :::',
    ':::',
  ].join('\n');

  const html = md.render(input);
  assertContainerNotCodeBlock(html, 'docmd-container callout');
  expect(html).toContain('<p>Content</p>');
});

test('collapsible nested inside card renders as container not code block', () => {
  const input = [
    '::: card success',
    '  ::: collapsible Title',
    '  Content',
    '  :::',
    ':::',
  ].join('\n');

  const html = md.render(input);
  assertContainerNotCodeBlock(html, 'docmd-container collapsible');
  expect(html).toContain('<p>Content</p>');
});

// ─── Double nesting ───────────────────────────────────────────────────────────

test('collapsible nested inside callout inside card renders correctly (3-level nesting)', () => {
  const input = [
    '::: card success',
    '  ::: callout info',
    '    ::: collapsible [open] Title Text',
    '    Content goes here.',
    '    :::',
    '  :::',
    ':::',
  ].join('\n');

  const html = md.render(input);
  assertContainerNotCodeBlock(html, 'docmd-container collapsible');
  expect(html).toContain('<p>Content goes here.</p>');
});

// ─── Issue #74 exact reproduction ────────────────────────────────────────────

test('issue #74: plain card > callout > collapsible nesting', () => {
  const input = [
    '::: card success',
    '  ::: callout info',
    '    ::: collapsible [open] Title Text',
    '    Content goes here.',
    '    :::',
    '  :::',
    ':::',
  ].join('\n');

  const html = md.render(input);
  assertContainerNotCodeBlock(html, 'docmd-container card');
  assertContainerNotCodeBlock(html, 'docmd-container callout');
  assertContainerNotCodeBlock(html, 'docmd-container collapsible');
  expect(html).toContain('<p>Content goes here.</p>');
});

test('issue #74: card > card > callout > collapsible (4-level nesting)', () => {
  const input = [
    '::: card Top',
    '  ::: card success',
    '    ::: callout info',
    '      ::: collapsible [open] Title Text',
    '      Content goes here.',
    '      :::',
    '    :::',
    '  :::',
    ':::',
  ].join('\n');

  const html = md.render(input);
  assertContainerNotCodeBlock(html, 'docmd-container collapsible');
  expect(html).toContain('<p>Content goes here.</p>');
});

// ─── Content integrity ────────────────────────────────────────────────────────

test('inner content paragraph is rendered as <p>, not raw text', () => {
  const input = [
    '::: card x',
    '  ::: callout info',
    '  Hello world',
    '  :::',
    ':::',
  ].join('\n');

  const html = md.render(input);
  expect(html).toContain('<p>Hello world</p>');
});

test('collapsible open attribute is preserved through nesting', () => {
  const input = [
    '::: card x',
    '  ::: collapsible [open] My Title',
    '  Body',
    '  :::',
    ':::',
  ].join('\n');

  const html = md.render(input);
  expect(html).toMatch(/open/);
  expect(html).toContain('My Title');
});
