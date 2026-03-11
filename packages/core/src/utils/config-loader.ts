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
import fs from 'fs';
import { validateConfig } from '@docmd/parser';
import { normalizeConfig } from './config-schema.js';
import { buildAutoNav } from './auto-router.js';
import chalk from 'chalk';
import { pathToFileURL } from 'url';

function hasMarkdownFiles(dir: string, maxDepth = 2, currentDepth = 0): boolean {
  if (currentDepth > maxDepth) return false;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) return true;
      if (entry.isDirectory()) {
        if (hasMarkdownFiles(path.join(dir, entry.name), maxDepth, currentDepth + 1)) return true;
      }
    }
  } catch (e) { }
  return false;
}

async function buildZeroConfig(cwd: string, isDev = false, quiet = false) {

  if (isDev && !quiet) {
    if (!(global as any).__DOCMD_ZERO_LOGGED) {
      console.log(chalk.yellow('✨ Zero-Config mode activated. Analyzing directory...'));
      (global as any).__DOCMD_ZERO_LOGGED = true;
    }
  }

  // Detect if there's a specific docs folder, otherwise use root
  const candidates = ['docs', 'src/docs', 'documentation', 'content'];
  let srcDir: string | null = null;
  for (const c of candidates) {
    if (fs.existsSync(path.join(cwd, c))) {
      srcDir = c;
      break;
    }
  }

  if (!srcDir) {
    console.log(chalk.bold.red(`‼️  No documentation directory found in this root!  ‼️\n`));
    console.log(chalk.yellow(`Zero-Config expects one of these directories: ${chalk.bold(candidates.join(', '))}`));
    console.log(chalk.dim('Please create one of these folders or provide a docmd.config.js file.\n'));
    console.log(chalk.dim('Shutting down silently...\n'));

    const err: any = new Error('No candidate documentation directory found.');
    err.silent = true;
    throw err;
  }

  const absSrcDir = path.join(cwd, srcDir);

  if (!hasMarkdownFiles(absSrcDir, 2)) {
    console.log(chalk.yellow(`\n⚠️  No documentation content found in ${chalk.bold(absSrcDir)}`));
    console.log(chalk.dim('   docmd expects markdown files in the documentation folder.\n'));

    const err: any = new Error('No content found for documentation.');
    err.silent = true;
    throw err;
  }

  // Try extracting defaults from package.json
  let autoTitle = path.basename(cwd) || 'Documentation';
  let autoDesc = '';
  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) {
        autoTitle = pkg.name.replace(/^@[^/]+\//, '').split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      if (pkg.description) autoDesc = pkg.description;
    }
  } catch (e) { }

  // Dynamically build the navigation tree
  const autoNav = buildAutoNav(absSrcDir);

  const autoConfig = {
    title: autoTitle,
    description: autoDesc,
    srcDir: srcDir,
    outputDir: 'site',
    navigation: autoNav,
    layout: { spa: true },
    theme: { name: 'default', appearance: 'system' }
  };

  return normalizeConfig(autoConfig);
}

export async function loadConfig(configPath: string, options: any = {}) {
  const cwd = process.cwd();

  if (options.zeroConfig) {
    return await buildZeroConfig(cwd, options.isDev, options.quiet);
  }

  let absoluteConfigPath = path.resolve(cwd, configPath);

  if (!fs.existsSync(absoluteConfigPath) && configPath === 'docmd.config.js') {
    const legacyPath = path.resolve(cwd, 'config.js');
    if (fs.existsSync(legacyPath)) absoluteConfigPath = legacyPath;
    else {
      // Fallback to Zero-Config if nothing is found to prevent crashing!
      if (!(global as any).__DOCMD_NO_CONFIG_LOGGED && !options.quiet) {
        console.log(chalk.yellow('⚠️  ') + chalk.dim('No config file found. Falling back to Zero-Config mode...'));
        (global as any).__DOCMD_NO_CONFIG_LOGGED = true;
      }
      return await buildZeroConfig(cwd, options.isDev, options.quiet);
    }
  }

  try {
    // Polyfill defineConfig globally so the config file works 
    // even if @docmd/core isn't installed locally in the target project.
    (global as any).defineConfig = (config: any) => config;

    // Use a timestamp to bypass ESM cache if file is likely changed
    const ts = Date.now();
    let configUrl = pathToFileURL(absoluteConfigPath).href + '?t=' + ts;
    let tempConfigPath: string | null = null;

    if (absoluteConfigPath.endsWith('.ts')) {
        const esbuild = await import('esbuild');
        tempConfigPath = absoluteConfigPath.replace(/\.ts$/, `-${ts}.mjs`);
        await esbuild.build({
            entryPoints: [absoluteConfigPath],
            outfile: tempConfigPath,
            format: 'esm',
            bundle: true,
            packages: 'external',
            platform: 'node',
            target: 'node18'
        });
        configUrl = pathToFileURL(tempConfigPath).href;
    }

    const rawModule = await import(configUrl);
    const rawConfig = rawModule.default || rawModule;

    if (tempConfigPath && fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath);
    }

    // Clean up global to avoid pollution
    delete (global as any).defineConfig;

    // If user has 'search' or 'theme' at root, but no 'layout' object, they are legacy.
    const isLegacy = !rawConfig.layout && (
      rawConfig.search !== undefined ||
      (rawConfig.theme && rawConfig.theme.enableModeToggle !== undefined) ||
      rawConfig.sponsor
    );

    if (isLegacy) {
      console.log(chalk.yellow('┌──────────────────────────────────────────────────────────┐'));
      console.log(chalk.yellow('│  ⚠️  Update Config: Legacy Configuration Detected!        │'));
      console.log(chalk.yellow('│                                                          │'));
      console.log(chalk.yellow('│  Run "') +
        chalk.green('docmd migrate') +
        chalk.yellow('" to upgrade your config to the       │'));
      console.log(chalk.yellow('│  new V2 structure (it will auto backup your old config). │'));
      console.log(chalk.yellow('└──────────────────────────────────────────────────────────┘\n'));
    }

    validateConfig(rawConfig);
    const hasExplicitNav = 'navigation' in rawConfig;
    const normalized = normalizeConfig(rawConfig);

    // Ensure we have a navigation array, fallback to Auto-Router if empty (unless explicitly set to empty)
    if (!normalized.navigation || (normalized.navigation.length === 0 && !hasExplicitNav)) {
      if (!options.quiet && !(global as any).__DOCMD_ZERO_NAV_LOGGED) {
        console.log(chalk.dim('   ➖ No navigation settings found in config!'));
        console.log(chalk.dim('   ✨ Auto-generating navigation with Zero-Config...'));
        if (options.isDev) (global as any).__DOCMD_ZERO_NAV_LOGGED = true;
      }
      normalized.navigation = buildAutoNav(path.resolve(cwd, normalized.srcDir));
    }

    return normalized;

  } catch (e: any) {
    if (e.message === 'Invalid configuration file.') throw e;
    throw new Error(`Error parsing config file: ${e.message}`);
  }
}