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
import { resolveHref } from '../utils/normalize-href.js';

/**
 * Strips a matched pair of surrounding quotes from a value if present.
 * The tag options parser captures both quoted ("..." or '...') and
 * unquoted forms in a single regex; this normalises them to a plain
 * string before passing to downstream helpers like resolveHref.
 */
function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value.charAt(0);
    const last = value.charAt(value.length - 1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function tagInlineRule(state, silent) {
  const start = state.pos;
  const max = state.posMax;
  
  if (state.src.charCodeAt(start) !== 0x3A /* : */) return false;
  if (state.src.slice(start, start + 3) !== ':::') return false;

  // We are at `:::`. Let's see if it's `::: tag` or `:::tag` (spaceless).
  //
  // Option values accept three forms so URLs and other values that
  // contain reserved characters can be wrapped in quotes for clarity
  // (matching the rule used by other docmd containers):
  //   - icon:check-circle        (unquoted)
  //   - color:#ef4444            (unquoted)
  //   - url:"../../release.md"   (double-quoted, recommended for URLs)
  //   - url:'../../release.md'   (single-quoted)
  //
  // `url:` is the canonical name; `link:` is kept as an alias for
  // backward compatibility with existing pages.
  const match = state.src.slice(start, max).match(
    /^:::\s*tag\s+(?:["']([^"']+)["']|(\S+))((?:\s+(?:icon|color|link|url):(?:"[^"]*"|'[^']*'|\S+))*)/
  );
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
    if (part.startsWith('icon:')) icon = unquote(part.substring(5));
    else if (part.startsWith('color:')) color = unquote(part.substring(6));
    else if (part.startsWith('link:')) link = unquote(part.substring(5));
    else if (part.startsWith('url:')) link = unquote(part.substring(4));
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
    const result = resolveHref(link);
    const targetAttr = result.isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    tagHtml = `<a href="${result.href}" class="docmd-tag-link" style="text-decoration:none;"${targetAttr}>${tagHtml}</a>`;
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