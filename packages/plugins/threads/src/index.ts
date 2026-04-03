/**
 * @docmd/plugin-threads — inline discussion threads stored in markdown.
 *
 * @copyright Copyright (c) 2026 Saulo Vallory
 * @license MIT
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { setup as setupContainers } from './plugin/containers.js';
import { setup as setupHighlightRule } from './plugin/highlight-rule.js';
import { actions } from './plugin/actions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function markdownSetup(md: any, options?: any): void {
  setupContainers(md);
  setupHighlightRule(md);
}

export function generateScripts(config: any, options?: any): { headScriptsHtml: string; bodyScriptsHtml: string } {
  let authorsJson = '{}';
  try {
    const srcDir = config.src || 'docs';
    const authorsPath = path.resolve(srcDir, '.threads', 'authors.json');
    authorsJson = fs.readFileSync(authorsPath, 'utf8');
  } catch {
    // File doesn't exist yet — that's fine
  }

  return {
    headScriptsHtml: '',
    bodyScriptsHtml: `<script>window.__threads_authors=${authorsJson}</script>`
  };
}

export function getAssets(options?: any): any[] {
  // Resolve relative to the compiled output location
  const distDir = path.resolve(__dirname, '..', 'dist', 'client');
  return [
    {
      src: path.join(distDir, 'index.js'),
      dest: 'assets/js/threads.js',
      type: 'js',
      location: 'body',
      attributes: { type: 'module' }
    },
    {
      src: path.join(distDir, 'index.css'),
      dest: 'assets/css/threads.css',
      type: 'css',
      location: 'head'
    }
  ];
}

export { actions };
