const path = require('path');
const fs = require('fs');
const { validateConfig } = require('@docmd/parser'); 

async function loadConfig(configPath) {
  const cwd = process.cwd();
  let absoluteConfigPath = path.resolve(cwd, configPath);

  // Fallback for default filename
  if (!fs.existsSync(absoluteConfigPath) && configPath === 'docmd.config.js') {
    const legacyPath = path.resolve(cwd, 'config.js');
    if (fs.existsSync(legacyPath)) absoluteConfigPath = legacyPath;
    else throw new Error(`Configuration file not found at: ${absoluteConfigPath}\nRun "docmd init" to create one.`);
  }

  try {
    delete require.cache[require.resolve(absoluteConfigPath)];
    const config = require(absoluteConfigPath);
    
    // Validate using Parser
    validateConfig(config);

    // Apply Defaults
    return {
      base: '/',
      srcDir: 'docs',
      outputDir: 'site',
      ...config,
      theme: { defaultMode: 'light', ...config.theme },
      navigation: config.navigation || [{ title: 'Home', path: '/' }]
    };
  } catch (e) {
    if (e.message === 'Invalid configuration file.') throw e;
    throw new Error(`Error parsing config file: ${e.message}`);
  }
}

module.exports = { loadConfig };