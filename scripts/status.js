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

const LOGO = `
    _                 _ 
  _| |___ ___ _____ _| |
 | . | . |  _|     | . |
 |___|___|___|_|_|_|___|
`;

const args = process.argv.slice(2);
const TYPE = args[0];
const skipHeader = args.includes('--skip-header');

const IS_START = TYPE && TYPE.startsWith('start:');

if (IS_START && !skipHeader) {
    console.log('\x1b[34m%s\x1b[0m', LOGO);
    console.log('\x1b[2m Dev Environment \x1b[0m\n\n');
}

if (TYPE === 'start:reset') {
    process.stdout.write('🫧  \x1b[1mResetting docmd...\x1b[0m \x1b[2m(cleaning up)\x1b[0m');
} else if (TYPE === 'start:verify') {
    process.stdout.write('🛡️  \x1b[1mVerifying docmd...\x1b[0m \x1b[2m(running intensive failsafe checks)\x1b[0m');
} else if (TYPE === 'reset') {
    console.log('\n\x1b[32m✅ Reset complete!\x1b[0m\n');
    console.log('\x1b[34m🛑 Any running servers stopped.\x1b[0m');
    console.log('\x1b[34m🔗 Global links and binaries removed.\x1b[0m');
    console.log('\x1b[34m🧹 Monorepo cleaned.\x1b[0m');
    console.log('\x1b[32m\n⚡️ You can start fresh now.\x1b[0m');

} else if (TYPE === 'verify') {
    const isLinked = process.argv[3] === '--linked';
    console.log('\n\x1b[32m✨ Failsafe verification passed!\x1b[0m\n');
    console.log('\x1b[34m✅ Monorepo integrity & version sync verified.\x1b[0m');
    console.log('\x1b[34m✅ Engine reliability & multi-paradigm builds passed.\x1b[0m');
    console.log('\x1b[34m✅ Plugin ecosystem & installer lifecycle verified.\x1b[0m');
    console.log('\x1b[34m✅ Runtime execution & Live Editor sandbox verified.\x1b[0m');
    console.log('\x1b[34m✅ Deployment engine & infrastructure health verified.\x1b[0m');
    console.log('\x1b[34m✅ Security audit & release verification complete.\x1b[0m');
    if (isLinked) console.log('\x1b[34m🔗 Linked docmd globally.\x1b[0m');
    console.log('\x1b[32m\n🛡️  docmd is ready for production!\x1b[0m');
}

console.log('\n');