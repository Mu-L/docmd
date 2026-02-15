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

const ejs = require('ejs');
const { renderIcon } = require('./utils/icon-renderer');

/**
 * Renders an EJS template string with provided data.
 * NOTE: The 'templateString' must be read by the CLI and passed here.
 */
function renderTemplate(templateString, data, options = {}) {
  // Inject core helpers into every template
  const fullData = {
    ...data,
    renderIcon,
    // Helper to fix links relative to root
    fixLink: (url) => fixHtmlLinks(url, data.relativePathToRoot, data.isOfflineMode, data.config?.base)
  };

  try {
    return ejs.render(templateString, fullData, options);
  } catch (e) {
    throw new Error(`EJS Render Error: ${e.message}`);
  }
}

function fixHtmlLinks(url, root = './', isOffline = false, base = '/') {
  if (!url || url.startsWith('http') || url.startsWith('#') || url.startsWith('mailto:')) return url;

  let final = url;
  
  // Strip base if present
  if (base !== '/' && url.startsWith(base)) {
    final = '/' + url.substring(base.length);
  }

  // Make relative
  if (final.startsWith('/')) {
    final = root + final.substring(1);
  }

  // Offline adjustments
  if (isOffline) {
    if (!final.includes('.') && !final.endsWith('/')) final += '/index.html';
    else if (final.endsWith('/')) final += 'index.html';
  } else {
    // Clean URLs
    if (final.endsWith('/index.html')) final = final.substring(0, final.length - 10);
  }

  return final;
}

module.exports = { renderTemplate };