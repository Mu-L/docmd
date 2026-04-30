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
        let found = true;
        while (found) {
            try {
                const paths = execSync(`which -a ${bin}`, { stdio: 'pipe' }).toString().split('\n').filter(Boolean);
                if (paths.length === 0) {
                    found = false;
                } else {
                    for (const p of paths) {
                        try {
                            if (fs.existsSync(p)) fs.unlinkSync(p);
                        } catch {
                            // If unlink fails (permissions), try rm -f
                            try { execSync(`rm -f "${p}"`, { stdio: 'ignore' }); } catch { /* ignore rm failure */ }
                        }
                    }
                }
            } catch {
                found = false;
            }
        }
    }
}

// 1. Initial Reporting
run('node scripts/status.js start:reset', false);

// 2. Stop any running servers
run('pnpm -s stop');

// 3. Deep Wipe (Unlink)
process.stdout.write('\x1b[2m   Wiping global binaries...\x1b[0m');
// Standard uninstalls - individual try/catch to avoid overall failure
const pkgs = ['@docmd/core', '@docmd/monorepo', 'docmd', 'docmd-live'];
for (const pkg of pkgs) {
    try { execSync(`npm uninstall -g ${pkg} -s`, { stdio: 'ignore' }); } catch { /* ignore */ }
    try { execSync(`pnpm uninstall -g ${pkg} -s`, { stdio: 'ignore' }); } catch { /* ignore */ }
}
// Aggressive wipe
deepWipe();
process.stdout.write(' \x1b[32mDone!\x1b[0m\n');

// 4. Clean
run('pnpm -s clean');

// 5. Final Reset Report
run('node scripts/status.js reset', false);

// 6. Verify (this builds and optionally links)
// Pass --skip-header to avoid duplicate logo
run(`node scripts/verify.js ${args.join(' ')} --skip-header`, false);