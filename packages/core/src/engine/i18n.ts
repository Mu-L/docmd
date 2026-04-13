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
import { renderPages } from './generator.js';
import { buildVersions, filterGhostVersions } from './versioning.js';

/**
 * Prepare locale context to inject into config for a build pass.
 * When locale is null (i18n disabled), returns the config unchanged.
 */
export function createLocaleConfig(config: any, locale: any): any {
  if (!locale) return config;
  return {
    ...config,
    _activeLocale: locale,
    _allLocales: config.i18n.locales,
    _defaultLocale: config.i18n.default,
    _localeOutputPrefix: locale.id + '/'
  };
}

/**
 * Get the list of locales to iterate over.
 * Returns [null] when i18n is disabled (single pass, no locale prefix).
 */
export function getLocales(config: any): any[] {
  return config.i18n && config.i18n.locales ? config.i18n.locales : [null];
}

/**
 * Build all locales — the outer loop of the build pipeline.
 * For each locale, runs the versioning loop (or standard build) inside it.
 * Returns all generated pages across all locales/versions.
 */
export async function buildLocales({
  config,
  rootOutputDir,
  hooks,
  buildHash,
  options,
  buildAssetsForDir,
  CWD
}: {
  config: any;
  rootOutputDir: string;
  hooks: any;
  buildHash: string;
  options: any;
  buildAssetsForDir: (dir: string) => Promise<void>;
  CWD: string;
}): Promise<any[]> {
  const allGeneratedPages = [];

  // Filter ghost versions once before any locale pass
  await filterGhostVersions(config, CWD, options.isDev);

  const locales = getLocales(config);

  for (const locale of locales) {
    const localeId = locale ? locale.id : null;
    const localeOutputDir = localeId ? path.join(rootOutputDir, localeId) : rootOutputDir;
    const localeConfig = createLocaleConfig(config, locale);

    if (localeConfig.versions?.all?.length > 0) {
      // Versioned build within this locale
      const pages = await buildVersions({
        config: localeConfig,
        outputDir: localeOutputDir,
        hooks,
        buildHash,
        options,
        buildAssetsForDir,
        CWD,
        pathPrefix: localeId ? localeId + '/' : undefined
      });
      allGeneratedPages.push(...pages);

    } else {
      // Standard build (no versioning) within this locale
      const srcDir = path.resolve(CWD, localeConfig.src);

      if (options.zeroConfig && !await fs.exists(srcDir)) {
        await fs.ensureDir(srcDir);
      }
      if (!await fs.exists(srcDir)) throw new Error(`Source directory not found: ${srcDir}`);

      await buildAssetsForDir(localeOutputDir);
      const pages = await renderPages({
        config: localeConfig, srcDir, outputDir: localeOutputDir, hooks, buildHash, options
      });

      if (localeId) {
        pages.forEach(p => p.outputPath = `${localeId}/${p.outputPath}`);
      }
      allGeneratedPages.push(...pages);
    }
  }

  return allGeneratedPages;
}

/**
 * Generate the root redirect page for i18n sites.
 * Redirects to the user's preferred locale via localStorage → navigator.language → default.
 */
export async function generateLocaleRedirect(config: any, rootOutputDir: string): Promise<void> {
  if (!config.i18n?.locales) return;

  const defaultLocale = config.i18n.default;
  const allLocaleIds = config.i18n.locales.map((l: any) => l.id);
  const base = config.base && config.base !== '/' ? config.base.replace(/\/$/, '') : '';

  const redirectHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Redirecting...</title>
<script>
(function() {
  var defined = ${JSON.stringify(allLocaleIds)};
  var fallback = ${JSON.stringify(defaultLocale)};
  var stored = null;
  try { stored = localStorage.getItem('docmd-locale'); } catch(e) {}
  var nav = (navigator.language || navigator.userLanguage || '').split('-')[0].toLowerCase();
  var locale = (stored && defined.indexOf(stored) !== -1) ? stored : (defined.indexOf(nav) !== -1 ? nav : fallback);
  window.location.replace('${base}/' + locale + '/');
})();
</script>
<noscript><meta http-equiv="refresh" content="0;url=${base}/${defaultLocale}/"></noscript>
</head>
<body></body>
</html>`;

  await fs.writeFile(path.join(rootOutputDir, 'index.html'), redirectHtml);
}

/**
 * Generate hreflang link tags for a page across all locales.
 * Used by the generator to inject into <head>.
 */
export function generateHreflangTags(config: any, pageOutputPath: string): string {
  if (!config._allLocales) return '';

  const base = config.base && config.base !== '/' ? config.base.replace(/\/$/, '') : '';
  const pagePath = pageOutputPath.replace(/index\.html$/, '').replace(/\\/g, '/');

  return config._allLocales.map((loc: any) => {
    const isDefault = loc.id === config._defaultLocale;
    let tags = `<link rel="alternate" hreflang="${loc.id}" href="${base}/${loc.id}/${pagePath}">`;
    if (isDefault) {
      tags += `\n<link rel="alternate" hreflang="x-default" href="${base}/${loc.id}/${pagePath}">`;
    }
    return tags;
  }).join('\n');
}