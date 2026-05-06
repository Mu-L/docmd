/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import type { PluginDescriptor } from '@docmd/api';

export const plugin: PluginDescriptor = {
  name: 'git',
  version: '0.7.9',
  capabilities: ['build', 'body', 'assets', 'translations', 'head']
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.resolve(__dirname, '..', 'i18n');

// Cache for git data to avoid repeated shell calls
const gitCache = new Map<string, GitFileInfo>();

// Track if we're in a git repo (checked once per build)
let _isGitRepoChecked = false;
let _isGitRepo = false;
let _gitRootPath: string | null = null;

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  timestamp: number;
  message: string;
  avatarUrl: string;
}

export interface GitFileInfo {
  lastUpdated: string;
  lastUpdatedTimestamp: number;
  commits: GitCommit[];
}

/**
 * Check if the project is inside a git repository.
 * Uses process.cwd() as the project root.
 */
function checkGitRepo(cwd?: string): boolean {
  if (_isGitRepoChecked) return _isGitRepo;
  
  const checkDir = cwd || process.cwd();
  
  try {
    const result = execSync('git rev-parse --show-toplevel', { 
      cwd: checkDir, 
      stdio: 'pipe', 
      encoding: 'utf8' 
    }).trim();
    _isGitRepo = true;
    _gitRootPath = result;
  } catch {
    _isGitRepo = false;
    _gitRootPath = null;
  }
  
  _isGitRepoChecked = true;
  return _isGitRepo;
}

/**
 * Get the git root path.
 */
function getGitRoot(): string | null {
  checkGitRepo();
  return _gitRootPath;
}

/**
 * Check if git is available on the system.
 */
function isGitAvailable(): boolean {
  try {
    execSync('git --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get git information for a specific file.
 * Uses process.cwd() as the git root to handle monorepo/workspace setups.
 */
function getGitFileInfo(filePath: string, maxCommits: number = 6): GitFileInfo | null {
  // Use process.cwd() as the project root - this is where docmd runs from
  const projectRoot = process.cwd();
  
  // Quick exit if not in a git repo
  if (!checkGitRepo(projectRoot)) {
    return null;
  }

  // Check cache first
  const cacheKey = filePath;
  if (gitCache.has(cacheKey)) {
    return gitCache.get(cacheKey)!;
  }

  try {
    // Always run git log from the git root with a root-relative path.
    // Running from a subdirectory causes git to scope history to that
    // subtree only, which can return repo-wide commits instead of
    // file-specific ones when the path resolves unexpectedly.
    const gitRoot = _gitRootPath || projectRoot;
    const relPath = path.relative(gitRoot, filePath).replace(/\\/g, '/');

    if (!relPath || relPath.startsWith('..')) {
      // File is outside the git root — skip
      return null;
    }

    // Get commit history using the root-relative path from the git root
    const logOutput = execSync(
      `git log -n ${maxCommits} --format="%H|%h|%an|%ae|%at|%s" -- "${relPath}"`,
      { cwd: gitRoot, stdio: 'pipe', encoding: 'utf8' }
    ).trim();

    if (!logOutput) {
      return null;
    }

    const commits: GitCommit[] = logOutput.split('\n').filter(Boolean).map((line: string) => {
      const [hash, shortHash, author, email, timestamp, ...messageParts] = line.split('|');
      const ts = parseInt(timestamp, 10) * 1000;
      const hashEmail = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
      return {
        hash,
        shortHash,
        author,
        email,
        date: new Date(ts).toISOString(),
        timestamp: ts,
        message: messageParts.join('|'), // In case message contains |
        avatarUrl: `https://www.gravatar.com/avatar/${hashEmail}?d=mp&s=64`
      };
    });

    if (commits.length === 0) {
      return null;
    }

    const info: GitFileInfo = {
      lastUpdated: commits[0]?.date || '',
      lastUpdatedTimestamp: commits[0]?.timestamp || 0,
      commits
    };

    gitCache.set(cacheKey, info);
    return info;
  } catch {
    return null;
  }
}

/**
 * Format a timestamp for display.
 * Uses relative time for recent updates, absolute for older ones.
 */
function formatLastUpdated(timestamp: number, locale: string = 'en'): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  // For very recent updates, show relative time
  if (days < 1) {
    if (hours >= 1) {
      return `${hours}h ago`;
    }
    if (minutes >= 1) {
      return `${minutes}m ago`;
    }
    return 'just now';
  }
  
  if (days < 7) {
    return `${days}d ago`;
  }

  // For older updates, show date
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Load translation strings for a given locale.
 */
function loadPluginStrings(localeId: string): Record<string, string> {
  try {
    const localePath = path.join(i18nDir, `${localeId}.json`);
    if (fs.existsSync(localePath)) {
      return JSON.parse(fs.readFileSync(localePath, 'utf8'));
    }
  } catch { /* fallback below */ }
  try {
    const enPath = path.join(i18nDir, 'en.json');
    if (fs.existsSync(enPath)) {
      return JSON.parse(fs.readFileSync(enPath, 'utf8'));
    }
  } catch { /* silent */ }
  return {};
}

/**
 * Plugin translations hook.
 */
export function translations(localeId: string): Record<string, string> {
  return loadPluginStrings(localeId || 'en');
}

/**
 * Build hook: Reset caches at the start of each build.
 */
export function onBeforeParse({ config }: any): void {
  // Clear all caches at the start of each build
  gitCache.clear();
  _isGitRepoChecked = false;
  _isGitRepo = false;
  _gitRootPath = null;
}

/**
 * Page ready hook: no-op for git plugin.
 * Data is injected via generateMetaTags (runs before template render).
 * This hook is kept for API completeness and future post-render use.
 */
export async function onPageReady(_ctx: any): Promise<void> {
  // intentionally empty - git data injected in generateMetaTags
}

/**
 * Inject git data into page context BEFORE template rendering.
 * This ensures the data is available when the template is rendered.
 * Uses the 'head' capability which runs during render.
 */
export function generateMetaTags(config: any, pageContext: any, _relativePathToRoot: string): string {
  const sourcePath = pageContext?.sourcePath;
  if (!sourcePath) return '';
  
  // Skip if not in a git repo
  if (!checkGitRepo(path.dirname(sourcePath))) {
    return '';
  }
  
  const gitInfo = getGitFileInfo(sourcePath);
  if (!gitInfo || !pageContext?.frontmatter) {
    return '';
  }
  
  // Inject git data into frontmatter BEFORE rendering
  pageContext.frontmatter._git = gitInfo;
  
  return '';
}

/**
 * Generate scripts to inject git i18n strings for the client widget.
 */
export function generateScripts(config: any, options?: any): { headScriptsHtml: string; bodyScriptsHtml: string } {
  const gitConfig = {
    repo: options?.repo || config.editLink?.baseUrl || null,
    branch: options?.branch || 'main',
    editLink: options?.editLink !== false && !!(options?.repo || config.editLink?.baseUrl),
    lastUpdated: options?.lastUpdated !== false,
    commitHistory: options?.commitHistory !== false,
    maxCommits: options?.maxCommits || 5,
    dateFormat: options?.dateFormat || 'relative'
  };

  const localeId = config._activeLocale?.id || 'en';
  const i18nStrings = JSON.stringify(loadPluginStrings(localeId));

  return {
    headScriptsHtml: '',
    bodyScriptsHtml: `<script>window.__git_config=${JSON.stringify(gitConfig)};window.__git_i18n=${i18nStrings}</script>`
  };
}

/**
 * Provide client-side assets.
 * Always returns assets - client-side JS handles graceful degradation.
 */
export function getAssets(_options?: any): any[] {
  // Always include assets - client-side JS handles visibility based on git status
  const distDir = path.resolve(__dirname, '..', 'dist', 'client');
  return [
    {
      src: path.join(distDir, 'git-widget.js'),
      dest: 'assets/js/docmd-git.js',
      type: 'js',
      location: 'body',
      attributes: { type: 'module' }
    },
    {
      src: path.join(distDir, 'git-widget.css'),
      dest: 'assets/css/docmd-git.css',
      type: 'css',
      location: 'head'
    }
  ];
}

export { getGitFileInfo, formatLastUpdated, checkGitRepo as isGitRepo };
