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
import { fsUtils as fs } from '@docmd/utils';
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
  /** Internal: Absolute path to the config file itself. Used for hot-reloading. */
  _resolvedPath?: string;
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
export async function detectMultiProject(configPathOption: string): Promise<MultiProjectConfig | null> {
  const CWD = process.cwd();
  let absolutePath = path.resolve(CWD, configPathOption);

  if (configPathOption === 'docmd.config.js') {
    const candidates = [
      'docmd.config.json',
      'docmd.config.ts',
      'docmd.config.js',
      'docmd.config.mjs',
      'config.js'
    ];
    let found = false;
    for (const c of candidates) {
      const p = path.resolve(CWD, c);
      if (nativeFs.existsSync(p)) {
        absolutePath = p;
        found = true;
        break;
      }
    }
    if (!found) return null;
  } else if (!nativeFs.existsSync(absolutePath)) {
    return null;
  }

  try {
    let rawConfig: any;

    if (absolutePath.endsWith('.json')) {
      rawConfig = JSON.parse(nativeFs.readFileSync(absolutePath, 'utf-8'));
    } else {
      // Polyfill defineConfig
      (global as any).defineConfig = (config: any) => config;

      const ts = Date.now();
      const ext = path.extname(absolutePath);
      const tempPath = absolutePath.replace(new RegExp(`\\${ext}$`), `-${ts}${ext}`);
      nativeFs.copyFileSync(absolutePath, tempPath);

      const { pathToFileURL } = await import('url');
      const configUrl = pathToFileURL(tempPath).href;
      const rawModule = await import(configUrl);
      rawConfig = rawModule.default || rawModule;

      nativeFs.unlinkSync(tempPath);
      delete (global as any).defineConfig;
    }

    if (isMultiProject(rawConfig)) {
      rawConfig._resolvedPath = absolutePath;
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
  const totalElapsed = TUI.timer();

  validateProjects(multiConfig.projects);

  // Sort: root project first, then alphabetical
  const sorted = [...multiConfig.projects].sort((a, b) => {
    if (a.prefix === '/') return -1;
    if (b.prefix === '/') return 1;
    return a.prefix.localeCompare(b.prefix);
  });

  // Section header — the CLI already printed the docmd banner
  if (!opts.quiet) {
    TUI.section(`Multi-Project Build (${sorted.length} projects)`);
  }

  // Ensure clean output directory
  await fs.ensureDir(rootOutDir);

  // Copy shared assets first (root-level assets/ folder)
  const sharedAssetsDir = path.resolve(CWD, 'assets');
  if (nativeFs.existsSync(sharedAssetsDir)) {
    if (!opts.quiet) {
      TUI.item('Shared assets', path.relative(CWD, sharedAssetsDir), TUI.dim, TUI.cyan);
    }
  }

  if (!opts.quiet) {
    TUI.footer(TUI.cyan);
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
    const projectElapsed = TUI.timer();

    // Check if the project has its own config
    const hasProjectConfig = nativeFs.existsSync(projectConfigPath);

    if (!opts.quiet) {
      TUI.section(`Building: ${label}`);

      // Load the child config to extract version/locale details
      const originalCwdCheck = process.cwd();
      process.chdir(projectSrcDir);
      try {
        const childConfig = await loadConfig(hasProjectConfig ? 'docmd.config.js' : 'docmd.config.js', { isDev: opts.isDev, quiet: true });
        const childDetails = TUI.extractProjectDetails(childConfig, projectOutDir, CWD);
        TUI.projectDetails({
          source: `${project.src}/`,
          output: `${path.relative(CWD, projectOutDir)}/`,
          versions: childDetails.versions,
          locales: childDetails.locales,
        });
      } catch {
        // Fallback: just show source/output if config loading fails
        TUI.item('Source', `${project.src}/`, TUI.dim, TUI.cyan);
        TUI.item('Output', `${path.relative(CWD, projectOutDir)}/`, TUI.dim, TUI.cyan);
      } finally {
        process.chdir(originalCwdCheck);
      }

      if (!hasProjectConfig) {
        TUI.item('Config', 'zero-config (no docmd.config.js found)', TUI.dim, TUI.cyan);
      }
    }

    // Change to project directory and build
    const originalCwd = process.cwd();
    process.chdir(projectSrcDir);

    try {
      // The project's docmd.config.js should NOT have src/out,
      // because the multi-project handler provides those.
      // We set environment variables so the config loader can
      // pick them up. src is NOT overridden - the child config
      // controls where content lives (defaults to 'docs').
      process.env.DOCMD_PROJECT_OUT = projectOutDir;
      process.env.DOCMD_PROJECT_PREFIX = prefix;

      // If shared assets exist, copy them into the project output
      if (nativeFs.existsSync(sharedAssetsDir)) {
        await fs.ensureDir(path.join(projectOutDir, 'assets'));
        await fs.copy(sharedAssetsDir, path.join(projectOutDir, 'assets'));
      }

      // Build this project — quiet suppresses headers/summary,
      // but showStats + onProgress give us live feedback
      const configFile = hasProjectConfig ? 'docmd.config.js' : 'docmd.config.js';

      await buildSite(configFile, {
        isDev:   opts.isDev   || false,
        offline: opts.offline || false,
        quiet:   true,  // Projects.ts owns all section headers
      });

    } catch (err: any) {
      if (!opts.quiet) {
        TUI.step(`Project ${label} build failed`, 'FAIL', TUI.cyan);
      }
      TUI.error(`Build failed for ${label}`, err.message);
      if (!opts.isDev) throw err;
    } finally {
      process.chdir(originalCwd);
      delete process.env.DOCMD_PROJECT_OUT;
      delete process.env.DOCMD_PROJECT_PREFIX;
    }
  }

  // Final summary
  if (!opts.quiet) {
    const totalSize = await getDirectorySize(rootOutDir);
    TUI.success(`Multi-project build complete. ${sorted.length} projects → ${path.relative(CWD, rootOutDir)}/ (${formatBytes(totalSize)}) in ${totalElapsed()}.\n`);
  }
}

/* ── Single Project Build (for dev watchers) ────────────────── */

async function buildSingleProject(
  project: ProjectEntry,
  multiConfig: MultiProjectConfig,
  opts: { isDev?: boolean; offline?: boolean; quiet?: boolean; targetFiles?: string[] } = {}
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
      targetFiles: opts.targetFiles
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
  // For dev mode, do a full multi-project build first.
  // isDev: true affects build behaviour (no minification etc),
  // quiet is NOT set so we get full TUI output (sections, stats, progress).
  try {
    await buildMultiProject(multiConfig, { isDev: true });
  } catch (err: any) {
    TUI.error('Initial build failed', err.message);
  }

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
    wss.on('error', (e: any) => TUI.error('WebSocket Error', e.message));

    const networkIp = getNetworkIp();
    const localUrl = `http://127.0.0.1:${port}`;
    const networkUrl = networkIp ? `http://${networkIp}:${port}` : null;

    TUI.section('Development Server Running', TUI.green);
    TUI.item('', '', TUI.dim, TUI.green);
    TUI.item('Local Access', localUrl, TUI.bold, TUI.green);
    if (networkUrl) {
      TUI.item('Network Access', networkUrl, TUI.bold, TUI.green);
    }
    TUI.item('Serving from', formatPathForDisplay(rootOutDir, CWD), TUI.dim, TUI.green);
    TUI.item('', '', TUI.dim, TUI.green);

    for (const project of multiConfig.projects) {
      const pfx = project.prefix === '/' ? '/' : project.prefix;
      TUI.item('Project', localUrl + pfx, TUI.dim, TUI.green);
    }
    TUI.item('', '', TUI.dim, TUI.green);
    TUI.footer(TUI.green);
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

        const isConfigUpdate = filename.includes('docmd.config') && !filename.includes('docmd.config-');
        const label = project.prefix === '/' ? '/' : project.prefix;
        const displayPath = filename.replace(/^[^/]+\//, '');
        const rebuildElapsed = TUI.timer();

        if (isConfigUpdate) {
          TUI.step(`Reloading config and rebuilding [${label}]`, 'WAIT', TUI.blue, true);
        } else {
          TUI.step(`Rebuilding [${label}] ${displayPath}`, 'WAIT', TUI.blue, true);
        }

        try {
          const fullChangedPath = path.resolve(projectSrcDir, filename);
          await buildSingleProject(project, multiConfig, { 
            isDev: true,
            targetFiles: isConfigUpdate ? undefined : [fullChangedPath]
          });
          broadcastReload();
          TUI.step(`Rebuilt [${label}] ${isConfigUpdate ? 'with new config' : displayPath} in ${rebuildElapsed()}`, 'DONE', TUI.blue, true);
        } catch (err: any) {
          TUI.step(`Rebuild [${label}] ${displayPath}`, 'FAIL', TUI.blue, true);
          TUI.error('Rebuild failed', err.message);
        } finally {
          isRebuilding = false;
        }
      }, 200);
    });
  }

  // Watch the root multi-project config file itself
  if (multiConfig._resolvedPath && nativeFs.existsSync(multiConfig._resolvedPath)) {
    let rootConfigLock = false;
    nativeFs.watch(multiConfig._resolvedPath, () => {
      if (rootConfigLock) return;
      rootConfigLock = true;

      if (rebuildTimeout) clearTimeout(rebuildTimeout);
      rebuildTimeout = setTimeout(async () => {
        if (isRebuilding) return;
        isRebuilding = true;

        const rebuildElapsed = TUI.timer();
        TUI.step('Reloading multi-project workspace config...', 'WAIT', TUI.blue, true);

        try {
          const { detectMultiProject } = await import('./projects.js');
          const newMultiConfig = await detectMultiProject(path.basename(multiConfig._resolvedPath));
          if (newMultiConfig) {
            // Update the reference for subsequent project rebuilds
            Object.assign(multiConfig, newMultiConfig);
            await buildMultiProject(newMultiConfig, { isDev: true });
            broadcastReload();
            TUI.step(`Rebuilt entire workspace with new config in ${rebuildElapsed()}`, 'DONE', TUI.blue, true);
          }
        } catch (err: any) {
          TUI.step('Workspace Rebuild', 'FAIL', TUI.blue, true);
          TUI.error('Rebuild failed', err.message);
        } finally {
          isRebuilding = false;
          setTimeout(() => { rootConfigLock = false; }, 500);
        }
      }, 300);
    });
  }

  // Also watch shared assets
  if (nativeFs.existsSync(path.resolve(CWD, 'assets'))) {
    nativeFs.watch(path.resolve(CWD, 'assets'), { recursive: true }, () => {
      if (rebuildTimeout) clearTimeout(rebuildTimeout);
      rebuildTimeout = setTimeout(async () => {
        if (isRebuilding) return;
        isRebuilding = true;

        const rebuildElapsed = TUI.timer();
        TUI.step('Shared assets changed — rebuilding all', 'WAIT', TUI.blue, true);

        try {
          await buildMultiProject(multiConfig, { isDev: true, quiet: true });
          broadcastReload();
          TUI.step(`All projects rebuilt in ${rebuildElapsed()}`, 'DONE', TUI.blue, true);
        } catch (err: any) {
          TUI.step('Rebuild all projects', 'FAIL', TUI.blue, true);
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

  let isShuttingDown = false;
  process.on('SIGINT', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (process.stdin.isTTY) process.stdin.setRawMode(false);

    TUI.success('Shutting down...\n');

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