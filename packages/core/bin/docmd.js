#!/usr/bin/env node

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

const { program } = require('commander');
const { version } = require('../package.json');
const { initProject } = require('../src/commands/init');
const { buildSite } = require('../src/commands/build');
const { startDevServer } = require('../src/commands/dev');
const { buildLive } = require('../src/commands/live');
const { printBanner } = require('../src/utils/logger');

program
  .name('docmd')
  .description('The minimalist, zero-config documentation generator')
  .version(version);

program
  .command('init')
  .action(() => {
    printBanner();
    initProject();
  });

program
  .command('build')
  .option('-c, --config <path>', 'Path to config', 'docmd.config.js')
  .option('--offline', 'Optimize for file:// viewing')
  .action((opts) => {
    buildSite(opts.config, { isDev: false, offline: opts.offline });
  });

program
  .command('dev')
  .option('-c, --config <path>', 'Path to config', 'docmd.config.js')
  .option('-p, --port <number>', 'Port to run server')
  .action((opts) => {
    printBanner();
    startDevServer(opts.config, opts);
  });

program
  .command('live')
  .description('Launch the Live Editor')
  .option('--build-only', 'Generate the dist/ folder without starting the server')
  .action(async (opts) => {
    try {
      await buildLive({ serve: !opts.buildOnly });
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });

program.parse();