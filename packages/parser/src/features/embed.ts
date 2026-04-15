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

import { embed } from 'embed-lite';

function embedRule(state: any, startLine: number, endLine: number, silent: boolean) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const lineContent = state.src.slice(start, max).trim();

  const match = lineContent.match(/^:::\s+embed\s+(?:\[|")?((https?:\/\/)[^\]"\s]+)(?:\]|")?$/i);
  if (!match) return false;
  if (silent) return true;

  const urlStr = match[1];
  let html = '';

  try {
    const embedResult = embed(urlStr, { className: 'docmd-embed' });
    if (embedResult && embedResult.html) {
      // We received a valid parsed native iframe/blockquote component
      html = embedResult.html;
    } else {
      const url = new URL(urlStr);
      const hostname = url.hostname.replace('www.', '');
      html = `<div class="docmd-embed-fallback"><a href="${urlStr}" class="docmd-button docmd-button-external" target="_blank" rel="noopener noreferrer">Open ${hostname} link</a></div>`;
    }
  } catch (e) {
    // Hard fallback if string is entirely invalid URL
    html = `<div class="docmd-embed-fallback"><a href="${urlStr}" class="docmd-button docmd-button-external" target="_blank" rel="noopener noreferrer">Open link</a></div>`;
  }

  const token = state.push('html_inline', '', 0);
  token.content = html;

  state.line = startLine + 1;
  return true;
}

export default {
  name: 'embed',
  setup(md: any) {
    md.block.ruler.before('paragraph', 'docmd_embed', embedRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  }
};