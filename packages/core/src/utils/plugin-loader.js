const chalk = require('chalk');

const hooks = {
  markdownSetup: [],
  injectHead: [],
  injectBody: [],
  onPostBuild: [],
  assets: [],
  getClientAssets: [] // Legacy support
};

// Map short names to package names
const ALIASES = {
  'search': '@docmd/plugin-search',
  'seo': '@docmd/plugin-seo',
  'sitemap': '@docmd/plugin-sitemap',
  'analytics': '@docmd/plugin-analytics',
  'mermaid': '@docmd/plugin-mermaid'
};

function loadPlugins(config) {
  // 1. Reset hooks
  Object.keys(hooks).forEach(key => hooks[key] = []);

  // 2. Initialize Plugin Map (Name -> Options)
  // This ensures unique plugins (last write wins)
  const pluginMap = new Map();

  // A. Add Defaults
  pluginMap.set('@docmd/plugin-search', config.search !== false ? {} : false);
  pluginMap.set('@docmd/plugin-seo', config.plugins?.seo || {});
  pluginMap.set('@docmd/plugin-sitemap', config.plugins?.sitemap || {});
  pluginMap.set('@docmd/plugin-analytics', config.plugins?.analytics || {});

  // B. Add/Override from Config
  if (config.plugins) {
    Object.keys(config.plugins).forEach(key => {
      // Resolve Alias (e.g., 'mermaid' -> '@docmd/plugin-mermaid')
      const resolvedName = ALIASES[key] || key;
      const options = config.plugins[key];
      
      // Update map (Override default if exists)
      pluginMap.set(resolvedName, options);
    });
  }

  // 3. Load and Register
  for (const [name, options] of pluginMap) {
    if (options === false) continue; // Skip disabled

    try {
      // Try resolving standard package
      let pluginModule;
      try {
        pluginModule = require(name);
      } catch (e) {
        // Fallback for local development or misnamed packages
        console.warn(chalk.dim(`   > Debug: Could not require '${name}', checking alternatives...`));
        throw e; 
      }

      registerPlugin(name, pluginModule, options);
    } catch (e) {
      console.warn(chalk.yellow(`⚠️  Could not load plugin: ${name}`));
      // Only log full error in verbose/debug mode to reduce noise
      // console.error(e.message); 
    }
  }

  return hooks;
}

function registerPlugin(name, plugin, options) {
  if (typeof plugin.markdownSetup === 'function') hooks.markdownSetup.push((md) => plugin.markdownSetup(md, options));
  
  if (typeof plugin.generateMetaTags === 'function') {
    hooks.injectHead.push((config, page, root) => plugin.generateMetaTags(config, page, root));
  }
  
  if (typeof plugin.generateScripts === 'function') {
    hooks.injectHead.push((c) => plugin.generateScripts(c, options).headScriptsHtml || '');
    hooks.injectBody.push((c) => plugin.generateScripts(c, options).bodyScriptsHtml || '');
  }

  if (typeof plugin.onPostBuild === 'function') hooks.onPostBuild.push((ctx) => plugin.onPostBuild({ ...ctx, options }));
  
  if (typeof plugin.getAssets === 'function') hooks.assets.push(() => plugin.getAssets(options));
}

module.exports = { loadPlugins, hooks };