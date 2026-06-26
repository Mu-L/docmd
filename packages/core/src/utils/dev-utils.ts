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
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { fsUtils as fs, safePath, asUserPath } from '@docmd/utils';



// MIME types for static file serving
export const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.jpeg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'application/font-woff',
  '.woff2': 'font/woff2',
  '.ttf': 'application/font-ttf',
  '.txt': 'text/plain',
};

/**
 * Format an absolute path for display relative to CWD.
 */
export function formatPathForDisplay(absolutePath: string, cwd: string): string {
  const relativePath = path.relative(cwd, absolutePath);
  if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return `./${relativePath}`;
  }
  return relativePath;
}

/**
 * Get the first non-internal IPv4 network address.
 */
export function getNetworkIp(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

/**
 * Read git user.name and user.email, compute Gravatar URL.
 * Lazy-initialized on first call.
 */
let _gitDevInfoCache: { name: string; email: string; gravatarUrl: string } | null = null;
export function getGitDevInfo() {
  if (_gitDevInfoCache) return _gitDevInfoCache;
  let name = '';
  let email = '';
  try { name = execSync('git config user.name', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim(); } catch { /* git not configured */ }
  try { email = execSync('git config user.email', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim(); } catch { /* git not configured */ }
  const gravatarUrl = email
    ? `https://gravatar.com/avatar/${crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex')}?s=80&d=mp`
    : '';
  _gitDevInfoCache = { name, email, gravatarUrl };
  return _gitDevInfoCache;
}

export function getDevInfoScript(): string {
  return `<script>window.__docmd_dev=${JSON.stringify(getGitDevInfo())}</script>`;
}

/**
 * Serve static files from rootDir with live-reload injection.
 */
export async function serveStatic(req: any, res: any, rootDir: string) {
  // Serve dev-only API script
  if (req.url === '/__dev/docmd-api.js') {
    try {
      const apiScriptPath = path.resolve(
        fileURLToPath(import.meta.url),
        '../../../../ui/assets/js/docmd-api.js'
      );
      const apiScript = await fs.readFile(apiScriptPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(apiScript);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  const rootAbs = path.resolve(rootDir);
  // Security (Phase 1.A: CWE-22 fix). Use safePath() to enforce the boundary.
  //
  // The previous `filePath.startsWith(rootAbs)` check was the outlier in the
  // repo: it did not append `path.sep`, so a sibling directory whose name
  // started with rootDir's name (e.g. rootDir=`/x/site`, sibling=`/x/site-private`)
  // passed the check, and a URL like `/..%2fsite-private/secret.txt` resolved
  // to the sibling. safePath() enforces the strict `root + path.sep` boundary
  // and throws on escape.
  //
  // Note: URL pathnames always start with `/` (e.g. `/index.html`). We
  // strip the leading slash before passing to safePath() so the second
  // argument is treated as a *relative* path. `path.resolve` (which
  // safePath uses internally) treats `/index.html` as absolute and would
  // bypass the boundary check; `path.join`-style resolution is the
  // correct semantic for "join this to the root".
  let filePath: string;
  try {
    const safeRelative = pathname.replace(/^\/+/, '') || '.';
    filePath = safePath(rootAbs, asUserPath(safeRelative));
  } catch (_e: any) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    let stats;
    try {
      stats = await fs.stat(filePath);
    } catch (e) {
      if (path.extname(filePath) === '') {
        filePath += '.html';
        stats = await fs.stat(filePath);
      } else {
        throw e;
      }
    }

    if (stats.isDirectory()) {
      if (!req.url.split('?')[0].endsWith('/')) {
        res.writeHead(301, { 'Location': req.url + '/' });
        res.end();
        return;
      }
      filePath = path.join(filePath, 'index.html');
      await fs.stat(filePath);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await fs.readFile(filePath);

    if (contentType === 'text/html') {
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
      const htmlStr = content.toString('utf-8');
      const liveReloadScript = `${getDevInfoScript()}<script src="/__dev/docmd-api.js"></script></body>`;
      res.end(htmlStr.replace('</body>', liveReloadScript));
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }

  } catch (err: any) {
    if (err.code === 'ENOENT') {
      const custom404Path = path.join(rootDir, '404.html');
      try {
        const content = await fs.readFile(custom404Path);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        const htmlStr = content.toString('utf-8');
        const liveReloadScript = `${getDevInfoScript()}<script src="/__dev/docmd-api.js"></script></body>`;
        res.end(htmlStr.replace('</body>', liveReloadScript));
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`
          <div style="font-family:system-ui;text-align:center;padding:50px;">
            <h1>404 Not Found</h1>
            <p>The requested URL <code>${req.url}</code> was not found.</p>
            <p style="color:#666;font-size:0.9em;">(docmd dev server)</p>
          </div>
        `);
      }
    } else {
      res.writeHead(500);
      res.end(`Server Error: ${err.code}`);
    }
  }
}

/**
 * Check if a port is in use.
 */
export function checkPortInUse(port: number): Promise<boolean> {
  // The probe binds to 127.0.0.1, not 0.0.0.0, so it only checks whether
  // the loopback interface has the port. Binding to all interfaces here
  // was unnecessary (we just need to know if "our" port is taken) and
  // briefly exposed the probe socket to the LAN.
  return new Promise((resolve) => {
    const tester = http.createServer()
      .once('error', (err: any) => resolve(err.code === 'EADDRINUSE'))
      .once('listening', () => tester.close(() => resolve(false)))
      .listen(port, '127.0.0.1');
  });
}

/**
 * Find the next available port starting from startPort.
 */
export async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (await checkPortInUse(port)) {
    port++;
  }
  return port;
}

/**
 * Open a URL in the user's default browser. Best-effort: failures are
 * swallowed so the dev server is never taken down by a missing `xdg-open`
 * (e.g. inside the official Docker image, where the binary is not
 * installed). The call is also skipped entirely when running inside a
 * container — the official image sets DOCMD_CONTAINER=true for this.
 */
export function openBrowser(url: string): void {
  if (process.env.DOCMD_CONTAINER === 'true') return;

  let command = 'xdg-open';
  let args = [url];

  if (process.platform === 'darwin') {
    command = 'open';
  } else if (process.platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '""', url];
  }

  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => { /* missing browser binary — ignore */ });
    child.unref();
  } catch {
    /* never let a browser-launch failure crash the dev server */
  }
}