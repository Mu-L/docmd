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

(function() {
  try {
    // 1. Determine Theme
    var localValue = localStorage.getItem('docmd-theme');
    var configValue = window.DOCMD_DEFAULT_MODE || 'light'; 
    var theme = localValue ? localValue : configValue;
    
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // 2. Apply to Root
    document.documentElement.setAttribute('data-theme', theme);
    
    // 3. Highlight.js Toggle Strategy
    var lightLink = document.getElementById('hljs-light');
    var darkLink = document.getElementById('hljs-dark');
    
    if (lightLink && darkLink) {
        if (theme === 'dark') {
            lightLink.disabled = true;
            darkLink.disabled = false;
        } else {
            lightLink.disabled = false;
            darkLink.disabled = true;
        }
    }

  } catch (e) {
    console.error('Theme init failed', e);
  }
})();