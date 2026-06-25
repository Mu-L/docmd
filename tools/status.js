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

const args = process.argv.slice(2);
const TYPE = args[0];
const skipHeader = args.includes('--skip-header');

// TUI Design Tokens
const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    bgBlue: '\x1b[44m',
    black: '\x1b[30m'
};

const LOGO = `
    _                 _ 
  _| |___ ___ _____ _| |
 | . | . |  _|     | . |
 |___|___|___|_|_|_|___|
`;

/**
 * Modern TUI Components
 */
const TUI = {
    header: (title) => {
        console.log(`\n${C.blue}${LOGO}${C.reset}`);
        console.log(`${C.dim} ${title} ${C.reset}\n`);
    },
    
    section: (label, color = C.cyan) => {
        console.log(`${color}${C.bold}┌─ ${label}${C.reset}`);
    },
    
    item: (label, status = 'DONE', color = C.dim, barColor = '\x1b[36m') => {
        const indicator = status === 'DONE' ? `\x1b[32m[ DONE ]\x1b[0m` : `\x1b[36m[ ${status} ]\x1b[0m`;
        console.log(`${barColor}│\x1b[0m  ${color}${label.padEnd(45)}${C.reset} ${indicator}`);
    },
    
    footer: (color = C.cyan) => {
        console.log(`${color}└──────────────────────────────────────────────────────────${C.reset}\n`);
    },

    alert: (msg, color = C.green) => {
        console.log(`${color}${C.bold}⬢ ${msg}${C.reset}\n`);
    },

    error: (msg, detail) => {
        console.error(`\n\x1b[31m\x1b[1m┌─ Failure\x1b[0m`);
        console.error(`\x1b[31m│\x1b[0m  ${msg}`);
        if (detail) {
            detail.split('\n').forEach(line => {
                console.error(`\x1b[31m│\x1b[0m  \x1b[2m${line}\x1b[0m`);
            });
        }
        console.error(`\x1b[31m└──────────────────────────────────────────────────────────\x1b[0m\n`);
    }
};

if (TYPE && TYPE.startsWith('start:') && !skipHeader) {
    TUI.header('Monorepo Maintenance Pipeline');
}

if (TYPE === 'start:reset') {
    TUI.section('Resetting Docmd Engine', C.cyan);
} else if (TYPE === 'reset') {
    TUI.footer(C.cyan);
    TUI.alert('Ready for fresh verification.');
} else if (TYPE === 'start:verify') {
    TUI.section('Failsafe Verification', C.blue);
} else if (TYPE === 'verify') {
    //TUI.footer(C.blue);
    TUI.alert('docmd is production-ready.');
} else if (TYPE === 'error') {
    TUI.error(process.argv[3], process.argv[4]);
}