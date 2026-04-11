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

import chalk from 'chalk';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export const hooks: any = {
  markdownSetup: [],
  injectHead: [],
  injectBody: [],
  onPostBuild: [],
  assets: [],
  getClientAssets: [], // Legacy support
  actions: {},         // action name → handler function (for WebSocket RPC)
  events: {}           // event name → handler function (fire-and-forget)
};

// Dynamic resolution replaces hardcoded aliases.
// We automatically scope shorts to official docmd namespace.
function resolvePluginName(key: string): string {
  // If it's fully qualified (scoped, or custom convention), pass as-is
  if (key.includes('/') || key.startsWith('docmd-plugin-')) {
    return key;
  }
  // Convert shorts directly to official namespace.
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

  // A. Add Defaults
  pluginMap.set('@docmd/plugin-search', searchEnabled ? {} : false);

  if (!config.hasExplicitPlugins) {
    pluginMap.set('@docmd/plugin-seo', config.plugins?.seo || {});
    pluginMap.set('@docmd/plugin-sitemap', config.plugins?.sitemap || {});
    pluginMap.set('@docmd/plugin-analytics', config.plugins?.analytics || {});
    pluginMap.set('@docmd/plugin-pwa', config.plugins?.pwa || {});
  }

  // B. Add/Override from Config
  if (config.plugins) {
    Object.keys(config.plugins).forEach(key => {
      // Resolve dynamically instead of hardcoded aliases
      const resolvedName = resolvePluginName(key);
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

      // Determine resolution cascade for security and convenience
      const loadAttempts = [name];
      const baseName = name.startsWith('@docmd/plugin-') ? name.replace('@docmd/plugin-', '') : null;

      // If it's a dynamic official short, append community & exact fallbacks
      // This guarantees official plugins load FIRST, protecting against malicious injections.
      if (baseName) {
        loadAttempts.push(`docmd-plugin-${baseName}`);
        loadAttempts.push(baseName);
      }

      let loaded = false;
      let lastError = null;

      for (const attempt of loadAttempts) {
        try {
          rawModule = await import(attempt);
          loaded = true;
          break; // Stop at first successful namespace load
        } catch (e: any) {
          // If standard module resolution fails, try local CWD resolution
          try {
            rawModule = await import(require.resolve(attempt, { paths: [process.cwd(), import.meta.dirname] }));
            loaded = true;
            break;
          } catch (localError: any) {
            lastError = localError;
            continue; // Try next scope
          }
        }
      }

      if (!loaded) {
        throw lastError; // Exhausted all attempts
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
  const shortName = name.replace(/^(@docmd\/plugin-|docmd-plugin-)/, '');

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

  // Plugin actions (WebSocket RPC handlers)
  if (plugin.actions && typeof plugin.actions === 'object') {
    Object.assign(hooks.actions, plugin.actions);
  }

  // Plugin events (fire-and-forget handlers)
  if (plugin.events && typeof plugin.events === 'object') {
    Object.assign(hooks.events, plugin.events);
  }
}