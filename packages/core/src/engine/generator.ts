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
import { generateHreflangTags } from './i18n.js';
import nativeFs from 'fs';

const require = createRequire(import.meta.url);
import * as parser from '@docmd/parser';
import * as ui from '@docmd/ui';
import { findPageNeighbors, findBreadcrumbs } from '@docmd/parser/dist/utils/navigation-helper.js';

export async function renderPages({ config, srcDir, outputDir, hooks, buildHash, options }: any) {
  // Load Translations for the active locale
  const localeId = config._activeLocale?.id || null;
  const pluginTranslations = hooks.translations
    ? hooks.translations.reduce((acc: any, fn: any) => ({ ...acc, ...fn(localeId) }), {})
    : {};
  const strings = ui.loadTranslations(localeId, pluginTranslations);
  const t = ui.createT(strings);

  // Pass UI strings to the markdown processor (for locale-aware aria-labels etc.)
  const configWithStrings = { ...config, _uiStrings: strings };
  const mdProcessor = parser.createMarkdownProcessor(configWithStrings, (md: any) => hooks.markdownSetup.forEach((hook: any) => hook(md)));

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
  // Build a set of file paths that the auto-router designated as folder-level indexes
  // These are files where _sourceFile was stored when the auto-router reassigned them to '/'
  const navDesignatedIndexFiles = new Set<string>();
  const extractNavIndexes = (items: any[]) => {
    for (const item of items) {
      if (item.children) {
        extractNavIndexes(item.children);
      } else if (item._sourceFile) {
        // _sourceFile is the original path like '/highlighting' — normalize to relative path
        navDesignatedIndexFiles.add(item._sourceFile.replace(/^\//, ''));
      }
    }
  };
  if (config.navigation) extractNavIndexes(config.navigation);

  // Find both .md/.markdown files AND .ejs content files (EJS files are pre-rendered before markdown)
  const mdFiles = await findFilesRecursive(srcDir, ['.md', '.markdown', '.ejs']);

  const pages = [];
  for (const filePath of mdFiles) {
    let rawContent = await nativeFs.promises.readFile(filePath, 'utf8');
    const relativePath = path.relative(srcDir, filePath);
    const filename = path.basename(relativePath).toLowerCase();
    const ext = path.extname(filename);
    const isIndex = filename.startsWith('index.');
    const isReadme = filename === 'readme.md';

    // Pre-render .ejs content files through lite-template before passing to markdown
    // 1. Extract frontmatter first so variables like `depth` are available to the template
    // 2. Render the EJS body with frontmatter data + helpers
    // 3. Re-prepend frontmatter so processContent can parse it normally
    if (ext === '.ejs') {
      try {
        // Inline frontmatter extraction (avoids dependency on lite-matter in core)
        const fmRegex = /^(?:---[\r\n]+)([\s\S]*?)(?:[\r\n]+---(?:[\r\n]+|$))/;
        const fmMatch = rawContent.match(fmRegex);
        let ejsBody = rawContent;
        const fmData: Record<string, any> = {};
        let fmRaw = '';

        if (fmMatch) {
          fmRaw = fmMatch[0];
          ejsBody = rawContent.slice(fmRaw.length);
          // Parse simple YAML key-values for template variables
          const yamlStr = fmMatch[1];
          for (const line of yamlStr.split('\n')) {
            const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
            if (kv) {
              let val: any = kv[2].trim();
              // Attempt to parse numbers and booleans
              if (/^\d+$/.test(val)) val = parseInt(val, 10);
              else if (val === 'true') val = true;
              else if (val === 'false') val = false;
              else val = val.replace(/^["']|["']$/g, ''); // strip quotes
              fmData[kv[1]] = val;
            }
          }
        }

        // Render the EJS body with frontmatter data + core helpers (include, renderIcon)
        const renderedBody = await parser.renderTemplateAsync(ejsBody, {
          ...fmData
        }, { filename: filePath });

        // Re-prepend original frontmatter for processContent
        if (fmRaw) {
          rawContent = fmRaw + '\n' + renderedBody;
        } else {
          rawContent = renderedBody;
        }
      } catch (e) {
        console.warn(`[docmd] Skipping EJS render error in ${relativePath}: ${e.message}`);
        continue;
      }
    }

    // Treat README.md as index only if no index.md exists in the same folder
    const hasIndexInFolder = mdFiles.some(f => {
      const b = path.basename(f).toLowerCase();
      return b.startsWith('index.') && path.dirname(f) === path.dirname(filePath);
    });

    // Check if the auto-router designated this file as a folder-level index
    // This handles zero-config's "first file becomes index" when no index.md exists
    const relWithoutExt = relativePath.replace(/\.(md|markdown|ejs)$/i, '').replace(/\\/g, '/');
    const isNavDesignatedIndex = navDesignatedIndexFiles.has(relWithoutExt);

    const effectivelyIndex = isIndex || (isReadme && !hasIndexInFolder) || (isNavDesignatedIndex && !hasIndexInFolder);

    const processed = parser.processContent(rawContent, mdProcessor, config, { isIndex: effectivelyIndex });
    if (!processed) continue;

    // Determine output path — .ejs files map like .md files
    const withoutExt = relativePath.replace(/\.(md|markdown|ejs)$/, '');
    const htmlOutputPath = effectivelyIndex
      ? path.join(path.dirname(relativePath), 'index.html')
      : withoutExt + '/index.html';
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
      assetHeadHtml,
      generateHreflangTags(config, page.outputPath)
    ].join('\n');

    const fullBodyHtml = [
      assetBodyHtml,
      hooks.injectBody.map((fn: any) => fn(config, pageContext)).join('\n')
    ].join('\n');

    // Source file path relative to srcDir — used by plugins (e.g. threads) to identify the file
    const sourceRelative = path.relative(process.cwd(), page.sourcePath).replace(/\\/g, '/');

    let editUrl = null;
    const editLinkText = config.editLink?.text || t('editThisPage');

    if (config.editLink && config.editLink.enabled && config.editLink.baseUrl) {
      const cleanBase = config.editLink.baseUrl.replace(/\/$/, '');
      const editRelative = path.relative(srcDir, page.sourcePath).replace(/\\/g, '/');
      editUrl = `${cleanBase}/${editRelative}`;
    }

    // Navigation HTML
    const navigationHtml = await parser.renderTemplateAsync(templates.navigation, {
      config,
      navItems: config.navigation,
      currentPagePath: navPath,
      relativePathToRoot,
      isOfflineMode: options.offline,
      t
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

      // Source file path for plugin use (e.g. threads RPC)
      sourceFile: sourceRelative,

      // i18n locale context
      activeLocale: config._activeLocale || null,
      allLocales: config._allLocales || null,
      defaultLocale: config._defaultLocale || null,

      // Translation function
      t,

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