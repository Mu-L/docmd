// eslint-rules/index.js — docmd internal ESLint rules.
// Registered in eslint.config.mjs as plugin "docmd".

import noUnsafeFsRead from './no-unsafe-fs-read.js';
import requireVerifyClient from './require-verify-client.js';

export default {
  meta: {
    name: 'docmd-internal-rules',
    version: '0.0.1'
  },
  rules: {
    'no-unsafe-fs-read': noUnsafeFsRead,
    'require-verify-client': requireVerifyClient
  }
};