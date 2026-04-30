/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/tui
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import chalk from 'chalk';
import { readFileSync } from 'node:fs';

const pkgUrl = new URL('../package.json', import.meta.url);
const { version: PKG_VERSION } = JSON.parse(readFileSync(pkgUrl, 'utf-8'));

const LOGO = `
    _                 _ 
  _| |___ ___ _____ _| |
 | . | . |  _|     | . |
 |___|___|___|_|_|_|___|
`;

/**
 * High-Signal Terminal Design System (TUI)
 * Standalone package with zero internal dependencies.
 */
export const TUI = {
  // Semantic Colors
  blue: chalk.blue,
  cyan: chalk.cyan,
  green: chalk.green,
  yellow: chalk.yellow,
  red: chalk.red,
  dim: chalk.dim,
  bold: chalk.bold,

  banner: (logo: string = LOGO, version: string = PKG_VERSION) => {
    console.log(`\n${chalk.blue(logo)}`);
    console.log(`${chalk.dim(` v${version}`)}\n`);
  },

  section: (label: string, color = chalk.cyan) => {
    console.log(`${color.bold(`┌─ ${label}`)}`);
  },

  divider: (label: string, color = chalk.blue) => {
    console.log(`${color.bold(`├─ ${label}`)}`);
  },

  step: (label: string, status: 'DONE' | 'WAIT' | 'SKIP' | 'FAIL' | string = 'WAIT', barColor = chalk.cyan) => {
    const statusText = status === 'DONE' ? chalk.green('[ DONE ]') : 
                       status === 'SKIP' ? chalk.yellow('[ SKIP ]') : 
                       status === 'FAIL' ? chalk.red('[ FAIL ]') :
                       chalk.blue(`[ ${status} ]`);
    
    const line = `${barColor('│')}  ${chalk.dim(label.padEnd(45))} ${statusText}`;

    // If it's a TTY and the status is transitioning from WAIT to DONE/FAIL/SKIP, 
    // we can try to overwrite the line instead of printing a new one.
    if (process.stdout.isTTY && status !== 'WAIT') {
      // Move cursor up 1 line, move to start, clear line
      process.stdout.write(`\x1b[1A\r\x1b[K${line}\n`);
    } else {
      console.log(line);
    }
  },

  item: (label: string, value: string, labelColor = chalk.dim, barColor = chalk.cyan) => {
    console.log(`${barColor('│')}  ${labelColor(label.padEnd(15))} ${value}`);
  },

  footer: (color = chalk.cyan) => {
    console.log(`${color('└──────────────────────────────────────────────────────────')}\n`);
  },

  info: (msg: string) => {
    console.log(`${chalk.blue.bold('⬢')} ${msg}`);
  },

  success: (msg: string) => {
    console.log(`\n${chalk.green.bold('⬢')} ${msg}\n`);
  },

  warn: (msg: string) => {
    console.log(`${chalk.yellow.bold('⬢')} ${chalk.yellow(msg)}`);
  },

  error: (msg: string, detail?: string) => {
    console.error(`\n${chalk.red.bold('┌─ Failure')}`);
    console.error(`${chalk.red('│')}  ${msg}`);
    if (detail) {
      detail.split('\n').forEach(line => {
        console.error(`${chalk.red('│')}  ${chalk.dim(line)}`);
      });
    }
    console.error(`${chalk.red('└──────────────────────────────────────────────────────────')}\n`);
  }
};