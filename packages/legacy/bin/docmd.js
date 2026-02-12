#!/usr/bin/env node

console.error('\x1b[33m%s\x1b[0m', '⚠️  DEPRECATION NOTICE:');
console.error('\x1b[33m%s\x1b[0m', '   You are using the legacy package "@mgks/docmd".');
console.error('\x1b[33m%s\x1b[0m', '   Please uninstall it and install "@docmd/core" for future updates.');
console.error('\x1b[33m%s\x1b[0m', '   Redirecting to new engine...\n');

// Pass control to the core binary
require('@docmd/core/bin/docmd.js');