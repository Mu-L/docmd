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

// Types
export type {
  // Plugin system
  PluginDescriptor,
  PluginModule,
  PluginHooks,
  Capability,
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
} from './types.js';
