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

import chalk from 'chalk';
import { readFileSync } from 'fs';

const pkgUrl = new URL('../../package.json', import.meta.url);
const { version } = JSON.parse(readFileSync(pkgUrl, 'utf-8'));

export const printBanner = () => {
  const logo = `
                       
${chalk.blue('     _                 _ ')}
${chalk.blue('   _| |___ ___ _____ _| |')}
${chalk.blue('  | . | . |  _|     | . |')}
${chalk.blue('  |___|___|___|_|_|_|___|')}
  `;

  console.log(logo);
  console.log(`   ${chalk.dim(`v${version}`)}`);
  console.log(`\n`);
};