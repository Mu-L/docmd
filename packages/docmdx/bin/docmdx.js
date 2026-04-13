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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// ── Load own package.json ──────────────────────────────────────────
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
// ── Colours (zero dependencies) ────────────────────────────────────
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const blue = (s) => `\x1b[34m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
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
    console.log(`  ${green('(none)')}            Start the dev server ${dim('(default)')}`);
    console.log(`  ${green('build')}             Build the site for production`);
    console.log(`  ${green('init')}              Scaffold a new documentation project`);
    console.log(`  ${green('live')}              Start in live-editor mode`);
    console.log(`  ${green('migrate')}           Migrate an older project to the latest format`);
    console.log(`  ${green('plugin add')}        Install an optional plugin`);
    console.log(`  ${green('plugin remove')}     Remove an installed plugin`);
    console.log(`  ${green('stop')}              Stop any running background process\n`);
    console.log(`${bold('Options:')}`);
    console.log(`  -p, --port <n>     Dev server port ${dim('(default: 3000)')}`);
    console.log(`  -c, --config <f>   Path to config file`);
    console.log(`  -z, --zero-config  Force zero-config mode`);
    console.log(`  -V, --version      Show version`);
    console.log(`  -h, --help         Show this help\n`);
    console.log(`${bold('Full install for permanent local use:')}`);
    console.log(`  npm install -g @docmd/core\n`);
    console.log(dim(`  Documentation   https://docmd.io`));
    console.log(dim(`  Repository      https://github.com/docmd-io/docmd\n`));
}
// ── Resolve @docmd/core binary ─────────────────────────────────────
// Tries (in order):
//   1. Locally installed dependency (resolved from CWD)
//   2. Sibling package in monorepo / workspace
//   3. Globally installed `docmd` on PATH
function resolveDocmdBin() {
    // 1. CWD-relative resolution (proper npm/pnpm consumer installs)
    try {
        const req = createRequire(pathToFileURL(resolve(process.cwd(), 'package.json')).href);
        const corePkgPath = req.resolve('@docmd/core/package.json');
        const meta = JSON.parse(readFileSync(corePkgPath, 'utf-8'));
        const binPath = resolve(dirname(corePkgPath), meta.bin?.docmd ?? 'dist/bin/docmd.js');
        if (existsSync(binPath))
            return binPath;
    }
    catch { /* not installed in project */ }
    // 2. Workspace peer (monorepo — e.g. when running docmdx from docmd's own repo)
    try {
        const monoCoreBin = resolve(__dirname, '../../core/dist/bin/docmd.js');
        if (existsSync(monoCoreBin))
            return monoCoreBin;
    }
    catch { /* not in monorepo */ }
    // 3. Global PATH
    try {
        const globalBin = execSync('which docmd', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (globalBin && existsSync(globalBin))
            return globalBin;
    }
    catch { /* not on PATH */ }
    return null;
}
// ── Detect whether a config file exists in CWD ────────────────────
function hasLocalConfig() {
    const cwd = process.cwd();
    return (existsSync(resolve(cwd, 'docmd.config.js')) ||
        existsSync(resolve(cwd, 'docmd.config.ts')) ||
        existsSync(resolve(cwd, 'config.js')));
}
// ── Main ───────────────────────────────────────────────────────────
async function main() {
    const args = process.argv.slice(2);
    if (args.includes('-V') || args.includes('--version')) {
        console.log(pkg.version);
        process.exit(0);
    }
    if (args.includes('-h') || args.includes('--help')) {
        printHelp();
        process.exit(0);
    }
    const command = args[0];
    let docmdArgs = [];
    if (!command || command.startsWith('-')) {
        // No command → dev server; auto zero-config when no config file exists
        docmdArgs = ['dev'];
        if (!hasLocalConfig() && !args.includes('-c') && !args.includes('--config')) {
            docmdArgs.push('-z');
        }
        docmdArgs.push(...args);
    }
    else if (command === 'build') {
        docmdArgs = ['build', ...args.slice(1)];
        if (!hasLocalConfig() && !args.includes('-c') && !args.includes('--config')) {
            docmdArgs.push('-z');
        }
    }
    else if (command === 'plugin') {
        const subCmd = args[1];
        if (subCmd === 'add' || subCmd === 'remove') {
            docmdArgs = [subCmd, ...args.slice(2)];
        }
        else {
            console.error(`\n  Unknown plugin command: ${subCmd ?? '(none)'}`);
            console.error(`  Usage: docmdx plugin add|remove <plugin-name>\n`);
            process.exit(1);
        }
    }
    else {
        // Pass all other commands through verbatim (init, live, migrate, stop, …)
        docmdArgs = args;
    }
    const docmdBin = resolveDocmdBin();
    if (!docmdBin) {
        console.error(`\n  ${bold('Could not locate @docmd/core.')}\n`);
        console.error(`  Install it in your project:`);
        console.error(`    npm install @docmd/core\n`);
        console.error(`  Or install the global CLI:`);
        console.error(`    npm install -g @docmd/core\n`);
        console.error(dim(`  Documentation: https://docmd.io\n`));
        process.exit(1);
    }
    const child = spawn(process.execPath, [docmdBin, ...docmdArgs], {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env,
    });
    child.on('close', (code) => process.exit(code ?? 0));
    child.on('error', (err) => {
        console.error(`\n  Failed to start docmd: ${err.message}\n`);
        process.exit(1);
    });
}
main();
