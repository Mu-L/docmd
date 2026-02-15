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

  // 1. Initialize
  const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
  
  mermaid.initialize({
    startOnLoad: false,
    theme: theme,
    securityLevel: 'loose',
    fontFamily: 'inherit'
  });

  // 2. Render Function
  async function render() {
    try {
      // Mermaid 10/11 API: run() handles finding .mermaid classes
      await mermaid.run({
        querySelector: '.mermaid'
      });
    } catch (e) {
      console.error('Mermaid rendering failed:', e);
    }
  }

  // 3. Theme Observer
  const observer = new MutationObserver(async (mutations) => {
    for (const m of mutations) {
      if (m.attributeName === 'data-theme') {
        // Reload to force re-render with new theme variables
        // (Mermaid doesn't support dynamic theme swapping easily without re-parsing)
        location.reload(); 
      }
    }
  });
  
  observer.observe(document.documentElement, { 
    attributes: true, 
    attributeFilter: ['data-theme'] 
  });

  // 4. Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();