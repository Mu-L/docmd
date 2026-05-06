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

// ---------------------------------------------------------------------------
// Plugin Descriptor & Capabilities (§1, §3 of advanced-plugin-plan)
// ---------------------------------------------------------------------------

/** Known hook categories that a plugin can declare. */
export type Capability =
  | 'markdown'
  | 'head'
  | 'body'
  | 'assets'
  | 'post-build'
  | 'actions'
  | 'events'
  | 'translations'
  | 'init'
  | 'build'
  | 'dev';

/**
 * Every plugin should export a `plugin` descriptor.
 * Required starting 0.8.0; currently a soft deprecation warning is
 * emitted when missing.
 */
export interface PluginDescriptor {
  /** Unique identifier for this plugin. */
  name: string;
  /** Semver version string. */
  version: string;
  /** Declared hook categories this plugin uses. */
  capabilities: Capability[];
}

// ---------------------------------------------------------------------------
// Action / Event system (RPC)
// ---------------------------------------------------------------------------

/**
 * Context provided to plugin action and event handlers.
 *
 * Contains file I/O helpers, source editing tools, and project metadata.
 * All file operations are sandboxed to the project root directory.
 */
export interface ActionContext {
  /** Absolute path to the project root directory. */
  projectRoot: string;
  /** Current docmd site configuration. */
  config: any;
  /** Read a file relative to the project root. */
  readFile(relativePath: string): Promise<string>;
  /** Write a file relative to the project root. Sets the modification flag. */
  writeFile(relativePath: string, content: string): Promise<void>;
  /** Read a file as an array of lines. */
  readFileLines(relativePath: string): Promise<string[]>;
  /** Broadcast an event to all connected browser clients. */
  broadcast(event: string, data: any): void;
  /** Source editing tools for block-level markdown manipulation. */
  source: SourceTools;
}

/**
 * Handler for a named plugin action (WebSocket RPC).
 * Returns a result that is sent back to the browser client.
 */
export type ActionHandler = (payload: any, ctx: ActionContext) => Promise<any>;

/** Handler for a fire-and-forget plugin event. */
export type EventHandler = (data: any, ctx: ActionContext) => void;

/** Result of dispatching an action call. */
export interface DispatchResult {
  result: any;
  reload: boolean;
}

// ---------------------------------------------------------------------------
// Source Editing Tools
// ---------------------------------------------------------------------------

/**
 * Source editing tools that translate rendered-output references
 * (block IDs, text offsets) back to raw markdown source positions.
 */
export interface SourceTools {
  /** Get block content and inline segments at a given source map reference. */
  getBlockAt(file: string, blockRef: [number, number], options?: { textOffset?: number }): Promise<BlockInfo>;
  /** Locate text within a block and return its source position. */
  findText(file: string, blockRef: [number, number], text: string, textOffset?: number): Promise<TextLocation | null>;
  /** Wrap text within a block with syntax markers (e.g., `==`, `**`). */
  wrapText(file: string, blockRef: [number, number], text: string, textOffset: number, before: string, after: string): Promise<void>;
  /** Insert markdown content after a block. */
  insertAfter(file: string, blockRef: [number, number], content: string): Promise<void>;
  /** Replace an entire block's source lines. */
  replaceBlock(file: string, blockRef: [number, number], content: string): Promise<void>;
  /** Remove a block's source lines. */
  removeBlock(file: string, blockRef: [number, number]): Promise<void>;
}

/** Information about a block in the markdown source. */
export interface BlockInfo {
  id: string | null;
  line: { start: number; end: number };
  raw: string;
  textContent: string;
  segments: InlineSegment[];
  cursor: InlineSegment | null;
  ancestors: any[];
}

/** A contiguous run of text content with optional surrounding syntax. */
export interface InlineSegment {
  text: string;
  rawOffset: number;
  rawLength: number;
  syntax: [string, string] | null;
}

/** Source position of located text within a block. */
export interface TextLocation {
  line: number;
  startCol: number;
  endCol: number;
  rawText: string;
  wrappingSyntax: { before: string | null; after: string | null };
}

// ---------------------------------------------------------------------------
// Plugin Module Interface
// ---------------------------------------------------------------------------

/**
 * Interface for a docmd plugin module.
 *
 * Plugins can export any combination of build-time hooks and runtime
 * action/event handlers.
 */
export interface PluginModule {
  /** Plugin descriptor (required starting 0.8.0). */
  plugin?: PluginDescriptor;
  /** Extend the markdown-it parser instance. */
  markdownSetup?(md: any, options?: any): void;
  /** Inject meta/link tags into the HTML head. */
  generateMetaTags?(config: any, page: any, relativePathToRoot: string): string | Promise<string>;
  /** Inject scripts into head and/or body. */
  generateScripts?(config: any, options?: any): { headScriptsHtml?: string; bodyScriptsHtml?: string };
  /** Define external assets (JS/CSS) to inject. */
  getAssets?(options?: any): any[];
  /** Run logic after all HTML files are generated. */
  onPostBuild?(ctx: any): Promise<void>;
  /** Locale-specific UI string overrides. */
  translations?(localeId: string, options?: any): Record<string, string>;
  /** Named action handlers for WebSocket RPC calls from the browser. */
  actions?: Record<string, ActionHandler>;
  /** Named event handlers for fire-and-forget messages from the browser. */
  events?: Record<string, EventHandler>;
  /** Whether this plugin should run on noStyle pages (default: true). */
  noStyle?: boolean;

  // --- Lifecycle Hooks ---
  /** Read/modify normalized config right after initialization. */
  onConfigResolved?(config: any): void | Promise<void>;
  /** Access the dev server instance. */
  onDevServerReady?(server: any, wss: any): void | Promise<void>;
  /** Modify raw markdown before parsing. Called per page. */
  onBeforeParse?(src: string, frontmatter: any): string | Promise<string>;
  /** Modify rendered HTML after parsing. */
  onAfterParse?(html: string, frontmatter: any): string | Promise<string>;
  /**
   * Called BEFORE template rendering. Receives the page context including
   * `sourcePath` (absolute path to the source .md file), `frontmatter`,
   * and `html`. Mutations are reflected in the rendered output.
   *
   * This is the right hook for plugins that need to inject data derived
   * from the source file (e.g. reading frontmatter, computing metadata)
   * before the template runs.
   */
  onBeforeRender?(page: PageContext): void | Promise<void>;
  /** Access fully assembled page object before write. */
  onPageReady?(page: any): void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Page Context — available in onBeforeRender
// ---------------------------------------------------------------------------

/**
 * Page context object passed to `onBeforeRender`.
 * Always includes `sourcePath` so plugins can read the source file,
 * compute file-based metadata, and inject it before templating.
 */
export interface PageContext {
  /** Absolute path to the source .md file. Always set. */
  sourcePath: string;
  /** Parsed frontmatter object. Plugins may mutate this. */
  frontmatter: Record<string, any>;
  /** Rendered HTML body (between template slots). Plugins may mutate this. */
  html: string;
  /** Locale id active for this page. */
  localeId?: string;
  /** Version id active for this page (if versioning enabled). */
  versionId?: string;
  /** Relative path from the output file to the site root. */
  relativePathToRoot?: string;
}

// ---------------------------------------------------------------------------
// Hook Registry Shape
// ---------------------------------------------------------------------------

/** The shape of the hooks object maintained by the plugin loader. */
export interface PluginHooks {
  markdownSetup: ((md: any) => void)[];
  injectHead: ((config: any, pageContext: any, root?: string) => string | Promise<string>)[];
  injectBody: ((config: any, pageContext: any) => string | Promise<string>)[];
  onPostBuild: ((ctx: any) => Promise<void>)[];
  assets: (() => any[])[];
  translations: ((localeId: string) => Record<string, string>)[];
  actions: Record<string, ActionHandler>;
  events: Record<string, EventHandler>;

  // Lifecycle Hooks
  onConfigResolved: ((config: any) => void | Promise<void>)[];
  onDevServerReady: ((server: any, wss: any) => void | Promise<void>)[];
  onBeforeParse: ((src: string, frontmatter: any) => string | Promise<string>)[];
  onAfterParse: ((html: string, frontmatter: any) => string | Promise<string>)[];
  /** Called before template rendering. Receives full PageContext. */
  onBeforeRender: ((page: PageContext) => void | Promise<void>)[];
  onPageReady: ((page: any) => void | Promise<void>)[];
}
