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

import { generateDeployConfigs } from '@docmd/deployer';
import { loadConfig } from '../utils/config-loader.js';
import { normalizeConfig } from '../utils/config-schema.js';
import { TUI } from '@docmd/api';
import { readFileSync } from 'node:fs';

const pkgUrl = new URL('../../package.json', import.meta.url);
const { version } = JSON.parse(readFileSync(pkgUrl, 'utf-8'));

interface DeployFlags {
  docker?: boolean;
  nginx?: boolean;
  caddy?: boolean;
  githubPages?: boolean;
  vercel?: boolean;
  netlify?: boolean;
  force?: boolean;
  config?: string;
}

async function resolveDeployContext(configPath: string) {
  let config: any;
  try {
    config = await loadConfig(configPath, { isDev: false, quiet: true });
  } catch {
    config = normalizeConfig({});
  }

  const title = config.title;
  const outDir = config.out;
  const siteUrl = config.url ?? null;
  const isSpa = config.layout?.spa !== false;
  const configFile = configPath !== 'docmd.config.js' ? configPath : null;

  let hostname = '';
  if (siteUrl) {
    try {
      hostname = new URL(siteUrl).hostname;
    } catch {
      hostname = siteUrl.replace(/^https?:\/\//, '').split('/')[0];
    }
  }

  return { title, outDir, siteUrl, hostname, isSpa, configFile, version };
}

export async function initDeploy(opts: DeployFlags) {
  const hasTarget = opts.docker || opts.nginx || opts.caddy || opts.githubPages || opts.vercel || opts.netlify;

  if (!hasTarget) {
    TUI.section('Deployment Configuration');
    TUI.info('Please specify a target to configure:');
    console.log('');
    console.log(`  Self-hosted`);
    console.log(`    ${TUI.cyan('--docker')}          Generate Dockerfile & .dockerignore`);
    console.log(`    ${TUI.cyan('--nginx')}           Generate production nginx.conf`);
    console.log(`    ${TUI.cyan('--caddy')}           Generate production Caddyfile`);
    console.log('');
    console.log(`  Cloud / CI`);
    console.log(`    ${TUI.cyan('--github-pages')}    Generate GitHub Actions deploy workflow`);
    console.log(`    ${TUI.cyan('--vercel')}          Generate vercel.json`);
    console.log(`    ${TUI.cyan('--netlify')}         Generate netlify.toml`);
    console.log('');
    TUI.footer();
    process.exit(0);
  }

  try {
    const ctx = await resolveDeployContext(opts.config || 'docmd.config.js');
    TUI.section('Generating Deployment Configs');
    await generateDeployConfigs(ctx, opts);
    TUI.footer();
    TUI.success('Deployment configurations generated successfully!');
    TUI.info(`Remember to run ${TUI.cyan('docmd build')} first to generate your static site content.`);
  } catch (err: any) {
    TUI.error('Failed to generate deployment config', err.message);
    process.exit(1);
  }
}