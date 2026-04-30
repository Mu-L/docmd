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

import type { PluginDescriptor } from '@docmd/api';
import { outputPathToPathname, sanitizeUrl } from '@docmd/api';

export const plugin: PluginDescriptor = {
  name: 'seo',
  version: '0.7.7',
  capabilities: ['head']
};

/**
 * Generates HTML meta tags for a specific page.
 * @param {Object} config - Project config
 * @param {Object} pageData - { frontmatter, outputPath }
 * @param {string} relativePathToRoot - Path relative to root (for assets)
 * @returns {string} HTML string of meta tags
 */

export function generateMetaTags(config: any, pageData: any, _relativePathToRoot: string) {
  let html = '';
  const { frontmatter, outputPath } = pageData;
  const seo = frontmatter.seo || {}; // Page-specific SEO overrides
  const globalSeo = config.plugins?.seo || {};

  // 1. Robots
  if (frontmatter.noindex || seo.noindex) {
    return '<meta name="robots" content="noindex">\n';
  }

  // 1.5 AI Bots Control
  const aiBots = seo.aiBots ?? globalSeo.aiBots;
  if (aiBots === false) {
    const bots = ['GPTBot', 'ChatGPT-User', 'Google-Extended', 'CCBot', 'anthropic-ai', 'Omgilibot', 'Omgili', 'FacebookBot', 'Diffbot', 'Bytespider', 'ImagesiftBot', 'cohere-ai'];
    bots.forEach(bot => {
      html += `<meta name="${bot}" content="noindex">\n`;
    });
  }

  // 2. Basic Meta
  const siteTitle = config.title;
  const pageTitle = frontmatter.title || 'Untitled';
  let description = seo.description || frontmatter.description || globalSeo.defaultDescription || '';

  // Smart Fallback Description
  if (!description && pageData.searchData && pageData.searchData.content) {
    const contentPrefix = pageData.searchData.content.substring(0, 150).trim();
    description = pageData.searchData.content.length > 150 ? contentPrefix + '...' : contentPrefix;
  }

  html += `<meta name="description" content="${description}">\n`;

  // 3. Canonical URL
  // Use centralised URL utility for consistent URL generation.
  const siteUrl = config.url ? config.url.replace(/\/$/, '') : '';
  const pathname = outputPathToPathname(outputPath);
  const pageUrl = sanitizeUrl(siteUrl + pathname);

  const canonical = seo.canonicalUrl || frontmatter.canonicalUrl || pageUrl;
  if (canonical) {
    html += `<link rel="canonical" href="${canonical}">\n`;
  }

  // 4. Open Graph (Facebook/LinkedIn)
  const appendTitle = frontmatter.titleAppend !== false;
  const fullTitle = (appendTitle && siteTitle && pageTitle !== siteTitle) ? `${pageTitle} — ${siteTitle}` : pageTitle;

  html += `<meta property="og:title" content="${fullTitle}">\n`;
  html += `<meta property="og:description" content="${description}">\n`;
  html += `<meta property="og:url" content="${pageUrl}">\n`;
  html += `<meta property="og:type" content="${seo.ogType || frontmatter.ogType || 'website'}">\n`;

  // Image Logic
  let image = seo.image || frontmatter.image || globalSeo.openGraph?.defaultImage;
  if (image) {
    if (!image.startsWith('http')) {
      // Resolve relative image path to absolute URL
      image = `${siteUrl}/${image.replace(/^\.?\//, '')}`;
    }
    html += `<meta property="og:image" content="${image}">\n`;
  }

  // 5. Twitter
  const cardType = seo.twitterCard || globalSeo.twitter?.cardType || 'summary_large_image';
  html += `<meta name="twitter:card" content="${cardType}">\n`;

  if (globalSeo.twitter?.siteUsername) {
    html += `<meta name="twitter:site" content="${globalSeo.twitter.siteUsername}">\n`;
  }

  html += `<meta name="twitter:title" content="${fullTitle}">\n`;
  html += `<meta name="twitter:description" content="${description}">\n`;
  if (image) {
    html += `<meta name="twitter:image" content="${image}">\n`;
  }

  // 6. Keywords
  const keywords = seo.keywords || frontmatter.keywords;
  if (keywords) {
    const kwStr = Array.isArray(keywords) ? keywords.join(', ') : keywords;
    html += `<meta name="keywords" content="${kwStr}">\n`;
  }

  return html;
}