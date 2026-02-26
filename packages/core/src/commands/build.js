/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025 docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

const path = require('path');
const fs = require('../utils/fs-utils');
const chalk = require('chalk');
const { loadConfig } = require('../utils/config-loader');
const { loadPlugins } = require('../utils/plugin-loader');
const { prepareAssets } = require('../engine/assets');
const { renderPages } = require('../engine/generator');

async function buildSite(configPath, options = { isDev: false, offline: false }) {
  const CWD = process.cwd();
  
  try {
    const config = await loadConfig(configPath);
    const hooks = loadPlugins(config);
    const buildHash = Date.now().toString(36);

    const srcDir = path.resolve(CWD, config.srcDir);
    const outputDir = path.resolve(CWD, config.outputDir);
    
    if (!await fs.exists(srcDir)) throw new Error(`Source directory not found: ${srcDir}`);
    await fs.ensureDir(outputDir);

    // 1. Assets (Core, Theme, User)
    // Pass logger options if needed in future
    await prepareAssets(config, outputDir, options);

    // 2. Plugin Assets
    if (hooks.assets) {
      for (const getAssetsFn of hooks.assets) {
        const assets = getAssetsFn();
        if (Array.isArray(assets)) {
          for (const asset of assets) {
            if (asset.src && asset.dest) {
              const destPath = path.join(outputDir, asset.dest);
              await fs.ensureDir(path.dirname(destPath));
              await fs.copy(asset.src, destPath);
            }
          }
        }
      }
    }

    // 3. Render Content
    const pages = await renderPages({
      config,
      srcDir,
      outputDir,
      hooks,
      buildHash,
      options
    });

    // 4. Post Build Hooks
    await Promise.all(hooks.onPostBuild.map(fn => fn({ 
      config,
      pages,
      outputDir,
      log: (msg) => !options.isDev && console.log(msg)
    })));

    if (!options.isDev) {
      console.log(chalk.green(`✅ Build complete. Generated ${pages.length} pages.`));
    }

  } catch (e) {
    if (!options.isDev) {
      console.error(chalk.red('Build failed:'));
      console.error(e.message);
      process.exit(1);
    }
    throw e; // Re-throw for dev server to catch and display in its own format
  }
}

module.exports = { buildSite };