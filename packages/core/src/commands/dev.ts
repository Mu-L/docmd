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
import fs from '../utils/fs-utils.js';
import chalk from 'chalk';
import { buildSite } from './build.js';
import { loadConfig } from '../utils/config-loader.js';
import { createRequire } from 'module';
import { createActionDispatcher, loadPlugins, hooks } from '@docmd/api';
import {
  formatPathForDisplay, getNetworkIp, serveStatic, findAvailablePort,
} from '../utils/dev-utils.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);

// Main Dev Function
export async function startDevServer(configPathOption: string, opts: any = {}) {
  const options = {
    preserve: opts.preserve || false,
    port: opts.port || undefined,
  };

  // ── Multi-Project Detection ──────────────────────────
  if (!process.env.DOCMD_PROJECT_OUT) {
    const { detectMultiProject, devMultiProject } = await import('../engine/projects.js');
    const multiConfig = await detectMultiProject(configPathOption);
    if (multiConfig) {
      await devMultiProject(multiConfig, options);
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
    // Config validation errors already print their details — exit cleanly
    if (e.message === 'Invalid configuration file.' || e.message?.startsWith('Error parsing config')) {
      console.error(`\nBuild failed:\n${e.message}\n`);
      process.exit(1);
    }
    throw e;
  }
  const CWD = process.cwd();

  // Config Fallback Logic
  let actualConfigPath = path.resolve(CWD, configPathOption);
  if (configPathOption === 'docmd.config.js' && !await fs.pathExists(actualConfigPath)) {
    const legacyPath = path.resolve(CWD, 'config.js');
    if (await fs.pathExists(legacyPath)) actualConfigPath = legacyPath;
  }

  const resolveConfigPaths = (currentConfig) => ({
    outputDir: path.resolve(CWD, currentConfig.out),
    srcDirToWatch: path.resolve(CWD, currentConfig.src),
    configFileToWatch: actualConfigPath,
    userAssetsDir: path.resolve(CWD, 'assets'),
  });

  let paths = resolveConfigPaths(config);

  // Create Server — uses a mutable reference so config restarts update the output dir
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

  // Initial Build
  console.log(chalk.blue('🚀 Performing initial build...'));
  try {
    await buildSite(configPathOption, { isDev: true, preserve: options.preserve });
  } catch (error) {
    console.error(chalk.red('❌ Initial build failed:'), error.message);
  }

  // Watcher Setup
  const userAssetsDirExists = await fs.pathExists(paths.userAssetsDir);
  const configWatchPath = paths.configFileToWatch;
  const hasConfigFile = await fs.pathExists(configWatchPath);

  console.log(chalk.dim('\n👀 Watching for changes in:'));
  console.log(chalk.dim(`   - Source: ${chalk.cyan(formatPathForDisplay(paths.srcDirToWatch, CWD))}`));
  if (hasConfigFile) {
    console.log(chalk.dim(`   - Config: ${chalk.cyan(formatPathForDisplay(configWatchPath, CWD))}`));
  }
  if (userAssetsDirExists) {
    console.log(chalk.dim(`   - Assets: ${chalk.cyan(formatPathForDisplay(paths.userAssetsDir, CWD))}`));
  }
  console.log('');

  const watchers: nativeFs.FSWatcher[] = [];
  let isRebuilding = false;
  let rebuildQueued = false;
  let rebuildTimeout: any = null;

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

    for (const watchPath of contentPaths) {
      if (!nativeFs.existsSync(watchPath)) continue;

      const watcher = nativeFs.watch(watchPath, { recursive: true }, (event, filename) => {
        if (!filename) return;
        
        const filePath = path.join(watchPath, filename);
        const relativeFilePath = path.relative(CWD, filePath);
        
        if (
          relativeFilePath.startsWith(path.relative(CWD, paths.outputDir)) ||
          filename.includes('.git') || 
          filename.includes('node_modules') || 
          filename.startsWith('.') ||
          relativeFilePath.includes('.DS_Store')
        ) return;

        if (rebuildTimeout) clearTimeout(rebuildTimeout);
        rebuildTimeout = setTimeout(() => {
          const executeBuildFn = async () => {
            if (isRebuilding) { rebuildQueued = true; return; }
            process.stdout.write(chalk.dim(`↻ Change in ${relativeFilePath}... `));
            isRebuilding = true;
            rebuildQueued = false;
            try {
              await buildSite(configPathOption, { isDev: true, preserve: options.preserve });
              broadcastReload();
              process.stdout.write(chalk.green('Done.\n'));
            } catch (error: any) {
              console.error(chalk.red('\n❌ Rebuild failed:'), error.message);
            } finally {
              isRebuilding = false;
              if (rebuildQueued) executeBuildFn();
            }
          };
          executeBuildFn();
        }, 150);
      });
      watchers.push(watcher);
    }
  }

  setupContentWatchers();

  // Config file watcher — reload config, rebuild, re-setup watchers
  if (hasConfigFile) {
    let configLock = false;
    const setupConfigWatcher = () => {
      const configWatcher = nativeFs.watch(configWatchPath, () => {
        if (configLock) return;
        configLock = true;

        setTimeout(async () => {
          process.stdout.write(chalk.yellow('⚙  Config changed. Reloading... '));
          try {
            // Tear down all watchers (including this config watcher)
            watchers.forEach(w => w.close());
            watchers.length = 0;
            if (rebuildTimeout) { clearTimeout(rebuildTimeout); rebuildTimeout = null; }
            isRebuilding = false;
            rebuildQueued = false;

            // Reload config, update paths
            config = await loadConfig(configPathOption, { isDev: true, quiet: true });
            paths = resolveConfigPaths(config);
            state.outputDir = paths.outputDir;

            // Full rebuild with fresh config
            await buildSite(configPathOption, { isDev: true, preserve: options.preserve });

            // Re-setup all watchers
            setupContentWatchers();
            setupConfigWatcher();

            broadcastReload();
            process.stdout.write(chalk.green('Done.\n'));
          } catch (error: any) {
            console.error(chalk.red('\n❌ Config reload failed:'), error.message);
            // Recover
            setupContentWatchers();
            setupConfigWatcher();
          } finally {
            configLock = false;
          }
        }, 300);
      });
      watchers.push(configWatcher);
    };
    setupConfigWatcher();
  }

  // Server Startup Logic
  const PORT = parseInt(options.port || process.env.PORT || 3000, 10);

  function tryStartServer(port) {
    server.listen(port, '0.0.0.0')
      .once('listening', async () => {
        wss = new WebSocketServer({ server });
        wss.on('error', (e: any) => console.error('WebSocket Error:', e.message));

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
                // Don't send reload flag to client — let the file watcher detect
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

        const border = chalk.gray('────────────────────────────────────────');
        console.log(border);
        console.log(`  ${chalk.bold.green('SERVER RUNNING')}  ${chalk.dim(`(v${require('../../package.json').version})`)}`);
        console.log('');
        console.log(`  ${chalk.bold('Local:')}    ${chalk.cyan(localUrl)}`);
        if (networkUrl) {
          console.log(`  ${chalk.bold('Network:')}  ${chalk.cyan(networkUrl)}`);
        }
        console.log('');
        console.log(`  ${chalk.dim('Serving:')}  ${formatPathForDisplay(paths.outputDir, CWD)}`);
        console.log(border);
        console.log('');

        if (!await fs.pathExists(indexHtmlPath)) {
          console.warn(chalk.yellow(`⚠️  Warning: Root index.html not found.`));
        }
      })
      .once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          server.close();
          tryStartServer(port + 1);
        } else {
          console.error(chalk.red(`Failed to start server: ${err.message}`));
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

    process.stdout.write(chalk.yellow('\n🛑 Shutting down...\n'));

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

      await Promise.all(closures);
      clearTimeout(forceExitTimeout);
      console.log(chalk.green('Done.'));
      process.exit(0);
    } catch {
      console.log('');
      process.exit(0);
    }
  });

  process.on('SIGTERM', () => {
    process.exit(0);
  });
}