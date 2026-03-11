#!/usr/bin/env node

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

import { program } from 'commander';
import { readFileSync } from 'fs';
import { initProject } from '../commands/init.js';
import { buildSite } from '../commands/build.js';
import { startDevServer } from '../commands/dev.js';
import { buildLive } from '../commands/live.js';
import { migrateProject } from '../commands/migrate.js';
import { stopServer } from '../commands/stop.js';
import { printBanner } from '../utils/logger.js';
import { installPlugin, removePlugin } from '@docmd/plugin-installer';

const pkgUrl = new URL('../../package.json', import.meta.url);
const { version } = JSON.parse(readFileSync(pkgUrl, 'utf-8'));

program
  .name('docmd')
  .description('The minimalist, zero-config documentation generator.')
  .version(version, '-v, --version')
  .action(() => {
    printBanner();
    program.help();
  });

program
  .command('init')
  .description('Initialize a new documentation project')
  .action(() => {
    printBanner();
    initProject();
  });

program
  .command('build')
  .description('Build the static site for production')
  .option('-c, --config <path>', 'Path to config', 'docmd.config.js')
  .option('-z, --zero-config', 'Run in auto-detect mode without a config file')
  .option('--offline', 'Optimize for file:// viewing')
  .action((opts) => {
    printBanner();
    buildSite(opts.config, { isDev: false, offline: opts.offline, zeroConfig: opts.zeroConfig });
  });

program
  .command('dev')
  .description('Start the development server')
  .option('-c, --config <path>', 'Path to config', 'docmd.config.js')
  .option('-p, --port <number>', 'Port to run server')
  .option('-z, --zero-config', 'Run in auto-detect mode without a config file')
  .action((opts) => {
    printBanner();
    startDevServer(opts.config, opts);
  });

program
  .command('live')
  .description('Launch the Live Editor')
  .option('--build-only', 'Generate the dist/ folder without starting the server')
  .action(async (opts) => {
    printBanner();
    try {
      await buildLive({ serve: !opts.buildOnly });
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });

program
  .command('migrate')
  .description('Migrate legacy config to the new V2 structure')
  .option('-c, --config <path>', 'Path to config', 'docmd.config.js')
  .action((opts) => {
    printBanner();
    migrateProject(opts.config);
  });

program
  .command('stop')
  .description('Kill all running background docmd dev servers')
  .option('-p, --port <number>', 'Stop a specific docmd instance running on this port')
  .action(async (opts: any) => {
    await stopServer(opts.port);
  });

program
  .command('add <pluginName>')
  .description('Install and configure a docmd plugin')
  .option('-v, --verbose', 'Show detailed package manager logs')
  .action((pluginName, opts) => {
    printBanner();
    installPlugin(pluginName, opts);
  });

program
  .command('remove <pluginName>')
  .description('Remove and unconfigure a docmd plugin')
  .option('-v, --verbose', 'Show detailed package manager logs')
  .action((pluginName, opts) => {
    printBanner();
    removePlugin(pluginName, opts);
  });

program.parse();