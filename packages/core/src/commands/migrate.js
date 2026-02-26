/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
 *
 * @package     @docmd/core
 * @description Migration tool to upgrade configurations
 * --------------------------------------------------------------------
 */

const fs = require('../utils/fs-utils');
const path = require('path');
const chalk = require('chalk');
const { loadConfig } = require('../utils/config-loader');

// Helper to stringify object to clean JS content
function serializeConfig(obj) {
  // Use JSON stringify with indentation
  const json = JSON.stringify(obj, null, 2);
  // Remove quotes from keys to make it look like idiomatic JS
  // (Regex matches "key": but ignores "https://..." values)
  const cleanJs = json.replace(/"([^"]+)":/g, '$1:');
  return `module.exports = ${cleanJs};\n`;
}

async function migrateProject(configPathOption = 'docmd.config.js') {
  const CWD = process.cwd();
  const configPath = path.resolve(CWD, configPathOption);

  if (!await fs.exists(configPath)) {
    console.error(chalk.red(`❌ Config file not found at: ${configPath}`));
    return;
  }

  // 1. Load current (legacy) config
  // We use our loader because it handles the raw require
  let oldConfig;
  try {
    const rawPath = require.resolve(configPath);
    delete require.cache[rawPath];
    oldConfig = require(rawPath);
  } catch (e) {
    console.error(chalk.red('❌ Could not read config file.'));
    return;
  }

  // Check if already migrated (simple check for layout object)
  if (oldConfig.layout && oldConfig.layout.optionsMenu) {
    console.log(chalk.yellow('⚠️  Config appears to be already migrated (V2 layout detected).'));
    console.log('   Aborting to prevent overwriting.');
    return;
  }

  console.log(chalk.blue('📦 Starting migration to V2 Architecture...'));

  // 2. Create Backup
  const backupPath = path.resolve(CWD, 'docmd.config.legacy.js');
  await fs.copy(configPath, backupPath);
  console.log(chalk.dim(`   > Backup created: docmd.config.legacy.js`));

  // 3. Construct New Config Object
  // We explicitly rebuild it to ensure order and structure, rather than just dumping the normalized object
  const newConfig = {};

  // -- Core --
  if (oldConfig.siteTitle) newConfig.siteTitle = oldConfig.siteTitle;
  if (oldConfig.siteUrl) newConfig.siteUrl = oldConfig.siteUrl;
  
  // -- Branding --
  if (oldConfig.logo) newConfig.logo = oldConfig.logo;
  if (oldConfig.favicon) newConfig.favicon = oldConfig.favicon;

  // -- Directories --
  if (oldConfig.srcDir) newConfig.srcDir = oldConfig.srcDir;
  if (oldConfig.outputDir) newConfig.outputDir = oldConfig.outputDir;

  // -- V2 Layout Architecture --
  newConfig.layout = {
    spa: true, // Enable new feature by default
    header: { enabled: true },
    sidebar: {
      collapsible: oldConfig.sidebar?.collapsible ?? true,
      defaultCollapsed: oldConfig.sidebar?.defaultCollapsed ?? false,
    },
    optionsMenu: {
      position: oldConfig.theme?.positionMode === 'bottom' ? 'sidebar-bottom' : 'header',
      components: {
        search: oldConfig.search !== false,
        themeSwitch: oldConfig.theme?.enableModeToggle !== false,
        sponsor: oldConfig.sponsor?.link || null
      }
    },
    footer: {
      style: typeof oldConfig.footer === 'string' ? 'minimal' : 'complete',
      content: typeof oldConfig.footer === 'string' ? oldConfig.footer : undefined,
      // If they had a complex footer before (unlikely in v1, but safe to map)
      ...(typeof oldConfig.footer === 'object' ? oldConfig.footer : {})
    }
  };

  // -- Theme --
  newConfig.theme = {
    name: oldConfig.theme?.name || 'default',
    defaultMode: oldConfig.theme?.defaultMode || 'system',
    codeHighlight: oldConfig.theme?.codeHighlight !== false,
    customCss: oldConfig.theme?.customCss || [],
  };

  // -- Features --
  if (oldConfig.minify !== undefined) newConfig.minify = oldConfig.minify;
  if (oldConfig.autoTitleFromH1 !== undefined) newConfig.autoTitleFromH1 = oldConfig.autoTitleFromH1;
  if (oldConfig.copyCode !== undefined) newConfig.copyCode = oldConfig.copyCode;
  if (oldConfig.pageNavigation !== undefined) newConfig.pageNavigation = oldConfig.pageNavigation;
  if (oldConfig.customJs) newConfig.customJs = oldConfig.customJs;
  
  if (oldConfig.editLink) newConfig.editLink = oldConfig.editLink;

  // -- Navigation & Plugins (Pass through) --
  newConfig.plugins = oldConfig.plugins || {};
  newConfig.navigation = oldConfig.navigation || [];

  // 4. Write New File
  const fileContent = serializeConfig(newConfig);
  await fs.writeFile(configPath, fileContent);

  console.log(chalk.green('\n✅ Migration Complete!'));
  console.log(`   Your config has been updated to the V2 structure.`);
  console.log(`   Run ${chalk.cyan('docmd dev')} to verify.`);
}

module.exports = { migrateProject };