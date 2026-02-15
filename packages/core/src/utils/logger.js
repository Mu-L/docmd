/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025 docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

const chalk = require('chalk');

const { version } = require('../../package.json');

const printBanner = () => {
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

module.exports = { printBanner };