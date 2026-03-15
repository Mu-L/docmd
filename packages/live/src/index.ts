/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
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

import path from 'path';
import http from 'http';
import fs from 'fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from './build.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function checkPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = http.createServer()
      .once('error', (err: any) => resolve(err.code === 'EADDRINUSE'))
      .once('listening', () => tester.close(() => resolve(false)))
      .listen(port, '0.0.0.0');
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (await checkPortInUse(port)) {
    port++;
  }
  return port;
}

async function start() {
  // Resolution logic: index.js is in dist/, public/ is its sibling at root
  const publicDir = path.resolve(__dirname, '..', 'public');
  const initialPort = parseInt(process.env.PORT || '3000', 10);
  const port = await findAvailablePort(initialPort);

  // 2. Native HTTP Server
  const server = http.createServer(async (req, res) => {
    // Normalize path and prevent directory traversal attacks
    let safePath = path.normalize(req.url!).replace(/^(\.\.[\/\\])+/, '').split('?')[0].split('#')[0];
    if (safePath === '/' || safePath === '\\') safePath = 'index.html';

    let filePath = path.join(publicDir, safePath);

    // Dynamic routing for project-local user assets (bypassing the precompiled bundle)
    if (safePath.startsWith('assets/')) {
      const userAssetPath = path.join(process.cwd(), safePath);
      try {
        await fs.stat(userAssetPath);
        filePath = userAssetPath;
      } catch (e) {
        // fallback to bundled assets if not found locally
      }
    }

    try {
      let stats = await fs.stat(filePath);

      // If it's a directory, serve its index.html
      if (stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        await fs.stat(filePath);
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = await fs.readFile(filePath);

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);

    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    }
  });

  // 3. Start Listening
  server.listen(port, '0.0.0.0', () => {
    console.log(`\n🌍 Launching Live Editor at http://localhost:${port}`);
    console.log(`   Serving from: ${publicDir}`);
    console.log('   (Press Ctrl+C to stop)\n');
  });

  server.on('error', (err: any) => {
    console.error(err);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Live Editor...');
    server.close();
    process.exit();
  });
}

export { start, build };