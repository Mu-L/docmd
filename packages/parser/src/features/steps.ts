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

function stepsRule(state, startLine, endLine, silent) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const lineContent = state.src.slice(start, max).trim();
  // Support both '::: steps' and ':::steps' (spaceless)
  if (lineContent !== '::: steps' && lineContent !== ':::steps') return false;
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
      if (nextContent.match(/^:::\s*[a-zA-Z]/) && !nextContent.match(/^:::\s*button/)) {
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

  const openToken = state.push('steps_open', 'div', 1);
  openToken.info = '';

  const oldParentType = state.parentType;
  const oldLineMax = state.lineMax;
  state.parentType = 'container';
  state.lineMax = nextLine;

  state.md.block.tokenize(state, startLine + 1, nextLine);

  state.push('steps_close', 'div', -1);

  state.parentType = oldParentType;
  state.lineMax = oldLineMax;
  state.line = nextLine + 1;
  return true;
}

export default {
  name: 'steps',
  setup(md) {
    md.block.ruler.before('fence', 'steps_container', stepsRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

    // Module-level counter so each <li> gets a globally unique `id`
    // (step-1, step-2, …) across the whole document. This matters for
    // permalinks: clicking `#step-1` on a page with two step containers
    // would otherwise scroll to the first match in both.
    let stepIndex = 0;

    // Custom List Renderer for Steps
    md.renderer.rules.steps_open = () => '<div class="docmd-container steps steps-reset">';
    md.renderer.rules.steps_close = () => '</div>';

    // Hook into list rendering to add classes when inside steps
    md.renderer.rules.ordered_list_open = function (tokens, idx, options, env, self) {
      let isInSteps = false;
      // Check tokens backward to see if we are inside a steps container
      for (let i = idx - 1; i >= 0; i--) {
        if (tokens[i].type === 'steps_open') { isInSteps = true; break; }
        if (tokens[i].type === 'steps_close') break;
      }
      if (isInSteps) {
        const start = tokens[idx].attrGet('start');
        return start ? `<ol class="steps-list" start="${start}">` : '<ol class="steps-list">';
      }
      return self.renderToken(tokens, idx, options);
    };

    // Lucide `link-2` icon — same as the one used by .heading-anchor so the
    // visual language stays consistent across the site.
    const STEP_PERMALINK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2m6 0h2a5 5 0 1 1 0 10h-2m-7-5h8"/></svg>';

    md.renderer.rules.list_item_open = function (tokens, idx, _options, _env, _self) {
      let isInSteps = false;
      for (let i = idx - 1; i >= 0; i--) {
        if (tokens[i].type === 'steps_open') { isInSteps = true; break; }
        if (tokens[i].type === 'steps_close') break;
      }
      if (isInSteps) {
        stepIndex++;
        // Render a permalink anchor that's hidden by default and revealed
        // on hover. Uses `scroll-margin-top` via .step-item so jumping
        // to the anchor lands just below the sticky header.
        const id = `step-${stepIndex}`;
        const permalink = `<a href="#${id}" class="step-permalink" aria-label="Permalink to this step">${STEP_PERMALINK_SVG}</a>`;
        return `<li class="step-item" id="${id}">${permalink}`;
      }
      return '<li>';
    };
  }
};