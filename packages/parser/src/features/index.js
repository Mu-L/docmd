const common = require('./common-containers');
const tabs = require('./tabs');
const steps = require('./steps');
const changelog = require('./changelog');
const basics = require('./basics');

const FEATURES = [basics, common, tabs, steps, changelog];

function registerFeatures(md) {
  FEATURES.forEach(feature => {
    if (feature.setup) feature.setup(md);
  });
}

module.exports = { registerFeatures };