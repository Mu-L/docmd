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
const fs = require('fs');
const { validateConfig } = require('@docmd/parser'); 
const { normalizeConfig } = require('./config-schema');
const chalk = require('chalk');

async function loadConfig(configPath) {
  const cwd = process.cwd();
  let absoluteConfigPath = path.resolve(cwd, configPath);

  if (!fs.existsSync(absoluteConfigPath) && configPath === 'docmd.config.js') {
    const legacyPath = path.resolve(cwd, 'config.js');
    if (fs.existsSync(legacyPath)) absoluteConfigPath = legacyPath;
    else throw new Error(`Configuration file not found: ${absoluteConfigPath}`);
  }

  try {
    delete require.cache[require.resolve(absoluteConfigPath)];
    const rawConfig = require(absoluteConfigPath);
    
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
    const normalized = normalizeConfig(rawConfig);

    return normalized;

  } catch (e) {
    if (e.message === 'Invalid configuration file.') throw e;
    throw new Error(`Error parsing config file: ${e.message}`);
  }
}

module.exports = { loadConfig };