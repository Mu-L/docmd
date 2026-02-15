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

const path = require('path');
const fs = require('../utils/fs-utils');
const { loadConfig } = require('../utils/config-loader');
const { loadPlugins } = require('../utils/plugin-loader');
const parser = require('@docmd/parser');
const ui = require('@docmd/ui');
const themes = require('@docmd/themes');
const { findPageNeighbors } = require('@docmd/parser/src/utils/navigation-helper');
const esbuild = require('esbuild');

const COPYRIGHT_BANNER = `/*!
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
 */`;

// Recursively find files with specific extensions
async function findFilesRecursive(dir, extensions) {
  let files = [];
  if (!await fs.exists(dir)) return [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(await findFilesRecursive(fullPath, extensions));
    } else if (item.isFile()) {
      // If extensions is null, get all files. Otherwise check list.
      if (!extensions || extensions.includes(path.extname(item.name))) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

// Minify CSS and JS assets in the output directory
async function minifyAssets(outputDir) {
  const assets = await findFilesRecursive(path.join(outputDir, 'assets'), ['.css', '.js']);

  for (const file of assets) {
    if (file.endsWith('.min.js') || file.endsWith('.min.css')) continue;

    try {
      const ext = path.extname(file);
      const content = await fs.readFile(file, 'utf8');
      
      const result = await esbuild.transform(content, {
        loader: ext.slice(1),
        minify: true,
        legalComments: 'none' 
      });

      const finalContent = COPYRIGHT_BANNER + '\n' + result.code;

      await fs.writeFile(file, finalContent);
    } catch (e) {
      console.warn(`⚠️  Minification failed for ${path.basename(file)}: ${e.message}`);
    }
  }
}

// Generate HTML tag for asset
function generateTag(pathOrUrl, type, attributes = {}) {
  const attrs = Object.entries(attributes).map(([k,v]) => v === true ? k : `${k}="${v}"`).join(' ');
  if (type === 'css') return `<link rel="stylesheet" href="${pathOrUrl}" ${attrs}>`;
  if (type === 'js') return `<script src="${pathOrUrl}" ${attrs}></script>`;
  return '';
}

// Main Build Function
async function buildSite(configPath, options = { isDev: false, offline: false }) {
  const CWD = process.cwd();
  const config = await loadConfig(configPath);
  const hooks = loadPlugins(config);
  const buildHash = Date.now().toString(36);

  const srcDir = path.resolve(CWD, config.srcDir);
  const outputDir = path.resolve(CWD, config.outputDir);
  
  if (!await fs.exists(srcDir)) throw new Error(`Source directory not found: ${srcDir}`);
  await fs.ensureDir(outputDir);

// --- 1. ASSET COPYING (Core & Themes) ---
  const uiAssets = ui.getAssetsDir();
  if (await fs.exists(uiAssets)) await fs.copy(uiAssets, path.join(outputDir, 'assets'));

  const themesDir = themes.getThemesDir();
  if (await fs.exists(themesDir)) await fs.copy(themesDir, path.join(outputDir, 'assets/css'));

  const userAssets = path.resolve(CWD, 'assets');
  if (await fs.exists(userAssets)) await fs.copy(userAssets, path.join(outputDir, 'assets'));

  // --- 2. GENERATE TAGS & COPY PLUGIN ASSETS ---
  const assetTags = { head: [], body: [] };

  // Theme CSS Tag
  if (config.theme && config.theme.name && config.theme.name !== 'default') {
    const themeFileName = `docmd-theme-${config.theme.name}.css`;
    if (await fs.exists(path.join(themes.getThemesDir(), themeFileName))) {
        assetTags.head.push(rel => generateTag(`${rel}assets/css/${themeFileName}?v=${buildHash}`, 'css'));
    } else {
        if (!options.isDev) console.warn(`⚠️  Theme not found: ${themeFileName}`);
    }
  }

  // Lightbox Tag
  if(await fs.exists(path.join(uiAssets, 'js/docmd-image-lightbox.js'))) {
      assetTags.body.push(rel => generateTag(`${rel}assets/js/docmd-image-lightbox.js?v=${buildHash}`, 'js'));
  }

  // Plugin Assets Loop
  if (hooks.assets) {
    for (const getAssetsFn of hooks.assets) {
      const assets = getAssetsFn();
      if (Array.isArray(assets)) {
        for (const asset of assets) {
          let tagGen;
          if (asset.src && asset.dest) {
            // Copy the file to output
            const destPath = path.join(outputDir, asset.dest);
            if (await fs.exists(asset.src)) {
              await fs.ensureDir(path.dirname(destPath));
              await fs.copy(asset.src, destPath);
            }
            // Generate the HTML tag
            tagGen = (rel) => generateTag(`${rel}${asset.dest}?v=${buildHash}`, asset.type, asset.attributes);
          } else if (asset.url) {
            tagGen = () => generateTag(asset.url, asset.type, asset.attributes);
          }
          if (tagGen) assetTags[asset.location === 'head' ? 'head' : 'body'].push(tagGen);
        }
      }
    }
  }

  // --- 3. ASSET MINIFICATION ---
  if (config.minify !== false && !options.isDev) {
      await minifyAssets(outputDir);
  }

  // --- 4. PROCESSING ---
  const mdProcessor = parser.createMarkdownProcessor(config, (md) => hooks.markdownSetup.forEach(hook => hook(md)));
  const themeInitPath = path.join(ui.getTemplatesDir(), 'partials', 'theme-init.js');
  let themeInitScript = '';
  if (await fs.exists(themeInitPath)) themeInitScript = `<script>${await fs.readFile(themeInitPath, 'utf8')}</script>`;
  let footerHtml = config.footer ? mdProcessor.renderInline(config.footer) : '';

  const mdFiles = await findFilesRecursive(srcDir, ['.md', '.markdown']);
  const pages = [];
  
  for (const filePath of mdFiles) {
    const rawContent = await fs.readFile(filePath, 'utf8');
    const processed = parser.processContent(rawContent, mdProcessor, config);
    if (!processed) continue;
    
    const relativePath = path.relative(srcDir, filePath);
    const isIndex = path.basename(relativePath).startsWith('index.');
    const htmlOutputPath = isIndex ? path.join(path.dirname(relativePath), 'index.html') : relativePath.replace(/\.md$/, '/index.html');
    pages.push({ ...processed, sourcePath: filePath, outputPath: htmlOutputPath });
  }

  // --- 5. RENDER LOOP ---
  for (const page of pages) {
    // 1. Determine Output Location
    const finalPath = path.join(outputDir, page.outputPath);
    
    // 2. Calculate Relative Path to Root
    // "content/nested/index.html" -> dir "content/nested" -> relative "../.."
    const fileDir = path.dirname(page.outputPath); 
    let relativePathToRoot = path.relative(fileDir, '.');
    
    if (relativePathToRoot === '') relativePathToRoot = './';
    else relativePathToRoot += '/';
    relativePathToRoot = relativePathToRoot.replace(/\\/g, '/'); // Windows fix

    // 3. Normalize Nav Path for Matching
    // We use the "clean" URL path for checking active state
    let navPath = '/' + page.outputPath.replace(/\\/g, '/').replace(/\/index\.html$/, '').replace(/^index\.html$/, '');
    if(navPath === '/.') navPath = '/';

    // 4. Navigation & Neighbors
    const { prevPage, nextPage } = findPageNeighbors(config.navigation, navPath);

    // Fix Neighbor Links (Prepend relative root)
    if (prevPage && !prevPage.path.startsWith('http')) {
        let p = prevPage.path.replace(/^\//, ''); // Strip leading slash
        if(options.offline && !p.endsWith('.html')) p = p.replace(/\/$/, '') + '/index.html';
        prevPage.url = relativePathToRoot + p;
    }
    if (nextPage && !nextPage.path.startsWith('http')) {
        let p = nextPage.path.replace(/^\//, '');
        if(options.offline && !p.endsWith('.html')) p = p.replace(/\/$/, '') + '/index.html';
        nextPage.url = relativePathToRoot + p;
    }

    // 5. Asset Injection (Head/Body)
    const assetHeadHtml = assetTags.head.map(gen => gen(relativePathToRoot)).join('\n');
    const assetBodyHtml = assetTags.body.map(gen => gen(relativePathToRoot)).join('\n');
    
    const pageContext = { frontmatter: page.frontmatter, outputPath: page.outputPath };
    
    const fullHeadHtml = [
      hooks.injectHead.map(fn => fn(config, pageContext, relativePathToRoot)).join('\n'),
      assetHeadHtml
    ].join('\n');

    const fullBodyHtml = [
      assetBodyHtml,
      hooks.injectBody.map(fn => fn(config, pageContext)).join('\n')
    ].join('\n');

    // 6. Helpers
    let faviconLinkHtml = '';
    if (config.favicon) {
        const cleanFavicon = config.favicon.startsWith('/') ? config.favicon.substring(1) : config.favicon;
        const finalFavicon = `${relativePathToRoot}${cleanFavicon}?v=${buildHash}`;
        faviconLinkHtml = `<link rel="icon" href="${finalFavicon}" type="image/x-icon" sizes="any">\n<link rel="shortcut icon" href="${finalFavicon}" type="image/x-icon">`;
    }

    const isActivePage = page.htmlContent && page.htmlContent.trim().length > 0;
    
    let editUrl = null, editLinkText = 'Edit this page';
    if (config.editLink && config.editLink.enabled && config.editLink.baseUrl) {
         const cleanBase = config.editLink.baseUrl.replace(/\/$/, '');
         const cleanPath = page.outputPath.replace(/\/index\.html$/, '.md');
         editUrl = `${cleanBase}/${cleanPath}`;
         if (page.outputPath.endsWith('index.html') && page.outputPath !== 'index.html') editUrl = editUrl.replace('.md', '/index.md');
         if (page.outputPath === 'index.html') editUrl = `${cleanBase}/index.md`;
         editLinkText = config.editLink.text || editLinkText;
    }

    // 7. Render
    const templateName = page.frontmatter.noStyle ? 'no-style' : 'layout';
    const templatePath = ui.getTemplatePath(templateName);
    const templateString = await fs.readFile(templatePath, 'utf8');
    const navTemplateString = await fs.readFile(ui.getTemplatePath('navigation'), 'utf8');
    
    const navigationHtml = parser.renderTemplate(navTemplateString, {
      config,
      navItems: config.navigation,
      currentPagePath: navPath,
      relativePathToRoot,
      isOfflineMode: options.offline
    }, { filename: ui.getTemplatePath('navigation') });

    const fullHtml = parser.renderTemplate(templateString, {
      content: page.htmlContent,
      frontmatter: page.frontmatter,
      headings: page.headings,
      config,
      buildHash,
      siteTitle: config.siteTitle,
      pageTitle: page.frontmatter.title,
      description: page.frontmatter.description || '',
      defaultMode: config.theme?.defaultMode || 'light',
      relativePathToRoot,
      isOfflineMode: options.offline,
      navigationHtml,
      prevPage,
      nextPage,
      logo: config.logo,
      theme: config.theme,
      sidebarConfig: config.sidebar || {},
      footer: config.footer,
      sponsor: config.sponsor,
      customCssFiles: config.theme.customCss || [],
      customJsFiles: config.customJs || [],
      
      pluginHeadScriptsHtml: fullHeadHtml,
      pluginBodyScriptsHtml: fullBodyHtml,
      
      faviconLinkHtml,
      themeInitScript,
      footerHtml,
      isActivePage,
      editUrl,
      editLinkText,
      themeCssLinkHtml: '',
      metaTagsHtml: '',
      pluginStylesHtml: '' 
    }, { filename: templatePath });

    // 8. Write File
    await fs.ensureDir(path.dirname(finalPath));
    await fs.writeFile(finalPath, fullHtml);
  }

  await Promise.all(hooks.onPostBuild.map(fn => fn({ 
    config,
    pages,
    outputDir,
    log: (msg) => !options.isDev && console.log(msg)
  })));
  if (!options.isDev) console.log(`✅ Build complete. Generated ${pages.length} pages.`);
}

module.exports = { buildSite };