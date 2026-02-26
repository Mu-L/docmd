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

function createDepthTrackingContainer(md, name, renderOpen, renderClose) {
  md.block.ruler.before('fence', `custom_${name}`, (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const lineContent = state.src.slice(start, max).trim();

    // Match opening tag e.g., `::: callout info Title`
    const regex = new RegExp(`^:::\\s+${name}(?:\\s+(.*))?$`);
    const match = lineContent.match(regex);
    if (!match) return false;
    if (silent) return true;

    let nextLine = startLine;
    let found = false;
    let depth = 1;
    let fenceMarker = null;

    while (nextLine < endLine) {
      nextLine++;
      if (nextLine >= endLine) break;

      const nextStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const nextMax = state.eMarks[nextLine];
      const nextContent = state.src.slice(nextStart, nextMax).trim();
      
      if (!fenceMarker) {
          const match = nextContent.match(/^(`{3,}|~{3,})/);
          if (match) fenceMarker = match[1];
      } else if (nextContent.startsWith(fenceMarker)) {
          fenceMarker = null;
      }

      if (!fenceMarker) {
        if (nextContent.match(/^:::\s+[a-zA-Z]/) && !nextContent.match(/^:::\s+button/)) {
          depth++; 
        } else if (nextContent.match(/^:::\s*$/)) {
          depth--; 
          if (depth === 0) {
            found = true;
            break;
          }
        }
      }
    }

    if (!found) return false;

    const info = match[1] || '';
    
    const openToken = state.push(`custom_${name}_open`, 'div', 1);
    openToken.info = info;

    const oldParentType = state.parentType;
    const oldLineMax = state.lineMax;
    state.parentType = 'container';
    state.lineMax = nextLine;

    // Tokenize inside the container
    state.md.block.tokenize(state, startLine + 1, nextLine);

    const closeToken = state.push(`custom_${name}_close`, 'div', -1);

    state.parentType = oldParentType;
    state.lineMax = oldLineMax;
    state.line = nextLine + 1;
    return true;
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

  // Register Renderers
  md.renderer.rules[`custom_${name}_open`] = renderOpen;
  md.renderer.rules[`custom_${name}_close`] = renderClose;
}

module.exports = {
  name: 'common-containers',
  setup(md) {
    
    // 1. Callout
    createDepthTrackingContainer(md, 'callout', (tokens, idx) => {
      const info = tokens[idx].info.trim();
      const parts = info.split(' ');
      const type = parts[0] || 'info'; 
      const title = parts.slice(1).join(' ');
      return `<div class="docmd-container callout callout-${type}">${title ? `<div class="callout-title">${title}</div>` : ''}<div class="callout-content">\n`;
    }, () => '</div></div>\n');

    // 2. Card
    createDepthTrackingContainer(md, 'card', (tokens, idx) => {
      const title = tokens[idx].info.trim();
      return `<div class="docmd-container card">${title ? `<div class="card-title">${title}</div>` : ''}<div class="card-content">\n`;
    }, () => '</div></div>\n');

    // 3. Collapsible
    createDepthTrackingContainer(md, 'collapsible', (tokens, idx) => {
      const info = tokens[idx].info.trim();
      const isOpen = info.startsWith('open ') || info === 'open';
      const title = isOpen ? info.replace('open', '').trim() : info;
      const displayTitle = title || 'Click to expand';
      
      return `<details class="docmd-container collapsible" ${isOpen ? 'open' : ''}>
        <summary class="collapsible-summary">
            <span class="collapsible-title">${displayTitle}</span>
            <span class="collapsible-arrow"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
        </summary>
        <div class="collapsible-content">\n`;
    }, () => '</div></details>\n');

  }
};