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

import { renderIcon } from '../utils/icon-renderer.js';

function tagInlineRule(state, silent) {
  const start = state.pos;
  const max = state.posMax;
  
  if (state.src.charCodeAt(start) !== 0x3A /* : */) return false;
  if (state.src.slice(start, start + 3) !== ':::') return false;

  // We are at `:::`. Let's see if it's `::: tag `
  const match = state.src.slice(start, max).match(/^:::\s+tag\s+(?:["']([^"']+)["']|(\S+))((?:\s+(?:icon|color|link):\S+)*)/);
  if (!match) return false;

  if (silent) return true;

  const text = match[1] || match[2] || 'Tag';
  const optionsStr = match[3] || '';
  
  let icon = '';
  let color = '';
  let link = '';

  const parts = optionsStr.trim().split(/\s+/);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('icon:')) icon = part.substring(5);
    else if (part.startsWith('color:')) color = part.substring(6);
    else if (part.startsWith('link:')) link = part.substring(5);
  }

  state.pos += match[0].length;

  const token = state.push('html_inline', '', 0);

  let styleAttr = '';
  if (color) {
    styleAttr = ` style="--tag-color: ${color}; background-color: color-mix(in srgb, ${color} 15%, transparent); color: ${color}; border-color: color-mix(in srgb, ${color} 30%, transparent);"`;
  }

  let iconHtml = '';
  if (icon) {
    iconHtml = renderIcon(icon, { class: 'tag-icon', style: 'width:12px;height:12px;margin-right:4px;' });
  }

  let tagHtml = `<span class="docmd-tag"${styleAttr}>${iconHtml}${state.md.renderInline(text)}</span>`;

  if (link) {
    const isExternal = link.startsWith('http');
    const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    tagHtml = `<a href="${link}" class="docmd-tag-link" style="text-decoration:none;"${targetAttr}>${tagHtml}</a>`;
  }

  token.content = tagHtml;

  return true;
}

export default {
  name: 'tags',
  setup(md) {
    md.inline.ruler.before('text', 'docmd_tag_inline', tagInlineRule);
  }
};