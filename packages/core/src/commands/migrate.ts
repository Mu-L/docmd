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

import { fsUtils as fs } from '@docmd/utils';
import path from 'path';
import nativeFs from 'fs';
import { TUI } from '@docmd/api';

function serializeConfig(obj: any) {
  const json = JSON.stringify(obj, null, 2);
  const cleanJs = json.replace(/"([^"]+)":/g, '$1:');
  return `export default ${cleanJs};\n`;
}

export async function migrateProject(options: { docusaurus?: boolean; mkdocs?: boolean; vitepress?: boolean; starlight?: boolean; upgrade?: boolean }) {
  const CWD = process.cwd();

  const moveFilesToBackup = async (backupDir: string) => {
    const backupName = path.basename(backupDir);
    const files = await nativeFs.promises.readdir(CWD);
    for (const file of files) {
      if (file === 'node_modules' || file === '.git' || file === backupName || file === 'docmd.config.js') {
        continue;
      }
      const oldPath = path.resolve(CWD, file);
      const newPath = path.resolve(backupDir, file);
      await nativeFs.promises.rename(oldPath, newPath);
    }
  };

  if (options.docusaurus) {
    TUI.section('Docusaurus Migration');
    const configPath = path.resolve(CWD, 'docusaurus.config.js');
    const tsConfigPath = path.resolve(CWD, 'docusaurus.config.ts');

    let activeConfigPath = '';
    if (nativeFs.existsSync(configPath)) activeConfigPath = configPath;
    else if (nativeFs.existsSync(tsConfigPath)) activeConfigPath = tsConfigPath;
    else {
      TUI.error('Missing configuration', 'docusaurus.config.js or docusaurus.config.ts not found.');
      return;
    }

    const backupDir = path.resolve(CWD, 'docusaurus-backup');
    await fs.ensureDir(backupDir);

    const rawConfig = await nativeFs.promises.readFile(activeConfigPath, 'utf8');
    let title = 'Docmd Site';
    const titleMatch = rawConfig.match(/title:\s*['"]([^'"]+)['"]/);
    if (titleMatch) title = titleMatch[1];

    await moveFilesToBackup(backupDir);
    TUI.step('Created backup directory', 'DONE');

    const backupDocsDir = path.resolve(backupDir, 'docs');
    const newDocsDir = path.resolve(CWD, 'docs');
    if (nativeFs.existsSync(backupDocsDir)) {
      await fs.copy(backupDocsDir, newDocsDir);
      TUI.step('Migrated documentation content', 'DONE');
    } else {
      await fs.ensureDir(newDocsDir);
      TUI.step('Created new docs directory', 'DONE');
    }

    const docmdConfig = { title, src: 'docs', out: 'dist', theme: { appearance: 'system' } };
    await nativeFs.promises.writeFile(path.resolve(CWD, 'docmd.config.js'), serializeConfig(docmdConfig));
    TUI.step('Generated docmd.config.js', 'DONE');

    TUI.footer();
    TUI.success('Docusaurus migration complete.');
    TUI.info(`Original files moved to: ${TUI.cyan('docusaurus-backup/')}`);
    TUI.info(`Run ${TUI.cyan('docmd dev')} to preview your site.`);

  } else if (options.mkdocs) {
    TUI.section('MkDocs Migration');
    const configPath = path.resolve(CWD, 'mkdocs.yml');

    if (!nativeFs.existsSync(configPath)) {
      TUI.error('Missing configuration', 'mkdocs.yml not found.');
      return;
    }

    const backupDir = path.resolve(CWD, 'mkdocs-backup');
    await fs.ensureDir(backupDir);

    const rawConfig = await nativeFs.promises.readFile(configPath, 'utf8');
    let title = 'Docmd Site';
    const titleMatch = rawConfig.match(/^site_name:\s*['"]?([^'"\n]+)['"]?/m);
    if (titleMatch) title = titleMatch[1].trim();

    await moveFilesToBackup(backupDir);
    TUI.step('Created backup directory', 'DONE');

    const backupDocsDir = path.resolve(backupDir, 'docs');
    const newDocsDir = path.resolve(CWD, 'docs');
    if (nativeFs.existsSync(backupDocsDir)) {
      await fs.copy(backupDocsDir, newDocsDir);
      TUI.step('Migrated documentation content', 'DONE');
    } else {
      await fs.ensureDir(newDocsDir);
      TUI.step('Created new docs directory', 'DONE');
    }

    const docmdConfig = { title, src: 'docs', out: 'dist', theme: { appearance: 'system' } };
    await nativeFs.promises.writeFile(path.resolve(CWD, 'docmd.config.js'), serializeConfig(docmdConfig));
    TUI.step('Generated docmd.config.js', 'DONE');

    TUI.footer();
    TUI.success('MkDocs migration complete.');
    TUI.info(`Original files moved to: ${TUI.cyan('mkdocs-backup/')}`);
    TUI.info(`Run ${TUI.cyan('docmd dev')} to preview your site.`);

  } else if (options.vitepress) {
    TUI.section('VitePress Migration');
    const CWD = process.cwd();

    let configDir = '';
    let activeConfigPath = '';

    // Check if config is in root or docs
    for (const dir of ['.vitepress', 'docs/.vitepress']) {
      for (const ext of ['js', 'ts', 'mjs']) {
        const p = path.resolve(CWD, `${dir}/config.${ext}`);
        if (nativeFs.existsSync(p)) {
          configDir = dir;
          activeConfigPath = p;
          break;
        }
      }
      if (activeConfigPath) break;
    }

    if (!activeConfigPath) {
      TUI.error('Missing configuration', '.vitepress/config.[js|ts|mjs] not found.');
      return;
    }

    const backupDir = path.resolve(CWD, 'vitepress-backup');
    await fs.ensureDir(backupDir);

    const rawConfig = await nativeFs.promises.readFile(activeConfigPath, 'utf8');
    let title = 'Docmd Site';
    const titleMatch = rawConfig.match(/title:\s*['"]([^'"]+)['"]/);
    if (titleMatch) title = titleMatch[1];

    await moveFilesToBackup(backupDir);
    TUI.step('Created backup directory', 'DONE');

    const isDocsInRoot = configDir === '.vitepress';
    const newDocsDir = path.resolve(CWD, 'docs');
    await fs.ensureDir(newDocsDir);

    if (isDocsInRoot) {
      const files = await nativeFs.promises.readdir(backupDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          await fs.copy(path.resolve(backupDir, file), path.resolve(newDocsDir, file));
        }
      }
      TUI.step('Migrated root content to docs/', 'DONE');
    } else {
      const backupDocsDir = path.resolve(backupDir, 'docs');
      if (nativeFs.existsSync(backupDocsDir)) {
        await fs.copy(backupDocsDir, newDocsDir);
        await fs.remove(path.resolve(newDocsDir, '.vitepress'));
        TUI.step('Migrated docs content', 'DONE');
      }
    }

    const docmdConfig = { title, src: 'docs', out: 'dist', theme: { appearance: 'system' } };
    await nativeFs.promises.writeFile(path.resolve(CWD, 'docmd.config.js'), serializeConfig(docmdConfig));
    TUI.step('Generated docmd.config.js', 'DONE');

    TUI.footer();
    TUI.success('VitePress migration complete.');
    TUI.info(`Original files moved to: ${TUI.cyan('vitepress-backup/')}`);
    TUI.info(`Run ${TUI.cyan('docmd dev')} to preview your site.`);

  } else if (options.starlight) {
    TUI.section('Starlight Migration');
    const configPath = path.resolve(CWD, 'astro.config.mjs');
    const tsConfigPath = path.resolve(CWD, 'astro.config.ts');

    let activeConfigPath = '';
    if (nativeFs.existsSync(configPath)) activeConfigPath = configPath;
    else if (nativeFs.existsSync(tsConfigPath)) activeConfigPath = tsConfigPath;
    else {
      TUI.error('Missing configuration', 'astro.config.mjs or astro.config.ts not found.');
      return;
    }

    const backupDir = path.resolve(CWD, 'starlight-backup');
    await fs.ensureDir(backupDir);

    const rawConfig = await nativeFs.promises.readFile(activeConfigPath, 'utf8');
    let title = 'Docmd Site';
    const titleMatch = rawConfig.match(/title:\s*['"]([^'"]+)['"]/);
    if (titleMatch) title = titleMatch[1];

    await moveFilesToBackup(backupDir);
    TUI.step('Created backup directory', 'DONE');

    const backupDocsDir = path.resolve(backupDir, 'src/content/docs');
    const newDocsDir = path.resolve(CWD, 'docs');

    if (nativeFs.existsSync(backupDocsDir)) {
      await fs.copy(backupDocsDir, newDocsDir);
      TUI.step('Migrated documentation content', 'DONE');
    } else {
      await fs.ensureDir(newDocsDir);
      TUI.step('Created new docs directory', 'DONE');
    }

    const docmdConfig = { title, src: 'docs', out: 'dist', theme: { appearance: 'system' } };
    await nativeFs.promises.writeFile(path.resolve(CWD, 'docmd.config.js'), serializeConfig(docmdConfig));
    TUI.step('Generated docmd.config.js', 'DONE');

    TUI.footer();
    TUI.success('Astro Starlight migration complete.');
    TUI.info(`Original files moved to: ${TUI.cyan('starlight-backup/')}`);
    TUI.info(`Run ${TUI.cyan('docmd dev')} to preview your site.`);
  } else if (options.upgrade) {
    TUI.section('Upgrading Configuration');
    
    const jsonPath = path.resolve(CWD, 'docmd.config.json');
    const jsPath = path.resolve(CWD, 'docmd.config.js');
    const tsPath = path.resolve(CWD, 'docmd.config.ts');

    let activePath = '';
    let format: 'json' | 'js' | 'ts' = 'json';

    if (nativeFs.existsSync(jsonPath)) {
      activePath = jsonPath;
      format = 'json';
    } else if (nativeFs.existsSync(jsPath)) {
      activePath = jsPath;
      format = 'js';
    } else if (nativeFs.existsSync(tsPath)) {
      activePath = tsPath;
      format = 'ts';
    }

    if (!activePath) {
      TUI.error('Upgrade Failed', 'No docmd configuration file (docmd.config.json/js/ts) found in current directory.');
      return;
    }

    TUI.step(`Found configuration: ${TUI.cyan(path.basename(activePath))}`, 'WAIT');

    try {
      const raw = await nativeFs.promises.readFile(activePath, 'utf8');
      let configObj: any = {};
      let isUpgraded = false;

      if (format === 'json') {
        configObj = JSON.parse(raw);
      } else {
        // Dynamic import to read current exported config values
        const module = await import(`file://${activePath}`);
        configObj = module.default || {};
      }

      // 1. Upgrade legacy top-level 'projects' to 'workspace.projects'
      if (configObj.projects && Array.isArray(configObj.projects) && !configObj.workspace) {
        configObj.workspace = {
          projects: configObj.projects,
          switcher: {
            enabled: true,
            position: 'sidebar-top'
          }
        };
        delete configObj.projects;
        isUpgraded = true;
        TUI.step('Upgraded legacy top-level "projects" to "workspace" schema.', 'DONE');
      }

      // 2. Upgrade legacy 'siteTitle' to 'title'
      if (configObj.siteTitle && !configObj.title) {
        configObj.title = configObj.siteTitle;
        delete configObj.siteTitle;
        isUpgraded = true;
        TUI.step('Upgraded "siteTitle" to "title".', 'DONE');
      }

      // 3. Upgrade legacy 'siteUrl' / 'baseUrl' to 'url'
      if (configObj.siteUrl && !configObj.url) {
        configObj.url = configObj.siteUrl;
        delete configObj.siteUrl;
        isUpgraded = true;
        TUI.step('Upgraded "siteUrl" to "url".', 'DONE');
      }
      if (configObj.baseUrl && !configObj.url) {
        configObj.url = configObj.baseUrl;
        delete configObj.baseUrl;
        isUpgraded = true;
        TUI.step('Upgraded "baseUrl" to "url".', 'DONE');
      }

      // 4. Upgrade legacy 'srcDir' to 'src'
      if (configObj.srcDir && !configObj.src) {
        configObj.src = configObj.srcDir;
        delete configObj.srcDir;
        isUpgraded = true;
        TUI.step('Upgraded "srcDir" to "src".', 'DONE');
      }

      // 5. Upgrade legacy 'outputDir' to 'out'
      if (configObj.outputDir && !configObj.out) {
        configObj.out = configObj.outputDir;
        delete configObj.outputDir;
        isUpgraded = true;
        TUI.step('Upgraded "outputDir" to "out".', 'DONE');
      }

      // 6. Upgrade legacy 'defaultLocale' to 'i18n.default'
      if (configObj.defaultLocale) {
        configObj.i18n = configObj.i18n || {};
        configObj.i18n.default = configObj.defaultLocale;
        delete configObj.defaultLocale;
        isUpgraded = true;
        TUI.step('Upgraded "defaultLocale" to "i18n.default".', 'DONE');
      }

      if (!isUpgraded) {
        TUI.footer();
        TUI.success('Configuration is already up to date with the latest schema.');
        return;
      }

      // Write upgraded config back
      if (format === 'json') {
        await nativeFs.promises.writeFile(activePath, JSON.stringify(configObj, null, 2) + '\n');
      } else {
        let content = serializeConfig(configObj);
        if (format === 'ts') {
          content = `import { UserConfig } from '@docmd/api';\n\nconst config: UserConfig = ${JSON.stringify(configObj, null, 2).replace(/"([^"]+)":/g, '$1:')};\n\nexport default config;\n`;
        }
        await nativeFs.promises.writeFile(activePath, content);
      }

      TUI.footer();
      TUI.success(`Successfully upgraded config file to modern schema.`);
    } catch (error: any) {
      TUI.error('Upgrade Error', `Failed to parse or write config file: ${error.message}`);
    }
  }
}