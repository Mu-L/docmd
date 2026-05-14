/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/api
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

// Plugin loader & hook registry
export { loadPlugins, hooks, resolvePluginName } from './hooks.js';

// RPC action/event dispatcher
export { createActionDispatcher, safePath } from './rpc.js';

// Source editing tools
export { createSourceTools } from './source.js';

// TUI tools
export { TUI } from '@docmd/tui';

// ─── Centralised URL Utilities ─────────────────────────────────────────────
// Re-exported from @docmd/parser for plugin consumption.
// Plugins MUST use these instead of rolling their own URL logic.
export {
  sanitizeUrl,
  outputPathToSlug,
  outputPathToPathname,
  outputPathToCanonical,
  buildContextualUrl,
  createUrlContext,
  computePageUrls,
  buildAbsoluteUrl,
  resolveHref,
  normalizeInternalHref,
} from '@docmd/parser';

export type { UrlContext, PageUrls } from '@docmd/parser';

// ─── Engine System ─────────────────────────────────────────────────────────
// Re-exported from engine module.
export {
  engineRegistry,
  registerEngine,
  loadEngine,
  isEngineAvailable,
  getAvailableEngines,
  runTask,
  discoverFiles,
  readFilesBatch,
  getGitLog,
  buildSearchIndex,
} from './engine.js';

// Types
export type {
  // Plugin system
  PluginDescriptor,
  PluginModule,
  PluginHooks,
  Capability,
  PageContext,
  PostBuildContext,
  // Action/Event system
  ActionContext,
  ActionHandler,
  EventHandler,
  DispatchResult,
  // Source tools
  SourceTools,
  BlockInfo,
  InlineSegment,
  TextLocation,
  // Engine system
  Engine,
  EngineTask,
  EngineResult,
  EngineLoader,
  EngineInitOptions,
  BuiltinTaskType,
  FileDiscoverPayload,
  FileReadBatchPayload,
  GitLogPayload,
  SearchIndexPayload,
} from './types.js';
