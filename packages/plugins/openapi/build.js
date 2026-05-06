import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure dist exists
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.mkdirSync(path.join(__dirname, 'dist'));
}

// Copy CSS
fs.copyFileSync(
  path.join(__dirname, 'src', 'openapi.css'),
  path.join(__dirname, 'dist', 'openapi.css')
);

console.log('OpenAPI assets copied to dist/');