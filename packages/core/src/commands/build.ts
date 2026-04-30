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
import fs from '../utils/fs-utils.js';
import chalk from 'chalk';
import { loadConfig } from '../utils/config-loader.js';
import { loadPlugins } from '@docmd/api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { prepareAssets } from '../engine/assets.js';
import { buildLocales, generateLocaleRedirect } from '../engine/i18n.js';

export async function buildSite(configPath: string, opts: any = {}) {

  // Defaults to prevent ReferenceErrors
  const options = {
    isDev: opts.isDev || false,
    offline: opts.offline || false,
  };

  const CWD = process.cwd();

  // ── Multi-Project Detection ──────────────────────────
  // If we're NOT already inside a multi-project build (no env var set),
  // check if the root config has a projects[] array.
  if (!process.env.DOCMD_PROJECT_SRC) {
    const { detectMultiProject, buildMultiProject } = await import('../engine/projects.js');
    const multiConfig = await detectMultiProject(configPath);
    if (multiConfig) {
      await buildMultiProject(multiConfig, options);
      return;
    }
  }

  // 1. Load Config (Zero-Config aware)
  try {
    const config = await loadConfig(configPath, { isDev: options.isDev });
    const hooks = await loadPlugins(config, { resolvePaths: [__dirname] });

    // Execute onConfigResolved hooks
    for (const fn of hooks.onConfigResolved) {
      await fn(config);
    }

    const buildHash = Date.now().toString(36);

    // Use V3 labels (config.out / config.src) which are normalized by config-schema
    const rootOutputDir = path.resolve(CWD, config.out);
    await fs.ensureDir(rootOutputDir);

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

    // Build assets ONCE for the root site
    await buildAssetsForDir(rootOutputDir);

    // --- BUILD ALL LOCALES + VERSIONS ---
    // i18n.buildLocales handles the outer locale loop, inner version loop,
    // ghost version filtering, and standard (non-versioned) builds.
    const allGeneratedPages = await buildLocales({
      config,
      rootOutputDir,
      hooks,
      buildHash,
      options,
      CWD
    });

    // --- i18n ROOT REDIRECT ---
    await generateLocaleRedirect(config, rootOutputDir);

    // --- i18n PAGE MANIFEST ---
    // Emit a tiny JS file mapping locale IDs to their available page paths.
    // The client-side language switcher uses this for instant page-existence
    // checks — zero HEAD fetches, works offline, CDN-agnostic.
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
    await Promise.all(hooks.onPostBuild.map(fn => fn({
      config,
      pages: allGeneratedPages,
      outputDir: rootOutputDir,
      log: (msg) => !options.isDev && console.log(msg)
    })));

    if (!options.isDev) {
      console.log(chalk.green(`✅ Build complete. Generated ${allGeneratedPages.length} pages.`));
    }

  } catch (e) {
    if (!options.isDev) {
      console.error(chalk.red('Build failed:'));
      // Show full stack trace if we are in a testing/CI environment
      if (process.env.npm_lifecycle_event === 'test' || process.env.CI) {
        console.error(e.stack);
      } else {
        console.error(e.message);
      }
      process.exit(1);
    }
    throw e;
  }
}