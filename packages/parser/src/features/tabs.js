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

function smartDedent(str) {
  const lines = str.split('\n');
  let minIndent = Infinity;

  // 1. Find min indent
  lines.forEach(line => {
    if (line.trim().length === 0) return;
    const match = line.match(/^ */);
    if (match[0].length < minIndent) minIndent = match[0].length;
  });

  if (minIndent === Infinity) return str;

  // 2. Dedent
  return lines.map(line => {
    if (line.trim().length === 0) return '';
    return line.substring(minIndent);
  }).join('\n');
}

// Helper to identify fences
function isFenceLine(line) {
  return /^(\s{0,3})(~{3,}|`{3,})/.test(line);
}

// The Parsing Rule
function tabsRule(state, startLine, endLine, silent) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const lineContent = state.src.slice(start, max).trim();

  if (lineContent !== '::: tabs') return false;
  if (silent) return true;

  let nextLine = startLine;
  let found = false;
  let depth = 1;
  let inFence = false;

  // Find closing :::
  while (nextLine < endLine) {
    nextLine++;
    const nextStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const nextMax = state.eMarks[nextLine];
    const nextContent = state.src.slice(nextStart, nextMax).trim();
    
    if (isFenceLine(nextContent)) inFence = !inFence;

    if (!inFence) {
      if (nextContent.startsWith(':::')) {
        // We check if it has a name after :::
        if (nextContent.match(/^:::\s+[a-zA-Z]/)) {
            if (!nextContent.match(/^:::\s+button/)) {
                depth++;
            }
        } 
        // If it's a CLOSING tag (::: followed by nothing or whitespace)
        else if (nextContent.match(/^:::\s*$/)) {
          depth--;
          if (depth === 0) { 
            found = true; 
            break; 
          }
        }
      }
    }
  }
  if (!found) return false;

  // Extract content
  let content = '';
  for (let i = startLine + 1; i < nextLine; i++) {
    const lineStart = state.bMarks[i] + state.tShift[i];
    const lineEnd = state.eMarks[i];
    content += state.src.slice(lineStart, lineEnd) + '\n';
  }

  // Parse "== tab" lines
  const lines = content.split('\n');
  const tabs = [];
  let currentTab = null;
  let currentContentLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]; 
    const trimmedLine = rawLine.trim();
    const tabMatch = trimmedLine.match(/^==\s*tab\s+(?:"([^"]+)"|(\S+))$/);
    
    if (tabMatch) {
      if (currentTab) {
        currentTab.content = smartDedent(currentContentLines.join('\n'));
        tabs.push(currentTab);
      }
      const title = tabMatch[1] || tabMatch[2];
      currentTab = { title: title, content: '' };
      currentContentLines = [];
    } else if (currentTab) {
      currentContentLines.push(rawLine); 
    }
  }
  if (currentTab) {
    currentTab.content = smartDedent(currentContentLines.join('\n'));
    tabs.push(currentTab);
  }

  // Generate Tokens
  const openToken = state.push('tabs_open', 'div', 1);
  openToken.attrs = [['class', 'docmd-tabs']];
  
  const navToken = state.push('tabs_nav_open', 'div', 1);
  tabs.forEach((tab, index) => {
    const navItemToken = state.push('tabs_nav_item', 'div', 0);
    navItemToken.attrs = [['class', `docmd-tabs-nav-item ${index === 0 ? 'active' : ''}`]];
    navItemToken.content = tab.title;
  });
  state.push('tabs_nav_close', 'div', -1);
  
  const contentToken = state.push('tabs_content_open', 'div', 1);
  tabs.forEach((tab, index) => {
    const paneToken = state.push('tab_pane_open', 'div', 1);
    paneToken.attrs = [['class', `docmd-tab-pane ${index === 0 ? 'active' : ''}`]];
    
    if (tab.content) {
        // Recurse parsing inside tabs
        const renderedContent = state.md.render(tab.content, state.env);
        const htmlToken = state.push('html_block', '', 0);
        htmlToken.content = renderedContent;
    }
    state.push('tab_pane_close', 'div', -1);
  });
  state.push('tabs_content_close', 'div', -1);
  state.push('tabs_close', 'div', -1);
  
  state.line = nextLine + 1;
  return true;
}

module.exports = {
  name: 'tabs',
  setup(md) {
    // Register Rule
    md.block.ruler.before('fence', 'enhanced_tabs', tabsRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

    // Register Renderers
    md.renderer.rules.tabs_nav_open = () => '<div class="docmd-tabs-nav">';
    md.renderer.rules.tabs_nav_close = () => '</div>';
    md.renderer.rules.tabs_nav_item = (tokens, idx) => `<div class="${tokens[idx].attrs[0][1]}">${tokens[idx].content}</div>`;
    md.renderer.rules.tabs_content_open = () => '<div class="docmd-tabs-content">';
    md.renderer.rules.tabs_content_close = () => '</div>';
    md.renderer.rules.tab_pane_open = (tokens, idx) => `<div class="${tokens[idx].attrs[0][1]}">`;
    md.renderer.rules.tab_pane_close = () => '</div>';
    md.renderer.rules.tabs_close = () => '</div>';
  }
};