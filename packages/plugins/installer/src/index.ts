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

import fs from 'fs';
import path from 'path';
import { execSync, execFileSync } from 'child_process';

import { createRequire } from 'module';
import {
  detectConfigFormat,
  addPluginToJsonConfig,
  addPluginToPluginsBlock,
  removePluginFromJsonConfig,
  removePluginFromPluginsBlock
} from './config-editor.js';

const require = createRequire(import.meta.url);
const pluginsRegistry = require('../registry/plugins.json');

/**
 *
 * @param err            The thrown error from execFileSync.
 * @param cmdExe         The package-manager binary that was being spawned.
 * @param action         Human verb describing what was happening, e.g.
 *                       "install" or "remove". Used in the suggestion copy.
 * @param opts.verbose   If true, return the raw `err.message` so power
 *                       users can still see the full Node error.
 */
function formatSpawnError(err: any, cmdExe: string, action: string, opts: { verbose?: boolean } = {}): string {
  const isMissingBinary = err && err.code === 'ENOENT' &&
    typeof err.syscall === 'string' && err.syscall.startsWith('spawn');

  if (isMissingBinary) {
    const binary = err.path || cmdExe;

    // Special case: if the failing binary is a package manager but Node itself
    // is reachable, the issue is likely that docmd was launched through npx
    // and the spawned child process can't see the parent's PATH. Suggest
    // installing the plugin via the host package manager directly.
    const nodeReachable = (() => {
      try { require('child_process').execFileSync(process.execPath, ['--version'], { stdio: 'pipe' }); return true; }
      catch { return false; }
    })();
    const isPkgManager = /^(npm|pnpm|yarn|bun)(\.cmd)?$/i.test(path.basename(binary));

    if (nodeReachable && isPkgManager) {
      return [
        `Could not spawn ${binary} — it was not found on PATH when running through npx.`,
        ``,
        `This is a common issue when @docmd/core itself was launched via npx on`,
        `Windows or in restricted shells. Install the plugin directly using your`,
        `package manager, then run the build again:`,
        ``,
        `  npm install <package-name>`,
        ``,
        `If you still see this after a direct install, run with --verbose for the`,
        `full spawn error.`,
      ].join('\n');
    }

    return [
      `The package manager '${binary}' was not found on your system PATH.`,
      ``,
      `To fix it:`,
      `  1. Install ${binary} (e.g. \`npm install -g ${binary}\`, or use a`,
      `     Node version manager like nvm / volta / fnm)`,
      `  2. Verify it's reachable: \`${binary} --version\` should print a version`,
      `  3. Retry: \`npx @docmd/core ${action} <name>\``,
      ``,
      `If you just installed ${binary}, restart your terminal so the updated`,
      `PATH takes effect.`,
    ].join('\n');
  }

  if (opts.verbose && err && err.message) return err.message;
  return 'Run with --verbose for detailed logs.';
}

/**
 * Resolves the absolute path to a package-manager binary, falling back
 * to PATH lookup if not found next to Node.
 *
 * On Windows, `npm`/`pnpm`/`yarn` are `.cmd` shims that may not be on
 * PATH when `@docmd/core` is itself launched through `npx`. Since all
 * major package managers ship their CLI scripts in Node's install
 * directory (e.g. `node_modules/npm/bin/npm-cli.js`), resolving from
 * `process.execPath` works reliably across all platforms and invocation
 * methods (including `npx`).
 */
function resolvePackageManagerBin(name: string): string {
  const nodeDir = path.dirname(process.execPath);

  // Candidate scripts to look for, in priority order.
  const candidates: Record<string, string[]> = {
    npm:  ['npm-cli.js', `npm${process.platform === 'win32' ? '.cmd' : ''}`],
    pnpm: ['pnpm.js', `pnpm${process.platform === 'win32' ? '.cmd' : ''}`],
    yarn: ['yarn.js', `yarn${process.platform === 'win32' ? '.cmd' : ''}`],
    bun:  ['bun.js', `bun${process.platform === 'win32' ? '.cmd' : ''}`],
  };

  const files = candidates[name] || [name];

  // 1. Look next to the running Node binary (npm ships here, pnpm global does too).
  for (const file of files) {
    const candidate = path.join(nodeDir, file);
    if (fs.existsSync(candidate)) return candidate;
  }

  // 2. Look in Node's lib/node_modules (npm/pnpm install here on most setups).
  const libModules = path.join(nodeDir, 'lib', 'node_modules');
  for (const file of files) {
    const candidate = path.join(libModules, name, file === `${name}.cmd` ? 'bin' : 'bin', file);
    if (fs.existsSync(candidate)) return candidate;
  }

  // 3. Last resort: return the bare name and let PATH resolve it.
  return files[files.length - 1];
}

/**
 * Detects the package manager used in the current project by looking for lockfiles upwards.
 * Defaults to 'npm' if no lockfile is found.
 */
function getPackageManager(cwd) {
  let dir = cwd;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(dir, 'bun.lockb'))) return 'bun';
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) return 'npm';
    dir = path.dirname(dir);
  }
  return 'npm';
}

/**
 * Resolves the project's config file path. Phase 3 PR 3.B (M-3):
 * checks all five supported formats in preference order (JSON > JS >
 * MJS > CJS > TS) and falls back to JSON when no config exists.
 *
 * The previous implementation only looked at `.json` and `.js`, so a
 * project with `docmd.config.ts` would silently scaffold a new
 * `docmd.config.json` instead of editing the existing TS file.
 */
function resolveConfigPath(cwd) {
  const candidates = [
    'docmd.config.json',
    'docmd.config.js',
    'docmd.config.mjs',
    'docmd.config.cjs',
    'docmd.config.ts'
  ];
  for (const name of candidates) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) return p;
  }
  return path.join(cwd, 'docmd.config.json');
}

function detectConfigFormatLegacy(configPath) {
  return configPath.endsWith('.json') ? 'json' : 'js';
}

/**
 * Resolves plugin metadata from the registry, or builds a fallback object.
 */
function resolvePluginMeta(name) {
  if (pluginsRegistry[name]) {
    return pluginsRegistry[name];
  }
  
  throw new Error(`Plugin "${name}" not found in the official registry. For custom plugins, please install via your package manager and configure manually.`);
}

/**
 * Reads config and safely injects the plugin to the `plugins` object.
 *
 * Phase 3 PR 3.B (F7 + M-3): replaced the legacy regex-based injector
 * (which only matched `module.exports = { ... }` and silently no-op'd
 * for `export default defineConfig({...})` configs) with the
 * brace-balanced scanner in `./config-editor.js`. JSON configs are
 * handled via `JSON.parse` for full safety; JS / TS / MJS / CJS
 * configs use a scanner that finds the `plugins:` block by
 * brace-balancing and adds the entry while preserving the existing
 * indentation and trailing-comma style.
 */
function injectPluginToConfig(configPath, meta) {
  const configKey = meta.configKey;
  const valueText = meta.defaultConfig || '{}';

  let content = '';
  if (fs.existsSync(configPath)) {
    content = fs.readFileSync(configPath, 'utf8');
  } else {
    // Scaffold a minimal config in the matching format.
    const fmt = detectConfigFormat(configPath);
    if (fmt === 'json') {
      content = '{\n  "plugins": {}\n}\n';
    } else if (fmt === 'mjs' || fmt === 'ts') {
      content = "export default {\n  plugins: {}\n};\n";
    } else {
      content = "module.exports = {\n  plugins: {}\n};\n";
    }
  }

  const fmt = detectConfigFormat(configPath);
  let result: { newContent: string; changed: boolean };
  if (fmt === 'json') {
    result = addPluginToJsonConfig(content, configKey, valueText);
  } else {
    result = addPluginToPluginsBlock(content, configKey, valueText);
  }

  if (!result.changed) {
    return false; // Already present
  }

  fs.writeFileSync(configPath, result.newContent, 'utf8');
  return true;
}

/**
 * Removes the plugin from the config file. Phase 3 PR 3.B (F7) fix:
 * the legacy regex only matched CJS-style configs; the brace-balanced
 * scanner handles all five supported formats.
 */
function removePluginFromConfig(configPath, meta) {
  if (!fs.existsSync(configPath)) return false;

  const content = fs.readFileSync(configPath, 'utf8');
  const configKey = meta.configKey;
  const fmt = detectConfigFormat(configPath);

  let result: { newContent: string; changed: boolean };
  if (fmt === 'json') {
    result = removePluginFromJsonConfig(content, configKey);
  } else {
    result = removePluginFromPluginsBlock(content, configKey);
  }

  if (!result.changed) {
    return false; // Not present
  }

  fs.writeFileSync(configPath, result.newContent, 'utf8');
  return true;
}

/**
 * Sets `theme.template` in the config. Replaces any existing template value.
 * Returns true if a change was made. Handles both JSON and JS config formats.
 * Templates do NOT stack — re-running with a different template overwrites.
 */
function injectTemplateToConfig(configPath, meta) {
  const format = detectConfigFormat(configPath);
  const templateName = meta.templateName || meta.configKey;

  let content = '';
  if (fs.existsSync(configPath)) {
    content = fs.readFileSync(configPath, 'utf8');
  } else {
    content = format === 'json'
      ? '{\n  "theme": {}\n}\n'
      : 'module.exports = {\n  theme: {}\n};\n';
  }

  if (format === 'json') {
    let config;
    try { config = JSON.parse(content); }
    catch (err) {
      TUI.warn(`Could not parse ${configPath} as JSON. Skipping template injection.`);
      return false;
    }
    config.theme = config.theme || {};
    if (config.theme.template === templateName) return false;
    config.theme.template = templateName;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    return true;
  }

  // JS config (regex-based, matching the existing plugin injector)
  const escaped = templateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`template\\s*:\\s*['"\`]${escaped}['"\`]`).test(content)) return false;

  const themeRegex = /theme\s*:\s*\{([\s\S]*?)\}/;
  const themeMatch = content.match(themeRegex);

  if (themeMatch) {
    const inner = themeMatch[1];
    let newInner;
    if (/template\s*:/.test(inner)) {
      // Replace existing `template: "..."` value
      newInner = inner.replace(/template\s*:\s*['"`][^'"`]*['"`]/, `template: "${templateName}"`);
    } else {
      const trimmed = inner.trim();
      if (trimmed === '') {
        newInner = `\n    template: "${templateName}"\n  `;
      } else {
        // Strip trailing whitespace + optional comma, then add comma + template
        const stripped = inner.replace(/[\s,]+$/, '');
        newInner = `${stripped},\n    template: "${templateName}"\n  `;
      }
    }
    content = content.replace(themeMatch[0], `theme: {${newInner}}`);
  } else {
    // No `theme: { ... }` yet — create one in module.exports
    const moduleExportsRegex = /module\.exports\s*=\s*(?:defineConfig\()?\{([\s\S]*?)\}(?:\))?;?/g;
    let matchE, lastMatch;
    while ((matchE = moduleExportsRegex.exec(content)) !== null) lastMatch = matchE;
    if (lastMatch) {
      const closingBraceIndex = lastMatch.index + lastMatch[0].lastIndexOf('}');
      const prefixRaw = content.substring(0, closingBraceIndex);
      const suffix = content.substring(closingBraceIndex);
      // Strip trailing whitespace from prefix so the separator lands cleanly after the last value
      const prefix = prefixRaw.replace(/\s+$/, '');
      const lastChar = prefix.slice(-1);
      const separator = (lastChar === ',' || lastChar === '{') ? '\n  ' : ',\n  ';
      const insert = `${separator}theme: {\n    template: "${templateName}"\n  }\n`;
      content = prefix + insert + suffix;
    } else {
      TUI.warn(`Could not automatically inject template into ${configPath}. Please set theme.template = "${templateName}" manually.`);
      return false;
    }
  }

  fs.writeFileSync(configPath, content, 'utf8');
  return true;
}

/**
 * Clears `theme.template` from the config (reverts to default).
 * Returns true if a change was made.
 */
function removeTemplateFromConfig(configPath) {
  if (!fs.existsSync(configPath)) return false;
  const format = detectConfigFormat(configPath);
  const content = fs.readFileSync(configPath, 'utf8');

  if (format === 'json') {
    let config;
    try { config = JSON.parse(content); }
    catch { return false; }
    if (!config.theme || !('template' in config.theme)) return false;
    delete config.theme.template;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    return true;
  }

  // JS config
  if (!/template\s*:/.test(content)) return false;
  const newContent = content.replace(/\s*template\s*:\s*['"`][^'"`]*['"`]\s*,?\s*/, '');
  if (content === newContent) return false;
  fs.writeFileSync(configPath, newContent, 'utf8');
  return true;
}


import { TUI } from '@docmd/api';

async function installPlugin(pluginInput: string, opts: { verbose?: boolean } = {}) {
  const cwd = process.cwd();
  const pkgManager = getPackageManager(cwd);
  
  let meta;
  try {
    meta = resolvePluginMeta(pluginInput);
  } catch (err: any) {
    TUI.error('Installation Aborted', err.message);
    return;
  }
  const packageName = meta.package;
  const isTemplate = meta.kind === 'template';

  TUI.section(isTemplate ? 'Template Installation' : 'Plugin Installation');
  TUI.step(`Installing ${packageName} via ${pkgManager}`, 'WAIT');

  let cmdExe = '';
  let cmdArgs: string[] = [];
  if (pkgManager === 'npm') { cmdExe = resolvePackageManagerBin('npm'); cmdArgs = ['install', packageName]; }
  else if (pkgManager === 'yarn') { cmdExe = resolvePackageManagerBin('yarn'); cmdArgs = ['add', packageName]; }
  else if (pkgManager === 'pnpm') { cmdExe = resolvePackageManagerBin('pnpm'); cmdArgs = ['add', packageName]; }
  else if (pkgManager === 'bun') { cmdExe = resolvePackageManagerBin('bun'); cmdArgs = ['add', packageName]; }

  if (pkgManager === 'npm' && !fs.existsSync(path.join(cwd, 'package.json'))) {
    cmdArgs.push('--no-save');
  }

  try {
    const stdioMode = opts.verbose ? 'inherit' : 'pipe';
    execFileSync(cmdExe, cmdArgs, { stdio: stdioMode, cwd });
    
    TUI.step(packageName, 'DONE');
    
    const configPath = resolveConfigPath(cwd);
    TUI.divider('Configuration');

    let injected;
    if (isTemplate) {
      TUI.step(`Setting theme.template to "${meta.configKey}"`, 'WAIT', TUI.blue);
      injected = injectTemplateToConfig(configPath, meta);
    } else {
      TUI.step(`Activating ${meta.configKey}`, 'WAIT', TUI.blue);
      injected = injectPluginToConfig(configPath, meta);
    }
    if (injected) {
      TUI.step(isTemplate ? 'Template activated' : 'Activation completed', 'DONE', TUI.blue);
    } else {
      TUI.step(isTemplate ? 'Template already configured' : 'Plugin already configured', 'SKIP', TUI.blue);
    }
    TUI.footer();
    TUI.success(isTemplate ? 'Template successfully installed and activated.' : 'Plugin successfully installed and activated.');

  } catch (err: any) {
    TUI.step(packageName, 'FAIL');
    TUI.footer();
    TUI.error(`Could not install ${packageName}`, formatSpawnError(err, cmdExe, 'add', opts));
  }
}

async function removePlugin(pluginInput: string, opts: { verbose?: boolean } = {}) {
  const cwd = process.cwd();
  const pkgManager = getPackageManager(cwd);

  let meta;
  try {
    meta = resolvePluginMeta(pluginInput);
  } catch (err: any) {
    TUI.error('Removal Aborted', err.message);
    // Phase 3 PR 3.A (F6): exit 1 so CI pipelines can gate on the
    // documented "Removal Aborted" failure path. Previously this
    // `return` left the process at exit code 0, silently passing a
    // failed removal.
    process.exit(1);
  }
  const packageName = meta.package;
  const isTemplate = meta.kind === 'template';

  TUI.section(isTemplate ? 'Template Removal' : 'Plugin Removal');
  TUI.step(`Uninstalling ${packageName} via ${pkgManager}`, 'WAIT');

  let cmdExe = '';
  let cmdArgs: string[] = [];
  if (pkgManager === 'npm') { cmdExe = 'npm'; cmdArgs = ['uninstall', packageName]; }
  else if (pkgManager === 'yarn') { cmdExe = 'yarn'; cmdArgs = ['remove', packageName]; }
  else if (pkgManager === 'pnpm') { cmdExe = 'pnpm'; cmdArgs = ['remove', packageName]; }
  else if (pkgManager === 'bun') { cmdExe = 'bun'; cmdArgs = ['remove', packageName]; }

  try {
    const stdioMode = opts.verbose ? 'inherit' : 'pipe';
    execFileSync(cmdExe, cmdArgs, { stdio: stdioMode, cwd });
    
    TUI.step(packageName, 'DONE');
    
    const configPath = resolveConfigPath(cwd);
    TUI.divider('Configuration');

    let removed;
    if (isTemplate) {
      TUI.step('Clearing theme.template', 'WAIT', TUI.blue);
      removed = removeTemplateFromConfig(configPath);
    } else {
      TUI.step(`Removing ${meta.configKey}`, 'WAIT', TUI.blue);
      removed = removePluginFromConfig(configPath, meta);
    }
    if (removed) {
      TUI.step('Cleanup completed', 'DONE', TUI.blue);
    } else {
      TUI.step('No config entry found', 'SKIP', TUI.blue);
    }
    TUI.footer();
    TUI.success(isTemplate ? 'Template successfully uninstalled.' : 'Plugin successfully uninstalled.');

  } catch (err: any) {
    TUI.step(packageName, 'FAIL');
    TUI.footer();
    TUI.error(`Could not remove ${packageName}`, formatSpawnError(err, cmdExe, 'remove', opts));
  }
}

export {
  installPlugin,
  removePlugin
};