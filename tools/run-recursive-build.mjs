#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Run every workspace package's `build` script in topological order without
// forwarding arbitrary CLI args (such as `--verbose`) to `tsc`, which
// rejects them with `TS5093: Compiler option '--verbose' may only be used
// with '--build'`. This wrapper is the single entry point for the root
// `pnpm build` command and centralises the workspace recursion so future
// tooling (concurrency limits, summary reporting, error aggregation) has
// a single place to live.
// ---------------------------------------------------------------------------
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Read the workspace package globs from pnpm-workspace.yaml (pnpm 9+)
// so we honour the same source of truth as pnpm itself.
const wsYaml = readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
const pkgGlobs = [...wsYaml.matchAll(/^\s*-\s*['"]?([^'"\n]+)['"]?\s*$/gm)]
  .map(m => m[1])
  .filter(g => !g.startsWith('!'));

const { execSync } = await import('node:child_process');
const pkgListJson = execSync(`pnpm m ls --depth=-1 --json --silent`, { cwd: root, encoding: 'utf8' });
let pkgs;
try {
  pkgs = JSON.parse(pkgListJson);
} catch (e) {
  // Fallback: simple `pnpm -r ls` package-name walk via the workspace
  // list command output.
  const fallback = execSync('pnpm -r ls --depth=-1', { cwd: root, encoding: 'utf8' });
  pkgs = fallback.split('\n').map(line => line.replace(/^[^@]+@/, ''))
    .filter(Boolean).map(name => ({ name, path: `packages/${name}` }));
}

let failed = 0;
for (const pkg of pkgs) {
  // Skip root and the playground (no build needed).
  if (pkg.path === '.' || !pkg.path) continue;
  const pkgDir = path.join(root, pkg.path);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  let pkgJson;
  try {
    pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  } catch { continue; }
  if (!pkgJson.scripts || !pkgJson.scripts.build) continue;

  const name = pkg.name || pkg.path;
  process.stdout.write(`\n› Building ${name}\n`);
  const start = Date.now();
  const code = await new Promise(resolve => {
    const child = spawn('pnpm', ['--silent', 'run', 'build'], {
      cwd: pkgDir,
      stdio: 'inherit',
      env: process.env
    });
    child.on('close', resolve);
  });
  if (code !== 0) {
    failed++;
    process.stdout.write(`✗ ${name} failed (exit ${code}, ${((Date.now() - start) / 1000).toFixed(1)}s)\n`);
  } else {
    process.stdout.write(`✓ ${name} (${((Date.now() - start) / 1000).toFixed(1)}s)\n`);
  }
}

if (failed > 0) {
  process.stdout.write(`\n✗ ${failed} package(s) failed to build\n`);
  process.exit(1);
} else {
  process.stdout.write(`\n✓ All workspace packages built successfully\n`);
}