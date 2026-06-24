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
const fs = require('fs');

const args = process.argv.slice(2);

function run(cmd, silent = true) {
    try {
        execSync(cmd, { stdio: silent ? 'ignore' : 'inherit' });
    } catch (e) {
        if (!silent) console.error(e);
        process.exit(1);
    }
}

/**
 * Robustly removes any global docmd binaries from the system.
 * Loops until 'which' returns nothing.
 */
function deepWipe() {
    const bins = ['docmd', 'docmd-live'];
    for (const bin of bins) {
        try {
            const paths = execSync(`which -a ${bin}`, { stdio: 'pipe' }).toString().split('\n').filter(Boolean);
            for (const p of paths) {
                try {
                    if (fs.existsSync(p)) fs.unlinkSync(p);
                } catch {
                    try { execSync(`rm -f "${p}"`, { stdio: 'ignore' }); } catch { /* ignore */ }
                }
            }
        } catch { /* ignore which failure */ }
    }
}

// 1. Initial Reporting
run('node tools/status.js start:reset', false);

// 1a. Lint gate — capture eslint JSON, summarise in TUI style, fail
// fast on errors. Output is silent; developer runs `pnpm lint`
// directly to see the full file-by-file breakdown.
function runLint() {
    const cyan   = (t) => `\x1b[36m${t}\x1b[0m`;
    const green  = (t) => `\x1b[32m${t}\x1b[0m`;
    const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
    const red    = (t) => `\x1b[31m${t}\x1b[0m`;
    const dim    = (t) => `\x1b[2m${t}\x1b[0m`;

    let stdout = '';
    try {
        stdout = execSync('pnpm -s exec eslint . --format json', {
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 64 * 1024 * 1024
        }).toString();
    } catch (e) {
        // eslint exits non-zero on errors — the JSON is still on stdout
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
    } catch (_) {
        // malformed output — leave counts at 0
    }

    console.log(`\n${cyan('┌─ Lint')}`);
    if (errors > 0) {
        console.log(`${cyan('│')}  ${red('[ FAIL ]')} ${red(`${errors} error${errors === 1 ? '' : 's'}`)}`);
        console.log(`${cyan('│')}`);
        console.log(`${cyan('│')}  ${dim('Run `pnpm lint` to see the full output.')}`);
    } else {
        console.log(`${cyan('│')}  ${green('[ PASS ]')} ${green('0 errors')}`);
    }
    if (warnings > 0) {
        console.log(`${cyan('│')}  ${yellow('[ WARN ]')} ${yellow(`${warnings} warning${warnings === 1 ? '' : 's'}`)}`);
    }
    console.log(`${cyan('└──────────────────────────────────────────────────────────')}\n`);

    if (errors > 0) process.exit(1);
}
runLint();

// 2. Stop any running servers
process.stdout.write(`\x1b[36m│\x1b[0m  \x1b[2mStopping active servers\x1b[0m`.padEnd(45));
run('pnpm -s stop');
// process.stdout.write(` \x1b[32m[ DONE ]\x1b[0m\n`);
process.stdout.write(`\n`);

// 3. Deep Wipe (Unlink)
process.stdout.write(`\x1b[36m│\x1b[0m  \x1b[2mWiping global binaries\x1b[0m`.padEnd(45));
const pkgs = ['@docmd/core', '@docmd/monorepo', 'docmd', 'docmd-live'];
for (const pkg of pkgs) {
    try { execSync(`npm uninstall -g ${pkg} -s`, { stdio: 'ignore' }); } catch { /* ignore */ }
    try { execSync(`pnpm uninstall -g ${pkg} -s`, { stdio: 'ignore' }); } catch { /* ignore */ }
}
deepWipe();
// process.stdout.write(` \x1b[32m[ DONE ]\x1b[0m\n`);
process.stdout.write(`\n`);

// 4. Clean
process.stdout.write(`\x1b[36m│\x1b[0m  \x1b[2mCleaning monorepo\x1b[0m`.padEnd(45));
run('pnpm -s clean');
// process.stdout.write(` \x1b[32m[ DONE ]\x1b[0m\n`);
process.stdout.write(`\n`);

// 5. Final Reset Report
run('node tools/status.js reset', false);

// 6. Verify Docker setup (optional)
try {
    const hasDocker = require('child_process').execSync('which docker 2>/dev/null', { 
        encoding: 'utf8', 
        stdio: ['pipe', 'pipe', 'pipe'] 
    }).trim();
    
    if (hasDocker || process.env.DOCKER_HOST) {
        process.stdout.write(`\x1b[36m│\x1b[0m  \x1b[2mChecking Docker setup\x1b[0m`.padEnd(45));
        try {
            require('child_process').execSync('docker --version', { stdio: 'ignore' });
            process.stdout.write(` \x1b[32m[ AVAILABLE ]\x1b[0m\n`);
        } catch {
            process.stdout.write(` \x1b[33m[ NOT INSTALLED ]\x1b[0m\n`);
        }
    }
} catch {
    // Docker not installed, skip check silently
}

// 7. Verify (this builds and optionally links)
// Pass --skip-header to avoid duplicate logo
run(`node tools/verify.js ${args.join(' ')} --skip-header`, false);

// 8. Categorised test suite
//    Runs the new `tests/runner.js` which orchestrates:
//      - CLI contracts (exit-codes, plugin-add-remove, validate-workspace)
//      - Container normaliser (parser unit tests)
//      - Utils (path + html-escape)
//      - Security (Phase 1 CVE suite — 88 assertions)
//      - Feature integration (legacy brute-test.js, minus Phase 3 dupes)
//      - OKF plugin
//    Forward any `--only=<id>` filter so individual sections can be
//    re-run in isolation during development. Forward `--skip-tests`
//    to skip this step entirely (e.g. for the `--link` workflow
//    where the user just wants the global install).
if (args.includes('--skip-tests')) {
    console.log('\x1b[36m│\x1b[0m  \x1b[2mSkipping categorised test suite (--skip-tests)\x1b[0m');
} else {
    const only = args.find((a) => a.startsWith('--only='));
    const runnerArgs = only ? ` ${only}` : '';
    run(`node tests/runner.js${runnerArgs}`, false);
}