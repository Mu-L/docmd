#!/usr/bin/env node

/**
 * --------------------------------------------------------------------
 * docmdx : instant documentation from Markdown.
 *
 * A lightweight wrapper around @docmd/core.
 * Runs `docmd dev` by default, `docmd build` when you say build.
 * No config required. No setup. Just docs.
 *
 * @package     docmdx
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

// ── Colours (no dependencies) ──────────────────────────────────────
const dim   = (s) => `\x1b[2m${s}\x1b[0m`;
const blue  = (s) => `\x1b[34m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const bold  = (s) => `\x1b[1m${s}\x1b[0m`;

// ── Banner ─────────────────────────────────────────────────────────
function printBanner() {
  console.log(`
${blue('     _                 _ ')}
${blue('   _| |___ ___ _____ _| |')}
${blue('  | . | . |  _|     | . |')}
${blue('  |___|___|___|_|_|_|___|')}

   ${dim(`docmdx v${pkg.version}`)}
`);
}

// ── Help ───────────────────────────────────────────────────────────
function printHelp() {
  printBanner();
  console.log(`${bold('Usage:')} npx docmdx [command] [options]\n`);
  console.log(`${bold('Commands:')}`);
  console.log(`  ${green('(none)')}          Start the dev server (default)`);
  console.log(`  ${green('build')}           Build the site for production`);
  console.log(`  ${green('init')}            Scaffold a new documentation project`);
  console.log(`  ${green('plugin add')}      Install an optional plugin`);
  console.log(`  ${green('plugin remove')}   Remove an installed plugin\n`);
  console.log(`${bold('Options:')}`);
  console.log(`  -p, --port <n>     Port for dev server (default: 3000)`);
  console.log(`  -c, --config <f>   Path to config file`);
  console.log(`  -V, --version      Show version`);
  console.log(`  -h, --help         Show this help\n`);
  console.log(`${bold('Install the full CLI for advanced usage:')}`);
  console.log(`  npm install -g @docmd/core\n`);
  console.log(dim(`  Documentation: https://docmd.io`));
  console.log(dim(`  Repository:    https://github.com/docmd-io/docmd\n`));
}

// ── Resolve docmd binary ───────────────────────────────────────────
function resolveDocmdBin() {
  // 1. Local workspace (monorepo / installed dependency)
  try {
    const corePkg = resolve(__dirname, '../node_modules/@docmd/core/package.json');
    if (existsSync(corePkg)) {
      const meta = JSON.parse(readFileSync(corePkg, 'utf-8'));
      const binPath = resolve(dirname(corePkg), meta.bin?.docmd || 'dist/bin/docmd.js');
      if (existsSync(binPath)) return binPath;
    }
  } catch { /* continue */ }

  // 2. Global install
  try {
    const { execSync } = await import('node:child_process');
    const globalBin = execSync('which docmd', { encoding: 'utf-8' }).trim();
    if (globalBin && existsSync(globalBin)) return globalBin;
  } catch { /* continue */ }

  return null;
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // Version flag
  if (args.includes('-V') || args.includes('--version')) {
    console.log(pkg.version);
    process.exit(0);
  }

  // Help flag
  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  // Map docmdx commands → docmd commands
  const command = args[0];
  let docmdArgs = [];

  if (!command || command.startsWith('-')) {
    // No command = dev server (zero config by default when no config exists)
    docmdArgs = ['dev'];

    // Auto-detect zero-config: if no docmd.config.js/ts exists, add -z
    const cwd = process.cwd();
    const hasConfig = existsSync(resolve(cwd, 'docmd.config.js'))
                   || existsSync(resolve(cwd, 'docmd.config.ts'))
                   || existsSync(resolve(cwd, 'config.js'));

    if (!hasConfig) {
      docmdArgs.push('-z');
    }

    // Pass through any flags (e.g. -p 8080)
    docmdArgs.push(...args);
  } else if (command === 'build') {
    docmdArgs = ['build', ...args.slice(1)];

    // Auto zero-config for build too
    const cwd = process.cwd();
    const hasConfig = existsSync(resolve(cwd, 'docmd.config.js'))
                   || existsSync(resolve(cwd, 'docmd.config.ts'))
                   || existsSync(resolve(cwd, 'config.js'));

    if (!hasConfig && !args.includes('-c') && !args.includes('--config')) {
      docmdArgs.push('-z');
    }
  } else if (command === 'plugin') {
    // docmdx plugin add <name> → docmd add <name>
    const subCmd = args[1]; // add or remove
    if (subCmd === 'add' || subCmd === 'remove') {
      docmdArgs = [subCmd, ...args.slice(2)];
    } else {
      console.error(`Unknown plugin command: ${subCmd}`);
      console.error(`Usage: docmdx plugin add|remove <plugin-name>`);
      process.exit(1);
    }
  } else {
    // Pass through any other command directly
    docmdArgs = args;
  }

  const docmdBin = resolveDocmdBin();

  if (!docmdBin) {
    console.error(`\n  Could not find @docmd/core.\n`);
    console.error(`  Install it with:`);
    console.error(`    npm install -g @docmd/core\n`);
    console.error(`  Or add it as a project dependency:`);
    console.error(`    npm install @docmd/core\n`);
    process.exit(1);
  }

  // Spawn docmd with the mapped arguments
  const child = spawn('node', [docmdBin, ...docmdArgs], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error(`Failed to start docmd: ${err.message}`);
    process.exit(1);
  });
}

main();
