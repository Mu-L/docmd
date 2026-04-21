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

import path from 'path';
import fs from 'fs/promises';
import type { PluginDescriptor } from '@docmd/api';

export const plugin: PluginDescriptor = {
  name: 'sitemap',
  version: '0.7.2',
  capabilities: ['post-build']
};

/**
 * Hook to run after the build is complete.
 * @param {Object} context
 * @param {Object} context.config - The parsed project config
 * @param {Array} context.pages - Array of page objects { outputPath, frontmatter }
 * @param {string} context.outputDir - Absolute path to output directory
 * @param {Function} context.log - Logger function
 */

export async function onPostBuild({ config, pages, outputDir, log }: any) {
  // 1. Check if enabled
  if (config.plugins?.sitemap === false || !config.url) {
    if (!config.url && log) log('⚠️  Skipping sitemap: "url" is missing in config.');
    return;
  }

  const siteUrl = config.url.replace(/\/$/, '');

  // 2. Build XML Header
  let sitemapXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemapXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // 3. Defaults
  const defaultChangefreq = config.plugins?.sitemap?.defaultChangefreq || 'weekly';
  const defaultPriority = config.plugins?.sitemap?.defaultPriority || 0.8;
  const rootPriority = config.plugins?.sitemap?.rootPriority || 1.0;

  // 4. Loop Pages
  for (const page of pages) {
    const fm = page.frontmatter || {};

    // Skip hidden pages
    if (fm.sitemap === false || fm.noindex === true) continue;

    const pagePath = page.outputPath; // e.g. "guide/index.html"
    let url = siteUrl;

    // URL Construction Logic
    if (pagePath === 'index.html') {
      url += '/';
    } else if (pagePath.endsWith('/index.html')) {
      url += '/' + pagePath.replace('/index.html', '/');
    } else {
      url += '/' + pagePath;
    }

    // Metadata Logic
    const priority = fm.priority || (pagePath === 'index.html' ? rootPriority : defaultPriority);
    const changefreq = fm.changefreq || defaultChangefreq;

    sitemapXml += '  <url>\n';
    sitemapXml += `    <loc>${url}</loc>\n`;
    if (fm.lastmod) sitemapXml += `    <lastmod>${fm.lastmod}</lastmod>\n`;
    sitemapXml += `    <changefreq>${changefreq}</changefreq>\n`;
    sitemapXml += `    <priority>${priority}</priority>\n`;
    sitemapXml += '  </url>\n';
  }

  sitemapXml += '</urlset>';

  // 5. Write File
  await fs.writeFile(path.join(outputDir, 'sitemap.xml'), sitemapXml);
  if (log) log('✅ Sitemap generated.');
}