const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const shouldLink = args.includes('--link');

function run(cmd, silent = true) {
    try {
        execSync(cmd, { stdio: silent ? 'ignore' : 'inherit' });
    } catch (e) {
        // If it's a start/status command, we want to see errors, but for others we just exit
        if (!silent) console.error(e);
        process.exit(1);
    }
}

// 1. Show starting logo and message
run('node scripts/status.js start:onboard', false);

// 2. Install dependencies
run('pnpm install --silent');

// 3. Build monorepo
run('pnpm run build');

// 4. Handle global linking if requested
if (shouldLink) {
    process.stdout.write('\x1b[2m🔗 Linking docmd globally...\x1b[0m');
    try {
        // We use npm link in core because it's the package that provides the binary
        execSync('npm link --silent', { cwd: path.join(process.cwd(), 'packages/core'), stdio: 'ignore' });
        console.log(' \x1b[32mDone!\x1b[0m');
    } catch (e) {
        console.log(' \x1b[31mFailed (requires sudo?)\x1b[0m');
    }
}

// 5. Show final completion status
const statusCmd = shouldLink ? 'node scripts/status.js onboard --linked' : 'node scripts/status.js onboard';
run(statusCmd, false);