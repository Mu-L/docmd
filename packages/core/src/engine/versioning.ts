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
import nodeFs from 'fs';
import fs from '../utils/fs-utils.js';
import chalk from 'chalk';
import { renderPages } from './generator.js';

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
  buildAssetsForDir,
  CWD,
  pathPrefix
}: {
  config: any;
  outputDir: string;
  hooks: any;
  buildHash: string;
  options: any;
  buildAssetsForDir: (dir: string) => Promise<void>;
  CWD: string;
  pathPrefix?: string;
}): Promise<any[]> {
  const allPages = [];

  for (const v of config.versions.all) {
    const isCurrent = v.id === config.versions.current;
    const vSrcDir = path.resolve(CWD, v.dir);

    if (!await fs.exists(vSrcDir)) {
      if (!options.isDev) console.log(chalk.yellow(`⚠️  Version directory missing: ${v.dir}. Skipping ${v.id}...`));
      continue;
    }

    const vOutputDir = isCurrent ? outputDir : path.join(outputDir, v.id);
    await fs.ensureDir(vOutputDir);
    await buildAssetsForDir(vOutputDir);

    const activeNav = resolveVersionNav(v, vSrcDir, config.navigation);
    const cleanedNav = filterNavForVersion(activeNav, vSrcDir);

    const versionedConfig = {
      ...config,
      _activeVersion: v,
      navigation: cleanedNav
    };

    const pages = await renderPages({
      config: versionedConfig,
      srcDir: vSrcDir,
      outputDir: vOutputDir,
      hooks,
      buildHash,
      options
    });

    // Prefix output paths for non-current versions (used by sitemap, search, etc.)
    if (!isCurrent) {
      pages.forEach(p => p.outputPath = `${v.id}/${p.outputPath}`);
    }

    // Apply any additional path prefix (e.g. locale prefix)
    if (pathPrefix) {
      pages.forEach(p => p.outputPath = `${pathPrefix}${p.outputPath}`);
    }

    allPages.push(...pages);
  }

  return allPages;
}