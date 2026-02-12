const path = require('path');
const fs = require('../utils/fs-utils');
const { loadConfig } = require('../utils/config-loader');
const { loadPlugins } = require('../utils/plugin-loader');
const parser = require('@docmd/parser');
const ui = require('@docmd/ui');
const themes = require('@docmd/themes');
const { findPageNeighbors } = require('@docmd/parser/src/utils/navigation-helper');

async function findMarkdownFilesRecursive(dir) {
  let files = [];
  if (!await fs.exists(dir)) return [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(await findMarkdownFilesRecursive(fullPath));
    } else if (item.isFile() && (item.name.endsWith('.md') || item.name.endsWith('.markdown'))) {
      files.push(fullPath);
    }
  }
  return files;
}

function generateTag(pathOrUrl, type, attributes = {}) {
  const attrs = Object.entries(attributes).map(([k,v]) => v === true ? k : `${k}="${v}"`).join(' ');
  if (type === 'css') return `<link rel="stylesheet" href="${pathOrUrl}" ${attrs}>`;
  if (type === 'js') return `<script src="${pathOrUrl}" ${attrs}></script>`;
  return '';
}

async function buildSite(configPath, options = { isDev: false, offline: false }) {
  const CWD = process.cwd();
  const config = await loadConfig(configPath);
  const hooks = loadPlugins(config);
  const buildHash = Date.now().toString(36);

  const srcDir = path.resolve(CWD, config.srcDir);
  const outputDir = path.resolve(CWD, config.outputDir);
  
  if (!await fs.exists(srcDir)) throw new Error(`Source directory not found: ${srcDir}`);
  await fs.ensureDir(outputDir);

  // --- 1. ASSET COPYING (Simplified) ---
  
  // A. Copy ALL UI Assets (Deep copy)
  // This handles css, js, images, AND favicon.ico in root of assets
  const uiAssets = ui.getAssetsDir();
  if (await fs.exists(uiAssets)) {
    await fs.copy(uiAssets, path.join(outputDir, 'assets'));
  }

  // B. Copy Themes
  const themesDir = themes.getThemesDir();
  if (await fs.exists(themesDir)) {
    await fs.copy(themesDir, path.join(outputDir, 'assets/css'));
  }

  // C. Copy User Assets (Override)
  const userAssets = path.resolve(CWD, 'assets');
  if (await fs.exists(userAssets)) await fs.copy(userAssets, path.join(outputDir, 'assets'));

  // --- 2. GENERATE TAGS ---
  const assetTags = { head: [], body: [] };

  if (config.theme && config.theme.name && config.theme.name !== 'default') {
    const themeFileName = `docmd-theme-${config.theme.name}.css`;
    if (await fs.exists(path.join(themes.getThemesDir(), themeFileName))) {
        assetTags.head.push(rel => generateTag(`${rel}assets/css/${themeFileName}?v=${buildHash}`, 'css'));
    } else {
        if (!options.isDev) console.warn(`⚠️  Theme not found: ${themeFileName}`);
    }
  }

  // Core JS (Keep this, or move to EJS if you want full control, but keeping here is fine)
  assetTags.body.push(rel => generateTag(`${rel}assets/js/docmd-main.js?v=${buildHash}`, 'js'));
  
  // Lightbox
  if(await fs.exists(path.join(uiAssets, 'js/docmd-image-lightbox.js'))) {
      assetTags.body.push(rel => generateTag(`${rel}assets/js/docmd-image-lightbox.js?v=${buildHash}`, 'js'));
  }

  // Plugin Assets
  if (hooks.assets) {
    for (const getAssetsFn of hooks.assets) {
      const assets = getAssetsFn();
      if (Array.isArray(assets)) {
        for (const asset of assets) {
          let tagGen;
          if (asset.src && asset.dest) {
            const destPath = path.join(outputDir, asset.dest);
            if (await fs.exists(asset.src)) {
              await fs.ensureDir(path.dirname(destPath));
              await fs.copy(asset.src, destPath);
            }
            tagGen = (rel) => generateTag(`${rel}${asset.dest}?v=${buildHash}`, asset.type, asset.attributes);
          } else if (asset.url) {
            tagGen = () => generateTag(asset.url, asset.type, asset.attributes);
          }
          if (tagGen) assetTags[asset.location === 'head' ? 'head' : 'body'].push(tagGen);
        }
      }
    }
  }

  // --- 3. PROCESSING ---
  const mdProcessor = parser.createMarkdownProcessor(config, (md) => hooks.markdownSetup.forEach(hook => hook(md)));
  const themeInitPath = path.join(ui.getTemplatesDir(), 'partials', 'theme-init.js');
  let themeInitScript = '';
  if (await fs.exists(themeInitPath)) themeInitScript = `<script>${await fs.readFile(themeInitPath, 'utf8')}</script>`;
  let footerHtml = config.footer ? mdProcessor.renderInline(config.footer) : '';

  const mdFiles = await findMarkdownFilesRecursive(srcDir);
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

  // --- 4. RENDER LOOP ---
  for (const page of pages) {
    // 1. Determine Output Location
    const finalPath = path.join(outputDir, page.outputPath);
    
    // 2. Calculate Relative Path to Root (CRITICAL FIX)
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