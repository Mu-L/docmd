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

function run(cmd, silent = true) {
    try {
        execSync(cmd, { stdio: silent ? 'ignore' : 'inherit' });
    } catch (e) {
        if (!silent) console.error(e);
        process.exit(1);
    }
}

// 1. Show starting logo (only if not in CI or if user wants it)
if (!isCI) {
    run('node scripts/status.js start:verify', false);
}

// 2. Run the actual failsafe check
// Forwarding arguments to failsafe.js
const failsafeArgs = args.filter(a => a !== '--link').join(' ');
run(`node scripts/failsafe.js ${failsafeArgs}`, false);

// 3. Handle global linking if requested
if (shouldLink) {
    process.stdout.write('\x1b[2m🔗 Linking docmd globally...\x1b[0m');
    try {
        execSync('npm link --silent', { cwd: path.join(process.cwd(), 'packages/core'), stdio: 'ignore' });
        console.log(' \x1b[32mDone!\x1b[0m');
    } catch (e) {
        console.log(' \x1b[31mFailed (requires sudo?)\x1b[0m');
    }
}

// 4. Show final completion status
if (!isCI) {
    const statusCmd = shouldLink ? 'node scripts/status.js verify --linked' : 'node scripts/status.js verify';
    run(statusCmd, false);
} else {
    console.log('\n🛡️  \x1b[32m\x1b[1mdocmd verification passed!\x1b[0m');
}