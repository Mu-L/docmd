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

export async function migrateProject(options: { docusaurus?: boolean; mkdocs?: boolean; vitepress?: boolean; starlight?: boolean }) {
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
  }
}