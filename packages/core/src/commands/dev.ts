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

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import nativeFs from 'node:fs';
import path from 'path';
import { fsUtils as fs, WorkerPool } from '@docmd/utils';
import { TUI } from '@docmd/api';
import { buildSite } from './build.js';
import { loadConfig } from '../utils/config-loader.js';
import { createRequire } from 'module';
import { createActionDispatcher, loadPlugins, hooks } from '@docmd/api';
import {
  formatPathForDisplay, getNetworkIp, serveStatic, findAvailablePort, openBrowser,
} from '../utils/dev-utils.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);

// Main Dev Function
export async function startDevServer(configPathOption: string, opts: any = {}) {
  const options = {
    preserve: opts.preserve || false,
    port: opts.port || undefined,
  };

  // ── Multi-Project (Workspace) Detection ──────────────────────────
  if (!process.env.DOCMD_PROJECT_OUT) {
    const { detectWorkspace, devWorkspace } = await import('../engine/workspace.js');
    const workspaceConfig = await detectWorkspace(configPathOption);
    if (workspaceConfig) {
      await devWorkspace(workspaceConfig, options);
      return;
    }
  }

  let config;
  try {
    config = await loadConfig(configPathOption, { isDev: true, quiet: true });
  } catch (e) {
    if (e.silent) {
      process.exit(0); // Exit gracefully if it's a known non-project folder error
    }
    // Config validation errors already print their details - exit cleanly
    if (e.message === 'Invalid configuration file.' || e.message?.startsWith('Error parsing config')) {
      TUI.error('Build failed', e.message);
      process.exit(1);
    }
    throw e;
  }
  const CWD = process.cwd();

  // Config Fallback Logic
  const actualConfigPath = config._resolvedPath || path.resolve(CWD, configPathOption);

  const resolveConfigPaths = (currentConfig) => ({
    outputDir: path.resolve(CWD, currentConfig.out),
    srcDirToWatch: path.resolve(CWD, currentConfig.src),
    configFileToWatch: actualConfigPath,
    userAssetsDir: path.resolve(CWD, 'assets'),
  });

  let paths = resolveConfigPaths(config);

  // Create Server - uses a mutable reference so config restarts update the output dir
  const state = { outputDir: paths.outputDir };
  const server = http.createServer((req, res) => serveStatic(req, res, state.outputDir));
  let wss;

  function broadcastReload() {
    if (wss) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send('reload');
      });
    }
  }

  // ── Initial Build ────────────────────────────────────
  const initialElapsed = TUI.timer();

  const rootOutputDir = path.resolve(CWD, config.out || 'site');

  let workerPool: WorkerPool;

  try {
    const workerScript = path.resolve(__dirname, '../engine/worker-parser.js');
    workerPool = new WorkerPool(workerScript, { config, cwd: CWD });
    // Clean output dir before initial build to remove stale files from previous builds.
    // Without this, files generated under old URL structures (e.g. from a different
    // auto-router behaviour) persist alongside new files and cause 404 on nav links.
    if (await fs.exists(rootOutputDir)) {
      await fs.remove(rootOutputDir);
    }
    await buildSite(configPathOption, { isDev: true, preserve: options.preserve, quiet: false, showStats: false, workerPool });
    TUI.info(`Initial build completed in ${initialElapsed()}.`);
  } catch (error: any) {
    TUI.error('Initial build failed', error.message);
  }

  // ── Watcher Setup ────────────────────────────────────
  const userAssetsDirExists = await fs.pathExists(paths.userAssetsDir);
  const configWatchPath = paths.configFileToWatch;
  const hasConfigFile = await fs.pathExists(configWatchPath);

  TUI.section('Watching', TUI.blue);
  TUI.item('Source', formatPathForDisplay(paths.srcDirToWatch, CWD), TUI.dim, TUI.blue);
  if (hasConfigFile) {
    TUI.item('Config', formatPathForDisplay(configWatchPath, CWD), TUI.dim, TUI.blue);
  }
  if (userAssetsDirExists) {
    TUI.item('Assets', formatPathForDisplay(paths.userAssetsDir, CWD), TUI.dim, TUI.blue);
  }
  TUI.footer(TUI.blue);

  const watchers: nativeFs.FSWatcher[] = [];
  let isRebuilding = false;
  let rebuildQueued = false;
  let rebuildTimeout: any = null;
  let lastRebuildAt = 0;
  // Brief quiet window after a rebuild to absorb phantom fs.watch events
  // that macOS emits for newly-written output files. NOT a fake UX delay —
  // the absolute-path exclusion below is the primary guard; this is backup.
  const REBUILD_QUIET_MS = 500;

  // Resolved output dir for robust exclusion (never retrigger on build output)
  const resolvedOutputDir = path.resolve(CWD, config.out || 'site');

  let configLock = false;
  let configDebounce: any = null;
  async function reloadConfigAndRebuild(changedFilePath: string) {
    if (configLock) return;
    configLock = true;

    const baseName = path.basename(changedFilePath);
    const configElapsed = TUI.timer();
    TUI.step(`Reloading config and rebuilding due to change in: ${baseName}`, 'WAIT', TUI.blue, true);

    try {
      // Close all watchers
      watchers.forEach(w => w.close());
      watchers.length = 0;
      if (rebuildTimeout) { clearTimeout(rebuildTimeout); rebuildTimeout = null; }
      isRebuilding = false;
      rebuildQueued = false;

      // Reload config
      config = await loadConfig(configPathOption, { isDev: true, quiet: true });
      paths = resolveConfigPaths(config);
      state.outputDir = paths.outputDir;

      if (workerPool) await workerPool.terminateAll();
      const workerScript = path.resolve(__dirname, '../engine/worker-parser.js');
      workerPool = new WorkerPool(workerScript, { config, cwd: CWD });

      // Full rebuild
      await buildSite(configPathOption, { 
        isDev: true, 
        preserve: options.preserve,
        quiet: true,
        workerPool
      });

      lastRebuildAt = Date.now();
      TUI.step(`Config reloaded and rebuilt in ${configElapsed()}`, 'DONE', TUI.blue, true);

      // Re-setup watchers after a brief pause to let fs.watch settle
      setTimeout(() => {
        setupContentWatchers();
        setupConfigWatcher();
        configLock = false;
      }, REBUILD_QUIET_MS);

      broadcastReload();
    } catch (error: any) {
      TUI.step(`Config reload: ${baseName}`, 'FAIL', TUI.blue, true);
      TUI.error('Config reload failed', error.message);
      
      // Re-setup watchers to continue listening
      setTimeout(() => {
        setupContentWatchers();
        setupConfigWatcher();
        configLock = false;
      }, REBUILD_QUIET_MS);
    }
  }

  function setupContentWatchers() {
    const contentPaths = [paths.srcDirToWatch];
    if (nativeFs.existsSync(paths.userAssetsDir)) contentPaths.push(paths.userAssetsDir);

    if (process.env.DOCMD_DEV === 'true') {
      const DOCMD_ROOT = path.resolve(__dirname, '..');
      contentPaths.push(
        path.join(DOCMD_ROOT, 'templates'),
        path.join(DOCMD_ROOT, 'assets'),
        path.join(DOCMD_ROOT, 'engine'),
        path.join(DOCMD_ROOT, 'plugins'),
        path.join(DOCMD_ROOT, 'utils')
      );
    }

    // Resolved output dir — used for robust exclusion below
    const resolvedOut = path.resolve(CWD, paths.outputDir);

    for (const watchPath of contentPaths) {
      if (!nativeFs.existsSync(watchPath)) continue;

      const watcher = nativeFs.watch(watchPath, { recursive: true }, (event, filename) => {
        if (!filename) return;

        // Post-rebuild quiet period: swallow stale fs.watch events
        if (Date.now() - lastRebuildAt < REBUILD_QUIET_MS) return;

        const filePath = path.resolve(watchPath, filename);

        // Exclude build output dir (absolute path check — reliable across platforms)
        if (filePath.startsWith(resolvedOut + path.sep) || filePath === resolvedOut) return;

        // Common noise exclusions
        if (
          filename.includes('.git') ||
          filename.includes('node_modules') ||
          filename.startsWith('.') ||
          filename.includes('.DS_Store')
        ) return;

        const relativeFilePath = path.relative(CWD, filePath);
        const isAsset = filePath.startsWith(path.resolve(paths.userAssetsDir));
        const isConfigOrNav =
          filename.includes('navigation.json') ||
          (filename.includes('docmd.config') && !filename.includes('docmd.config-'));

        if (isConfigOrNav) {
          // Debounce config/nav reloads separately to collapse macOS multi-fire
          if (configDebounce) clearTimeout(configDebounce);
          configDebounce = setTimeout(() => {
            configDebounce = null;
            reloadConfigAndRebuild(filePath);
          }, 400);
          return;
        }

        // Debounce: wait until user stops making changes before rebuilding.
        // Each new save resets this timer, so the build only runs after
        // the last change — like Vite's approach.
        if (rebuildTimeout) clearTimeout(rebuildTimeout);
        rebuildTimeout = setTimeout(() => {
          const executeBuildFn = async () => {
            if (isRebuilding) { rebuildQueued = true; return; }

            const rebuildElapsed = TUI.timer();
            const sp = TUI.spinner(`Rebuilding: ${relativeFilePath}`, TUI.blue);
            isRebuilding = true;
            rebuildQueued = false;
            try {
              await buildSite(configPathOption, {
                isDev: true,
                preserve: options.preserve,
                quiet: true,
                targetFiles: isAsset ? undefined : [filePath],
                workerPool
              });
              lastRebuildAt = Date.now();
              sp.done(`Rebuilt: ${relativeFilePath} in ${rebuildElapsed()}`, true);
              broadcastReload();
            } catch (error: any) {
              sp.fail(`Rebuild: ${relativeFilePath}`, true);
              TUI.error('Rebuild failed', error.message);
            } finally {
              isRebuilding = false;
              if (rebuildQueued) executeBuildFn();
            }
          };
          executeBuildFn();
        }, 600); // 600ms: rebuild fires 600ms after user stops saving
      });
      watchers.push(watcher);
    }
  }

  const setupConfigWatcher = () => {
    if (!hasConfigFile) return;
    let cfgDebounce: any = null;
    const configWatcher = nativeFs.watch(configWatchPath, () => {
      // Debounce: collapse the 3-6 rapid events macOS fires per save into one
      if (cfgDebounce) clearTimeout(cfgDebounce);
      cfgDebounce = setTimeout(() => {
        cfgDebounce = null;
        reloadConfigAndRebuild(configWatchPath);
      }, 500);
    });
    watchers.push(configWatcher);
  };

  setupContentWatchers();
  setupConfigWatcher();

  // Server Startup Logic
  const PORT = parseInt(options.port || process.env.PORT || 3000, 10);

  function tryStartServer(port) {
    server.listen(port, '0.0.0.0')
      .once('listening', async () => {
        wss = new WebSocketServer({ server });
        wss.on('error', (e: any) => TUI.error('WebSocket Error', e.message));

        // Action dispatcher for plugin actions/events
        await loadPlugins(config, { resolvePaths: [__dirname] });
        const dispatcher = createActionDispatcher(hooks, {
          projectRoot: CWD,
          config,
          broadcast: (event: string, data: any) => {
            wss.clients.forEach((client: any) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'event', name: event, data }));
              }
            });
          }
        });

        // Execute onDevServerReady hooks
        for (const fn of hooks.onDevServerReady) {
          await fn(server, wss);
        }

        wss.on('connection', (ws: any) => {
          ws.on('message', async (raw: any) => {
            let msg: any;
            try { msg = JSON.parse(raw.toString()); } catch { return; }

            if (msg.type === 'call') {
              try {
                const { result } = await dispatcher.handleCall(msg.action, msg.payload);
                // Don't send reload flag to client - let the file watcher detect
                // the change, rebuild, and send the reload via broadcastReload()
                ws.send(JSON.stringify({ id: msg.id, type: 'response', result, reload: false }));
              } catch (e: any) {
                ws.send(JSON.stringify({ id: msg.id, type: 'response', error: e.message }));
              }
            } else if (msg.type === 'event') {
              dispatcher.handleEvent(msg.name, msg.data);
            }
          });
        });

        const indexHtmlPath = path.join(paths.outputDir, 'index.html');
        const networkIp = getNetworkIp();
        const localUrl = `http://127.0.0.1:${port}`;
        const networkUrl = networkIp ? `http://${networkIp}:${port}` : null;

        TUI.section('Development Server Running', TUI.green);
        TUI.item('', '', TUI.dim, TUI.green);
        TUI.item('Local Access', localUrl, TUI.bold, TUI.green);
        if (networkUrl) {
          TUI.item('Network Access', networkUrl, TUI.bold, TUI.green);
        }
        TUI.item('Serving from', formatPathForDisplay(paths.outputDir, CWD), TUI.dim, TUI.green);
        TUI.item('','', TUI.dim, TUI.green);
        TUI.footer(TUI.green);

        if (!await fs.pathExists(path.join(paths.outputDir, 'index.html'))) {
          TUI.warn('Root index.html not found. Build may be incomplete.');
        }

        // Auto-launch localhost URL in default browser
        openBrowser(localUrl);
      })
      .once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          server.close();
          tryStartServer(port + 1);
        } else {
          TUI.error('Failed to start server', err.message);
          process.exit(1);
        }
      });
  }

  // Execution Flow
  (async () => {
    const finalPort = await findAvailablePort(PORT);
    tryStartServer(finalPort);
  })();

  let isShuttingDown = false;

  // Suppress ^C display and handle graceful shutdown
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      // Ctrl+C = 0x03
      if (data[0] === 0x03) {
        process.emit('SIGINT' as any);
      }
    });
  }

  process.on('SIGINT', async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (process.stdin.isTTY) process.stdin.setRawMode(false);

    TUI.success('Shutting down...\n');

    // Force exit after a shorter timeout if graceful shutdown hangs
    const forceExitTimeout = setTimeout(() => {
      process.exit(0);
    }, 500);
    forceExitTimeout.unref();

    try {
      const closures: any[] = [];
      watchers.forEach(w => closures.push(new Promise<void>(resolve => { w.close(); resolve(); })));
      if (wss) closures.push(new Promise(resolve => wss.close(resolve)));
      if (server) closures.push(new Promise(resolve => server.close(resolve)));
      if (workerPool) closures.push(workerPool.terminateAll());

      await Promise.all(closures);
      clearTimeout(forceExitTimeout);
      process.exit(0);
    } catch {
      process.exit(0);
    }
  });

  process.on('SIGTERM', () => {
    process.exit(0);
  });
}