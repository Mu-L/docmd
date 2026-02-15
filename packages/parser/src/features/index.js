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

const common = require('./common-containers');
const tabs = require('./tabs');
const steps = require('./steps');
const changelog = require('./changelog');
const buttons = require('./buttons');
const basics = require('./basics');

const FEATURES = [basics, buttons, common, tabs, steps, changelog];

function registerFeatures(md) {
  FEATURES.forEach(feature => {
    if (feature.setup) feature.setup(md);
  });
}

module.exports = { registerFeatures };