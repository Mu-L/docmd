/* Source file from the docmd project — https://github.com/docmd-io/docmd */

(function() {
  try {
    var localValue = localStorage.getItem('docmd-theme');
    var configValue = window.DOCMD_DEFAULT_MODE || 'light'; 
    var theme = localValue ? localValue : configValue;
    
    // Set HTML Attribute
    document.documentElement.setAttribute('data-theme', theme);

    // Resolve 'system' to actual mode for Highlight.js
    var effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Handle Highlight.js Theme
    var highlightLink = document.getElementById('highlight-theme');
    if (highlightLink) {
      var baseHref = highlightLink.getAttribute('data-base-href');
      if (baseHref) {
        // Force load the resolved theme (light/dark)
        highlightLink.href = baseHref + 'docmd-highlight-' + effectiveTheme + '.css';
      }
    }
  } catch (e) {
    console.error('Theme init failed', e);
  }
})();