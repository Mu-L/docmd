/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/deployer
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TUI } from '@docmd/api';

import type { DeployContext } from './context.js';
import { generateDocker } from './providers/docker.js';
import { generateNginx } from './providers/nginx.js';
import { generateCaddy } from './providers/caddy.js';
import { generateGithubPages } from './providers/github-pages.js';
import { generateVercel } from './providers/vercel.js';
import { generateNetlify } from './providers/netlify.js';

const pkgUrl = new URL('../package.json', import.meta.url);
const { version } = JSON.parse(readFileSync(pkgUrl, 'utf-8'));

export interface DeployOpts {
  docker?: boolean;
  nginx?: boolean;
  caddy?: boolean;
  githubPages?: boolean;
  vercel?: boolean;
  netlify?: boolean;
  force?: boolean;
}

async function write(filePath: string, content: string, label: string, force?: boolean) {
  // N-2: when --force is not set, do not overwrite an existing file.
  // The deploy command was silently clobbering existing Docker / nginx /
  // vercel / etc. configs on every run. The fix: skip with a clear
  // TUI line and the existing content is preserved. Pass --force to
  // overwrite. This makes the existing `--force` flag meaningful.
  if (await fileExists(filePath) && !force) {
    TUI.step(`${label} (already exists, skipped — use --force to overwrite)`, 'SKIP', TUI.yellow);
    return;
  }
  await fs.writeFile(filePath, content, 'utf8');
  TUI.step(label, 'DONE');
}

async function fileExists(filePath: string): Promise<boolean> {
  try { await fs.access(filePath); return true; } catch { return false; }
}

export async function generateDeployConfigs(ctx: DeployContext, opts: DeployOpts): Promise<void> {
  const cwd = process.cwd();
  const force = opts.force === true;

  TUI.section('Deployment Context');
  TUI.item('Project', ctx.title);
  TUI.item('Output', `${ctx.outDir}/`);
  if (ctx.hostname) TUI.item('Host', ctx.hostname);
  TUI.footer();

  if (opts.docker) {
    const hasNginxConf = opts.nginx || await fileExists(resolve(cwd, 'nginx.conf'));
    const { dockerfile, dockerignore } = await generateDocker(ctx);
    const df = hasNginxConf
      ? dockerfile.replace('FROM nginx:alpine', 'FROM nginx:alpine\nCOPY nginx.conf /etc/nginx/conf.d/default.conf')
      : dockerfile;
    await write(resolve(cwd, 'Dockerfile'), df, 'Dockerfile', force);
    await write(resolve(cwd, '.dockerignore'), dockerignore, '.dockerignore', force);
  }

  if (opts.nginx) {
    await write(resolve(cwd, 'nginx.conf'), generateNginx(ctx), 'nginx.conf', force);
  }

  if (opts.caddy) {
    await write(resolve(cwd, 'Caddyfile'), generateCaddy(ctx), 'Caddyfile', force);
  }

  if (opts.githubPages) {
    await fs.mkdir(resolve(cwd, '.github', 'workflows'), { recursive: true });
    await write(resolve(cwd, '.github', 'workflows', 'deploy.yml'), generateGithubPages(ctx), '.github/workflows/deploy.yml', force);
  }

  if (opts.vercel) {
    await write(resolve(cwd, 'vercel.json'), generateVercel(ctx), 'vercel.json', force);
  }

  if (opts.netlify) {
    await write(resolve(cwd, 'netlify.toml'), generateNetlify(ctx), 'netlify.toml', force);
  }
}