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

import chalk from 'chalk';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const hooks: any = {
  markdownSetup: [],
  injectHead: [],
  injectBody: [],
  onPostBuild: [],
  assets: [],
  getClientAssets: [], // Legacy support
  translations: [],    // (localeId) => {key: value} — plugin UI string overrides
  actions: {},         // action name → handler function (for WebSocket RPC)
  events: {}           // event name → handler function (fire-and-forget)
};

// Shorthand resolution — only bare names (no `/` or scope) expand to @docmd/plugin-*.
// Third-party plugins must use their full package name in config.
function resolvePluginName(key: string): string {
  // Already fully qualified (scoped or pathed) — pass through
  if (key.includes('/')) {
    return key;
  }
  // Bare name = official shorthand → @docmd/plugin-<name>
  return `@docmd/plugin-${key}`;
}

export async function loadPlugins(config: any) {
  // 1. Reset hooks
  Object.keys(hooks).forEach(key => {
    hooks[key] = Array.isArray(hooks[key]) ? [] : {};
  });

  // 2. Initialize Plugin Map (Name -> Options)
  // This ensures unique plugins (last write wins)
  const pluginMap = new Map();
  const searchEnabled = config.optionsMenu ? config.optionsMenu.components.search !== false : config.search !== false;

  // A. Core Plugins — always loaded by default.
  //    Users disable with: plugins: { search: { enabled: false } }
  //    or plugins: { search: false }
  const corePlugins = ['search', 'seo', 'sitemap', 'analytics', 'llms', 'mermaid'];

  for (const name of corePlugins) {
    const resolved = `@docmd/plugin-${name}`;
    const userOpts = config.plugins?.[name];

    // Explicit disable via `false` or `{ enabled: false }`
    if (userOpts === false || (userOpts && userOpts.enabled === false)) {
      pluginMap.set(resolved, false);
      continue;
    }

    // Search respects the optionsMenu/search toggle
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

      // Core plugins are already handled above — skip to avoid double-loading
      if (corePlugins.includes(key)) return;

      const options = config.plugins[key];

      // Update map (Override default if exists)
      pluginMap.set(resolvedName, options);
    });
  }

  // 3. Load and Register
  for (const [name, options] of pluginMap) {
    if (options === false) continue; // Skip disabled

    try {
      let rawModule;

      // Single-target resolution — no fallback cascade.
      // Official plugins resolve via @docmd/plugin-*, third-party must be fully qualified.
      try {
        rawModule = await import(name);
      } catch (e: any) {
        // Fallback: local CWD / workspace resolution for dev or file-path plugins
        rawModule = await import(require.resolve(name, { paths: [process.cwd(), __dirname] }));
      }

      const pluginModule = rawModule.default || rawModule;

      try {
        registerPlugin(name, pluginModule, options);
      } catch (regError: any) {
        console.warn(chalk.yellow(`⚠️  Plugin loaded but failed to register: ${name}`));
        console.warn(chalk.dim(`   > ${regError.message}`));
      }
    } catch (e: any) {
      console.warn(chalk.yellow(`⚠️  Could not load plugin: ${name} (missing or misconfigured)`));
      // Only log full error in verbose/debug mode to reduce noise
      // console.error(e.message); 
    }
  }

  return hooks;
}

function registerPlugin(name: string, plugin: any, options: any) {
  const shortName = name.replace(/^@docmd\/plugin-/, '');

  const shouldExecute = (pageContext: any) => {
    if (!pageContext || !pageContext.frontmatter) return true;
    const fmPlugins = pageContext.frontmatter.plugins || {};
    
    // 1. Frontmatter explicit override (Highest priority)
    if (fmPlugins[shortName] === false) return false;
    if (fmPlugins[shortName] === true) return true;

    // 2. noStyle page conditional
    if (pageContext.frontmatter.noStyle) {
      if (options && options.noStyle !== undefined) return options.noStyle;
      if (plugin.noStyle !== undefined) return plugin.noStyle;
      return true; // Default behavior
    }
    
    return true;
  };

  if (typeof plugin.markdownSetup === 'function') hooks.markdownSetup.push((md: any) => plugin.markdownSetup(md, options));

  if (typeof plugin.generateMetaTags === 'function') {
    hooks.injectHead.push((config: any, pageContext: any, root: any) => {
      if (!shouldExecute(pageContext)) return '';
      return plugin.generateMetaTags(config, pageContext, root);
    });
  }

  if (typeof plugin.generateScripts === 'function') {
    hooks.injectHead.push((config: any, pageContext: any) => {
      if (!shouldExecute(pageContext)) return '';
      return plugin.generateScripts(config, options).headScriptsHtml || '';
    });
    hooks.injectBody.push((config: any, pageContext: any) => {
      if (!shouldExecute(pageContext)) return '';
      return plugin.generateScripts(config, options).bodyScriptsHtml || '';
    });
  }

  if (typeof plugin.onPostBuild === 'function') hooks.onPostBuild.push((ctx: any) => plugin.onPostBuild({ ...ctx, options }));

  if (typeof plugin.getAssets === 'function') hooks.assets.push(() => plugin.getAssets(options));

  // Plugin translations (locale-specific UI strings)
  if (typeof plugin.translations === 'function') hooks.translations.push((localeId: string) => plugin.translations(localeId, options));

  // Plugin actions (WebSocket RPC handlers)
  if (plugin.actions && typeof plugin.actions === 'object') {
    Object.assign(hooks.actions, plugin.actions);
  }

  // Plugin events (fire-and-forget handlers)
  if (plugin.events && typeof plugin.events === 'object') {
    Object.assign(hooks.events, plugin.events);
  }
}