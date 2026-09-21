/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * markdown-options — configurable linkify, typographer, breaks, and
 * HTTPS autolinking normalisation.
 *
 * Regression coverage for:
 *   - Issue #241: Expose markdown.linkify & markdown.typographer in config
 *   - Issue #242: Autolinked bare domains must default to https://
 *   - Issue #137: Configurable markdown.breaks
 *
 * Run: `pnpm --filter @docmd/parser test`
 * --------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarkdownProcessor } from '../dist/index.js';

test('Issue #242: autolinked bare domains default to https://', () => {
  const md = createMarkdownProcessor();
  const rendered = md.render('Visit docmd.io or sub.example.org/path for details.');

  assert.match(rendered, /href="https:\/\/docmd\.io"/);
  assert.match(rendered, /href="https:\/\/sub\.example\.org\/path"/);
  assert.doesNotMatch(rendered, /href="http:\/\/docmd\.io"/);
});

test('Issue #242: autolinked www bare domains default to https://', () => {
  const md = createMarkdownProcessor();
  const rendered = md.render('Visit www.docmd.io.');

  assert.match(rendered, /href="https:\/\/www\.docmd\.io"/);
  assert.doesNotMatch(rendered, /href="http:\/\/www\.docmd\.io"/);
});

test('Issue #242: explicit http:// URLs are preserved as http://', () => {
  const md = createMarkdownProcessor();
  const rendered = md.render('Insecure site: http://insecure.example.com');

  assert.match(rendered, /href="http:\/\/insecure\.example\.com"/);
  assert.doesNotMatch(rendered, /href="https:\/\/insecure\.example\.com"/);
});

test('Issue #242: explicit markdown links with http:// are preserved', () => {
  const md = createMarkdownProcessor();
  const rendered = md.render('[Insecure Link](http://insecure.example.com)');

  assert.match(rendered, /href="http:\/\/insecure\.example\.com"/);
});

test('Issue #242: email addresses are preserved as mailto:', () => {
  const md = createMarkdownProcessor();
  const rendered = md.render('Contact us at hello@docmd.io.');

  assert.match(rendered, /href="mailto:hello@docmd\.io"/);
});

test('Issue #241: markdown.linkify: false disables bare domain and email autolinking', () => {
  const md = createMarkdownProcessor({ markdown: { linkify: false } });
  const rendered = md.render('Visit docmd.io or email hello@docmd.io.');

  assert.doesNotMatch(rendered, /<a /);
  assert.match(rendered, /Visit docmd\.io or email hello@docmd\.io\./);
});

test('Issue #241: markdown.typographer: false disables smart quotes and symbols', () => {
  const mdDisabled = createMarkdownProcessor({ markdown: { typographer: false } });
  const renderedDisabled = mdDisabled.render('(c) 2026 -- "quotes"');

  assert.match(renderedDisabled, /\(c\)/);
  assert.match(renderedDisabled, /--/);

  const mdDefault = createMarkdownProcessor();
  const renderedDefault = mdDefault.render('(c) 2026 -- "quotes"');

  assert.match(renderedDefault, /©/);
});

test('Issue #137: markdown.breaks: false disables soft line breaks', () => {
  const mdNoBreaks = createMarkdownProcessor({ markdown: { breaks: false } });
  const renderedNoBreaks = mdNoBreaks.render('first line\nsecond line');

  assert.doesNotMatch(renderedNoBreaks, /<br>/);

  const mdDefault = createMarkdownProcessor();
  const renderedDefault = mdDefault.render('first line\nsecond line');

  assert.match(renderedDefault, /<br>/);
});
