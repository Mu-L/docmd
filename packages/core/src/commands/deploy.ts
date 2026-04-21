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

import pc from 'chalk';
import { generateDeployConfigs } from '../engine/deployer.js';

interface DeployFlags {
  docker?: boolean;
  nginx?: boolean;
  caddy?: boolean;
  force?: boolean;
}

export async function initDeploy(opts: DeployFlags) {
  if (!opts.docker && !opts.nginx && !opts.caddy) {
    console.log(`\n${pc.red('✖')} Please specify a deployment target to configure.`);
    console.log(`\nAvailable targets:`);
    console.log(`  ${pc.cyan('docmd deploy --docker')}    Generate Dockerfile & .dockerignore`);
    console.log(`  ${pc.cyan('docmd deploy --nginx')}     Generate production nginx.conf`);
    console.log(`  ${pc.cyan('docmd deploy --caddy')}     Generate production Caddyfile`);
    console.log(`\nOptions:`);
    console.log(`  ${pc.cyan('--force')}                  Overwrite existing files`);
    process.exit(1);
  }

  try {
    await generateDeployConfigs(opts);
    console.log(`\n${pc.green('✨')} Deployment configuration generated successfully!`);
    console.log(`${pc.blue('ℹ')}  Remember to run \`docmd build\` first to generate your static site content.`);
  } catch (err: any) {
    console.error(`\n${pc.red('✖')} Failed to generate deployment config: ${err.message}`);
    process.exit(1);
  }
}