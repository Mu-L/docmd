/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025 docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */


const path = require('path');
const http = require('http');
const fs = require('fs/promises');
const { build } = require('./src/build');

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

async function start() {
  // 1. Build the editor
  await build();

  const distDir = path.resolve(process.cwd(), 'dist');
  const port = process.env.PORT || 3000;

  // 2. Native HTTP Server
  const server = http.createServer(async (req, res) => {
    // Normalize path and prevent directory traversal attacks
    let safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '').split('?')[0].split('#')[0];
    if (safePath === '/' || safePath === '\\') safePath = 'index.html';
    
    let filePath = path.join(distDir, safePath);

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
    console.log(`   Serving from: ${distDir}`);
    console.log('   (Press Ctrl+C to stop)\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${port} is already in use.`);
      console.error(`   Please free the port or set a custom one via PORT environment variable.`);
      process.exit(1);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
  
  process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down Live Editor...');
      server.close();
      process.exit();
  });
}

module.exports = { start, build };