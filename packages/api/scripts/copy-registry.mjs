#!/usr/bin/env node
/**
 * Copy the generated plugin registry from `registry/` to `dist/registry/`
 * so the published package's runtime loader (which resolves paths from
 * `dist/`) can find it without depending on the `files` field layout.
 *
 * The `files: ["dist", "registry"]` array publishes both, so users can
 * also resolve directly from the package root, but the dist/ copy is
 * what the loader prefers (it's the path relative to __dirname).
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, '..');

const src = join(PKG_ROOT, 'registry', 'plugins.generated.json');
const destDir = join(PKG_ROOT, 'dist', 'registry');
const dest = join(destDir, 'plugins.generated.json');

if (!existsSync(src)) {
  console.error('✗ copy-registry: source missing:', src);
  console.error('  Run `node ../../scripts/build-plugin-registry.mjs` first.');
  process.exit(1);
}

if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`✓ Copied registry to ${dest}`);