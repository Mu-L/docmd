/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
 *
 * @package     @docmd/plugin-threads
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2026 Saulo Vallory
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import '@awesome.me/webawesome/dist/styles/themes/default.css';
import './components/threads-app.ts';

function init(): void {
  if (document.querySelector('threads-app')) return;
  const app = document.createElement('threads-app');
  document.body.appendChild(app);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
