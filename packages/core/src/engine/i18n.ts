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
import { TUI } from '@docmd/tui';
import nativeFs from 'fs';
import { fsUtils as fs } from '@docmd/utils';
import { renderPages } from './generator.js';
import { buildVersions, filterGhostVersions } from './versioning.js';
import { sanitizeUrl } from '@docmd/parser';
import { findFilesRecursive } from './assets.js';

/**
 * Pre-count total pages across all locale × version passes.
 * Fast scan (just directory walks, no file reads) so the progress bar
 * knows the exact denominator from the very first page.
 */
export async function preCountPages(config: any, CWD: string, targetFiles?: string[] | null): Promise<number> {
  if (targetFiles && targetFiles.length > 0) return targetFiles.length;
  const locales = getLocales(config);
  const isStringMode = config.i18n?.stringMode === true;
  let total = 0;

  for (const locale of locales) {
    const localeId = locale ? locale.id : null;
    const isDefault = localeId ? localeId === config.i18n.default : false;
    if (isStringMode && localeId && !isDefault) continue;

    const localeConfig = createLocaleConfig(config, locale);
    const versions = localeConfig.versions?.all?.length > 0
      ? localeConfig.versions.all
      : [null];

    for (const v of versions) {
      const baseSrcDir = v
        ? path.resolve(CWD, v.dir)
        : path.resolve(CWD, localeConfig.src);

      const localeSrcDir = resolveLocaleSrcDir(baseSrcDir, localeConfig);
      const fallbackSrcDir = resolveFallbackSrcDir(baseSrcDir, localeConfig);

      // Match the skip logic from buildVersions (line 164-169) and buildLocales (line 271-274):
      // If the locale-specific dir doesn't exist, only the default locale processes.
      if (!nativeFs.existsSync(localeSrcDir)) {
        if (!isDefault && localeId) continue; // non-default locale: skip
        // Default locale: try the base dir directly (old versions without locale dirs)
        if (v && nativeFs.existsSync(baseSrcDir)) {
          const files = await findFilesRecursive(baseSrcDir, ['.md', '.markdown', '.ejs']);
          total += files.length;
        }
        continue;
      }

      // Scan fallback dir when set (non-default locale uses default locale as canonical list)
      const scanDir = fallbackSrcDir || localeSrcDir;
      if (!nativeFs.existsSync(scanDir)) continue;

      const files = await findFilesRecursive(scanDir, ['.md', '.markdown', '.ejs']);
      total += files.length;
    }
  }

  return total;
}

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
 * When i18n is enabled with directory mode, each locale gets its own subdirectory: {baseSrcDir}/{localeId}/
 * When stringMode is enabled, all locales use the same root source directory.
 * When i18n is disabled, returns baseSrcDir unchanged.
 */
export function resolveLocaleSrcDir(baseSrcDir: string, config: any): string {
  if (!config._activeLocale) return baseSrcDir;
  if (config.i18n?.stringMode) return baseSrcDir;
  return path.join(baseSrcDir, config._activeLocale.id);
}

/**
 * Resolve the fallback source directory (the default locale's dir).
 * Used when a non-default locale is missing a page - falls back to the default locale.
 * Returns null if current locale IS the default (no fallback needed).
 * Returns null in stringMode (all locales share the same source).
 */
export function resolveFallbackSrcDir(baseSrcDir: string, config: any): string | null {
  if (!config._activeLocale || !config._defaultLocale) return null;
  if (config.i18n?.stringMode) return null;
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
 * Build all locales - the outer loop of the build pipeline.
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
  CWD,
  onProgress,
  targetFiles
}: {
  config: any;
  rootOutputDir: string;
  hooks: any;
  buildHash: string;
  options: any;
  CWD: string;
  onProgress?: (current: number, total: number) => void;
  targetFiles?: string[];
}): Promise<any[]> {
  const allGeneratedPages = [];

  // Filter ghost versions once before any locale pass
  await filterGhostVersions(config, CWD, options.isDev);

  const locales = getLocales(config);
  const isStringMode = config.i18n?.stringMode === true;

  // Pre-scan which locale directories actually exist so the language switcher
  // can disable unavailable locales during rendering (before pages are built).
  // The default locale is always "available" since it renders at root.
  if (config.i18n && config.i18n.locales) {
    const baseSrcDir = path.resolve(CWD, config.src);
    const availableLocaleIds = new Set<string>();
    
    for (const loc of config.i18n.locales) {
      if (loc.id === config.i18n.default) {
        availableLocaleIds.add(loc.id);
        continue;
      }
      if (isStringMode) {
        // stringMode: all locales are available (they clone the default)
        availableLocaleIds.add(loc.id);
        continue;
      }
      
      // Check for locale directory - handle both versioned and non-versioned structures
      // Non-versioned: baseSrcDir/{localeId}/
      // Versioned: baseSrcDir/{versionDir}/{localeId}/
      const locDir = path.join(baseSrcDir, loc.id);
      if (nativeFs.existsSync(locDir)) {
        availableLocaleIds.add(loc.id);
        continue;
      }
      
      // Check versioned structure: look in the current version's directory
      if (config.versions?.all?.length > 0) {
        const currentVersion = config.versions.all.find((v: any) => v.id === config.versions.current);
        if (currentVersion) {
          const versionedLocDir = path.join(baseSrcDir, currentVersion.dir, loc.id);
          if (nativeFs.existsSync(versionedLocDir)) {
            availableLocaleIds.add(loc.id);
          }
        }
      }
    }
    config._builtLocales = availableLocaleIds;
  }

  // In stringMode, build the default locale first (or single pass),
  // then clone its output with server-side string replacements for other locales.
  let defaultPassPages: any[] | null = null;

  for (const locale of locales) {
    const localeId = locale ? locale.id : null;
    const isDefault = localeId ? localeId === config.i18n.default : false;
    const localeConfig = createLocaleConfig(config, locale);
    
    // We pass the rootOutputDir so that path.rel() accurately maps back to root.
    // The nesting is handled purely by the string pathPrefix.
    const pathPrefix = (localeId && !isDefault) ? localeId + '/' : '';

    if (isStringMode && localeId && !isDefault) {
      // stringMode: clone default locale output with string replacements
      if (!defaultPassPages) {
        TUI.warn(`stringMode: no default locale pages to clone for ${localeId}. Skipping...`);
        continue;
      }

      const assetsDir = config.assets || 'assets';
      const strings = await loadStringModeTranslations(CWD, assetsDir, localeId);
      const localeDir = locale?.dir || 'ltr';

      if (Object.keys(strings).length === 0) {
        TUI.warn(`No string translations found for ${localeId} (assets/i18n/${localeId}.json). Rendering default language.`);
      }

      for (const page of defaultPassPages) {
        // Re-read the rendered default HTML and apply string replacements
        const defaultOutputPath = path.join(rootOutputDir, page.outputPath);
        if (!nativeFs.existsSync(defaultOutputPath)) continue;

        const defaultHtml = await nativeFs.promises.readFile(defaultOutputPath, 'utf8');
        const translatedHtml = applyStringModeReplacements(defaultHtml, strings, localeId, localeDir);

        // Write to the locale-prefixed output path
        const localeOutputPath = path.join(rootOutputDir, pathPrefix, page.outputPath);
        await fs.ensureDir(path.dirname(localeOutputPath));
        await nativeFs.promises.writeFile(localeOutputPath, translatedHtml);

        allGeneratedPages.push({ ...page, outputPath: pathPrefix + page.outputPath });
      }
      continue;
    }

    if (localeConfig.versions?.all?.length > 0) {
      // Versioned build within this locale
      const pages = await buildVersions({
        config: localeConfig,
        outputDir: rootOutputDir,
        hooks,
        buildHash,
        options,
        CWD,
        pathPrefix,
        onProgress,
        targetFiles
      });
      allGeneratedPages.push(...pages);
      if (isStringMode && isDefault) defaultPassPages = pages;

    } else {
      // Standard build (no versioning) within this locale
      const baseSrcDir = path.resolve(CWD, localeConfig.src);
      const localeSrcDir = resolveLocaleSrcDir(baseSrcDir, localeConfig);
      const fallbackSrcDir = resolveFallbackSrcDir(baseSrcDir, localeConfig);

      // The locale dir must exist (or fall back to base when no i18n)
      if (!await fs.exists(localeSrcDir)) {
        if (localeConfig._activeLocale && !isStringMode) {
          TUI.warn(`Locale directory missing: ${localeSrcDir}. Skipping ${localeConfig._activeLocale.id}...`);
          continue;
        } else if (!localeConfig._activeLocale) {
          throw new Error(`Source directory not found: ${localeSrcDir}`);
        }
      }

      const pages = await renderPages({
        config: localeConfig, 
        srcDir: localeSrcDir,
        fallbackSrcDir,
        outputDir: rootOutputDir, 
        hooks, 
        buildHash, 
        options,
        outputPrefix: pathPrefix,
        onProgress,
        targetFiles
      });
      allGeneratedPages.push(...pages);
      if (isStringMode && (isDefault || !localeId)) defaultPassPages = pages;
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
  // Default locale is at root - no redirect needed.
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
  let pagePath = pageOutputPath.replace(/index\.html$/, '').replace(/\\/g, '/');
  
  // Strip the current locale prefix from pagePath if present.
  // pageOutputPath may be "hi/guide/index.html" - we need just "guide/".
  const defaultLocale = config._defaultLocale;
  for (const loc of config._allLocales) {
    if (loc.id !== defaultLocale && pagePath.startsWith(loc.id + '/')) {
      pagePath = pagePath.slice(loc.id.length + 1);
      break;
    }
  }

  return config._allLocales.map((loc: any) => {
    const isDefault = loc.id === config._defaultLocale;
    // Default locale → root path, non-default → /{locale}/path
    // Use sanitizeUrl to ensure no double slashes
    const href = sanitizeUrl(isDefault
      ? `${base}/${pagePath}`
      : `${base}/${loc.id}/${pagePath}`);
    let tags = `<link rel="alternate" hreflang="${loc.id}" href="${href}">`;
    if (isDefault) {
      tags += `\n<link rel="alternate" hreflang="x-default" href="${href}">`;
    }
    return tags;
  }).join('\n');
}

/**
 * Load string-mode translations from assets/i18n/{localeId}.json.
 * Returns an empty object if the file doesn't exist (graceful fallback).
 */
export async function loadStringModeTranslations(
  CWD: string, 
  assetsDir: string, 
  localeId: string
): Promise<Record<string, string>> {
  const filePath = path.join(CWD, assetsDir, 'i18n', `${localeId}.json`);
  try {
    if (nativeFs.existsSync(filePath)) {
      const raw = await nativeFs.promises.readFile(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e: any) {
    TUI.warn(`Failed to load string-mode translations: ${filePath} - ${e.message}`);
  }
  return {};
}

/**
 * Apply server-side string replacement on rendered HTML.
 * Resolves data-i18n, data-i18n-html, and data-i18n-{attr} attributes
 * using the provided translations object.
 *
 * This is the build-time equivalent of docmd-i18n-strings.js - it produces
 * fully translated HTML that search engines can index.
 */
export function applyStringModeReplacements(html: string, strings: Record<string, string>, localeId: string, localeDir?: string): string {
  if (!strings || Object.keys(strings).length === 0) return html;

  // 1. data-i18n="key" → replace textContent
  //    Match: <tag ... data-i18n="key" ...>content</tag>
  html = html.replace(
    /(<[^>]+\sdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/[a-zA-Z][a-zA-Z0-9]*>)/g,
    (match, openTag, key, _content, closeTag) => {
      if (strings[key] !== undefined) {
        return openTag + strings[key] + closeTag;
      }
      return match;
    }
  );

  // 2. data-i18n-html="key" → replace innerHTML
  html = html.replace(
    /(<[^>]+\sdata-i18n-html="([^"]+)"[^>]*>)([\s\S]*?)(<\/[a-zA-Z][a-zA-Z0-9]*>)/g,
    (match, openTag, key, _content, closeTag) => {
      if (strings[key] !== undefined) {
        return openTag + strings[key] + closeTag;
      }
      return match;
    }
  );

  // 3. data-i18n-{attr}="key" → replace the target attribute value
  //    e.g. data-i18n-placeholder="search.placeholder" placeholder="Search..."
  html = html.replace(
    /(<[^>]+)\sdata-i18n-(?!html)([a-zA-Z][\w-]*)="([^"]+)"([^>]*>)/g,
    (match, before, targetAttr, key, after) => {
      if (strings[key] !== undefined) {
        // Replace the target attribute's value
        const attrRegex = new RegExp(`(${targetAttr})="[^"]*"`);
        const fullTag = before + ' data-i18n-' + targetAttr + '="' + key + '"' + after;
        if (attrRegex.test(fullTag)) {
          return fullTag.replace(attrRegex, `$1="${strings[key]}"`);
        }
      }
      return match;
    }
  );

  // 4. Update <html lang="..."> to the target locale
  html = html.replace(/<html\s+lang="[^"]*"/, `<html lang="${localeId}"`);

  // 5. Add dir attribute for RTL locales
  if (localeDir && localeDir !== 'ltr') {
    html = html.replace(/<html\s+lang="[^"]*"/, `$& dir="${localeDir}"`);
  }

  // 6. Update DOCMD_LOCALE to the target locale
  html = html.replace(
    /window\.DOCMD_LOCALE\s*=\s*"[^"]*"/,
    `window.DOCMD_LOCALE = "${localeId}"`
  );

  return html;
}