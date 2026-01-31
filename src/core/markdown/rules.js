// Source file from the docmd project — https://github.com/docmd-io/docmd

const MarkdownIt = require('markdown-it');
const { containers } = require('./containers');

// --- Helper: Smart Dedent ---
// This handles the "Tab Indentation" and "Code Block" nesting issues
function smartDedent(str) {
    const lines = str.split('\n');
    
    // 1. Calculate global minimum indent (ignoring empty lines)
    let minIndent = Infinity;
    lines.forEach(line => {
        if (line.trim().length === 0) return;
        const match = line.match(/^ */);
        const indent = match ? match[0].length : 0;
        if (indent < minIndent) minIndent = indent;
    });

    if (minIndent === Infinity) return str;

    // 2. Strip the common indent
    const dedented = lines.map(line => {
        if (line.trim().length === 0) return '';
        return line.substring(minIndent);
    });

    // 3. Fix Code Fences
    // If a line looks like a code fence (```) but is still indented 4+ spaces,
    // it will be parsed as an "Indented Code Block" containing text, not a Fence.
    // We force-pull these specific lines to the left to ensure they render as Fences.
    return dedented.map(line => {
        // Regex: 4 or more spaces, followed by 3 or more backticks/tildes
        if (/^\s{4,}(`{3,}|~{3,})/.test(line)) {
            return line.trimStart(); 
        }
        return line;
    }).join('\n');
}

// Helper to check if a line starts a fence
function isFenceLine(line) {
    return /^(\s{0,3})(~{3,}|`{3,})/.test(line);
}

// --- 1. Advanced Container Rule ---
function advancedContainerRule(state, startLine, endLine, silent) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const lineContent = state.src.slice(start, max).trim();
  
  const containerMatch = lineContent.match(/^:::\s*(\w+)(?:\s+(.+))?$/);
  if (!containerMatch) return false;
  
  const [, containerName, params] = containerMatch;
  const container = containers[containerName];
  if (!container) return false;
  if (silent) return true;
  
  if (container.selfClosing) {
    const openToken = state.push(`container_${containerName}_open`, 'div', 1);
    openToken.info = params || '';
    const closeToken = state.push(`container_${containerName}_close`, 'div', -1);
    state.line = startLine + 1;
    return true;
  }
  
  let nextLine = startLine;
  let found = false;
  let depth = 1;
  let inFence = false;
  
  while (nextLine < endLine) {
    nextLine++;
    const nextStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const nextMax = state.eMarks[nextLine];
    const nextContent = state.src.slice(nextStart, nextMax).trim();
    
    // Check for fences to prevent parsing ::: inside code blocks (#42)
    if (isFenceLine(nextContent)) inFence = !inFence;

    if (!inFence) {
        if (nextContent.startsWith(':::')) {
          const containerMatch = nextContent.match(/^:::\s*(\w+)/);
          if (containerMatch && containerMatch[1] !== containerName) {
            const innerContainer = containers[containerMatch[1]];
            if (innerContainer && innerContainer.render && !innerContainer.selfClosing) {
              depth++;
            }
            continue;
          }
        }
        
        if (nextContent === ':::') {
          depth--;
          if (depth === 0) {
            found = true;
            break;
          }
        }
    }
  }
  
  if (!found) return false;
  
  const openToken = state.push(`container_${containerName}_open`, 'div', 1);
  openToken.info = params || '';
  
  const oldParentType = state.parentType;
  const oldLineMax = state.lineMax;
  state.parentType = 'container';
  state.lineMax = nextLine;
  
  state.md.block.tokenize(state, startLine + 1, nextLine);
  
  const closeToken = state.push(`container_${containerName}_close`, 'div', -1);
  
  state.parentType = oldParentType;
  state.lineMax = oldLineMax;
  state.line = nextLine + 1;
  
  return true;
}

// --- 2. Changelog Timeline Rule ---
function changelogTimelineRule(state, startLine, endLine, silent) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const lineContent = state.src.slice(start, max).trim();

  if (lineContent !== '::: changelog') return false;
  if (silent) return true;

  let nextLine = startLine;
  let found = false;
  let depth = 1;
  let inFence = false;
  
  while (nextLine < endLine) {
    nextLine++;
    const nextStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const nextMax = state.eMarks[nextLine];
    const nextContent = state.src.slice(nextStart, nextMax).trim();
    
    if (isFenceLine(nextContent)) inFence = !inFence;

    if (!inFence) {
        if (nextContent.startsWith(':::')) {
          const match = nextContent.match(/^:::\s*(\w+)/);
          if (match) {
            const containerName = match[1];
            const containerDef = containers[containerName];
            if (!containerDef || !containerDef.selfClosing) depth++;
          }
        }
        if (nextContent === ':::') {
          depth--;
          if (depth === 0) { found = true; break; }
        }
    }
  }
  
  if (!found) return false;

  let content = '';
  for (let i = startLine + 1; i < nextLine; i++) {
    const lineStart = state.bMarks[i] + state.tShift[i];
    const lineEnd = state.eMarks[i];
    content += state.src.slice(lineStart, lineEnd) + '\n';
  }

  const lines = content.split('\n');
  const entries = [];
  let currentEntry = null;
  let currentContentLines = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();
    const markerMatch = trimmedLine.match(/^==\s+(.+)$/);

    if (markerMatch) {
      if (currentEntry) {
        currentEntry.content = smartDedent(currentContentLines.join('\n'));
        entries.push(currentEntry);
      }
      currentEntry = { meta: markerMatch[1], content: '' };
      currentContentLines = [];
    } else if (currentEntry) {
      currentContentLines.push(rawLine);
    }
  }
  if (currentEntry) {
    currentEntry.content = smartDedent(currentContentLines.join('\n'));
    entries.push(currentEntry);
  }

  state.push('container_changelog_open', 'div', 1);

  entries.forEach(entry => {
    const entryOpen = state.push('html_block', '', 0);
    entryOpen.content = `<div class="changelog-entry">
      <div class="changelog-meta"><span class="changelog-date">${entry.meta}</span></div>
      <div class="changelog-body">`;

    entryOpen.content += state.md.render(entry.content, state.env);
    
    const entryClose = state.push('html_block', '', 0);
    entryClose.content = `</div></div>`;
  });

  state.push('container_changelog_close', 'div', -1);
  state.line = nextLine + 1;
  return true;
}

// --- 3. Steps Container Rule ---
function stepsContainerRule(state, startLine, endLine, silent) {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const lineContent = state.src.slice(start, max).trim();
    if (lineContent !== '::: steps') return false;
    if (silent) return true;
  
    let nextLine = startLine;
    let found = false;
    let depth = 1;
    let inFence = false;
    
    while (nextLine < endLine) {
      nextLine++;
      const nextStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const nextMax = state.eMarks[nextLine];
      const nextContent = state.src.slice(nextStart, nextMax).trim();
      
      if (isFenceLine(nextContent)) inFence = !inFence;

      if (!inFence) {
          if (nextContent.startsWith('== tab')) continue;
          if (nextContent.startsWith(':::')) {
            const containerMatch = nextContent.match(/^:::\s*(\w+)/);
            if (containerMatch) {
              const containerName = containerMatch[1];
              const innerContainer = containers[containerName];
              if (innerContainer && !innerContainer.selfClosing) depth++;
              continue;
            }
          }
          if (nextContent === ':::') {
            depth--;
            if (depth === 0) { found = true; break; }
          }
      }
    }
    
    if (!found) return false;
  
    const openToken = state.push('container_steps_open', 'div', 1);
    openToken.info = '';
    
    const oldParentType = state.parentType;
    const oldLineMax = state.lineMax;
    state.parentType = 'container';
    state.lineMax = nextLine;
    state.md.block.tokenize(state, startLine + 1, nextLine);
    const closeToken = state.push('container_steps_close', 'div', -1);
    state.parentType = oldParentType;
    state.lineMax = oldLineMax;
    state.line = nextLine + 1;
    return true;
}

// --- 4. Enhanced Tabs Rule (Fixed) ---
function enhancedTabsRule(state, startLine, endLine, silent) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const lineContent = state.src.slice(start, max).trim();

  if (lineContent !== '::: tabs') return false;
  if (silent) return true;

  let nextLine = startLine;
  let found = false;
  let depth = 1;
  let inFence = false;

  while (nextLine < endLine) {
    nextLine++;
    const nextStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const nextMax = state.eMarks[nextLine];
    const nextContent = state.src.slice(nextStart, nextMax).trim();
    
    if (isFenceLine(nextContent)) inFence = !inFence;

    if (!inFence) {
        if (nextContent.startsWith(':::')) {
          const containerMatch = nextContent.match(/^:::\s*(\w+)/);
          if (containerMatch && containerMatch[1] !== 'tabs') {
            if (containerMatch[1] === 'steps') continue;
            const innerContainer = containers[containerMatch[1]];
            if (innerContainer && !innerContainer.selfClosing) depth++;
            continue;
          }
        }
        if (nextContent === ':::') {
          depth--;
          if (depth === 0) { found = true; break; }
        }
    }
  }
  if (!found) return false;

  let content = '';
  // Capture content preserving newlines
  for (let i = startLine + 1; i < nextLine; i++) {
    const lineStart = state.bMarks[i] + state.tShift[i];
    const lineEnd = state.eMarks[i];
    // .slice() keeps the indentation of the line as it is in source
    content += state.src.slice(lineStart, lineEnd) + '\n';
  }

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
        // Apply Smart Dedent before saving
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

  const openToken = state.push('tabs_open', 'div', 1);
  openToken.attrs = [['class', 'docmd-tabs']];
  
  const navToken = state.push('tabs_nav_open', 'div', 1);
  navToken.attrs = [['class', 'docmd-tabs-nav']];
  tabs.forEach((tab, index) => {
    const navItemToken = state.push('tabs_nav_item', 'div', 0);
    navItemToken.attrs = [['class', `docmd-tabs-nav-item ${index === 0 ? 'active' : ''}`]];
    navItemToken.content = tab.title;
  });
  state.push('tabs_nav_close', 'div', -1);
  
  const contentToken = state.push('tabs_content_open', 'div', 1);
  contentToken.attrs = [['class', 'docmd-tabs-content']];
  tabs.forEach((tab, index) => {
    const paneToken = state.push('tab_pane_open', 'div', 1);
    paneToken.attrs = [['class', `docmd-tab-pane ${index === 0 ? 'active' : ''}`]];
    
    if (tab.content) {
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

const standaloneClosingRule = (state, startLine, endLine, silent) => {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const lineContent = state.src.slice(start, max).trim();
  
  if (lineContent === ':::') {
    if (silent) return true;
    state.line = startLine + 1;
    return true;
  }
  return false;
};

module.exports = {
  advancedContainerRule,
  changelogTimelineRule,
  stepsContainerRule,
  enhancedTabsRule,
  standaloneClosingRule
};