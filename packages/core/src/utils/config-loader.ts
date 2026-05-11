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
import fs from 'fs';
import { validateConfig } from '@docmd/parser';
import { normalizeConfig } from './config-schema.js';
import { buildAutoNav } from './auto-router.js';
import { pathToFileURL } from 'url';
import { TUI } from '@docmd/api';

function hasMarkdownFiles(dir: string, maxDepth = 2, currentDepth = 0): boolean {
  if (currentDepth > maxDepth) return false;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown') || entry.name.endsWith('.ejs'))) return true;
      if (entry.isDirectory()) {
        if (hasMarkdownFiles(path.join(dir, entry.name), maxDepth, currentDepth + 1)) return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}

async function buildZeroConfig(cwd: string, isDev = false, quiet = false) {

  if (isDev && !quiet) {
    if (!(global as any).__DOCMD_ZERO_LOGGED) {
      TUI.info('Zero-Config mode activated. Analyzing directory...');
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
    TUI.error('Configuration Error', 'No documentation directory found.');
    TUI.info(`Zero-Config expects one of: ${candidates.join(', ')}`);
    TUI.info('Create one of these folders or provide a docmd.config.js file.');

    const err: any = new Error('No candidate documentation directory found.');
    err.silent = true;
    throw err;
  }

  const absSrcDir = path.join(cwd, srcDir);

  if (!hasMarkdownFiles(absSrcDir, 2)) {
    TUI.warn(`No documentation content found in ${absSrcDir}`);
    TUI.info('docmd expects markdown files in the source folder.');

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
  } catch { /* ignore */ }

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

  let absoluteConfigPath = path.resolve(cwd, configPath);

  if (configPath === 'docmd.config.js') {
    const candidates = [
      'docmd.config.json',
      'docmd.config.ts',
      'docmd.config.js',
      'docmd.config.mjs',
      'config.js'
    ];
    let found = false;
    for (const c of candidates) {
      const p = path.resolve(cwd, c);
      if (fs.existsSync(p)) {
        absoluteConfigPath = p;
        found = true;
        break;
      }
    }

    if (!found) {
      // Fallback to Zero-Config if nothing is found to prevent crashing!
      if (!(global as any).__DOCMD_NO_CONFIG_LOGGED && !options.quiet) {
        TUI.warn('No config found. Running in auto mode. Run `docmd init` to create one.');
        (global as any).__DOCMD_NO_CONFIG_LOGGED = true;
      }
      const autoConfig = await buildZeroConfig(cwd, options.isDev, options.quiet);
      return JSON.parse(JSON.stringify(autoConfig));
    }
  } else if (!fs.existsSync(absoluteConfigPath)) {
    throw new Error(`Config file not found: ${absoluteConfigPath}`);
  }

  // Cleanup any orphaned temp config files from previous failed reloads
  try {
      const configDir = path.dirname(absoluteConfigPath);
      const baseName = path.basename(absoluteConfigPath).split('.')[0];
      const files = fs.readdirSync(configDir);
      for (const file of files) {
          if (file.startsWith(`${baseName}-`) && (file.endsWith('.js') || file.endsWith('.mjs'))) {
              const fullPath = path.join(configDir, file);
              // If it has a timestamp-like suffix, it's one of ours
              if (/-[0-9]{13}\.(js|mjs)$/.test(file)) {
                  fs.unlinkSync(fullPath);
              }
          }
      }
  } catch { /* ignore cleanup errors */ }

  try {
    // Polyfill defineConfig globally so the config file works 
    // even if @docmd/core isn't installed locally in the target project.
    (global as any).defineConfig = (config: any) => config;

    // Use a timestamp to bypass ESM cache if file is likely changed
    const ts = Date.now();
    let configUrl = pathToFileURL(absoluteConfigPath).href + '?t=' + ts;
    let tempConfigPath: string | null = null;
    let rawConfig: any;

    try {
      if (absoluteConfigPath.endsWith('.json')) {
          rawConfig = JSON.parse(fs.readFileSync(absoluteConfigPath, 'utf-8'));
      } else {
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
          } else if (absoluteConfigPath.endsWith('.js') || absoluteConfigPath.endsWith('.mjs')) {
              // Copy to a temp file to guarantee cache bypass (query strings
              // are not always reliable for ESM cache busting in all Node versions)
              const ext = path.extname(absoluteConfigPath);
              tempConfigPath = absoluteConfigPath.replace(new RegExp(`\\${ext}$`), `-${ts}${ext}`);
              fs.copyFileSync(absoluteConfigPath, tempConfigPath);
              configUrl = pathToFileURL(tempConfigPath).href;
          }

          const rawModule = await import(configUrl);
          rawConfig = rawModule.default || rawModule;
      }
        
      // If user has 'search' or 'theme' at root, but no 'layout' object, they are legacy.
      const isLegacy = !rawConfig.layout && (
        rawConfig.search !== undefined ||
        (rawConfig.theme && rawConfig.theme.enableModeToggle !== undefined) ||
        rawConfig.sponsor
      );

      if (isLegacy) {
        TUI.error('Legacy Configuration Detected', 'Your docmd.config.js uses an outdated structure.');
        TUI.info(`Run ${TUI.cyan('docmd migrate')} to automatically upgrade your configuration.`);
      }

      validateConfig(rawConfig);
      const hasExplicitNav = 'navigation' in rawConfig;
      const normalized = normalizeConfig(rawConfig);

      // Ensure we have a navigation array, fallback to Auto-Router if empty (unless explicitly set to empty)
      if (!normalized.navigation || (normalized.navigation.length === 0 && !hasExplicitNav)) {
        // When i18n or versioning is enabled, check if navigation.json exists
        // in locale/version dirs before warning - it will be loaded later per-locale/version
        let navScanDir = path.resolve(cwd, normalized.srcDir);
        let hasNavInSubdirs = false;

        if (normalized.i18n?.default) {
          const localeScanDir = path.join(navScanDir, normalized.i18n.default);
          if (fs.existsSync(localeScanDir)) {
            navScanDir = localeScanDir;
          }
          // Check if any locale dir has navigation.json
          hasNavInSubdirs = (normalized.i18n.locales || []).some((l: any) =>
            fs.existsSync(path.join(path.resolve(cwd, normalized.srcDir), l.id, 'navigation.json'))
          );
        }

        // Check if any version dir has navigation.json
        if (!hasNavInSubdirs && normalized.versions?.all?.length > 0) {
          hasNavInSubdirs = normalized.versions.all.some((v: any) => {
            const vDir = path.resolve(cwd, v.dir);
            // Check base dir and locale subdirs
            if (fs.existsSync(path.join(vDir, 'navigation.json'))) return true;
            if (normalized.i18n?.default) {
              return fs.existsSync(path.join(vDir, normalized.i18n.default, 'navigation.json'));
            }
            return false;
          });
        }

        if (!hasNavInSubdirs) {
          // Check if navigation.json exists directly in the source root
          const rootNavPath = path.join(navScanDir, 'navigation.json');
          if (fs.existsSync(rootNavPath)) {
            hasNavInSubdirs = true;
            try {
              normalized.navigation = JSON.parse(fs.readFileSync(rootNavPath, 'utf-8'));
            } catch { /* fall through to auto-nav */ }
          }
        }

        if (!hasNavInSubdirs) {
          if (!options.quiet && !(global as any).__DOCMD_ZERO_NAV_LOGGED) {
            TUI.info('No navigation settings found. Auto-generating with Zero-Config...');
            if (options.isDev) (global as any).__DOCMD_ZERO_NAV_LOGGED = true;
          }

          normalized.navigation = buildAutoNav(navScanDir);
        }
      }

      normalized._resolvedPath = absoluteConfigPath;

      // Ensure the final configuration object is completely JSON-serialisable
      // This is crucial for passing the config to worker threads in the new multi-threaded build engine
      return JSON.parse(JSON.stringify(normalized));
    } finally {
      if (tempConfigPath && fs.existsSync(tempConfigPath)) {
          fs.unlinkSync(tempConfigPath);
      }
      // Clean up global to avoid pollution
      delete (global as any).defineConfig;
    }

  } catch (e: any) {
    if (e.message === 'Invalid configuration file.') throw e;
    throw new Error(`Error parsing config file: ${e.message}`);
  }
}