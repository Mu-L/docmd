/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
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
import fs from '../utils/fs-utils.js';
import { createRequire } from 'module';
import { generateAssetTag, findFilesRecursive } from './assets.js';
import nativeFs from 'fs';

const require = createRequire(import.meta.url);
import * as parser from '@docmd/parser';
import * as ui from '@docmd/ui';
import { findPageNeighbors, findBreadcrumbs } from '@docmd/parser/dist/utils/navigation-helper.js';

export async function renderPages({ config, srcDir, outputDir, hooks, buildHash, options }: any) {
  const mdProcessor = parser.createMarkdownProcessor(config, (md: any) => hooks.markdownSetup.forEach((hook: any) => hook(md)));

  // Load Layout Templates
  const templates = {
    layout: await nativeFs.promises.readFile(ui.getTemplatePath('layout'), 'utf8'),
    noStyle: await nativeFs.promises.readFile(ui.getTemplatePath('no-style'), 'utf8'),
    navigation: await nativeFs.promises.readFile(ui.getTemplatePath('navigation'), 'utf8')
  };

  // Load Partials
  const themeInitPath = path.join(ui.getTemplatesDir(), 'partials', 'theme-init.js');
  const themeInitScript = (await fs.exists(themeInitPath))
    ? `<script>${await nativeFs.promises.readFile(themeInitPath, 'utf8')}</script>`
    : '';

  // Footer Processing
  const footerHtml = config.footer?.content ? mdProcessor.renderInline(config.footer.content) : '';

  // --- 1. Identify Assets (Plugin Injection) ---
  const assetTags: { head: any[], body: any[] } = { head: [], body: [] };

  // Theme CSS
  if (config.theme.name && config.theme.name !== 'default') {
    assetTags.head.push((rel: string) => generateAssetTag(`${rel}assets/css/docmd-theme-${config.theme.name}.css?v=${buildHash}`, 'css'));
  }
  // Lightbox
  assetTags.body.push((rel: string) => generateAssetTag(`${rel}assets/js/docmd-image-lightbox.js?v=${buildHash}`, 'js'));

  // Plugin Assets
  if (hooks.assets) {
    for (const getAssetsFn of hooks.assets) {
      const assets = getAssetsFn();
      if (Array.isArray(assets)) {
        for (const asset of assets) {
          let tagGen;
          if (asset.src && asset.dest) {
            // Copy is handled in build.js main loop, here we just ref tags
            tagGen = (rel: string) => generateAssetTag(`${rel}${asset.dest}?v=${buildHash}`, asset.type, asset.attributes);
          } else if (asset.url) {
            tagGen = () => generateAssetTag(asset.url, asset.type, asset.attributes);
          }
          if (tagGen) assetTags[asset.location === 'head' ? 'head' : 'body'].push(tagGen);
        }
      }
    }
  }

  // --- 2. Process Content ---
  // Note: We use a passed-in file list or find them if not provided (future optimization)
  // For now, assume findFilesRecursive is available via utils
  const mdFiles = await findFilesRecursive(srcDir, ['.md', '.markdown']);

  const pages = [];
  for (const filePath of mdFiles) {
    const rawContent = await nativeFs.promises.readFile(filePath, 'utf8');
    const relativePath = path.relative(srcDir, filePath);
    const filename = path.basename(relativePath).toLowerCase();
    const isIndex = filename.startsWith('index.');
    const isReadme = filename === 'readme.md';

    // Treat README.md as index only if no index.md exists in the same folder
    const hasIndexInFolder = mdFiles.some(f => {
      const b = path.basename(f).toLowerCase();
      return b.startsWith('index.') && path.dirname(f) === path.dirname(filePath);
    });

    const effectivelyIndex = isIndex || (isReadme && !hasIndexInFolder);

    const processed = parser.processContent(rawContent, mdProcessor, config, { isIndex: effectivelyIndex });
    if (!processed) continue;

    const htmlOutputPath = effectivelyIndex
      ? path.join(path.dirname(relativePath), 'index.html')
      : relativePath.replace(/\.md$/, '/index.html');
    pages.push({ ...processed, sourcePath: filePath, outputPath: htmlOutputPath });
  }

  // --- 3. Render HTML ---
  for (const page of pages) {
    const finalPath = path.join(outputDir, page.outputPath);
    const fileDir = path.dirname(page.outputPath);
    let relativePathToRoot = path.relative(fileDir, '.');
    if (relativePathToRoot === '') relativePathToRoot = './';
    else relativePathToRoot += '/';
    relativePathToRoot = relativePathToRoot.replace(/\\/g, '/');

    // Navigation Context
    let navPath = '/' + page.outputPath.replace(/\\/g, '/').replace(/\/index\.html$/, '').replace(/^index\.html$/, '');
    if (navPath === '/.') navPath = '/';
    const { prevPage, nextPage } = findPageNeighbors(config.navigation, navPath);
    const breadcrumbs = config.layout?.breadcrumbs !== false ? findBreadcrumbs(config.navigation, navPath) : [];

    // Fix Neighbor Links
    const fixNeighbor = (node: any) => {
      if (!node) return null;
      if (node.path.startsWith('http')) return node;
      let p = node.path.replace(/^\//, '');
      if (options.offline && !p.endsWith('.html')) p = p.replace(/\/$/, '') + '/index.html';
      node.url = relativePathToRoot + p;
      return node;
    };

    // Inject Assets
    const assetHeadHtml = assetTags.head.map((gen: any) => gen(relativePathToRoot)).join('\n');
    const assetBodyHtml = assetTags.body.map((gen: any) => gen(relativePathToRoot)).join('\n');
    const pageContext = { frontmatter: page.frontmatter, outputPath: page.outputPath };

    const fullHeadHtml = [
      hooks.injectHead.map((fn: any) => fn(config, pageContext, relativePathToRoot)).join('\n'),
      assetHeadHtml
    ].join('\n');

    const fullBodyHtml = [
      assetBodyHtml,
      hooks.injectBody.map((fn: any) => fn(config, pageContext)).join('\n')
    ].join('\n');

    let editUrl = null;
    const editLinkText = config.editLink?.text || 'Edit this page';

    if (config.editLink && config.editLink.enabled && config.editLink.baseUrl) {
      const cleanBase = config.editLink.baseUrl.replace(/\/$/, '');
      const sourceRelative = path.relative(srcDir, page.sourcePath).replace(/\\/g, '/');
      editUrl = `${cleanBase}/${sourceRelative}`;
    }

    // Navigation HTML
    const navigationHtml = await parser.renderTemplateAsync(templates.navigation, {
      config,
      navItems: config.navigation,
      currentPagePath: navPath,
      relativePathToRoot,
      isOfflineMode: options.offline
    }, { filename: ui.getTemplatePath('navigation') });

    // Render Full Page
    const templateString = page.frontmatter.noStyle ? templates.noStyle : templates.layout;
    const fullHtml = await parser.renderTemplateAsync(templateString, {
      content: page.htmlContent,
      frontmatter: page.frontmatter,
      headings: page.headings,
      config,
      buildHash,
      siteTitle: config.siteTitle,
      pageTitle: page.frontmatter.title,
      description: page.frontmatter.description || '',
      appearance: config.theme?.appearance || config.theme?.defaultMode || 'system',
      defaultMode: config.theme?.appearance || config.theme?.defaultMode || 'system',
      relativePathToRoot,
      isOfflineMode: options.offline,
      navigationHtml,
      prevPage: fixNeighbor(prevPage),
      nextPage: fixNeighbor(nextPage),
      logo: config.logo,
      theme: config.theme,

      headerConfig: config.header,
      sidebarConfig: config.sidebar,
      footerConfig: config.footer,
      menubarConfig: config.menubar,
      optionsMenu: config.optionsMenu,

      customCssFiles: config.theme.customCss || [],
      customJsFiles: config.customJs || [],

      pluginHeadScriptsHtml: fullHeadHtml,
      pluginBodyScriptsHtml: fullBodyHtml,

      faviconLinkHtml: config.favicon ? `<link id="site-favicon" rel="icon" href="${relativePathToRoot}${config.favicon.replace(/^\//, '')}?v=${buildHash}">` : '',
      themeInitScript,
      footerHtml,
      isActivePage: page.htmlContent && page.htmlContent.trim().length > 0,
      editUrl,
      editLinkText,
      breadcrumbs,

      // Placeholders for template compatibility
      themeCssLinkHtml: '',
      metaTagsHtml: '',
      pluginStylesHtml: ''
    }, { filename: ui.getTemplatePath('layout') });

    await fs.ensureDir(path.dirname(finalPath));
    await nativeFs.promises.writeFile(finalPath, fullHtml);
  }

  return pages;
}