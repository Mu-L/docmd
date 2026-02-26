/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025 docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

(async function () {
  'use strict';

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
  }

  // 1. Save original text so we can re-render later without reloading
  document.querySelectorAll('.mermaid').forEach(el => {
      if (!el.dataset.original) el.dataset.original = el.textContent;
  });

  async function render() {
    mermaid.initialize({ startOnLoad: false, theme: getTheme(), securityLevel: 'loose' });
    try {
      await mermaid.run({ querySelector: '.mermaid' });
    } catch (e) { console.error('Mermaid render failed:', e); }
  }

  // 2. Theme Observer
  const observer = new MutationObserver(async (mutations) => {
    for (const m of mutations) {
      if (m.attributeName === 'data-theme') {
        // Restore original text, remove processed flags, and re-render
        document.querySelectorAll('.mermaid').forEach(el => {
            el.removeAttribute('data-processed');
            el.innerHTML = el.dataset.original;
        });
        render();
      }
    }
  });
  
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();

  // 3. Hook into SPA Router
  document.addEventListener('docmd:page-mounted', () => {
      document.querySelectorAll('.mermaid').forEach(el => {
          if (!el.dataset.original) el.dataset.original = el.textContent;
      });
      render();
  });
})();