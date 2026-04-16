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
import nodeFs from 'fs';
import fs from '../utils/fs-utils.js';
import chalk from 'chalk';
import { renderPages } from './generator.js';
import { resolveLocaleSrcDir, resolveFallbackSrcDir } from './i18n.js';

/**
 * Filter out "ghost" versions — configured versions whose source directories
 * don't actually exist on disk. Mutates `config.versions.all` in place.
 */
export async function filterGhostVersions(config: any, CWD: string, isDev: boolean) {
  if (!config.versions?.all) return;

  const validVersions = [];
  for (const v of config.versions.all) {
    const vSrcDir = path.resolve(CWD, v.dir);
    if (await fs.exists(vSrcDir)) {
      validVersions.push(v);
    } else {
      if (!isDev) console.log(chalk.yellow(`⚠️  Skipping missing version: ${v.id} (${v.dir})`));
    }
  }
  config.versions.all = validVersions;
}

/**
 * Smart filter: remove navigation items that point to files which don't exist
 * in a specific version directory. Prevents broken links when pages were
 * added or removed between versions.
 */
export function filterNavForVersion(items: any[], vSrcDir: string): any[] {
  return items.reduce((acc, item) => {
    const newItem = { ...item };

    if (newItem.children) {
      newItem.children = filterNavForVersion(newItem.children, vSrcDir);
    }

    if (newItem.path && !newItem.path.startsWith('http') && !newItem.external) {
      let relativeFilePath = newItem.path.replace(/^\//, '');
      if (!relativeFilePath.endsWith('.md')) relativeFilePath += '.md';
      if (relativeFilePath.endsWith('/.md')) relativeFilePath = relativeFilePath.replace('/.md', '/index.md');
      if (relativeFilePath === '.md') relativeFilePath = 'index.md';

      const absoluteFilePath = path.join(vSrcDir, relativeFilePath);
      try {
        if (!nodeFs.existsSync(absoluteFilePath)) return acc;
      } catch (e) { return acc; }
    }

    acc.push(newItem);
    return acc;
  }, []);
}

/**
 * Resolve the active navigation for a version — checks for navigation.json (Nav V2),
 * then per-version config override, then falls back to the global config navigation.
 */
export function resolveVersionNav(v: any, vSrcDir: string, configNavigation: any): any {
  let activeNav = configNavigation;

  try {
    const navJsonPath = path.join(vSrcDir, 'navigation.json');
    if (nodeFs.existsSync(navJsonPath)) {
      const rawNav = nodeFs.readFileSync(navJsonPath, 'utf-8');
      activeNav = JSON.parse(rawNav);
    } else if (v.navigation) {
      activeNav = v.navigation;
    }
  } catch (err) {
    console.warn(`[WARNING] Failed to parse navigation.json in ${vSrcDir}:`, err.message);
    activeNav = v.navigation || configNavigation;
  }

  return activeNav;
}

/**
 * Build all versions for a given base config and output directory.
 * Returns pages array with output paths prefixed for non-current versions.
 */
export async function buildVersions({
  config,
  outputDir,
  hooks,
  buildHash,
  options,
  CWD,
  pathPrefix = ''
}: {
  config: any;
  outputDir: string;
  hooks: any;
  buildHash: string;
  options: any;
  CWD: string;
  pathPrefix?: string;
}): Promise<any[]> {
  const allPages = [];

  for (const v of config.versions.all) {
    const isCurrent = v.id === config.versions.current;
    const baseSrcDir = path.resolve(CWD, v.dir);

    // When i18n is enabled, resolve to the locale-specific subdirectory
    // e.g., docs/ → docs/en/ for English locale
    // Graceful fallback: if the locale subdir doesn't exist but the base dir does,
    // use the base dir directly (supports old versions without locale dirs)
    let vSrcDir = resolveLocaleSrcDir(baseSrcDir, config);
    let fallbackSrcDir = resolveFallbackSrcDir(baseSrcDir, config);
    let versionHasI18n = true;

    if (!await fs.exists(vSrcDir) && await fs.exists(baseSrcDir)) {
      // Locale subdir doesn't exist but base dir does — this version has no i18n structure
      versionHasI18n = false;
      if (config._activeLocale && config._activeLocale.id !== config._defaultLocale) {
        // Non-default locale: skip entirely (no translations for this version)
        continue;
      }
      // Default locale: use the base dir directly (backward compat for old versions)
      vSrcDir = baseSrcDir;
      fallbackSrcDir = null;
    }

    if (!await fs.exists(vSrcDir)) {
      if (!options.isDev) console.log(chalk.yellow(`⚠️  Version directory missing: ${v.dir}. Skipping ${v.id}...`));
      continue;
    }

    // Determine the full output prefix for this version combining locale prefix + version prefix
    // Only non-current versions get a version prefix.
    const versionPrefixSegment = isCurrent ? '' : v.id + '/';
    const combinedOutputPrefix = pathPrefix + versionPrefixSegment;

    const activeNav = resolveVersionNav(v, vSrcDir, config.navigation);
    const cleanedNav = filterNavForVersion(activeNav, vSrcDir);

    const versionedConfig = {
      ...config,
      _activeVersion: v,
      _versionHasI18n: versionHasI18n,
      navigation: cleanedNav
    };

    const pages = await renderPages({
      config: versionedConfig,
      srcDir: vSrcDir,
      fallbackSrcDir,
      outputDir, // We always pass root outputDir so relativePathToRoot computes perfectly
      hooks,
      buildHash,
      options,
      outputPrefix: combinedOutputPrefix
    });

    allPages.push(...pages);
  }

  return allPages;
}