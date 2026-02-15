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

const path = require('path');

function markdownSetup(md) {
  const defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = token.info.trim();
    if (info === 'mermaid') {
      return `<div class="mermaid">${token.content}</div>`;
    }
    return defaultFence(tokens, idx, options, env, self);
  };
}

function getAssets() {
  return [
    // REMOVED: The direct CDN link to mermaid.min.js
    // We now rely on init-mermaid.js to import it as a module
    {
      src: path.join(__dirname, 'assets/init-mermaid.js'),
      dest: 'assets/js/init-mermaid.js',
      type: 'js',
      location: 'body',
      attributes: { type: 'module' } 
    }
  ];
}

module.exports = { markdownSetup, getAssets };