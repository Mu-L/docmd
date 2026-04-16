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
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import fs from './fs-utils.js';

const __filename = fileURLToPath(import.meta.url);

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
    } catch (err) {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  let safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '').split('?')[0].split('#')[0];
  if (safePath === '/' || safePath === '\\') safePath = 'index.html';

  let filePath = path.join(rootDir, safePath);

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

    res.writeHead(200, { 'Content-Type': contentType });

    if (contentType === 'text/html') {
      const htmlStr = content.toString('utf-8');
      const liveReloadScript = `${getDevInfoScript()}<script src="/__dev/docmd-api.js"></script></body>`;
      res.end(htmlStr.replace('</body>', liveReloadScript));
    } else {
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
      } catch (e2) {
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
  return new Promise((resolve) => {
    const tester = http.createServer()
      .once('error', (err: any) => resolve(err.code === 'EADDRINUSE'))
      .once('listening', () => tester.close(() => resolve(false)))
      .listen(port, '0.0.0.0');
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