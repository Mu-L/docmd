import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTitleSeparator,
  resolveTitleAppend,
  resolveTitleSeparator,
  resolveTitle
} from '../dist/title.js';

test('formatTitleSeparator: default is " - "', () => {
  assert.equal(formatTitleSeparator(), ' - ');
  assert.equal(formatTitleSeparator(undefined), ' - ');
});

test('formatTitleSeparator: adds single spaces around trimmed character', () => {
  assert.equal(formatTitleSeparator('-'), ' - ');
  assert.equal(formatTitleSeparator('|'), ' | ');
  assert.equal(formatTitleSeparator('·'), ' · ');
  assert.equal(formatTitleSeparator(' - '), ' - ');
  assert.equal(formatTitleSeparator('   |   '), ' | ');
});

test('formatTitleSeparator: returns empty string when separator is empty or whitespace', () => {
  assert.equal(formatTitleSeparator(''), '');
  assert.equal(formatTitleSeparator('   '), '');
});

test('resolveTitleAppend: hierarchy check', () => {
  // Default is true
  assert.equal(resolveTitleAppend({}, {}), true);

  // Root config
  assert.equal(resolveTitleAppend({ titleAppend: false }, {}), false);
  assert.equal(resolveTitleAppend({ titleAppend: true }, {}), true);

  // SEO config overrides root
  assert.equal(resolveTitleAppend({ titleAppend: true, plugins: { seo: { titleAppend: false } } }, {}), false);

  // Layout config overrides SEO config
  assert.equal(resolveTitleAppend({ plugins: { seo: { titleAppend: false } }, layout: { titleAppend: true } }, {}), true);

  // Frontmatter overrides all
  assert.equal(resolveTitleAppend({ layout: { titleAppend: true } }, { titleAppend: false }), false);
  assert.equal(resolveTitleAppend({ layout: { titleAppend: false } }, { titleAppend: true }), true);
  assert.equal(resolveTitleAppend({ layout: { titleAppend: true } }, { seo: { titleAppend: false } }), false);
});

test('resolveTitleSeparator: hierarchy check', () => {
  // Default is " - "
  assert.equal(resolveTitleSeparator({}, {}), ' - ');

  // Root config
  assert.equal(resolveTitleSeparator({ titleSeparator: '|' }, {}), ' | ');

  // SEO config overrides root
  assert.equal(resolveTitleSeparator({ titleSeparator: '-', plugins: { seo: { titleSeparator: '|' } } }, {}), ' | ');

  // Layout config overrides SEO
  assert.equal(resolveTitleSeparator({ layout: { titleSeparator: '/' }, plugins: { seo: { titleSeparator: '|' } } }, {}), ' / ');

  // Frontmatter overrides layout
  assert.equal(resolveTitleSeparator({ layout: { titleSeparator: '/' } }, { titleSeparator: '::' }), ' :: ');
  assert.equal(resolveTitleSeparator({ layout: { titleSeparator: '/' } }, { seo: { titleSeparator: '•' } }), ' • ');
});

test('resolveTitle: basic combinations', () => {
  assert.equal(resolveTitle('Installation', 'docmd'), 'Installation - docmd');
  assert.equal(resolveTitle('Installation', 'docmd', { layout: { titleSeparator: '|' } }), 'Installation | docmd');
  assert.equal(resolveTitle('Installation', 'docmd', { titleSeparator: '|' }), 'Installation | docmd');
  assert.equal(resolveTitle('Installation', 'docmd', { titleAppend: false }), 'Installation');
  assert.equal(resolveTitle('Installation', 'docmd', {}, { titleAppend: false }), 'Installation');
});

test('resolveTitle: edge cases', () => {
  // Same page title as site title
  assert.equal(resolveTitle('docmd', 'docmd'), 'docmd');

  // Empty site title
  assert.equal(resolveTitle('Installation', ''), 'Installation');
  assert.equal(resolveTitle('Installation', undefined), 'Installation');

  // Empty page title
  assert.equal(resolveTitle('', 'docmd'), 'docmd');
  assert.equal(resolveTitle(undefined, 'docmd'), 'docmd');

  // Empty separator
  assert.equal(resolveTitle('Installation', 'docmd', { layout: { titleSeparator: '' } }), 'Installationdocmd');
});
