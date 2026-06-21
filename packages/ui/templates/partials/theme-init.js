/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

(function () {
  try {
    // 1. Determine Theme
    //
    // Resolve from three sources, in priority order:
    //   1. localStorage explicit user choice (light / dark)
    //   2. window.DOCMD_APPEARANCE  (current canonical name, set by EJS templates)
    //   3. window.DOCMD_DEFAULT_MODE (legacy alias kept for pre-0.8.7 outputs)
    //   4. 'light' as the final fallback
    //
    // Note: localStorage is only honoured when it holds an explicit
    // 'light' or 'dark' value. A stored 'system' value (from a prior
    // session where the user picked "follow system") must NOT win over
    // a freshly resolved config value — the resolved value will itself
    // be 'system' in that case and the OS preference check below takes
    // over, so this is a no-op for the in-session behaviour but keeps
    // any future storage migration simple.
    var localValue = localStorage.getItem('docmd-theme');
    var configValue = window.DOCMD_APPEARANCE
      || window.DOCMD_DEFAULT_MODE
      || 'light';
    var theme = (localValue === 'light' || localValue === 'dark')
      ? localValue
      : configValue;

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

    document.documentElement.style.visibility = "visible";
  } catch (e) {
    document.documentElement.style.visibility = "visible";
    console.error('Theme init failed', e);
  }
})();