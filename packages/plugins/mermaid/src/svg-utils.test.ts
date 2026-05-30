/**
 * Tests for fixSvgNamespaces utility
 *
 * Root cause: mermaid.render() returns SVG with xlink:href attributes (used by
 * C4Context person icons) but without xmlns:xlink namespace declaration.
 * DOMParser.parseFromString(svg, 'image/svg+xml') is a strict XML parser —
 * it fails on undeclared namespace prefixes and returns a <parsererror> element.
 * This causes C4Context diagrams to render as a blank white box.
 *
 * mermaid.run() (live editor) does include xmlns:xlink, so it works fine.
 * Only mermaid.render() (static site via init-mermaid.js) is affected.
 */

import { describe, it, expect } from 'vitest';
import { fixSvgNamespaces } from './svg-utils.js';

// Minimal SVG that mermaid.render() produces for a typical C4Context diagram.
// Critical detail: has xlink:href (from person icon <image> elements) but
// NO xmlns:xlink declaration — this is what mermaid.render() actually outputs.
const C4_SVG_WITHOUT_XMLNS = `<svg id="mermaid-svg-0" width="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 650 400">
<style>#mermaid-svg-0 .node{fill:#08427B}</style>
<g>
  <rect x="10" y="10" width="200" height="100" fill="#08427B"/>
  <image width="48" height="48" x="91" y="20" xlink:href="data:image/png;base64,iVBORw0KGgo="/>
  <text x="110" y="90" fill="white">Customer</text>
</g>
</svg>`;

// Same SVG but already has xmlns:xlink — should not be modified
const C4_SVG_WITH_XMLNS = `<svg id="mermaid-svg-0" width="100%" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 650 400">
<style>#mermaid-svg-0 .node{fill:#08427B}</style>
<g>
  <image width="48" height="48" x="91" y="20" xlink:href="data:image/png;base64,iVBORw0KGgo="/>
</g>
</svg>`;

// Flowchart SVG — no xlink: usage at all, should not be modified
const FLOWCHART_SVG_NO_XLINK = `<svg id="mermaid-svg-1" width="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
<style>#mermaid-svg-1 .node rect{fill:#36bcf7}</style>
<g>
  <rect x="10" y="10" width="100" height="40"/>
  <text x="60" y="35">Start</text>
</g>
</svg>`;

// Flowchart with clickable links — also uses xlink:href (less common but possible)
const FLOWCHART_SVG_WITH_LINK = `<svg id="mermaid-svg-2" width="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
<a xlink:href="https://example.com" target="_blank">
  <rect x="10" y="10" width="100" height="40"/>
</a>
</svg>`;

describe('fixSvgNamespaces', () => {
  describe('C4Context person icon (root cause scenario)', () => {
    it('adds xmlns:xlink when SVG uses xlink:href without declaration', () => {
      const fixed = fixSvgNamespaces(C4_SVG_WITHOUT_XMLNS);

      expect(fixed).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    });

    it('places xmlns:xlink inside the <svg> opening tag', () => {
      const fixed = fixSvgNamespaces(C4_SVG_WITHOUT_XMLNS);

      // Must be on <svg>, not somewhere else
      expect(fixed).toMatch(/<svg[^>]+xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/);
    });

    it('preserves all existing SVG content unchanged', () => {
      const fixed = fixSvgNamespaces(C4_SVG_WITHOUT_XMLNS);

      expect(fixed).toContain('xlink:href="data:image/png;base64,iVBORw0KGgo="');
      expect(fixed).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(fixed).toContain('viewBox="0 0 650 400"');
      expect(fixed).toContain('<text x="110" y="90" fill="white">Customer</text>');
    });
  });

  describe('idempotency — does not break already-valid SVG', () => {
    it('returns SVG unchanged when xmlns:xlink is already declared', () => {
      const fixed = fixSvgNamespaces(C4_SVG_WITH_XMLNS);

      expect(fixed).toBe(C4_SVG_WITH_XMLNS);
    });

    it('does not duplicate xmlns:xlink when called twice', () => {
      const fixed = fixSvgNamespaces(fixSvgNamespaces(C4_SVG_WITHOUT_XMLNS));

      const count = (fixed.match(/xmlns:xlink/g) ?? []).length;
      expect(count).toBe(1);
    });
  });

  describe('non-C4 diagrams — no false positives', () => {
    it('returns flowchart SVG unchanged when no xlink: is used', () => {
      const fixed = fixSvgNamespaces(FLOWCHART_SVG_NO_XLINK);

      expect(fixed).toBe(FLOWCHART_SVG_NO_XLINK);
      expect(fixed).not.toContain('xmlns:xlink');
    });

    it('adds xmlns:xlink for flowchart with clickable links (also uses xlink:href)', () => {
      const fixed = fixSvgNamespaces(FLOWCHART_SVG_WITH_LINK);

      expect(fixed).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    });
  });

  describe('DOMParser integration — the actual failure mode', () => {
    // NOTE: Chrome's DOMParser (strict XML) returns <parsererror> when xlink:
    // prefix is undeclared. happy-dom is lenient and parses it anyway, so we
    // cannot replicate that specific Chrome failure here.
    // The string-level tests above are the authoritative verification that the
    // fix adds the declaration that Chrome requires.

    it('DOMParser returns <svg> root for fixed C4Context SVG', () => {
      const parser = new DOMParser();
      const fixed = fixSvgNamespaces(C4_SVG_WITHOUT_XMLNS);
      const doc = parser.parseFromString(fixed, 'image/svg+xml');

      expect(doc.documentElement.tagName.toLowerCase()).toBe('svg');
    });

    it('fixed SVG has xmlns:xlink — satisfies the strict XML namespace requirement', () => {
      const fixed = fixSvgNamespaces(C4_SVG_WITHOUT_XMLNS);

      // This is the declaration that Chrome's XML parser requires.
      // Its presence is what prevents the <parsererror> in production.
      expect(fixed).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    });

    it('querySelector finds <svg> after fix — no more null svgEl', () => {
      const parser = new DOMParser();
      const fixed = fixSvgNamespaces(C4_SVG_WITHOUT_XMLNS);
      const doc = parser.parseFromString(fixed, 'image/svg+xml');

      const wrapper = document.createElement('div');
      wrapper.appendChild(doc.documentElement);

      // This was null before the fix (causing white page in initView())
      expect(wrapper.querySelector('svg')).not.toBeNull();
    });
  });
});
