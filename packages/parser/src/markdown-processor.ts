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

import MarkdownIt from 'markdown-it';
import matter from 'lite-matter';
import { highlight } from 'lite-hl';

// Standard Plugins
import attrs from 'markdown-it-attrs';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import abbr from 'markdown-it-abbr';
import deflist from 'markdown-it-deflist';
import emoji from 'markdown-it-emoji';

// The Feature Registry
import { registerFeatures } from './features/index.js';

// Custom Heading ID & Anchor Logic
const headingIdPlugin = (md, options: any = {}) => {
  const uiStrings = options.uiStrings || {};
  md.core.ruler.push('heading_anchors', function (state) {
    let containerDepth = 0;
    const lastHeadingIds = new Array(7).fill(null);
    const usedIds = new Map();

    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];

      // Track block-level inline containers (like steps)
      if (token.type === 'steps_open' || (token.type.startsWith('custom_') && token.type.endsWith('_open'))) {
        containerDepth++;
      }
      if (token.type === 'steps_close' || (token.type.startsWith('custom_') && token.type.endsWith('_close'))) {
        containerDepth--;
      }

      const inContainer = state.env.isInsideContainer || containerDepth > 0;

      if (token.type === 'heading_open') {
        const level = parseInt(token.tag.slice(1), 10);
        const inlineToken = state.tokens[i + 1];

        // 1. Generate ID if not present and NOT in a container
        let id = token.attrGet('id');
        if (!id && inlineToken && inlineToken.content && !inContainer) {
          const slug = inlineToken.content
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\p{L}\p{N}-]+/gu, '')
            .replace(/--+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');

          if (slug) {
            // Find parent ID from previous levels
            let parentId = null;
            for (let j = level - 1; j >= 1; j--) {
              if (lastHeadingIds[j]) {
                parentId = lastHeadingIds[j];
                break;
              }
            }

            id = parentId ? `${parentId}-${slug}` : slug;

            // Handle hard collisions (same heading sequence twice)
            if (usedIds.has(id)) {
              const count = usedIds.get(id);
              usedIds.set(id, count + 1);
              id = `${id}-${count}`;
            } else {
              usedIds.set(id, 1);
            }

            token.attrSet('id', id);
            lastHeadingIds[level] = id;
            // Clear deeper levels to prevent wrong parent nesting on backtrack
            for (let j = level + 1; j <= 6; j++) lastHeadingIds[j] = null;
          }
        }

        // If we are in a container, strip existing IDs so they don't break the TOC parsing
        if (inContainer) {
          if (token.attrs) {
            token.attrs = token.attrs.filter(a => a[0] !== 'id');
          }
          id = null;
        }

        // 2. Inject Hover Anchor as an HTML Token (for H2, H3, H4)
        if (id && level >= 2 && level <= 4 && !inContainer) {
          const existingClass = token.attrGet('class') || '';
          token.attrSet('class', `${existingClass} docmd-heading`.trim());

          if (inlineToken && inlineToken.children) {
            const anchorToken = new state.Token('html_inline', '', 0);
            const anchorLabel = uiStrings.permalinkToSection || 'Permalink to this section';
            anchorToken.content = `<a href="#${id}" class="heading-anchor" aria-label="${anchorLabel}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link2-icon lucide-link-2"><path d="M9 17H7A5 5 0 0 1 7 7h2m6 0h2a5 5 0 1 1 0 10h-2m-7-5h8"/></svg></a>`;

            // Insert the anchor at the beginning of the heading text
            inlineToken.children.unshift(anchorToken);
          }
        }
      }
    }
  });
};

// Main Factory Function to Create a Markdown Processor
function createMarkdownProcessor(config: any = {}, pluginsCallback: any) {
  const mdOptions: any = {
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
  };

  // Syntax Highlighting
  const highlightFn = (str, lang) => {
    if (lang === 'mermaid') {
      return `<pre class="mermaid">${new MarkdownIt().utils.escapeHtml(str)}</pre>`;
    }
    const highlighted = highlight(str, { language: lang, mimicHljs: true }).value;
    return `<pre class="hljs"><code>${highlighted}</code></pre>`;
  };

  mdOptions.highlight = config.theme?.codeHighlight !== false ? highlightFn : (str: any, lang: any) => {
    if (lang === 'mermaid') return `<pre class="mermaid">${new MarkdownIt().utils.escapeHtml(str)}</pre>`;
    return `<pre><code>${new MarkdownIt().utils.escapeHtml(str)}</code></pre>`;
  };

  const md = new MarkdownIt(mdOptions);

  // Core Plugins
  md.use(attrs, { leftDelimiter: '{', rightDelimiter: '}' });
  md.use(footnote);
  md.use(taskLists);
  md.use(abbr);
  md.use(deflist);
  md.use(emoji);
  md.use(headingIdPlugin, { uiStrings: config._uiStrings || {} });

  // Register Built-in Features
  registerFeatures(md);

  // External Plugins Hook
  if (typeof pluginsCallback === 'function') {
    pluginsCallback(md);
  }

  const defaultLinkOpen = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const hrefIndex = token.attrIndex('href');

    if (hrefIndex >= 0) {
      let href = token.attrs[hrefIndex][1];

      const isExternal = href.match(/^(?:[a-z]+:|\/\/)/i);
      const isAsset = href.match(/(^|\/)assets\//);
      const isHashOnly = href.startsWith('#');

      if (!isExternal && !isAsset && !isHashOnly) {
        // Extract hash if it exists (e.g., info.md#section)
        let hash = '';
        const hashIndex = href.indexOf('#');
        if (hashIndex >= 0) {
          hash = href.substring(hashIndex);
          href = href.substring(0, hashIndex);
        }

        if (href.endsWith('.md')) {
          href = href.replace(/\.md$/, '');

          // If the page was shifted into a subfolder (Clean URLs), we must traverse up one level
          if (!href.startsWith('/') && env && env.isIndex === false) {
            if (href.startsWith('./')) {
              href = '../' + href.substring(2);
            } else {
              href = '../' + href;
            }
          }

          token.attrs[hrefIndex][1] = href + hash;
        }
      }
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return md;
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '');
}

function extractHeadings(html) {
  const headings = [];
  // Require non-empty ID match to exclude stripped container headings: "([^"]+)"
  const regex = /<h([1-6])[^>]*?id="([^"]+)"[^>]*?>([\s\S]*?)<\/h\1>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1], 10),
      id: match[2],
      text: match[3].replace(/<\/?[^>]+(>|$)/g, '').trim()
    });
  }
  return headings;
}

function processContent(rawString, mdInstance, config, env = {}) {
  let frontmatter, markdownContent;

  try {
    const parsed = matter(rawString);
    frontmatter = parsed.data;
    markdownContent = parsed.content;
  } catch (e) {
    console.error('Error parsing frontmatter:', e.message);
    return null;
  }

  if (!frontmatter.title && config.autoTitleFromH1 !== false) {
    const h1Match = markdownContent.match(/^#\s+(.*)/m);
    if (h1Match) frontmatter.title = h1Match[1].trim();
  }

  const htmlContent = mdInstance.render(markdownContent, env);
  const headings = extractHeadings(htmlContent);

  let searchData = null;
  if (!frontmatter.noindex) {
    searchData = {
      title: frontmatter.title || 'Untitled',
      content: stripHtml(htmlContent).slice(0, 5000),
      headings: headings.map(h => ({ id: h.id, text: h.text }))
    };
  }

  return { frontmatter, htmlContent, headings, searchData };
}

async function processContentAsync(rawString, mdInstance, config, env = {}, hooks: any = null) {
  let frontmatter, markdownContent;

  try {
    const parsed = matter(rawString);
    frontmatter = parsed.data;
    markdownContent = parsed.content;
  } catch (e) {
    console.error('Error parsing frontmatter:', e.message);
    return null;
  }

  if (hooks && hooks.onBeforeParse) {
    for (const fn of hooks.onBeforeParse) {
      markdownContent = await fn(markdownContent, frontmatter);
    }
  }

  if (!frontmatter.title && config.autoTitleFromH1 !== false) {
    const h1Match = markdownContent.match(/^#\s+(.*)/m);
    if (h1Match) frontmatter.title = h1Match[1].trim();
  }

  let htmlContent = mdInstance.render(markdownContent, env);

  if (hooks && hooks.onAfterParse) {
    for (const fn of hooks.onAfterParse) {
      htmlContent = await fn(htmlContent, frontmatter);
    }
  }

  const headings = extractHeadings(htmlContent);

  let searchData = null;
  if (!frontmatter.noindex) {
    searchData = {
      title: frontmatter.title || 'Untitled',
      content: stripHtml(htmlContent).slice(0, 5000),
      headings: headings.map((h: any) => ({ id: h.id, text: h.text }))
    };
  }

  return { frontmatter, htmlContent, headings, searchData };
}

export { createMarkdownProcessor, processContent, processContentAsync };