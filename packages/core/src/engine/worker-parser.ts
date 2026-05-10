/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/core
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 * --------------------------------------------------------------------
 */

import { parentPort, workerData } from 'node:worker_threads';
import { loadPlugins } from '@docmd/api';
import { createMarkdownProcessor, processContentAsync } from '@docmd/parser';
import * as ui from '@docmd/ui';

// Initialize the worker state once
let mdProcessor: any;
let hooks: any;
let config: any;

async function init() {
  config = workerData.config;
  const cwd = workerData.cwd;

  // 1. Re-hydrate hooks by loading plugins within the worker boundary
  hooks = await loadPlugins(config, { resolvePaths: [cwd] });

  // 2. Re-hydrate UI strings for the markdown processor (for heading anchors, etc.)
  const localeId = config._activeLocale?.id || null;
  const pluginTranslations = hooks.translations
    ? hooks.translations.reduce((acc: any, fn: any) => ({ ...acc, ...fn(localeId) }), {})
    : {};
  const userLocaleTranslations = config._activeLocale?.translations || {};
  const strings = ui.loadTranslations(localeId, { ...pluginTranslations, ...userLocaleTranslations });
  const configWithStrings = { ...config, _uiStrings: strings };

  // 3. Instantiate the exact same Markdown-It pipeline as the main thread
  mdProcessor = createMarkdownProcessor(configWithStrings, (md: any) => {
    hooks.markdownSetup.forEach((hook: any) => hook(md));
  });
}

// Start initialization immediately upon worker thread spawn
const initPromise = init();

parentPort?.on('message', async (task) => {
  try {
    // Ensure the worker is fully initialized before processing any task
    await initPromise;

    // Support generic tasks for plugins leveraging the WorkerPool
    if (task.payload && task.payload.type === 'plugin-task') {
      const { modulePath, functionName, args } = task.payload;
      const mod = await import(modulePath);
      const result = await mod[functionName](...args);
      parentPort?.postMessage({
        taskId: task.id,
        success: true,
        data: result
      });
      return;
    }

    const { rawContent, env } = task.payload;

    // Process the content (includes frontmatter extraction, hooks execution, and HTML rendering)
    const processed = await processContentAsync(rawContent, mdProcessor, config, env, hooks);

    parentPort?.postMessage({
      taskId: task.id,
      success: true,
      data: processed
    });
  } catch (error: any) {
    parentPort?.postMessage({
      taskId: task.id,
      success: false,
      error: error.message || String(error)
    });
  }
});