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
 * Resolves the project's config file path. Prefers docmd.config.json
 * (the project standard), falls back to docmd.config.js for legacy
 * projects, and defaults to docmd.config.json when no config exists yet.
 */
function resolveConfigPath(cwd) {
  const jsonPath = path.join(cwd, 'docmd.config.json');
  const jsPath = path.join(cwd, 'docmd.config.js');
  if (fs.existsSync(jsonPath)) return jsonPath;
  if (fs.existsSync(jsPath)) return jsPath;
  return jsonPath;
}

function detectConfigFormat(configPath) {
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
 */
function injectPluginToConfig(configPath, meta) {
  let content = '';
  if (fs.existsSync(configPath)) {
    content = fs.readFileSync(configPath, 'utf8');
  } else {
    // Scaffold minimal config if missing
    content = `module.exports = {\n  plugins: {}\n};\n`;
  }

  // Strip comments to avoid false positives (e.g., `// analytics: {}`)
  const strippedContent = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  const configKey = meta.configKey;

  // Check if plugin is already inside
  if (strippedContent.includes(`'${configKey}'`) || strippedContent.includes(`"${configKey}"`) || strippedContent.includes(`\`${configKey}\``) || strippedContent.includes(`${configKey}:`)) {
    return false; // Already installed
  }

  // Look for `plugins: {`
  const pluginsRegex = /plugins\s*:\s*\{/;
  const match = content.match(pluginsRegex);

  // Dynamically format multi-line configs to match indentation
  const formattedConfig = meta.defaultConfig.replace(/\n/g, '\n    ');
  const injectStr = `'${configKey}': ${formattedConfig}`;

  if (match) {
    content = content.replace(pluginsRegex, `plugins: {\n    ${injectStr},`);
  } else {
    // If there's no plugins object, we can try to inject it before the last closing brace
    const moduleExportsRegex = /module\.exports\s*=\s*(?:defineConfig\()?\{([\s\S]*?)\}(?:\))?;?/g;
    let matchE;
    let lastMatch;
    while ((matchE = moduleExportsRegex.exec(content)) !== null) {
      lastMatch = matchE;
    }
    if (lastMatch) {
      const closingBraceIndex = lastMatch.index + lastMatch[0].lastIndexOf('}');
      const prefix = content.substring(0, closingBraceIndex);
      const suffix = content.substring(closingBraceIndex);
      
      const insert = prefix.trim().endsWith(',') || prefix.trim().endsWith('{') ? 
        `\n  plugins: {\n    ${injectStr}\n  }\n` : 
        `,\n  plugins: {\n    ${injectStr}\n  }\n`;
        
      content = prefix + insert + suffix;
    } else {
      TUI.warn(`Could not automatically inject plugin into config file. Please add '${configKey}': ${meta.defaultConfig} manually to the plugins object.`);
      return false;
    }
  }

  fs.writeFileSync(configPath, content, 'utf8');
  return true;
}

/**
 * Removes the plugin from the config file.
 */
function removePluginFromConfig(configPath, meta) {
  if (!fs.existsSync(configPath)) return false;

  const content = fs.readFileSync(configPath, 'utf8');
  const configKey = meta.configKey;
  const escapedKey = configKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (!content.includes(configKey)) {
    return false;
  }

  // This regex handles both multiline well-formatted configs, and poorly formatted tight inline configs 
  // generated by the scaffolding fallback e.g. `'search': {},}`
  const re1 = new RegExp(`\\s*['"\`]?${escapedKey}['"\`]?\\s*:\\s*\\{[^}]*\\}\\s*,?\\s*`, 'gm');
  
  // Replace active entries with empty string
  const newContent = content.replace(re1, '');

  if (content === newContent) {
    return false; // Regex didn't match (e.g. config differs from expected format)
  }

  fs.writeFileSync(configPath, newContent, 'utf8');
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
  if (pkgManager === 'npm') { cmdExe = 'npm'; cmdArgs = ['install', packageName]; }
  else if (pkgManager === 'yarn') { cmdExe = 'yarn'; cmdArgs = ['add', packageName]; }
  else if (pkgManager === 'pnpm') { cmdExe = 'pnpm'; cmdArgs = ['add', packageName]; }
  else if (pkgManager === 'bun') { cmdExe = 'bun'; cmdArgs = ['add', packageName]; }

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
    return;
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