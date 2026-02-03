/* Source file from the docmd project — https://github.com/docmd-io/docmd */

(function() {
  try {
    var localValue = localStorage.getItem('docmd-theme');
    var configValue = window.DOCMD_DEFAULT_MODE || 'light'; 
    var theme = localValue ? localValue : configValue;
    
    // Resolve system preference immediately
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Apply to HTML and Body to ensure all CSS selectors catch it
    document.documentElement.setAttribute('data-theme', theme);
    
    // We use a small interval to ensure body exists (since this script is in head)
    var checkBody = setInterval(function() {
      if (document.body) {
        document.body.setAttribute('data-theme', theme);
        clearInterval(checkBody);
      }
    }, 10);

    // Handle Highlight.js Theme
    var highlightLink = document.getElementById('highlight-theme');
    if (highlightLink) {
      var baseHref = highlightLink.getAttribute('data-base-href');
      if (baseHref) {
        highlightLink.href = baseHref + 'docmd-highlight-' + theme + '.css';
      }
    }
  } catch (e) {
    console.error('Theme init failed', e);
  }
})();