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
import { fsUtils as fs } from '@docmd/utils';
import { createRequire } from 'module';
import { execSync } from 'child_process';

/**
 * Convert every segment of a relative file path to a URL-safe slug,
 * mirroring the slugifySegment logic in auto-router.ts.
 * This ensures the output path written to disk matches the URL that
 * buildAutoNav generates for the same file.
 *
 * Example:  "SA/folder with space/page with space"
 *        →  "SA/folder-with-space/page-with-space"
 */
function slugifyOutputPath(p: string): string {
  return p
    .split('/')
    .map(seg =>
      seg
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9\-_.~]/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '')
        || seg
    )
    .join('/');
}
import { generateAssetTag, findFilesRecursive } from './assets.js';
import { generateHreflangTags } from './i18n.js';
import nativeFs from 'fs';

const _require = createRequire(import.meta.url);
import * as parser from '@docmd/parser';
import { TUI } from '@docmd/tui';
import { findPageNeighbors, findBreadcrumbs, normalizeNavPaths, createUrlContext, buildContextualUrl, computePageUrls, buildAbsoluteUrl, sanitizeUrl } from '@docmd/parser';
import * as ui from '@docmd/ui';



/* ── Constants ────────────────────────────────────────────────── */

/** Number of pages to process concurrently in each batch. */
const BATCH_SIZE = 64;

/** Number of pages to write to disk concurrently. */
const WRITE_BATCH_SIZE = 128;

/* ── Git Root Detection (for edit links) ─────────────────────── */

/** Cached git root path (null = not yet detected, '' = not a git repo). */
let _cachedGitRoot: string | null = null;

/**
 * Detect the git repository root for the current working directory.
 * Returns the absolute path to the git root, or null if not in a git repo.
 * Result is cached per build (cache resets when cwd changes).
 */
function getGitRoot(): string | null {
  if (_cachedGitRoot !== null) {
    return _cachedGitRoot || null;
  }
  try {
    _cachedGitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8'
    }).trim();
    return _cachedGitRoot;
  } catch {
    _cachedGitRoot = '';
    return null;
  }
}

/* ── Types ────────────────────────────────────────────────────── */

interface RenderPagesOptions {
  config: any;
  srcDir: string;
  fallbackSrcDir: string | null;
  outputDir: string;
  hooks: any;
  buildHash: string;
  options: any;
  outputPrefix?: string;
  /** Progress callback: (current, total) called after each batch completes. */
  onProgress?: (current: number, total: number) => void;
  /** Optional: only render specific files (relative to srcDir). Used for incremental dev rebuilds. */
  targetFiles?: string[];
}

export async function renderPages({ config, srcDir, fallbackSrcDir, outputDir, hooks, buildHash, options, outputPrefix = '', onProgress, targetFiles }: RenderPagesOptions) {
  // Reset git root cache (cwd may have changed between workspace builds)
  _cachedGitRoot = null;

  // Load Translations for the active locale
  const localeId = config._activeLocale?.id || null;
  const pluginTranslations = hooks.translations
    ? hooks.translations.reduce((acc: any, fn: any) => ({ ...acc, ...fn(localeId) }), {})
    : {};

  // Merge: system translations → plugin translations → user-provided locale translations
  const userLocaleTranslations = config._activeLocale?.translations || {};
  const strings = ui.loadTranslations(localeId, { ...pluginTranslations, ...userLocaleTranslations });
  const t = ui.createT(strings);

  // Resolve locale-specific navigation.json
  // Each locale dir has its own navigation.json; fall back to default locale's navigation
  if (config.i18n && config._activeLocale) {
    const localeNavPath = path.join(srcDir, 'navigation.json');
    try {
      if (nativeFs.existsSync(localeNavPath)) {
        const rawNav = await nativeFs.promises.readFile(localeNavPath, 'utf8');
        const parsedNav = JSON.parse(rawNav);
        normalizeNavPaths(parsedNav);
        config = { ...config, navigation: parsedNav };
      } else if (fallbackSrcDir) {
        // Fall back to default locale's navigation.json
        const fallbackNavPath = path.join(fallbackSrcDir, 'navigation.json');
        if (nativeFs.existsSync(fallbackNavPath)) {
          const rawNav = await nativeFs.promises.readFile(fallbackNavPath, 'utf8');
          const parsedNav = JSON.parse(rawNav);
          normalizeNavPaths(parsedNav);
          config = { ...config, navigation: parsedNav };
        }
      }
    } catch {
      TUI.warn(`Failed to parse locale navigation: ${localeNavPath}`);
    }
  }

  // Pass UI strings to the markdown processor (for locale-aware aria-labels etc.)
  const configWithStrings = { ...config, _uiStrings: strings };
  const mdProcessor = parser.createMarkdownProcessor(configWithStrings, (md: any) => hooks.markdownSetup.forEach((hook: any) => hook(md)));

  // Load Layout Templates
  const templates = {
    layout: await nativeFs.promises.readFile(ui.getTemplatePath('layout'), 'utf8'),
    noStyle: await nativeFs.promises.readFile(ui.getTemplatePath('no-style'), 'utf8'),
    navigation: await nativeFs.promises.readFile(ui.getTemplatePath('navigation'), 'utf8'),
    'docmd-search': await nativeFs.promises.readFile(ui.getTemplatePath('docmd-search'), 'utf8'),
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
            // location: 'none' means copy the file but don't inject any tag
            if (asset.location !== 'none') {
              tagGen = (rel: string) => generateAssetTag(`${rel}${asset.dest}?v=${buildHash}`, asset.type, asset.attributes);
            }
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
        // _sourceFile is the original path like '/highlighting/' - normalize to relative path
        // and strip trailing slash to match relWithoutExt format used during comparison
        navDesignatedIndexFiles.add(item._sourceFile.replace(/^\//, '').replace(/\/$/, ''));
      }
    }
  };
  if (config.navigation) extractNavIndexes(config.navigation);

  // Find both .md/.markdown files AND .ejs content files (EJS files are pre-rendered before markdown)
  // When fallbackSrcDir is set (non-default locale), scan the fallback dir as the canonical
  // file list, then check the locale dir for overrides per file.
  const scanDir = fallbackSrcDir || srcDir;
  const mdFiles = await findFilesRecursive(scanDir, ['.md', '.markdown', '.ejs']);

  // Build set of locale directory names to skip when scanning a non-locale-specific dir
  // This prevents locale subdirs inside old version dirs from being rendered as regular pages
  const localeIds = new Set((config._allLocales || []).map((l: any) => l.id));

  // ── Phase 2A: Parallel file reading + content processing ──────
  //
  // Instead of sequential read→parse→render per file, we batch the work:
  //   1. Read files in parallel (I/O bound — benefits from concurrency)
  //   2. Parse + render markdown (CPU bound — still sequential per-file but batched)
  //   3. Collect all pages, then render HTML templates + write in parallel

  interface PageEntry {
    relativePath: string;
    targetFilePath: string;
    isFallback: boolean;
  }

  // Build the file manifest (fast — just path resolution, no I/O)
  const fileManifest: PageEntry[] = [];

  for (const filePath of mdFiles) {
    const relativePath = path.relative(scanDir, filePath);

    // Skip files inside locale subdirectories when scanning a non-locale dir
    if (localeIds.size > 0 && !fallbackSrcDir) {
      const topDir = relativePath.split(path.sep)[0];
      if (localeIds.has(topDir)) continue;
    }

    let targetFilePath = filePath;
    let isFallback = false;

    // For non-default locales: check if the locale dir has this file
    if (fallbackSrcDir) {
      const localizedPath = path.join(srcDir, relativePath);
      if (nativeFs.existsSync(localizedPath)) {
        targetFilePath = localizedPath;
      } else {
        isFallback = true;
      }
    }

    fileManifest.push({ relativePath, targetFilePath, isFallback });
  }

  // Scan for locale-exclusive pages (exist only in the locale dir, not in fallback)
  if (fallbackSrcDir && nativeFs.existsSync(srcDir)) {
    const localeFiles = await findFilesRecursive(srcDir, ['.md', '.markdown', '.ejs']);
    const fallbackRelPaths = new Set(mdFiles.map(f => path.relative(scanDir, f)));

    for (const filePath of localeFiles) {
      const relativePath = path.relative(srcDir, filePath);
      if (fallbackRelPaths.has(relativePath)) continue;
      fileManifest.push({ relativePath, targetFilePath: filePath, isFallback: false });
    }
  }

  // --- 2. Filter by targetFiles (Incremental Build) ---
  const filteredManifest = targetFiles && targetFiles.length > 0
    ? fileManifest.filter(entry => {
        // targetFiles are usually absolute or relative to CWD.
        // We check if the entry's targetFilePath matches any of the targetFiles.
        return targetFiles.some(t => {
            const absTarget = path.resolve(process.cwd(), t);
            return entry.targetFilePath === absTarget || entry.relativePath === t;
        });
      })
    : fileManifest;

  // Total page count for progress reporting
  const totalFiles = filteredManifest.length;
  let processedCount = 0;

  // ── Process files in batches ──────────────────────────────────
  const pages: any[] = [];

  for (let batchStart = 0; batchStart < filteredManifest.length; batchStart += BATCH_SIZE) {
    const batch = filteredManifest.slice(batchStart, batchStart + BATCH_SIZE);

    // 1. Read all files in this batch concurrently
    const fileContents = await Promise.all(
      batch.map(entry => nativeFs.promises.readFile(entry.targetFilePath, 'utf8'))
    );

    // 2. Process each file in the batch
    for (let j = 0; j < batch.length; j++) {
      const { relativePath, targetFilePath, isFallback } = batch[j];
      let rawContent = fileContents[j];

      // Prepend a warning callout when falling back to default language
      if (isFallback) {
          const defaultLabel = config._allLocales?.find((l: any) => l.id === config._defaultLocale)?.label || config._defaultLocale;
          const activeLabel = config._activeLocale.label;
          const fallbackMsg = t('fallbackMessage', { active: activeLabel, default: defaultLabel });
          const callout = `\n::: callout warning\n${fallbackMsg}\n:::\n\n`;
          // Insert after frontmatter if present, otherwise prepend
          const fmEnd = rawContent.indexOf('\n---', 1);
          if (rawContent.startsWith('---') && fmEnd > 0) {
              const afterFm = fmEnd + 4; // skip \n---
              rawContent = rawContent.slice(0, afterFm) + '\n' + callout + rawContent.slice(afterFm);
          } else {
              rawContent = callout + rawContent;
          }
      }

      const filename = path.basename(relativePath).toLowerCase();
      const ext = path.extname(filename);
      const isIndex = filename.startsWith('index.');
      const isReadme = filename === 'readme.md';

      // Pre-render .ejs content files through lite-template before passing to markdown
      if (ext === '.ejs') {
        try {
          const fmRegex = /^(?:---[\r\n]+)([\s\S]*?)(?:[\r\n]+---(?:[\r\n]+|$))/;
          const fmMatch = rawContent.match(fmRegex);
          let ejsBody = rawContent;
          const fmData: Record<string, any> = {};
          let fmRaw = '';

          if (fmMatch) {
            fmRaw = fmMatch[0];
            ejsBody = rawContent.slice(fmRaw.length);
            const yamlStr = fmMatch[1];
            for (const line of yamlStr.split('\n')) {
              const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
              if (kv) {
                let val: any = kv[2].trim();
                if (/^\d+$/.test(val)) val = parseInt(val, 10);
                else if (val === 'true') val = true;
                else if (val === 'false') val = false;
                else val = val.replace(/^["']|["']$/g, '');
                fmData[kv[1]] = val;
              }
            }
          }

          const renderedBody = await parser.renderTemplateAsync(ejsBody, {
            ...fmData
          }, { filename: targetFilePath });

          if (fmRaw) {
            rawContent = fmRaw + '\n' + renderedBody;
          } else {
            rawContent = renderedBody;
          }
        } catch (e) {
          TUI.warn(`Skipping EJS render error in ${relativePath}: ${(e as any).message}`);
          continue;
        }
      }

      // Treat README.md as index only if no index.md exists in the same folder
      const hasIndexInFolder = fileManifest.some(entry => {
        const b = path.basename(entry.targetFilePath).toLowerCase();
        return b.startsWith('index.') && path.dirname(entry.targetFilePath) === path.dirname(targetFilePath);
      });

      // Check if the auto-router designated this file as a folder-level index
      const relWithoutExt = relativePath.replace(/\.(md|markdown|ejs)$/i, '').replace(/\\/g, '/');
      const isNavDesignatedIndex = navDesignatedIndexFiles.has(relWithoutExt);
      const effectivelyIndex = isIndex || (isReadme && !hasIndexInFolder) || (isNavDesignatedIndex && !hasIndexInFolder);

      const processed = await parser.processContentAsync(rawContent, mdProcessor, config, { isIndex: effectivelyIndex, filePath: targetFilePath }, hooks);
      if (!processed) continue;

      // Determine output path — slugify each path segment so that spaces and
      // URL-unsafe characters are replaced with hyphens, matching the URLs
      // generated by buildAutoNav in auto-router.ts.
      const withoutExt = slugifyOutputPath(
        relativePath.replace(/\.(md|markdown|ejs)$/, '').replace(/\\/g, '/')
      );
      const slugifiedDir = slugifyOutputPath(
        path.dirname(relativePath).replace(/\\/g, '/')
      );
      const htmlOutputPath = effectivelyIndex
        ? path.posix.join(outputPrefix, slugifiedDir, 'index.html').replace(/^\/?/, '')
        : path.posix.join(outputPrefix, withoutExt, 'index.html').replace(/^\/?/, '');
      pages.push({ ...processed, sourcePath: targetFilePath, outputPath: htmlOutputPath, rawMarkdown: rawContent });
    }

    // Report progress after each batch
    processedCount += batch.length;
    if (onProgress) onProgress(processedCount, totalFiles);
  }

  // --- 2.5 onBeforeBuild (Data Indexing) ---
  // Run hooks on every pass (each locale has its own page set).
  // Show the section header only ONCE per top-level build to avoid
  // reprinting it for every locale × version combination.
  if (hooks.onBeforeBuild && hooks.onBeforeBuild.length > 0) {
    const showSection = !options.targetFiles;
    const beforeBuildContext = {
      config,
      pages,
      tui: TUI,
      options: showSection ? { ...options, quiet: options.quiet || false } : options,
      runWorkerTask(modulePath: string, functionName: string, args: any[]) {
        if (!config._workerPool) throw new Error('WorkerPool is not initialized');
        return config._workerPool.runTask({ type: 'plugin-task', modulePath, functionName, args });
      }
    };
    for (const hookFn of hooks.onBeforeBuild) {
      await hookFn(beforeBuildContext);
    }
    // Section stays open — build.ts closes it after appending search.
  }

  // --- 3. Render HTML (parallel template rendering + batched writes) ---
  const writeQueue: { finalPath: string; html: string }[] = [];

  // Process pages in batches to allow concurrent hook execution (e.g. Git log calls)
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (page) => {
      const finalPath = path.join(outputDir, page.outputPath);
      const fileDir = path.dirname(page.outputPath);
      let relativePathToRoot = path.relative(fileDir, '.');
      if (relativePathToRoot === '') relativePathToRoot = './';
      else relativePathToRoot += '/';
      relativePathToRoot = relativePathToRoot.replace(/\\/g, '/');

      // Navigation Context
      let navPath = '/' + page.outputPath.replace(/\\/g, '/').replace(/\/index\.html$/, '').replace(/^index\.html$/, '');
      if (navPath === '/.') navPath = '/';
      
      // Strip outputPrefix (locale + version) from navPath so it matches navigation.json paths
      if (outputPrefix) {
        const prefixStr = '/' + outputPrefix.replace(/\/$/, '');
        if (navPath.startsWith(prefixStr + '/') || navPath === prefixStr) {
          navPath = navPath.substring(prefixStr.length) || '/';
        }
      }
      
      const { prevPage, nextPage } = findPageNeighbors(config.navigation, navPath);
      const breadcrumbs = config.layout?.breadcrumbs !== false ? findBreadcrumbs(config.navigation, navPath) : [];

      // ── Centralized URL Context ──
      const urlContext = createUrlContext({
        relativePathToRoot,
        outputPrefix,
        offline: options.offline,
        base: config.base || '/',
        siteUrl: config.url || '',
      });

      // Pre-compute page URLs for plugin consumption
      const pageUrls = computePageUrls(page.outputPath, config.url || '');

      const buildRelativeUrl = (href: string) => buildContextualUrl(href, urlContext);

      // Fix Neighbor Links
      const fixNeighbor = (node: any) => {
        if (!node) return null;
        return { ...node, url: buildRelativeUrl(node.path) };
      };

      // Inject Assets
      const assetHeadHtml = assetTags.head.map((gen: any) => gen(relativePathToRoot)).join('\n');
      const assetBodyHtml = assetTags.body.map((gen: any) => gen(relativePathToRoot)).join('\n');
      
      // ── Phase 3A: Invoke onBeforeRender Hook ──
      const pageContext = { 
        frontmatter: page.frontmatter, 
        outputPath: page.outputPath, 
        sourcePath: page.sourcePath, 
        urls: pageUrls,
        html: page.htmlContent
      };

      if (hooks.onBeforeRender) {
        for (const fn of hooks.onBeforeRender) {
          await fn(pageContext);
        }
      }

      // Reflect any mutations from plugins
      page.htmlContent = pageContext.html;
      page.frontmatter = pageContext.frontmatter;

      const headInjections = await Promise.all(hooks.injectHead.map((fn: any) => fn(config, pageContext, relativePathToRoot)));
      const bodyInjections = await Promise.all(hooks.injectBody.map((fn: any) => fn(config, pageContext)));

      const fullHeadHtml = [
        headInjections.join('\n'),
        assetHeadHtml,
        generateHreflangTags(config, page.outputPath)
      ].join('\n');

      const fullBodyHtml = [
        assetBodyHtml,
        bodyInjections.join('\n')
      ].join('\n');

      // Source file path relative to srcDir
      const sourceRelative = path.relative(process.cwd(), page.sourcePath).replace(/\\/g, '/');

      // Compute edit URL from git plugin config (preferred) or legacy config.editLink
      let editUrl = null;
      const editLinkText = config.plugins?.git?.editLinkText || config.editLink?.text || t('editThisPage');
      const gitPluginConfig = config.plugins?.git;

      if (gitPluginConfig?.repo && gitPluginConfig?.editLink !== false) {
        // Git plugin config (modern approach)
        const gitRoot = getGitRoot();
        const editRelative = gitRoot
          ? path.relative(gitRoot, page.sourcePath).replace(/\\/g, '/')
          : sourceRelative;
        const repo = gitPluginConfig.repo.replace(/\/$/, '');
        const branch = gitPluginConfig.branch || 'main';
        const editPath = gitPluginConfig.editPath || 'edit';
        editUrl = `${repo}/${editPath}/${branch}/${editRelative}`;
      } else if (config.editLink?.enabled && config.editLink?.baseUrl) {
        // Legacy fallback
        const cleanBase = config.editLink.baseUrl.replace(/\/$/, '');
        const gitRoot = getGitRoot();
        const editRelative = gitRoot
          ? path.relative(gitRoot, page.sourcePath).replace(/\\/g, '/')
          : path.relative(path.resolve(process.cwd(), config.src || '.'), page.sourcePath).replace(/\\/g, '/');
        editUrl = `${cleanBase}/${editRelative}`;
      }

      // Navigation HTML
      const navigationHtml = await parser.renderTemplateAsync(templates.navigation, {
        config,
        navItems: config.navigation,
        currentPagePath: navPath,
        relativePathToRoot,
        outputPrefix,
        isOfflineMode: options.offline,
        buildRelativeUrl,
        t
      }, { filename: ui.getTemplatePath('navigation') });

      // Render Full Page
      // Template selection: frontmatter.template > frontmatter.noStyle > default layout
      let templateString = templates.layout;
      if (page.frontmatter.template && templates[page.frontmatter.template as keyof typeof templates]) {
        templateString = templates[page.frontmatter.template as keyof typeof templates];
      } else if (page.frontmatter.noStyle) {
        templateString = templates.noStyle;
      }
      let fullHtml = await parser.renderTemplateAsync(templateString, {
        content: page.htmlContent,
        rawMarkdown: page.rawMarkdown || '',
        frontmatter: page.frontmatter,
        headings: page.headings,
        config,
        buildHash,
        siteTitle: config.title,
        pageTitle: page.frontmatter.title,
        description: page.frontmatter.description || '',
        appearance: config.theme?.appearance || config.theme?.defaultMode || 'system',
        defaultMode: config.theme?.appearance || config.theme?.defaultMode || 'system',
        relativePathToRoot,
        isOfflineMode: options.offline,
        buildRelativeUrl,
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
        sourceFile: sourceRelative,
        activeLocale: config._activeLocale || null,
        allLocales: config._allLocales || null,
        builtLocales: config._builtLocales ? [...config._builtLocales] : null,
        defaultLocale: config._defaultLocale || null,
        i18nInPlace: config.i18n?.inPlace || false,
        i18nStringMode: config.i18n?.stringMode || false,
        localePrefix: config._localeOutputPrefix || '',
        currentPagePath: navPath,
        outputPrefix,
        t,
        buildAbsoluteUrl,
        sanitizeUrl,
        workspace: config._workspace,
        themeCssLinkHtml: '',
        metaTagsHtml: '',
        pluginStylesHtml: ''
      }, { filename: ui.getTemplatePath('layout') });

      const pageObj = {
        html: fullHtml,
        frontmatter: page.frontmatter,
        outputPath: page.outputPath,
        sourcePath: page.sourcePath,
        urls: pageUrls,
        urlContext,
        config
      };

      for (const fn of hooks.onPageReady) {
        await fn(pageObj);
      }

      fullHtml = pageObj.html;

      // Queue the write
      writeQueue.push({ finalPath, html: fullHtml });
      (page as any).urls = pageUrls;
    }));
  }

  // --- 4. Parallel file writes ───────────────────────────────────
  // Write all rendered HTML files in batches for maximum I/O throughput
  for (let i = 0; i < writeQueue.length; i += WRITE_BATCH_SIZE) {
    const writeBatch = writeQueue.slice(i, i + WRITE_BATCH_SIZE);
    await Promise.all(
      writeBatch.map(async ({ finalPath, html }) => {
        await fs.ensureDir(path.dirname(finalPath));
        await nativeFs.promises.writeFile(finalPath, html);
      })
    );
  }

  return pages;
}