/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/api
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

/**
 * Plugin loader with validation, isolation, and capability enforcement.
 *
 * - Lightweight contract check at load time.
 * - Every hook invocation wrapped in try/catch.
 * - Plugins can only register for hooks they've declared.
 */

import { TUI } from '@docmd/tui';
import path from 'node:path';
import nativeFs from 'node:fs';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { PluginDescriptor, PluginHooks, PluginModule, Capability } from './types.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Monorepo root - two levels up from packages/api/dist/
const __monorepoRoot = path.resolve(__dirname, '..', '..', '..');

// ---------------------------------------------------------------------------
// Capability → Hook mapping (§3)
// ---------------------------------------------------------------------------

const CAPABILITY_HOOKS: Record<Capability, string[]> = {
  markdown:     ['markdownSetup'],
  head:         ['generateMetaTags', 'generateScripts'],
  body:         ['generateScripts'],
  assets:       ['getAssets'],
  'post-build': ['onPostBuild'],
  actions:      ['actions'],
  events:       ['events'],
  translations: ['translations'],
  init:         ['onConfigResolved'],
  build:        ['onBeforeParse', 'onAfterParse', 'onBeforeBuild', 'onBeforeRender', 'onPageReady'],
  dev:          ['onDevServerReady'],
};

const KNOWN_CAPABILITIES = new Set(Object.keys(CAPABILITY_HOOKS));

// ---------------------------------------------------------------------------
// Hook registry
// ---------------------------------------------------------------------------

export const hooks: PluginHooks = {
  markdownSetup: [],
  injectHead: [],
  injectBody: [],
  onPostBuild: [],
  assets: [],
  translations: [],
  actions: {},
  events: {},
  onConfigResolved: [],
  onDevServerReady: [],
  onBeforeParse: [],
  onAfterParse: [],
  onBeforeBuild: [],
  onBeforeRender: [],
  onPageReady: [],
};

// ---------------------------------------------------------------------------
// Validation (§1)
// ---------------------------------------------------------------------------

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateDescriptor(descriptor: any): ValidationResult {
  const errors: string[] = [];

  if (!descriptor || typeof descriptor !== 'object') {
    return { valid: false, errors: ['Missing plugin descriptor'] };
  }

  if (!descriptor.name || typeof descriptor.name !== 'string') {
    errors.push('`name` must be a non-empty string');
  }

  if (!descriptor.version || typeof descriptor.version !== 'string') {
    errors.push('`version` must be a valid semver string');
  }

  if (!Array.isArray(descriptor.capabilities)) {
    errors.push('`capabilities` must be an array');
  } else {
    for (const cap of descriptor.capabilities) {
      if (!KNOWN_CAPABILITIES.has(cap)) {
        errors.push(`Unknown capability: "${cap}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if a plugin has declared a capability that allows a specific hook.
 */
function hasCapabilityForHook(descriptor: PluginDescriptor | null, hookName: string): boolean {
  if (!descriptor) return true; // Legacy plugins without descriptors get full access
  for (const cap of descriptor.capabilities) {
    if (CAPABILITY_HOOKS[cap]?.includes(hookName)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Isolation wrapper (§2)
// ---------------------------------------------------------------------------

function safeCall<T>(hookName: string, pluginName: string, fn: (...args: any[]) => T, ...args: any[]): T | string | undefined {
  try {
    return fn(...args);
  } catch (err: any) {
    TUI.error(`Plugin "${pluginName}" threw in ${hookName}`, err.message);
    return (hookName === 'injectHead' || hookName === 'injectBody') ? '' as any : undefined;
  }
}

// Collect errors for summary
const pluginErrors: { plugin: string; hook: string; message: string }[] = [];

// Track which plugin warnings have already been printed to avoid repeating them on
// every dev-server rebuild. Keyed by `pluginName:warningType`.
const _printedWarnings = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (_printedWarnings.has(key)) return;
  _printedWarnings.add(key);
  TUI.warn(message);
}

// ---------------------------------------------------------------------------
// Shorthand resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a plugin name from config shorthand to full package name.
 * Bare names (no `/` or scope) expand to `@docmd/plugin-*`.
 * Third-party plugins must use full package names.
 */
export function resolvePluginName(key: string): string {
  if (key.includes('/')) return key;
  return `@docmd/plugin-${key}`;
}

// ---------------------------------------------------------------------------
// Auto-Install for Official Plugins
// ---------------------------------------------------------------------------

// Load the official plugin registry
let _pluginRegistry: Record<string, any> | null = null;

function getPluginRegistry(): Record<string, any> {
  if (_pluginRegistry) return _pluginRegistry;
  
  try {
    // Try to load from @docmd/plugin-installer
    const registryPath = require.resolve('@docmd/plugin-installer/registry/plugins.json', {
      paths: [process.cwd(), __dirname, __monorepoRoot]
    });
    _pluginRegistry = JSON.parse(nativeFs.readFileSync(registryPath, 'utf8'));
  } catch {
    // Fallback: try monorepo path
    const localPath = path.resolve(__monorepoRoot, 'packages/plugins/installer/registry/plugins.json');
    if (nativeFs.existsSync(localPath)) {
      _pluginRegistry = JSON.parse(nativeFs.readFileSync(localPath, 'utf8'));
    } else {
      _pluginRegistry = {};
    }
  }
  
  return _pluginRegistry!;
}

/**
 * Detect the package manager used in the current project.
 */
function detectPackageManager(cwd: string): 'pnpm' | 'yarn' | 'bun' | 'npm' {
  let dir = cwd;
  while (dir !== path.parse(dir).root) {
    if (nativeFs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
    if (nativeFs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
    if (nativeFs.existsSync(path.join(dir, 'bun.lockb'))) return 'bun';
    if (nativeFs.existsSync(path.join(dir, 'package-lock.json'))) return 'npm';
    dir = path.dirname(dir);
  }
  return 'npm';
}

/**
 * Get the current docmd version for version-matched installs.
 */
function getDocmdVersion(): string {
  try {
    const corePkgPath = require.resolve('@docmd/core/package.json', {
      paths: [process.cwd(), __dirname, __monorepoRoot]
    });
    const pkg = JSON.parse(nativeFs.readFileSync(corePkgPath, 'utf8'));
    return pkg.version || 'latest';
  } catch {
    return 'latest';
  }
}

/**
 * Auto-install an official plugin from npm.
 * Only works for plugins in the official registry.
 * Installs the exact version matching the current docmd version.
 */
async function autoInstallPlugin(packageName: string): Promise<boolean> {
  const shortName = packageName.replace('@docmd/plugin-', '');
  const registry = getPluginRegistry();
  
  // Security: Only auto-install plugins in the official registry
  if (!registry[shortName]) {
    warnOnce(`registry:${packageName}`, TUI.yellow(`Plugin "${shortName}" not found in official registry - manual installation required`));
    return false;
  }

  const cwd = process.cwd();
  const pkgManager = detectPackageManager(cwd);
  const version = getDocmdVersion();
  const versionedPackage = version === 'latest' ? packageName : `${packageName}@${version}`;

  TUI.step(`Downloading missing plugin: ${shortName}`, 'WAIT');

  let installCmd = '';
  switch (pkgManager) {
    case 'pnpm': installCmd = `pnpm add ${versionedPackage}`; break;
    case 'yarn': installCmd = `yarn add ${versionedPackage}`; break;
    case 'bun': installCmd = `bun add ${versionedPackage}`; break;
    default: installCmd = `npm install ${versionedPackage}`; break;
  }

  try {
    const { execSync } = await import('node:child_process');
    execSync(installCmd, { stdio: 'pipe', cwd, timeout: 60000 });
    TUI.step(`Plugin installed: ${shortName}`, 'DONE');
    return true;
  } catch (err: any) {
    TUI.step(`Failed to install: ${shortName}`, 'FAIL');
    warnOnce(`install:${packageName}`, TUI.dim(`Run "docmd add ${shortName}" manually for details`));
    return false;
  }
}

// ---------------------------------------------------------------------------
// Load & Register
// ---------------------------------------------------------------------------

export async function loadPlugins(config: any, opts?: { resolvePaths?: string[] }): Promise<PluginHooks> {
  // 1. Resolution paths for plugin imports - the caller (e.g. @docmd/core) should
  // pass its own __dirname so plugins that are core's dependencies can be found
  // even under pnpm's strict node_modules layout.
  const resolvePaths = [
    process.cwd(), 
    __dirname, 
    __monorepoRoot, 
    path.join(__monorepoRoot, 'packages/plugins'),
    ...(opts?.resolvePaths || [])
  ];

  // 1. Reset hooks
  hooks.markdownSetup = [];
  hooks.injectHead = [];
  hooks.injectBody = [];
  hooks.onPostBuild = [];
  hooks.assets = [];
  hooks.translations = [];
  hooks.actions = {};
  hooks.events = {};
  hooks.onConfigResolved = [];
  hooks.onDevServerReady = [];
  hooks.onBeforeParse = [];
  hooks.onAfterParse = [];
  hooks.onBeforeBuild = [];
  hooks.onBeforeRender = [];
  hooks.onPageReady = [];
  pluginErrors.length = 0;

  // 2. Initialize Plugin Map (Name -> Options)
  const pluginMap = new Map<string, any>();
  const searchEnabled = config.optionsMenu ? config.optionsMenu.components.search !== false : config.search !== false;

  // A. Core Plugins - always loaded by default.
  const corePlugins = ['search', 'seo', 'sitemap', 'analytics', 'llms', 'mermaid', 'git', 'openapi'];

  for (const name of corePlugins) {
    const resolved = `@docmd/plugin-${name}`;
    const userOpts = config.plugins?.[name];

    if (userOpts === false || (userOpts && userOpts.enabled === false)) {
      pluginMap.set(resolved, false);
      continue;
    }

    if (name === 'search' && !searchEnabled) {
      pluginMap.set(resolved, false);
      continue;
    }

    pluginMap.set(resolved, userOpts || {});
  }

  // B. Add/Override from Config (non-core / optional / third-party plugins)
  if (config.plugins) {
    Object.keys(config.plugins).forEach(key => {
      const resolvedName = resolvePluginName(key);
      if (corePlugins.includes(key)) return;
      pluginMap.set(resolvedName, config.plugins[key]);
    });
  }

  // 3. Load and Register (with auto-install for official plugins)
  for (const [name, options] of pluginMap) {
    if (options === false) continue;

    try {
      let rawModule: any;
      let needsAutoInstall = false;
      
      try {
        const resolvedPath = require.resolve(name, { paths: resolvePaths });
        rawModule = await import(pathToFileURL(resolvedPath).href);
      } catch (e: any) {
        // Monorepo fallback: if it's an official plugin, try packages/plugins/{id}
        if (name.startsWith('@docmd/plugin-')) {
          const id = name.replace('@docmd/plugin-', '');
          const localPath = path.resolve(__monorepoRoot, 'packages/plugins', id, 'dist/index.js');
          if (nativeFs.existsSync(localPath)) {
            rawModule = await import(pathToFileURL(localPath).href);
          } else {
            // Mark for auto-install if it's an official plugin not found
            needsAutoInstall = true;
          }
        }

        if (!rawModule && !needsAutoInstall) {
          // Fallback for non-package plugins or when resolution fails
          try {
            rawModule = await import(name);
          } catch (innerError: any) {
            // For official plugins, attempt auto-install
            if (name.startsWith('@docmd/plugin-')) {
              needsAutoInstall = true;
            } else {
              throw new Error(`Failed to resolve ${name}. Search paths: ${resolvePaths.join(', ')}. Detail: ${innerError.message}`);
            }
          }
        }
      }

      // Auto-install official plugins that are missing
      if (needsAutoInstall && name.startsWith('@docmd/plugin-')) {
        const installed = await autoInstallPlugin(name);
        if (installed) {
          // Retry loading after install
          try {
            const resolvedPath = require.resolve(name, { paths: resolvePaths });
            rawModule = await import(pathToFileURL(resolvedPath).href);
          } catch {
            // If still fails, skip this plugin
            warnOnce(`autoinstall:${name}`, TUI.yellow(`Could not load ${name} after auto-install`));
            continue;
          }
        } else {
          continue; // Skip if auto-install failed
        }
      }

      if (!rawModule) continue;

      const pluginModule: PluginModule = rawModule.default || rawModule;

      try {
        registerPlugin(name, pluginModule, options);
      } catch (regError: any) {
        warnOnce(`register:${name}`, TUI.yellow(`Plugin loaded but failed to register: ${name}`) + TUI.dim(`\n   > ${regError.message}`));
      }
    } catch (e: any) {
      warnOnce(`load:${name}`, TUI.yellow(`Could not load plugin: ${name} (missing or misconfigured)`) + TUI.dim(`\n   > ${e.message}`));
    }
  }

  // 4. Print error summary if any
  if (pluginErrors.length > 0) {
    TUI.warn(`${pluginErrors.length} plugin error(s) occurred (build completed)`);
  }

  return hooks;
}

function registerPlugin(name: string, plugin: PluginModule, options: any) {
  const shortName = name.replace(/^@docmd\/plugin-/, '');
  const isOfficial = name.startsWith('@docmd/plugin-');

  // --- §1: Validate descriptor ---
  const descriptor = plugin.plugin || null;

  if (descriptor) {
    const { valid, errors } = validateDescriptor(descriptor);
    if (!valid) {
      const msg = `Plugin "${name}" descriptor failed validation: ${errors.join(', ')}`;
      if (isOfficial) {
        throw new Error(msg); // Hard error for official plugins
      }
      TUI.warn(`${msg} - registering anyway`);
    }
  } else {
    // No descriptor - emit deprecation warning (soft until 0.8.0)
    // Silent for official plugins as they'll be updated together
    if (!isOfficial) {
      TUI.warn(`Plugin "${name}" has no descriptor. This will be required in 0.8.0.`);
    }
  }

  // --- §3: Capability-gated registration ---
  const shouldExecute = (pageContext: any) => {
    if (!pageContext || !pageContext.frontmatter) return true;
    const fmPlugins = pageContext.frontmatter.plugins || {};

    if (fmPlugins[shortName] === false) return false;
    if (fmPlugins[shortName] === true) return true;

    if (pageContext.frontmatter.noStyle) {
      if (options && options.noStyle !== undefined) return options.noStyle;
      if (plugin.noStyle !== undefined) return plugin.noStyle;
      return true;
    }

    return true;
  };

  // markdownSetup
  if (typeof plugin.markdownSetup === 'function') {
    if (hasCapabilityForHook(descriptor, 'markdownSetup')) {
      const fn = plugin.markdownSetup;
      hooks.markdownSetup.push((md: any) => safeCall('markdownSetup', name, fn, md, options));
    } else {
      TUI.warn(`Plugin "${shortName}" exports markdownSetup but didn't declare "markdown" capability - skipped`);
    }
  }

  // generateMetaTags → injectHead
  if (typeof plugin.generateMetaTags === 'function') {
    if (hasCapabilityForHook(descriptor, 'generateMetaTags')) {
      const fn = plugin.generateMetaTags;
      hooks.injectHead.push((config: any, pageContext: any, root: any) => {
        if (!shouldExecute(pageContext)) return '';
        return safeCall('generateMetaTags', name, fn, config, pageContext, root) || '';
      });
    } else {
      TUI.warn(`Plugin "${shortName}" exports generateMetaTags but didn't declare "head" capability - skipped`);
    }
  }

  // generateScripts → injectHead + injectBody
  if (typeof plugin.generateScripts === 'function') {
    if (hasCapabilityForHook(descriptor, 'generateScripts')) {
      const fn = plugin.generateScripts;
      hooks.injectHead.push((config: any, pageContext: any) => {
        if (!shouldExecute(pageContext)) return '';
        const result = safeCall('generateScripts', name, fn, config, options) as any;
        return result?.headScriptsHtml || '';
      });
      hooks.injectBody.push((config: any, pageContext: any) => {
        if (!shouldExecute(pageContext)) return '';
        const result = safeCall('generateScripts', name, fn, config, options) as any;
        return result?.bodyScriptsHtml || '';
      });
    } else {
      TUI.warn(`Plugin "${shortName}" exports generateScripts but didn't declare "head"/"body" capability - skipped`);
    }
  }

  // onPostBuild
  if (typeof plugin.onPostBuild === 'function') {
    if (hasCapabilityForHook(descriptor, 'onPostBuild')) {
      const fn = plugin.onPostBuild;
      const wrapper = async (ctx: any) => {
        try {
          await fn(ctx);
        } catch (err: any) {
          TUI.error(`Plugin "${name}" threw in onPostBuild`, err.message);
          pluginErrors.push({ plugin: name, hook: 'onPostBuild', message: err.message });
        }
      };
      // Tag with the plugin's own declared name (e.g. 'search', 'sitemap')
      // so build.ts can split hooks into indexing vs publishing phases.
      (wrapper as any)._pluginName = descriptor?.name || shortName;
      hooks.onPostBuild.push(wrapper);
    } else {
      TUI.warn(`Plugin "${shortName}" exports onPostBuild but didn't declare "post-build" capability - skipped`);
    }
  }

  // getAssets
  if (typeof plugin.getAssets === 'function') {
    if (hasCapabilityForHook(descriptor, 'getAssets')) {
      const fn = plugin.getAssets;
      hooks.assets.push(() => safeCall('getAssets', name, fn, options) as any[] || []);
    } else {
      TUI.warn(`Plugin "${shortName}" exports getAssets but didn't declare "assets" capability - skipped`);
    }
  }

  // translations
  if (typeof plugin.translations === 'function') {
    if (hasCapabilityForHook(descriptor, 'translations')) {
      const fn = plugin.translations;
      hooks.translations.push((localeId: string) => safeCall('translations', name, fn, localeId, options) as Record<string, string> || {});
    } else {
      TUI.warn(`Plugin "${shortName}" exports translations but didn't declare "translations" capability - skipped`);
    }
  }

  // actions (WebSocket RPC)
  if (plugin.actions && typeof plugin.actions === 'object') {
    if (hasCapabilityForHook(descriptor, 'actions')) {
      Object.assign(hooks.actions, plugin.actions);
    } else {
      TUI.warn(`Plugin "${shortName}" exports actions but didn't declare "actions" capability - skipped`);
    }
  }

  // events (fire-and-forget)
  if (plugin.events && typeof plugin.events === 'object') {
    if (hasCapabilityForHook(descriptor, 'events')) {
      Object.assign(hooks.events, plugin.events);
    } else {
      TUI.warn(`Plugin "${shortName}" exports events but didn't declare "events" capability - skipped`);
    }
  }

  // --- Expanded Lifecycle Hooks ---

  // onConfigResolved
  if (typeof plugin.onConfigResolved === 'function') {
    if (hasCapabilityForHook(descriptor, 'onConfigResolved')) {
      const fn = plugin.onConfigResolved;
      hooks.onConfigResolved.push(async (config: any) => {
        try {
          await fn(config);
        } catch (err: any) {
          TUI.error(`Plugin "${name}" threw in onConfigResolved`, err.message);
          pluginErrors.push({ plugin: name, hook: 'onConfigResolved', message: err.message });
        }
      });
    } else {
      TUI.warn(`Plugin "${shortName}" exports onConfigResolved but didn't declare "init" capability - skipped`);
    }
  }

  // onDevServerReady
  if (typeof plugin.onDevServerReady === 'function') {
    if (hasCapabilityForHook(descriptor, 'onDevServerReady')) {
      const fn = plugin.onDevServerReady;
      hooks.onDevServerReady.push(async (server: any, wss: any) => {
        try {
          await fn(server, wss);
        } catch (err: any) {
          TUI.error(`Plugin "${name}" threw in onDevServerReady`, err.message);
          pluginErrors.push({ plugin: name, hook: 'onDevServerReady', message: err.message });
        }
      });
    } else {
      TUI.warn(`Plugin "${shortName}" exports onDevServerReady but didn't declare "dev" capability - skipped`);
    }
  }

  // onBeforeParse
  if (typeof plugin.onBeforeParse === 'function') {
    if (hasCapabilityForHook(descriptor, 'onBeforeParse')) {
      const fn = plugin.onBeforeParse;
      hooks.onBeforeParse.push(async (src: string, frontmatter: any) => {
        try {
          return await fn(src, frontmatter) ?? src;
        } catch (err: any) {
          TUI.error(`Plugin "${name}" threw in onBeforeParse`, err.message);
          pluginErrors.push({ plugin: name, hook: 'onBeforeParse', message: err.message });
          return src;
        }
      });
    } else {
      TUI.warn(`Plugin "${shortName}" exports onBeforeParse but didn't declare "build" capability - skipped`);
    }
  }

  // onAfterParse
  if (typeof plugin.onAfterParse === 'function') {
    if (hasCapabilityForHook(descriptor, 'onAfterParse')) {
      const fn = plugin.onAfterParse;
      hooks.onAfterParse.push(async (html: string, frontmatter: any) => {
        try {
          return await fn(html, frontmatter) ?? html;
        } catch (err: any) {
          TUI.error(`Plugin "${name}" threw in onAfterParse`, err.message);
          pluginErrors.push({ plugin: name, hook: 'onAfterParse', message: err.message });
          return html;
        }
      });
    } else {
      TUI.warn(`Plugin "${shortName}" exports onAfterParse but didn't declare "build" capability - skipped`);
    }
  }

  // onBeforeBuild
  if (typeof (plugin as any).onBeforeBuild === 'function') {
    if (hasCapabilityForHook(descriptor, 'onBeforeBuild')) {
      const fn = (plugin as any).onBeforeBuild;
      hooks.onBeforeBuild.push(async (ctx: any) => {
        try {
          await fn(ctx);
        } catch (err: any) {
          TUI.error(`Plugin "${name}" threw in onBeforeBuild`, err.message);
          pluginErrors.push({ plugin: name, hook: 'onBeforeBuild', message: err.message });
        }
      });
    } else {
      TUI.warn(`Plugin "${shortName}" exports onBeforeBuild but didn't declare "build" capability - skipped`);
    }
  }

  // onBeforeRender
  if (typeof (plugin as any).onBeforeRender === 'function') {
    if (hasCapabilityForHook(descriptor, 'onBeforeRender')) {
      const fn = (plugin as any).onBeforeRender;
      hooks.onBeforeRender.push(async (page: any) => {
        try {
          await fn(page);
        } catch (err: any) {
          TUI.error(`Plugin "${name}" threw in onBeforeRender`, err.message);
          pluginErrors.push({ plugin: name, hook: 'onBeforeRender', message: err.message });
        }
      });
    } else {
      TUI.warn(`Plugin "${shortName}" exports onBeforeRender but didn't declare "build" capability - skipped`);
    }
  }

  // onPageReady
  if (typeof plugin.onPageReady === 'function') {
    if (hasCapabilityForHook(descriptor, 'onPageReady')) {
      const fn = plugin.onPageReady;
      hooks.onPageReady.push(async (page: any) => {
        try {
          await fn(page);
        } catch (err: any) {
          TUI.error(`Plugin "${name}" threw in onPageReady`, err.message);
          pluginErrors.push({ plugin: name, hook: 'onPageReady', message: err.message });
        }
      });
    } else {
      TUI.warn(`Plugin "${shortName}" exports onPageReady but didn't declare "build" capability - skipped`);
    }
  }

}