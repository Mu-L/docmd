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
import chalk from 'chalk';
import fs from '../utils/fs-utils.js';
import { renderPages } from './generator.js';
import { buildVersions, filterGhostVersions } from './versioning.js';

/**
 * Prepare locale context to inject into config for a build pass.
 * When locale is null (i18n disabled), returns the config unchanged.
 *
 * Design: every locale lives in its own subdirectory inside the src dir:
 *   docs/en/   docs/hi/   docs/zh/
 *
 * The default locale renders at root (no URL prefix),
 * non-default locales render at /{locale}/.
 * Fallback: if a page doesn't exist in a non-default locale dir,
 * the engine falls back to the default locale's version of that page.
 */
export function createLocaleConfig(config: any, locale: any): any {
  if (!locale) return config;
  const isDefault = locale.id === config.i18n.default;
  return {
    ...config,
    _activeLocale: locale,
    _allLocales: config.i18n.locales,
    _defaultLocale: config.i18n.default,
    _localeOutputPrefix: isDefault ? '' : locale.id + '/'
  };
}

/**
 * Resolve the source directory for a given locale.
 * When i18n is enabled, each locale gets its own subdirectory: {baseSrcDir}/{localeId}/
 * When i18n is disabled, returns baseSrcDir unchanged.
 */
export function resolveLocaleSrcDir(baseSrcDir: string, config: any): string {
  if (!config._activeLocale) return baseSrcDir;
  return path.join(baseSrcDir, config._activeLocale.id);
}

/**
 * Resolve the fallback source directory (the default locale's dir).
 * Used when a non-default locale is missing a page — falls back to the default locale.
 * Returns null if current locale IS the default (no fallback needed).
 */
export function resolveFallbackSrcDir(baseSrcDir: string, config: any): string | null {
  if (!config._activeLocale || !config._defaultLocale) return null;
  if (config._activeLocale.id === config._defaultLocale) return null;
  return path.join(baseSrcDir, config._defaultLocale);
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
 *
 * The default locale builds directly into rootOutputDir (no prefix).
 * Non-default locales build into rootOutputDir/{locale}/.
 */
export async function buildLocales({
  config,
  rootOutputDir,
  hooks,
  buildHash,
  options,
  CWD
}: {
  config: any;
  rootOutputDir: string;
  hooks: any;
  buildHash: string;
  options: any;
  CWD: string;
}): Promise<any[]> {
  const allGeneratedPages = [];

  // Filter ghost versions once before any locale pass
  await filterGhostVersions(config, CWD, options.isDev);

  const locales = getLocales(config);

  for (const locale of locales) {
    const localeId = locale ? locale.id : null;
    const isDefault = localeId ? localeId === config.i18n.default : false;
    const localeConfig = createLocaleConfig(config, locale);
    
    // We pass the rootOutputDir so that path.rel() accurately maps back to root.
    // The nesting is handled purely by the string pathPrefix.
    const pathPrefix = (localeId && !isDefault) ? localeId + '/' : '';

    if (localeConfig.versions?.all?.length > 0) {
      // Versioned build within this locale
      const pages = await buildVersions({
        config: localeConfig,
        outputDir: rootOutputDir,
        hooks,
        buildHash,
        options,
        CWD,
        pathPrefix
      });
      allGeneratedPages.push(...pages);

    } else {
      // Standard build (no versioning) within this locale
      const baseSrcDir = path.resolve(CWD, localeConfig.src);
      const localeSrcDir = resolveLocaleSrcDir(baseSrcDir, localeConfig);
      const fallbackSrcDir = resolveFallbackSrcDir(baseSrcDir, localeConfig);

      // The locale dir must exist (or fall back to base when no i18n)
      if (!await fs.exists(localeSrcDir)) {
        if (localeConfig._activeLocale) {
          console.log(chalk.yellow(`⚠️  Locale directory missing: ${localeSrcDir}. Skipping ${localeConfig._activeLocale.id}...`));
          continue;
        }
        throw new Error(`Source directory not found: ${localeSrcDir}`);
      }

      const pages = await renderPages({
        config: localeConfig, 
        srcDir: localeSrcDir,
        fallbackSrcDir,
        outputDir: rootOutputDir, 
        hooks, 
        buildHash, 
        options,
        outputPrefix: pathPrefix
      });
      allGeneratedPages.push(...pages);
    }
  }

  return allGeneratedPages;
}

/**
 * Generate the root redirect page for i18n sites.
 *
 * Since the default locale now renders at root, the redirect is only needed
 * if the user's browser locale matches a non-default locale. The redirect
 * page is written as a lightweight JS snippet that checks localStorage →
 * navigator.language; if it matches a non-default locale, it redirects.
 * Otherwise, the root content (default locale) is already there.
 *
 * Note: This is now a no-op because the default locale is at root.
 * Users browsing to / get the default locale directly. The language
 * switcher handles navigation to non-default locales.
 */
export async function generateLocaleRedirect(config: any, _rootOutputDir: string): Promise<void> {
  // Default locale is at root — no redirect needed.
  // The language switcher provides navigation to /hi/, /zh/, etc.
  if (!config.i18n?.locales) return;
  return;
}

/**
 * Generate hreflang link tags for a page across all locales.
 * Used by the generator to inject into <head>.
 *
 * Default locale pages are at root (no prefix).
 * Non-default locale pages are at /{locale}/path.
 */
export function generateHreflangTags(config: any, pageOutputPath: string): string {
  if (!config._allLocales) return '';

  const base = config.base && config.base !== '/' ? config.base.replace(/\/$/, '') : '';
  const pagePath = pageOutputPath.replace(/index\.html$/, '').replace(/\\/g, '/');

  return config._allLocales.map((loc: any) => {
    const isDefault = loc.id === config._defaultLocale;
    // Default locale → root path, non-default → /{locale}/path
    const href = isDefault
      ? `${base}/${pagePath}`
      : `${base}/${loc.id}/${pagePath}`;
    let tags = `<link rel="alternate" hreflang="${loc.id}" href="${href}">`;
    if (isDefault) {
      tags += `\n<link rel="alternate" hreflang="x-default" href="${href}">`;
    }
    return tags;
  }).join('\n');
}