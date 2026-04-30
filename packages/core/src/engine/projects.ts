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

/**
 * Multi-Project Handler.
 *
 * Enables a single docmd instance to build multiple independent
 * documentation projects under one domain.
 *
 * Root config:
 *   projects: [
 *     { prefix: '/',       src: 'docmd-main' },
 *     { prefix: '/search', src: 'docmd-search' }
 *   ]
 *
 * Each project folder has its own docmd.config.js with its own
 * title, versions, i18n, plugins, navigation, etc.
 *
 * Output merges into a single site/ directory:
 *   site/                     ← root project
 *   site/search/              ← prefixed project
 *
 * Assets:
 *   - Root-level assets/ are shared across all projects
 *   - Each project can have its own assets/ that override shared ones
 */

import path from 'path';
import fs from '../utils/fs-utils.js';
import nativeFs from 'fs';
import { TUI } from '@docmd/tui';
import { loadConfig } from '../utils/config-loader.js';
import { buildSite } from '../commands/build.js';

/* ── Types ─────────────────────────────────────────────────── */

export interface ProjectEntry {
  /** URL prefix. '/' for root, '/search' for subpath. */
  prefix: string;
  /** Source directory relative to CWD (contains the project's docmd.config.js). */
  src: string;
}

export interface MultiProjectConfig {
  projects: ProjectEntry[];
  /** Shared output directory. Default: 'site' */
  out?: string;
}

/* ── Detection ─────────────────────────────────────────────── */

/**
 * Check if a raw config object is a multi-project config.
 * A multi-project config has a `projects` array at root level.
 */
export function isMultiProject(rawConfig: any): rawConfig is MultiProjectConfig {
  return rawConfig
    && Array.isArray(rawConfig.projects)
    && rawConfig.projects.length > 0
    && rawConfig.projects.every((p: any) =>
      typeof p.prefix === 'string' && typeof p.src === 'string'
    );
}

/**
 * Load the raw config file without normalization to check for projects.
 * Returns null if no config found or if it's not multi-project.
 */
export async function detectMultiProject(configPath: string): Promise<MultiProjectConfig | null> {
  const CWD = process.cwd();
  const absolutePath = path.resolve(CWD, configPath);

  if (!nativeFs.existsSync(absolutePath)) return null;

  try {
    // Polyfill defineConfig
    (global as any).defineConfig = (config: any) => config;

    const ts = Date.now();
    const ext = path.extname(absolutePath);
    const tempPath = absolutePath.replace(new RegExp(`\\${ext}$`), `-${ts}${ext}`);
    nativeFs.copyFileSync(absolutePath, tempPath);

    const { pathToFileURL } = await import('url');
    const configUrl = pathToFileURL(tempPath).href;
    const rawModule = await import(configUrl);
    const rawConfig = rawModule.default || rawModule;

    nativeFs.unlinkSync(tempPath);
    delete (global as any).defineConfig;

    if (isMultiProject(rawConfig)) {
      return rawConfig as MultiProjectConfig;
    }
    return null;
  } catch {
    delete (global as any).defineConfig;
    return null;
  }
}

/* ── Validation ────────────────────────────────────────────── */

function validateProjects(projects: ProjectEntry[]): void {
  const prefixes = new Set<string>();
  let hasRoot = false;

  for (const project of projects) {
    // Normalize prefix
    const prefix = project.prefix === '/' ? '/' : project.prefix.replace(/\/$/, '');

    if (prefixes.has(prefix)) {
      throw new Error(`Duplicate project prefix: "${prefix}"`);
    }
    prefixes.add(prefix);

    if (prefix === '/') hasRoot = true;

    // Verify source directory exists
    const srcPath = path.resolve(process.cwd(), project.src);
    if (!nativeFs.existsSync(srcPath)) {
      throw new Error(`Project source directory not found: ${project.src}`);
    }
  }

  if (!hasRoot) {
    throw new Error('Multi-project config must have a root project with prefix "/"');
  }

  // Check for potential conflicts: warn if root project might have content at a sub-project's prefix
  const rootProject = projects.find(p => p.prefix === '/');
  if (rootProject) {
    const rootSrcPath = path.resolve(process.cwd(), rootProject.src);
    for (const project of projects) {
      if (project.prefix === '/') continue;
      const prefixName = project.prefix.replace(/^\//, '');
      // Check if root project has a folder matching another project's prefix
      const conflictPath = path.join(rootSrcPath, prefixName);
      if (nativeFs.existsSync(conflictPath)) {
        TUI.warn(`Potential conflict: Root project has "${prefixName}/" folder which may conflict with project prefix "${project.prefix}".`);
        TUI.warn(`Content at "${rootProject.src}/${prefixName}/" will be overwritten by project "${project.src}".`);
      }
    }
  }
}

/* ── Build ─────────────────────────────────────────────────── */

/**
 * Build all projects in a multi-project config.
 *
 * For each project:
 * 1. cd into the project's src directory
 * 2. Load its own docmd.config.js
 * 3. Override src/out to fit the project structure
 * 4. Build normally
 * 5. Move output into the correct prefix under the root output dir
 */
export async function buildMultiProject(
  multiConfig: MultiProjectConfig,
  opts: { isDev?: boolean; offline?: boolean; quiet?: boolean } = {}
): Promise<void> {
  const CWD = process.cwd();
  const rootOutDir = path.resolve(CWD, multiConfig.out || 'site');

  validateProjects(multiConfig.projects);

  // Sort: root project first, then alphabetical
  const sorted = [...multiConfig.projects].sort((a, b) => {
    if (a.prefix === '/') return -1;
    if (b.prefix === '/') return 1;
    return a.prefix.localeCompare(b.prefix);
  });

  // Only show banner in production builds, not in dev mode
  if (!opts.isDev && !opts.quiet) {
    TUI.banner(undefined, 'Multi-Project');
    TUI.section(`Multi-Project Build (${sorted.length} projects)`);
  }

  // Ensure clean output directory
  await fs.ensureDir(rootOutDir);

  // Copy shared assets first (root-level assets/ folder)
  const sharedAssetsDir = path.resolve(CWD, 'assets');
  if (nativeFs.existsSync(sharedAssetsDir)) {
    TUI.item('Shared assets', path.relative(CWD, sharedAssetsDir));
  }

  for (const project of sorted) {
    const prefix = project.prefix === '/' ? '/' : project.prefix.replace(/\/$/, '');
    const projectSrcDir = path.resolve(CWD, project.src);
    const projectConfigPath = path.join(projectSrcDir, 'docmd.config.js');

    // Determine this project's output directory
    const projectOutDir = prefix === '/'
      ? rootOutDir
      : path.join(rootOutDir, prefix.replace(/^\//, ''));

    const label = prefix === '/' ? `/ (root)` : prefix;
    TUI.divider(`Building: ${label}`);
    TUI.item('Source', `${project.src}/`);
    TUI.item('Output', `${path.relative(CWD, projectOutDir)}/`);

    // Check if the project has its own config
    const hasProjectConfig = nativeFs.existsSync(projectConfigPath);

    if (!hasProjectConfig) {
      TUI.item('Config', 'zero-config (no docmd.config.js found)');
    }

    // Change to project directory and build
    const originalCwd = process.cwd();
    process.chdir(projectSrcDir);

    try {
      // The project's docmd.config.js should NOT have src/out,
      // because the multi-project handler provides those.
      // We set environment variables so the config loader can
      // pick them up. src is NOT overridden — the child config
      // controls where content lives (defaults to 'docs').
      process.env.DOCMD_PROJECT_OUT = projectOutDir;
      process.env.DOCMD_PROJECT_PREFIX = prefix;

      // If shared assets exist, copy them into the project output
      if (nativeFs.existsSync(sharedAssetsDir)) {
        await fs.ensureDir(path.join(projectOutDir, 'assets'));
        await fs.copy(sharedAssetsDir, path.join(projectOutDir, 'assets'));
      }

      // Build this project
      const configFile = hasProjectConfig ? 'docmd.config.js' : 'docmd.config.js';
      await buildSite(configFile, {
        isDev: opts.isDev || false,
        offline: opts.offline || false,
      });

      TUI.step(`Project ${label}`, 'DONE');

    } catch (err: any) {
      TUI.step(`Project ${label}`, 'FAIL');
      TUI.error(`Build failed for ${label}`, err.message);
      if (!opts.isDev) throw err;
    } finally {
      // Always restore CWD
      process.chdir(originalCwd);
      delete process.env.DOCMD_PROJECT_OUT;
      delete process.env.DOCMD_PROJECT_PREFIX;
    }
  }

  // Final summary
  if (!opts.isDev && !opts.quiet) {
    const totalSize = await getDirectorySize(rootOutDir);
    TUI.footer();
    TUI.success(`Multi-project build complete → ${path.relative(CWD, rootOutDir)}/ (${formatBytes(totalSize)})`);
  } else {
    TUI.footer();
  }
}

/* ── Single Project Build (for dev watchers) ────────────────── */

async function buildSingleProject(
  project: ProjectEntry,
  multiConfig: MultiProjectConfig,
  opts: { isDev?: boolean; offline?: boolean; quiet?: boolean } = {}
): Promise<void> {
  const CWD = process.cwd();
  const rootOutDir = path.resolve(CWD, multiConfig.out || 'site');
  const prefix = project.prefix === '/' ? '/' : project.prefix.replace(/\/$/, '');
  const projectSrcDir = path.resolve(CWD, project.src);
  const projectConfigPath = path.join(projectSrcDir, 'docmd.config.js');

  const projectOutDir = prefix === '/'
    ? rootOutDir
    : path.join(rootOutDir, prefix.replace(/^\//, ''));

  const label = prefix === '/' ? '/ (root)' : prefix;

  // Check if project has its own config
  const hasProjectConfig = nativeFs.existsSync(projectConfigPath);

  // Change to project directory and build
  const originalCwd = process.cwd();
  process.chdir(projectSrcDir);

  try {
    process.env.DOCMD_PROJECT_OUT = projectOutDir;
    process.env.DOCMD_PROJECT_PREFIX = prefix;

    // Copy shared assets if they exist
    const sharedAssetsDir = path.resolve(CWD, 'assets');
    if (nativeFs.existsSync(sharedAssetsDir)) {
      await fs.ensureDir(path.join(projectOutDir, 'assets'));
      await fs.copy(sharedAssetsDir, path.join(projectOutDir, 'assets'));
    }

    // Build only this project
    const configFile = hasProjectConfig ? 'docmd.config.js' : 'docmd.config.js';
    await buildSite(configFile, {
      isDev: opts.isDev || false,
      offline: opts.offline || false,
      quiet: true, // Suppress output in dev mode
    });

  } catch (err: any) {
    TUI.error(`Build failed for ${label}`, err.message);
    throw err;
  } finally {
    process.chdir(originalCwd);
    delete process.env.DOCMD_PROJECT_OUT;
    delete process.env.DOCMD_PROJECT_PREFIX;
  }
}

/* ── Dev Server Wrapper ────────────────────────────────────── */

/**
 * Start dev server for multi-project mode.
 *
 * Builds all projects initially, then watches each project's
 * source directory for changes and rebuilds only the affected project.
 */
export async function devMultiProject(
  multiConfig: MultiProjectConfig,
  opts: { port?: string; preserve?: boolean } = {}
): Promise<void> {
  // For dev mode, do a full multi-project build first
  await buildMultiProject(multiConfig, { isDev: true });

  // Then start a simple static server on the combined output
  const CWD = process.cwd();
  const rootOutDir = path.resolve(CWD, multiConfig.out || 'site');

  // Import dev utilities
  const { serveStatic, findAvailablePort, formatPathForDisplay, getNetworkIp } = await import('../utils/dev-utils.js');
  const http = await import('http');
  const { WebSocketServer, WebSocket } = await import('ws');

  const state = { outputDir: rootOutDir };
  const server = http.createServer((req: any, res: any) => serveStatic(req, res, state.outputDir));

  const PORT = parseInt(opts.port || process.env.PORT || '3000', 10);
  const port = await findAvailablePort(PORT);

  let wss: any;

  function broadcastReload() {
    if (wss) {
      wss.clients.forEach((client: any) => {
        if (client.readyState === WebSocket.OPEN) client.send('reload');
      });
    }
  }

  server.listen(port, '0.0.0.0', () => {
    wss = new WebSocketServer({ server });
    wss.on('error', (e: any) => console.error('WebSocket Error:', e.message));

    const networkIp = getNetworkIp();
    const localUrl = `http://127.0.0.1:${port}`;
    const networkUrl = networkIp ? `http://${networkIp}:${port}` : null;

    // TUI.banner(undefined, 'MULTI-PROJECT');
    TUI.section('DEV SERVER');
    console.log('');
    TUI.item('Local', localUrl, TUI.bold);
    if (networkUrl) {
      TUI.item('Network', networkUrl, TUI.bold);
    }
    console.log('');

    for (const project of multiConfig.projects) {
      const prefix = project.prefix === '/' ? '/' : project.prefix;
      TUI.item('Project', localUrl + prefix);
    }

    TUI.footer();
  });

  // Watch each project's source directory for changes
  let isRebuilding = false;
  let rebuildTimeout: any = null;

  for (const project of multiConfig.projects) {
    const projectSrcDir = path.resolve(CWD, project.src);

    if (!nativeFs.existsSync(projectSrcDir)) continue;

    nativeFs.watch(projectSrcDir, { recursive: true }, (event, filename) => {
      if (!filename) return;
      // Ignore config temp files, node_modules, .git, etc.
      if (filename.includes('.git') || filename.includes('node_modules') ||
          filename.includes('.DS_Store') || filename.startsWith('.') ||
          filename.includes('docmd.config-') || filename.endsWith('.js.bak')) return;

      if (rebuildTimeout) clearTimeout(rebuildTimeout);
      rebuildTimeout = setTimeout(async () => {
        if (isRebuilding) return;
        isRebuilding = true;

        // Build only this project, not all - show file path relative to project
        const label = project.prefix === '/' ? '/' : project.prefix;
        // Show [WAIT] [project-name] path/to/file.md - strip project folder name
        const displayPath = filename.replace(/^[^/]+\//, '');
        // Use a single line that gets updated
        console.log(`\x1b[34m│\x1b[0m  \x1b[36m[ WAIT ]\x1b[0m \x1b[33m[${label}]\x1b[0m ${displayPath}`);
        const stepLineStart = `\x1b[34m│\x1b[0m  `;

        try {
          await buildSingleProject(project, multiConfig, { isDev: true });
          broadcastReload();
          // Overwrite the WAIT line with DONE
          if (process.stdout.isTTY) {
            process.stdout.write(`\x1b[1A\r${stepLineStart}\x1b[32m[ DONE ]\x1b[0m \x1b[33m[${label}]\x1b[0m ${displayPath}\n`);
          } else {
            console.log(`${stepLineStart}\x1b[32m[ DONE ]\x1b[0m \x1b[33m[${label}]\x1b[0m ${displayPath}`);
          }
        } catch (err: any) {
          console.log(`${stepLineStart}\x1b[31m[ FAIL ]\x1b[0m \x1b[33m[${label}]\x1b[0m ${displayPath}`);
          TUI.error('Rebuild failed', err.message);
        } finally {
          isRebuilding = false;
        }
      }, 200);
    });
  }

  // Also watch shared assets
  if (nativeFs.existsSync(path.resolve(CWD, 'assets'))) {
    nativeFs.watch(path.resolve(CWD, 'assets'), { recursive: true }, () => {
      if (rebuildTimeout) clearTimeout(rebuildTimeout);
      rebuildTimeout = setTimeout(async () => {
        if (isRebuilding) return;
        isRebuilding = true;
        TUI.step('Shared assets changed');
        try {
          await buildMultiProject(multiConfig, { isDev: true });
          broadcastReload();
          TUI.step('All Projects', 'DONE');
        } catch (err: any) {
          TUI.error('Rebuild failed', err.message);
        } finally {
          isRebuilding = false;
        }
      }, 200);
    });
  }

  // Graceful shutdown - suppress ^C display
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      if (data[0] === 0x03) {
        process.emit('SIGINT' as any);
      }
    });
  }

  process.on('SIGINT', () => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    TUI.dim('Shutting down...');
    server.close();
    if (wss) wss.close();
    process.exit(0);
  });
}

/* ── Helpers ───────────────────────────────────────────────── */

async function getDirectorySize(dir: string): Promise<number> {
  let total = 0;
  try {
    const entries = await nativeFs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await getDirectorySize(fullPath);
      } else {
        const stat = await nativeFs.promises.stat(fullPath);
        total += stat.size;
      }
    }
  } catch { /* ignore */ }
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}