/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation generator.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 *
 * Release preparation pipeline. Runs the full dev suite in five
 * clear category sections:
 *
 *   1. Setup       - stop running servers, wipe global binaries,
 *                    clean the monorepo
 *   2. Lint        - eslint over the entire repo, summarised
 *   3. Docker      - optional Docker availability check
 *   4. Tests       - categorised test suite (tests/runner.js,
 *                    342 assertions covering Phase 1 security
 *                    CVEs + Phase 2 container parser + Phase 3
 *                    CLI contracts + OKF/LLMS plugin tests) and
 *                    the comprehensive integration test
 *                    (tools/failsafe.test.mjs, type-check /
 *                    version / engine / mega integration)
 *   5. Link        - optional global npm link
 *
 * Each step inside a section shows [WAIT] (dim) when it starts
 * and [DONE] (green) when it finishes. No emojis.
 *
 * Run:  pnpm prep
 *       pnpm prep --link            (skip tests, install globally)
 *       pnpm prep --skip-tests     (skip both test suites)
 *       pnpm prep --only=exit-codes (run a single test section)
 * --------------------------------------------------------------------
 */

const { execSync } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);

// ── TUI design tokens (no emojis, only [WAIT] / [DONE] / [ FAIL ]) ──
const C = {
    reset:  '\x1b[0m',
    bold:   '\x1b[1m',
    dim:    '\x1b[2m',
    blue:   '\x1b[34m',
    cyan:   '\x1b[36m',
    green:  '\x1b[32m',
    yellow: '\x1b[33m',
    red:    '\x1b[31m'
};

// ── TUI primitives ────────────────────────────────────────────────────
function section(label, color) {
    console.log(`\n${color}${C.bold}┌─ ${label}${C.reset}`);
}

function footer(color) {
    console.log(`${color}└${'─'.repeat(50)}${C.reset}\n`);
}

function startStep(label) {
    // Print the [WAIT] sign and return a handle to update on completion.
    const bar = `${C.cyan}│${C.reset}`;
    const text = `${C.dim}${label}${C.reset}`;
    process.stdout.write(`${bar}  ${text.padEnd(52)}${C.dim}[WAIT]${C.reset}\n`);
    return { label, startMs: Date.now(), bar, text };
}

function finishStep(s, status, summary) {
    // Rewrite the same line with [DONE] / [ WARN ] / [ FAIL ] + elapsed time.
    // Default status is 'done' — the common case.
    const effectiveStatus = status || 'done';
    const ms = Date.now() - s.startMs;
    const t = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
    const tag = effectiveStatus === 'done'
        ? `${C.green}[ DONE ]${C.reset}`
        : effectiveStatus === 'warn'
            ? `${C.yellow}[ WARN ]${C.reset}`
            : `${C.red}[ FAIL ]${C.reset}`;
    const sumTxt = summary ? `  ${C.dim}${summary}${C.reset}` : '';
    // Move cursor up 1 line, clear it, rewrite.
    process.stdout.write('\x1b[1A\x1b[2K');
    process.stdout.write(
        `${s.bar}  ${s.text.padEnd(52)}${tag} ${C.dim}${t}${C.reset}${sumTxt}\n`
    );
}

function run(cmd, silent) {
    if (silent === undefined) silent = true;
    try {
        execSync(cmd, { stdio: silent ? 'ignore' : 'inherit' });
    } catch (e) {
        if (!silent) console.error(e);
        process.exit(1);
    }
}

// ── Step helpers ──────────────────────────────────────────────────────
function deepWipe() {
    const bins = ['docmd', 'docmd-live'];
    for (const bin of bins) {
        try {
            const paths = execSync(`which -a ${bin}`, { stdio: 'pipe' })
                .toString().split('\n').filter(Boolean);
            for (const p of paths) {
                try { if (fs.existsSync(p)) fs.unlinkSync(p); }
                catch {
                    try { execSync(`rm -f "${p}"`, { stdio: 'ignore' }); } catch { /* ignore */ }
                }
            }
        } catch { /* ignore which failure */ }
    }
}

function runLint() {
    const s = startStep('Running eslint over monorepo');
    let stdout = '';
    try {
        stdout = execSync('pnpm -s exec eslint . --format json', {
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 64 * 1024 * 1024
        }).toString();
    } catch (e) {
        // eslint exits non-zero on errors — JSON is still on stdout
        if (e.stdout) stdout = e.stdout.toString();
    }

    let errors = 0, warnings = 0;
    try {
        const results = JSON.parse(stdout || '[]');
        for (const file of results) {
            for (const msg of file.messages || []) {
                if (msg.severity === 2) errors++;
                else if (msg.severity === 1) warnings++;
            }
        }
    } catch (_) { /* malformed output */ }

    const status = errors > 0 ? 'fail' : (warnings > 0 ? 'warn' : 'done');
    const sum = errors + ' error' + (errors === 1 ? '' : 's') + ', '
              + warnings + ' warning' + (warnings === 1 ? '' : 's');
    finishStep(s, status, sum);
    if (errors > 0) process.exit(1);
}

function runDockerCheck() {
    const s = startStep('Checking Docker availability');
    let hasDocker = '';
    try {
        hasDocker = execSync('which docker 2>/dev/null', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
    } catch { /* not installed */ }

    if (!hasDocker && !process.env.DOCKER_HOST) {
        finishStep(s, 'warn', 'not installed — skipped');
        return;
    }
    try {
        const version = execSync('docker --version', { encoding: 'utf8', stdio: ['pipe', 'pipe'] }).trim();
        finishStep(s, 'done', version.replace('Docker version ', 'Docker '));
    } catch {
        finishStep(s, 'warn', 'docker binary not functional');
    }
}

// ── Main pipeline ────────────────────────────────────────────────────

// Header (banner comes from tools/status.js start:reset)
run('node tools/status.js start:reset', false);

// Section 1: Setup
section('Setup', C.blue);
{
    const s = startStep('Stopping active servers');
    run('pnpm -s stop');
    finishStep(s);
}
{
    const s = startStep('Wiping global docmd binaries');
    const pkgs = ['@docmd/core', '@docmd/monorepo', 'docmd', 'docmd-live'];
    for (const pkg of pkgs) {
        try { execSync('npm uninstall -g ' + pkg + ' -s', { stdio: 'ignore' }); } catch { /* ignore */ }
        try { execSync('pnpm uninstall -g ' + pkg + ' -s', { stdio: 'ignore' }); } catch { /* ignore */ }
    }
    deepWipe();
    finishStep(s);
}
{
    const s = startStep('Cleaning monorepo');
    run('pnpm -s clean');
    finishStep(s);
}
run('node tools/status.js reset', false);
footer(C.blue);

// Section 2: Lint
section('Lint', C.cyan);
runLint();
footer(C.cyan);

// Section 3: Docker (optional)
section('Docker', C.blue);
runDockerCheck();
footer(C.blue);

// Section 4: Tests
section('Tests', C.blue);
if (args.includes('--skip-tests')) {
    const s = startStep('Skipping test suite (--skip-tests)');
    finishStep(s, 'done', 'skipped by user request');
} else {
    const only = args.find((a) => a.startsWith('--only='));
    const runnerArgs = only ? ' ' + only : '';
    {
        const s = startStep('Categorised test suite (tests/runner.js)');
        run('node tests/runner.js' + runnerArgs, false);
        finishStep(s);
    }
    {
        const s = startStep('Failsafe integration test (tools/failsafe.test.mjs)');
        const failsafeArgs = args.filter((a) => a !== '--link' && !a.startsWith('--only=')).join(' ');
        run('node tools/failsafe.test.mjs ' + failsafeArgs, false);
        finishStep(s);
    }
}
footer(C.blue);

// Section 5: Link (optional)
if (args.includes('--link')) {
    section('Link', C.blue);
    const s = startStep('Linking @docmd/core globally');
    try {
        execSync('npm link --silent', {
            cwd: require('path').join(process.cwd(), 'packages/core'),
            stdio: 'ignore'
        });
        finishStep(s, 'done', 'docmd command available globally');
    } catch {
        finishStep(s, 'fail', 'npm link failed');
        process.exit(1);
    }
    footer(C.blue);
}
