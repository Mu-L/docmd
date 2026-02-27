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

const MarkdownIt = require('markdown-it');
const matter = require('gray-matter');
const hljs = require('highlight.js');

// Standard Plugins
const attrs = require('markdown-it-attrs');
const footnote = require('markdown-it-footnote');
const taskLists = require('markdown-it-task-lists');
const abbr = require('markdown-it-abbr');
const deflist = require('markdown-it-deflist');
const emoji = require('markdown-it-emoji');

// The Feature Registry
const { registerFeatures } = require('./features');

// Custom Heading ID & Anchor Logic
const headingIdPlugin = (md) => {
  md.core.ruler.push('heading_anchors', function(state) {
    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];
      
      if (token.type === 'heading_open') {
        const level = parseInt(token.tag.slice(1), 10);
        const inlineToken = state.tokens[i + 1];
        
        // 1. Generate ID if not present
        let id = token.attrGet('id');
        if (!id && inlineToken && inlineToken.content) {
          id = inlineToken.content
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\u4e00-\u9fa5-]+/g, '')
            .replace(/--+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
          if (id) token.attrSet('id', id);
        }

        // 2. Inject Hover Anchor as an HTML Token (for H2, H3, H4)
        if (id && level >= 2 && level <= 4) {
          let existingClass = token.attrGet('class') || '';
          token.attrSet('class', `${existingClass} docmd-heading`.trim());

          if (inlineToken && inlineToken.children) {
            const anchorToken = new state.Token('html_inline', '', 0);
            anchorToken.content = `<a href="#${id}" class="heading-anchor" aria-label="Permalink to this section"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link2-icon lucide-link-2"><path d="M9 17H7A5 5 0 0 1 7 7h2m6 0h2a5 5 0 1 1 0 10h-2m-7-5h8"/></svg></a>`;
            
            // Insert the anchor at the beginning of the heading text
            inlineToken.children.unshift(anchorToken);
          }
        }
      }
    }
  });
};

// Main Factory Function to Create a Markdown Processor
function createMarkdownProcessor(config = {}, pluginsCallback) {
  const mdOptions = {
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
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        return `<pre class="hljs"><code>${highlighted}</code></pre>`;
      } catch (e) { /* ignore */ }
    }
    return `<pre class="hljs"><code>${new MarkdownIt().utils.escapeHtml(str)}</code></pre>`;
  };

  mdOptions.highlight = config.theme?.codeHighlight !== false ? highlightFn : (str, lang) => {
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
  md.use(headingIdPlugin);

  // Register Built-in Features
  registerFeatures(md);

  // External Plugins Hook
  if (typeof pluginsCallback === 'function') {
    pluginsCallback(md);
  }

  const defaultLinkOpen = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
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
  const regex = /<h([1-6])[^>]*?id="([^"]*)"[^>]*?>([\s\S]*?)<\/h\1>/g;
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

  let htmlContent, headings;
  if (frontmatter.noStyle === true) {
    htmlContent = markdownContent;
    headings =[];
  } else {
    htmlContent = mdInstance.render(markdownContent, env);
    headings = extractHeadings(htmlContent);
  }

  let searchData = null;
  if (!frontmatter.noindex) {
    searchData = {
      title: frontmatter.title || 'Untitled',
      content: stripHtml(htmlContent).slice(0, 5000),
      headings: headings.map(h => h.text)
    };
  }

  return { frontmatter, htmlContent, headings, searchData };
}

module.exports = { createMarkdownProcessor, processContent };