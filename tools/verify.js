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

const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const isCI = process.env.CI === 'true' || args.includes('--skip-setup');
const shouldLink = args.includes('--link');
const skipHeader = args.includes('--skip-header');

function run(cmd, silent = true) {
    // Pipe stdout/stderr so a failing child surfaces its real output. With
    // stdio 'inherit', a CI runner (no TTY) discards the child's output and
    // execSync's error object carries no captured buffers — leaving us with
    // an opaque "exit code 1" and no way to see which assertion failed.
    try {
        execSync(cmd, {
            stdio: silent ? 'ignore' : 'pipe',
            maxBuffer: 64 * 1024 * 1024,
        });
    } catch (e) {
        if (e.stdout) process.stderr.write(e.stdout);
        if (e.stderr) process.stderr.write(e.stderr);
        if (!silent) console.error(e);
        process.exit(1);
    }
}

// 1. Show starting logo (only if not in CI or if user wants it)
if (!isCI) {
    const headerCmd = skipHeader ? 'node tools/status.js start:verify --skip-header' : 'node tools/status.js start:verify';
    run(headerCmd, false);
}

// 2. Run the categorised test suite (tests/runner.js replaced the
// legacy scripts/failsafe.mjs after the tests/scripts split).
// Forwarding arguments so --skip-setup / future flags reach the runner.
const failsafeArgs = args.filter(a => a !== '--link' && a !== '--skip-header').join(' ');
run(`node tests/runner.js ${failsafeArgs}`, false);

// 3. Handle global linking if requested
if (shouldLink) {
    process.stdout.write(`\x1b[34m│\x1b[0m  \x1b[2mLinking docmd globally...\x1b[0m`);
    try {
        execSync('npm link --silent', { cwd: path.join(process.cwd(), 'packages/core'), stdio: 'ignore' });
        console.log(' \x1b[32m[ DONE ]\x1b[0m');
    } catch {
        console.log(' \x1b[31m[ FAIL ]\x1b[0m');
    }
}

// 4. Show final completion status
if (!isCI) {
    const statusCmd = 'node tools/status.js verify';
    run(statusCmd, false);
} else {
    console.log('\n\x1b[32m\x1b[1m⬢ Docmd verification passed!\x1b[0m\n');
}