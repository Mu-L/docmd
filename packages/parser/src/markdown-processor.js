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

// Custom Heading ID Logic (Internal helper)
const headingIdPlugin = (md) => {
  const originalHeadingOpen = md.renderer.rules.heading_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.heading_open = function(tokens, idx, options, env, self) {
    const token = tokens[idx];
    const existingId = token.attrGet('id');

    if (!existingId) {
      const contentToken = tokens[idx + 1];
      if (contentToken && contentToken.type === 'inline' && contentToken.content) {
        const headingText = contentToken.content;
        const id = headingText
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w\u4e00-\u9fa5-]+/g, '')
          .replace(/--+/g, '-')
          .replace(/^-+/, '')
          .replace(/-+$/, '');

        if (id) token.attrSet('id', id);
      }
    }
    return originalHeadingOpen(tokens, idx, options, env, self);
  };
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
      
      const isExternal = href.match(/^(?:[a-z]+:|\/\/|#)/i);
      const isAsset = href.match(/(^|\/)assets\//);

      if (!isExternal && !isAsset && href.endsWith('.md')) {
        href = href.replace(/\.md$/, '');
        token.attrs[hrefIndex][1] = href;
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

function processContent(rawString, mdInstance, config) {
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
    headings = [];
  } else {
    htmlContent = mdInstance.render(markdownContent);
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