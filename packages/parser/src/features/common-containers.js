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

const container = require('markdown-it-container');

module.exports = {
  name: 'common-containers',
  setup(md) {
    // 1. Callout
    md.use(container, 'callout', {
      render: (tokens, idx) => {
        if (tokens[idx].nesting === 1) {
          const info = tokens[idx].info.trim();
          const parts = info.split(' ');
          const type = parts[1] || 'info'; 
          const title = parts.slice(2).join(' ');
          return `<div class="docmd-container callout callout-${type}">${title ? `<div class="callout-title">${title}</div>` : ''}<div class="callout-content">\n`;
        }
        return '</div></div>\n';
      }
    });

    // 2. Card
    md.use(container, 'card', {
      render: (tokens, idx) => {
        if (tokens[idx].nesting === 1) {
          const title = tokens[idx].info.replace('card', '').trim();
          return `<div class="docmd-container card">${title ? `<div class="card-title">${title}</div>` : ''}<div class="card-content">\n`;
        }
        return '</div></div>\n';
      }
    });

    // 3. Collapsible
    md.use(container, 'collapsible', {
      render: (tokens, idx) => {
        if (tokens[idx].nesting === 1) {
          const info = tokens[idx].info.replace('collapsible', '').trim();
          // Check for "open" keyword
          const isOpen = info.startsWith('open ') || info === 'open';
          const title = isOpen ? info.replace('open', '').trim() : info;
          const displayTitle = title || 'Click to expand';
          
          return `<details class="docmd-container collapsible" ${isOpen ? 'open' : ''}>
            <summary class="collapsible-summary">
                <span class="collapsible-title">${displayTitle}</span>
                <span class="collapsible-arrow"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
            </summary>
            <div class="collapsible-content">\n`;
        }
        return '</div></details>\n';
      }
    });
  }
};