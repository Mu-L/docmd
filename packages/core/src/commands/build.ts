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
import { fileURLToPath } from 'url';
import { fsUtils as fs, WorkerPool } from '@docmd/utils';
import { loadConfig } from '../utils/config-loader.js';
import { TUI, loadPlugins } from '@docmd/api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { prepareAssets } from '../engine/assets.js';
import { buildLocales, generateLocaleRedirect, preCountPages } from '../engine/i18n.js';

export async function buildSite(configPath: string, opts: any = {}) {

  // Defaults to prevent ReferenceErrors
  const options = {
    isDev: opts.isDev || false,
    offline: opts.offline || false,
    quiet: opts.quiet || false,
    showStats: opts.showStats || false,   // Show version/locale stats even when quiet
    onProgress: opts.onProgress || null,  // External progress callback
    targetFiles: opts.targetFiles || null, // Optional: only rebuild specific files
  };

  const CWD = process.cwd();

  // ── Multi-Project Detection ──────────────────────────
  // If we're NOT already inside a multi-project build (no env var set),
  // check if the root config has a projects[] array.
  if (!process.env.DOCMD_PROJECT_OUT) {
    const { detectMultiProject, buildMultiProject } = await import('../engine/projects.js');
    const multiConfig = await detectMultiProject(configPath);
    if (multiConfig) {
      await buildMultiProject(multiConfig, options);
      return;
    }
  }

  // Start build timer
  const elapsed = TUI.timer();

  // 1. Load Config (Zero-Config aware)
  try {
    const config = await loadConfig(configPath, { isDev: options.isDev });
    
    // Initialize global WorkerPool (or use provided one)
    const workerScript = path.resolve(__dirname, '../engine/worker-parser.js');
    const workerPool = opts.workerPool || new WorkerPool(workerScript, { config, cwd: process.cwd() });
    config._workerPool = workerPool;

    const hooks = await loadPlugins(config, { resolvePaths: [__dirname] });

    // Execute onConfigResolved hooks
    for (const fn of hooks.onConfigResolved) {
      await fn(config);
    }

    const buildHash = Date.now().toString(36);

    // Use V3 labels (config.out / config.src) which are normalized by config-schema
    const rootOutputDir = path.resolve(CWD, config.out);
    await fs.ensureDir(rootOutputDir);

    // ── TUI: Build section header ──────────────────────────
    if (!options.quiet || options.showStats) {
      if (!options.quiet) TUI.section('Build');
      const details = TUI.extractProjectDetails(config, rootOutputDir, CWD);
      TUI.projectDetails({
        source: !options.quiet ? details.source : undefined,
        output: !options.quiet ? details.output : undefined,
        versions: details.versions,
        locales: details.locales,
      });
    }

    // Helper: Build Assets for a specific output directory
    const buildAssetsForDir = async (targetOutDir: string) => {
      await prepareAssets(config, targetOutDir, options);
      if (hooks.assets) {
        for (const getAssetsFn of hooks.assets) {
          const assets = getAssetsFn();
          if (Array.isArray(assets)) {
            for (const asset of assets) {
              if (asset.src && asset.dest) {
                const destPath = path.join(targetOutDir, asset.dest);
                await fs.ensureDir(path.dirname(destPath));
                await fs.copy(asset.src, destPath);
              }
            }
          }
        }
      }
    };

    // Build assets ONCE for the root site (skip on targeted incremental rebuilds)
    if (!options.targetFiles) {
      await buildAssetsForDir(rootOutputDir);
    }

    // Pre-count all pages across all locales and versions.
    // This gives us the exact total BEFORE processing starts, so the
    // progress bar can show accurate 0 → N from the very first page.
    const expectedTotal = await preCountPages(config, CWD, options.targetFiles);
    const processedSoFar = 0;

    const displayProgress = options.onProgress || (!options.quiet ? (current: number, total: number) => {
      TUI.progress('Processing     ', current, total);
    } : undefined);

    // Each renderPages call reports (current, total) for its own pass.
    // We ignore its `total` and use our pre-counted expectedTotal instead.
    // Track pass transitions by watching when the per-pass total changes
    // OR when current resets (drops below last value = new pass started).
    let processedBeforeThisPass = 0;
    let currentPassTotal = -1;
    let lastCurrent = 0;
    const fixedTotalProgress = displayProgress ? (current: number, passTotal: number) => {
      // Detect new renderPages pass: passTotal changes, or current reset
      const isNewPass = passTotal !== currentPassTotal || current < lastCurrent;
      if (isNewPass) {
        processedBeforeThisPass += currentPassTotal > 0 ? currentPassTotal : 0;
        currentPassTotal = passTotal;
      }
      lastCurrent = current;
      displayProgress(processedBeforeThisPass + current, expectedTotal);
    } : undefined;

    const allGeneratedPages = await buildLocales({
      config,
      rootOutputDir,
      hooks,
      buildHash,
      options,
      CWD,
      onProgress: fixedTotalProgress,
      targetFiles: options.targetFiles
    });

    // --- i18n ROOT REDIRECT ---
    await generateLocaleRedirect(config, rootOutputDir);

    // --- i18n PAGE MANIFEST ---
    // Emit a tiny JS file mapping locale IDs to their available page paths.
    // The client-side language switcher uses this for instant page-existence
    // checks - zero HEAD fetches, works offline, CDN-agnostic.
    if (config.i18n && config.i18n.locales) {
      const defaultLocale = config.i18n.default || '';
      const localeIds = new Set(config.i18n.locales.map((l: any) => l.id));
      const manifest: Record<string, string[]> = {};

      for (const page of allGeneratedPages) {
        const segments = page.outputPath.split('/');
        const firstSeg = segments[0];
        let localeId = defaultLocale;
        let pagePath: string;

        if (localeIds.has(firstSeg) && firstSeg !== defaultLocale) {
          localeId = firstSeg;
          pagePath = '/' + segments.slice(1).join('/');
        } else {
          pagePath = '/' + page.outputPath;
        }

        // Normalize: /index.html → /, /foo/index.html → /foo
        pagePath = pagePath.replace(/\/index\.html$/, '') || '/';

        if (!manifest[localeId]) manifest[localeId] = [];
        manifest[localeId].push(pagePath);
      }

      const manifestJs = `window.DOCMD_LOCALE_PAGES=${JSON.stringify(manifest)};`;
      const manifestPath = path.join(rootOutputDir, 'assets', 'js', 'docmd-i18n-manifest.js');
      await fs.ensureDir(path.dirname(manifestPath));
      await fs.writeFile(manifestPath, manifestJs);
    }

    // --- 3. GENERATE CUSTOM 404 PAGE ---
    const { renderTemplateAsync } = await import('@docmd/parser/dist/html-renderer.js');
    const ui = await import('@docmd/ui');

    // Load translations for the default locale (404 is a global page)
    const defaultLocaleId = config.i18n?.default || null;
    const notFoundStrings = ui.loadTranslations(defaultLocaleId);
    const t = ui.createT(notFoundStrings);

    const notFoundTemplatePath = path.join(ui.getTemplatesDir(), '404.ejs');
    let notFoundTemplateStr = '';
    if (await fs.exists(notFoundTemplatePath)) {
      notFoundTemplateStr = await fs.readFile(notFoundTemplatePath, 'utf8');
    } else {
      notFoundTemplateStr = `<h1>404</h1><p>Page Not Found</p>`;
    }

    const themeInitPath = path.join(ui.getTemplatesDir(), 'partials', 'theme-init.js');
    const themeInitScript = (await fs.exists(themeInitPath)) ? `<script>${await fs.readFile(themeInitPath, 'utf8')}</script>` : '';

    // Determine Absolute Base (usually '/' unless 'base' config is set)
    const absoluteRoot = config.base && config.base !== '/' ? config.base.replace(/\/$/, '') + '/' : '/';

    const full404Html = await renderTemplateAsync(notFoundTemplateStr, {
      pageTitle: config.notFound.title || t('pageNotFound'),
      title: config.notFound.title || t('pageNotFound'),
      content: config.notFound.content || 'The page you are looking for does not exist.',
      logo: config.logo,
      t,

      // Context for Assets
      relativePathToRoot: absoluteRoot,
      buildHash,
      appearance: config.theme?.appearance || config.theme?.defaultMode || 'system',
      defaultMode: config.theme?.appearance || config.theme?.defaultMode || 'system',
      theme: config.theme,
      customCssFiles: config.theme.customCss || [],

      faviconLinkHtml: config.favicon ? `<link rel="icon" href="${absoluteRoot}${config.favicon.replace(/^\//, '')}">` : '',
      themeInitScript
    });

    await fs.writeFile(path.join(rootOutputDir, '404.html'), full404Html);

    // --- 4. GENERATE STATIC REDIRECTS ---
    if (config.redirects && Object.keys(config.redirects).length > 0) {
      for (const [from, to] of Object.entries(config.redirects)) {
        let cleanFrom = from.replace(/^\//, '');
        if (!cleanFrom.endsWith('.html')) cleanFrom = path.join(cleanFrom, 'index.html');

        const redirectPath = path.join(rootOutputDir, cleanFrom);
        const redirectHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Redirecting...</title><meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="${to}"><script>window.location.replace("${to}");</script></head><body><p>Redirecting to <a href="${to}">${to}</a>...</p></body></html>`;

        await fs.ensureDir(path.dirname(redirectPath));
        await fs.writeFile(redirectPath, redirectHtml);
      }
    }

    // --- 5. Post Build Hooks (Search, Sitemap, LLMs) ---
    // Only run on full builds to prevent partial data from corrupting global indexes
    if (!options.targetFiles) {
      TUI.footer(TUI.cyan);
      TUI.section('Post-Build Tasks', TUI.blue);
      await Promise.all(hooks.onPostBuild.map((fn: any) => fn({
        config,
        pages: allGeneratedPages,
        outputDir: rootOutputDir,
        log: (msg: string) => TUI.step(msg, 'DONE', TUI.blue),
        tui: TUI,
        options: { ...options, quiet: false },
        runWorkerTask(modulePath: string, functionName: string, args: any[]) {
          if (!config._workerPool) throw new Error('WorkerPool is not initialized');
          return config._workerPool.runTask({ type: 'plugin-task', modulePath, functionName, args });
        }
      })));
    }

    if (!options.isDev) {
      TUI.footer(TUI.blue);
      TUI.success(`Build complete. Generated ${allGeneratedPages.length} pages in ${elapsed()}.`);
    }

    if (!opts.workerPool) {
      await workerPool.terminateAll();
    }

  } catch (e: any) {
    if (!options.isDev) {
      TUI.error('Build failed', e.message);
      // Show full stack trace if we are in a testing/CI environment
      if (process.env.npm_lifecycle_event === 'test' || process.env.CI) {
        console.error(e.stack);
      }
      process.exit(1);
    }
    throw e;
  }
}