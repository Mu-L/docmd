#!/usr/bin/env node
/**
 * copy-assets.mjs
 *
 * After `tsc` compiles `src/index.ts` → `dist/index.js`, this script
 * copies the template's `templates/` and `assets/` directories into
 * `dist/` so the URL-relative paths in `src/index.ts` resolve to the
 * same locations in both source and built forms.
 *
 * Idempotent. Safe to run repeatedly.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = path.join(root, 'dist');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function copyDir(src, dest) {
  if (!(await exists(src))) {
    console.warn(`[copy-assets] skip: ${src} does not exist`);
    return;
  }
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

if (!(await exists(dist))) {
  console.error(`[copy-assets] dist/ not found at ${dist} — run \`tsc\` first.`);
  process.exit(1);
}

const copyTargets = [
  { src: path.join(root, 'templates'), dest: path.join(dist, 'templates') },
  { src: path.join(root, 'assets'),    dest: path.join(dist, 'assets') },
];

for (const { src, dest } of copyTargets) {
  if (await exists(src)) {
    await copyDir(src, dest);
    const relSrc = path.relative(root, src);
    console.log(`[copy-assets] ${relSrc}/ → ${path.relative(root, dest)}/`);
  }
}

console.log('[copy-assets] done.');