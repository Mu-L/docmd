#!/usr/bin/env node

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

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { initProject } from '../commands/init.js';
import { buildSite } from '../commands/build.js';
import { startDevServer } from '../commands/dev.js';
import { buildLive } from '../commands/live.js';
import { migrateProject } from '../commands/migrate.js';
import { stopServer } from '../commands/stop.js';
import { initDeploy } from '../commands/deploy.js';
import { printBanner } from '../utils/logger.js';
import { installPlugin, removePlugin } from '@docmd/plugin-installer';

const pkgUrl = new URL('../../package.json', import.meta.url);
const { version } = JSON.parse(readFileSync(pkgUrl, 'utf-8'));

const args = process.argv.slice(2);

const options = {
  config: { type: 'string', short: 'c' },
  offline: { type: 'boolean' },
  port: { type: 'string', short: 'p' },
  'build-only': { type: 'boolean' },
  cwd: { type: 'string' },
  verbose: { type: 'boolean', short: 'V' },
  version: { type: 'boolean', short: 'v' },
  help: { type: 'boolean', short: 'h' }
} as const;

let parsed;
try {
  parsed = parseArgs({ args, options, allowPositionals: true, strict: false });
} catch (e: any) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}

const { values, positionals } = parsed;

// Handle custom working directory
if (values.cwd) {
  try {
    process.chdir(values.cwd);
  } catch (err: any) {
    console.error(`Error: Could not change directory to "${values.cwd}": ${err.message}`);
    process.exit(1);
  }
}

const command = positionals[0];

if (values.version || (!command && args.includes('-v'))) {
  console.log(version);
  process.exit(0);
}

if (!command || values.help) {
  printBanner();
  console.log(`docmd v${version}`);
  console.log(`\nUsage: docmd <command> [options]\n`);
  console.log(`Commands:`);
  console.log(`  init            Initialize a new documentation project`);
  console.log(`  build           Build the static site for production`);
  console.log(`  dev             Start the development server`);
  console.log(`  live            Launch the Live Editor`);
  console.log(`  migrate         Migrate legacy config to the new V2 structure`);
  console.log(`  deploy          Generate production deployment configurations`);
  console.log(`  stop            Kill all running background docmd dev servers`);
  console.log(`  add <plugin>    Install and configure a docmd plugin`);
  console.log(`  remove <plugin> Remove and unconfigure a docmd plugin`);
  console.log(`\nOptions:`);
  console.log(`  -c, --config <path>    Path to config (default: docmd.config.js)`);
  console.log(`  -p, --port <number>    Port to run server`);
  console.log(`  --offline              Optimise for file:// viewing`);
  console.log(`  --build-only           Generate the dist/ folder without starting the server`);
  console.log(`  -V, --verbose          Show detailed package manager logs`);
  console.log(`  -v, --version          Output the version number`);
  console.log(`  -h, --help             Display help for command`);
  console.log(`\nDeploy Options (docmd deploy):`);
  console.log(`  --docker               Generate Dockerfile for containerization`);
  console.log(`  --nginx                Generate production nginx.conf`);
  console.log(`  --caddy                Generate production Caddyfile`);
  console.log(`  --force                Overwrite existing deployment files`);
  process.exit(0);
}

const opts = {
  config: values.config || 'docmd.config.js',
  offline: values.offline,
  port: values.port,
  buildOnly: values['build-only'],
  verbose: values.verbose
};

if (command !== 'stop') {
  printBanner();
}

if (command === 'init') {
  initProject();
} else if (command === 'build') {
  buildSite(opts.config, { isDev: false, offline: opts.offline });
} else if (command === 'dev') {
  startDevServer(opts.config, opts);
} else if (command === 'live') {
  buildLive({ serve: !opts.buildOnly }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else if (command === 'migrate') {
  migrateProject(opts.config);
} else if (command === 'deploy') {
  // Deploy has its own scoped flags — re-parse argv with deploy-specific options
  const deployArgs = args.slice(args.indexOf('deploy') + 1); // everything after "deploy"
  const deployOptions = {
    docker: { type: 'boolean' },
    nginx: { type: 'boolean' },
    caddy: { type: 'boolean' },
    force: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' }
  } as const;

  let deployParsed;
  try {
    deployParsed = parseArgs({ args: deployArgs, options: deployOptions, allowPositionals: false });
  } catch (e: any) {
    console.log(`\nArgument needed. Please specify a deployment target to configure.`);
    console.log(`\nTargets:`);
    console.log(`  --docker    Generate Dockerfile & .dockerignore`);
    console.log(`  --nginx     Generate production nginx.conf`);
    console.log(`  --caddy     Generate production Caddyfile`);
    console.log(`\nOptions:`);
    console.log(`  --force     Overwrite existing deployment files`);
    console.log(`  -h, --help  Show this help message`);
    process.exit(0);
  }

  const dv = deployParsed.values;

  if (dv.help) {
    console.log(`\nUsage: docmd deploy [options]\n`);
    console.log(`Targets:`);
    console.log(`  --docker    Generate Dockerfile & .dockerignore`);
    console.log(`  --nginx     Generate production nginx.conf`);
    console.log(`  --caddy     Generate production Caddyfile`);
    console.log(`\nOptions:`);
    console.log(`  --force     Overwrite existing deployment files`);
    console.log(`  -h, --help  Show this help message`);
    process.exit(0);
  }

  initDeploy({ docker: dv.docker, nginx: dv.nginx, caddy: dv.caddy, force: dv.force, config: opts.config }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else if (command === 'stop') {
  stopServer(opts.port);
} else if (command === 'add') {
  if (!positionals[1]) {
    console.error('Error: missing plugin name.');
    process.exit(1);
  }
  installPlugin(positionals[1], opts);
} else if (command === 'remove') {
  if (!positionals[1]) {
    console.error('Error: missing plugin name.');
    process.exit(1);
  }
  removePlugin(positionals[1], opts);
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}