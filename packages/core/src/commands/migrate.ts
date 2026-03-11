/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
 *
 * @package     @docmd/core
 * @description Migration tool to upgrade configurations
 * --------------------------------------------------------------------
 */

import fs from '../utils/fs-utils.js';
import path from 'path';
import chalk from 'chalk';
import { loadConfig } from '../utils/config-loader.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Helper to stringify object to clean JS content
function serializeConfig(obj: any) {
  // Use JSON stringify with indentation
  const json = JSON.stringify(obj, null, 2);
  // Remove quotes from keys to make it look like idiomatic JS
  // (Regex matches "key": but ignores "https://..." values)
  const cleanJs = json.replace(/"([^"]+)":/g, '$1:');
  return `export default ${cleanJs};\n`;
}

export async function migrateProject(configPathOption = 'docmd.config.js') {
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

  // Check if fully modernized (V3 schema) with no legacy keys
  const hasLegacyKeys = 
    oldConfig.siteTitle !== undefined || 
    oldConfig.siteUrl !== undefined || 
    oldConfig.baseUrl !== undefined ||
    oldConfig.srcDir !== undefined || 
    oldConfig.source !== undefined ||
    oldConfig.outputDir !== undefined ||
    oldConfig.outDir !== undefined ||
    oldConfig.theme?.defaultMode !== undefined;

  const isV1 = !oldConfig.layout || !oldConfig.layout.optionsMenu;

  if (!isV1 && !hasLegacyKeys) {
    console.log(chalk.yellow('⚠️  Config appears to be fully modernized (V3 schema detected).'));
    console.log('   Aborting to prevent overwriting.');
    return;
  }

  console.log(chalk.blue('📦 Starting config migration...'));

  // 2. Create Backup
  const backupPath = path.resolve(CWD, 'docmd.config.legacy.js');
  await fs.copy(configPath, backupPath);
  console.log(chalk.dim(`   > Backup created: docmd.config.legacy.js`));

  // 3. Construct New Config Object
  const newConfig: any = {};

  // -- Core --
  if (oldConfig.title !== undefined) newConfig.title = oldConfig.title;
  else if (oldConfig.siteTitle !== undefined) newConfig.title = oldConfig.siteTitle;

  if (oldConfig.url !== undefined) newConfig.url = oldConfig.url;
  else if (oldConfig.siteUrl !== undefined) newConfig.url = oldConfig.siteUrl;
  else if (oldConfig.baseUrl !== undefined) newConfig.url = oldConfig.baseUrl;

  if (oldConfig.base !== undefined) newConfig.base = oldConfig.base;

  // -- Branding --
  if (oldConfig.logo) newConfig.logo = oldConfig.logo;
  if (oldConfig.favicon) newConfig.favicon = oldConfig.favicon;

  // -- Directories --
  if (oldConfig.src !== undefined) newConfig.src = oldConfig.src;
  else if (oldConfig.srcDir !== undefined) newConfig.src = oldConfig.srcDir;
  else if (oldConfig.source !== undefined) newConfig.src = oldConfig.source;

  if (oldConfig.out !== undefined) newConfig.out = oldConfig.out;
  else if (oldConfig.outDir !== undefined) newConfig.out = oldConfig.outDir;
  else if (oldConfig.outputDir !== undefined) newConfig.out = oldConfig.outputDir;

  // -- V2/V3 Layout Architecture --
  if (oldConfig.layout) {
    newConfig.layout = oldConfig.layout;
  } else {
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
        ...(typeof oldConfig.footer === 'object' ? oldConfig.footer : {})
      }
    };
  }

  // -- Theme --
  newConfig.theme = {};
  if (oldConfig.theme?.name) newConfig.theme.name = oldConfig.theme.name;
  
  if (oldConfig.theme?.appearance) {
    newConfig.theme.appearance = oldConfig.theme.appearance;
  } else if (oldConfig.theme?.defaultMode) {
    newConfig.theme.appearance = oldConfig.theme.defaultMode;
  } else {
    newConfig.theme.appearance = 'system';
  }

  if (oldConfig.theme?.codeHighlight !== undefined) newConfig.theme.codeHighlight = oldConfig.theme.codeHighlight;
  if (oldConfig.theme?.customCss) newConfig.theme.customCss = oldConfig.theme.customCss;

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
