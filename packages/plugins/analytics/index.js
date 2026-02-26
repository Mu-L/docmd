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

/**
 * Generates Analytics scripts.
 * @param {Object} config 
 * @returns {Object} { headScriptsHtml, bodyScriptsHtml }
 */

function generateScripts(config) {
  let headScriptsHtml = '';
  let bodyScriptsHtml = '';
  
  const analytics = config.plugins?.analytics || {};

  // Google Analytics 4
  if (analytics.googleV4?.measurementId) {
    const id = analytics.googleV4.measurementId;
    headScriptsHtml += `
    <!-- GA4 -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${id}');
    </script>\n`;
  }

  // Legacy UA
  if (analytics.googleUA?.trackingId) {
    const id = analytics.googleUA.trackingId;
    headScriptsHtml += `
    <!-- UA (Legacy) -->
    <script async src="https://www.google-analytics.com/analytics.js"></script>
    <script>
      window.ga=window.ga||function(){(ga.q=ga.q||[]).push(arguments)};ga.l=+new Date;
      ga('create', '${id}', 'auto');
      ga('send', 'pageview');
    </script>\n`;
  }

  return { headScriptsHtml, bodyScriptsHtml };
}

module.exports = { generateScripts };