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
import fs from '../utils/fs-utils.js';
import chalk from 'chalk';
import { loadConfig } from '../utils/config-loader.js';
import { loadPlugins } from '../utils/plugin-loader.js';
import { prepareAssets } from '../engine/assets.js';
import { buildLocales, generateLocaleRedirect } from '../engine/i18n.js';

export async function buildSite(configPath: string, opts: any = {}) {

  // Defaults to prevent ReferenceErrors
  const options = {
    isDev: opts.isDev || false,
    offline: opts.offline || false,
    zeroConfig: opts.zeroConfig || false
  };

  const CWD = process.cwd();

  // 1. Load Config (Zero-Config aware)
  try {
    const config = await loadConfig(configPath, { zeroConfig: options.zeroConfig, isDev: options.isDev });
    const hooks = await loadPlugins(config);
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