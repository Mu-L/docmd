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

import { generateDeployConfigs } from '../engine/deployer.js';
import { TUI } from '@docmd/api';

interface DeployFlags {
  docker?: boolean;
  nginx?: boolean;
  caddy?: boolean;
  force?: boolean;
  config?: string;
}

export async function initDeploy(opts: DeployFlags) {
  if (!opts.docker && !opts.nginx && !opts.caddy) {
    TUI.section('Deployment Configuration');
    TUI.info('Please specify a target to configure:');
    console.log(`  ${TUI.cyan('--docker')}    Generate Dockerfile & .dockerignore`);
    console.log(`  ${TUI.cyan('--nginx ')}    Generate production nginx.conf`);
    console.log(`  ${TUI.cyan('--caddy ')}    Generate production Caddyfile`);
    TUI.footer();
    process.exit(0);
  }

  try {
    TUI.section('Generating Deployment Configs');
    await generateDeployConfigs(opts);
    TUI.footer();
    TUI.success('Deployment configurations generated successfully!');
    TUI.info(`Remember to run ${TUI.cyan('docmd build')} first to generate your static site content.`);
  } catch (err: any) {
    TUI.error('Failed to generate deployment config', err.message);
    process.exit(1);
  }
}