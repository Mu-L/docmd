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

import { TUI } from '@docmd/api';
import { fsUtils as fs } from '@docmd/utils';
import path from 'path';
import readline from 'readline';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

const defaultConfigContent = `{
  "title": "My Documentation",
  "url": "https://docs.myproject.com",
  "src": "docs",
  "out": "site",
  "engine": "js",
  "layout": {
    "spa": true,
    "header": {
      "enabled": true
    },
    "sidebar": {
      "collapsible": true,
      "defaultCollapsed": false
    },
    "optionsMenu": {
      "position": "sidebar-top",
      "components": {
        "search": true,
        "themeSwitch": true
      }
    },
    "footer": {
      "style": "minimal",
      "content": "© My Project.",
      "branding": true
    }
  },
  "theme": {
    "name": "default",
    "appearance": "system",
    "codeHighlight": true
  },
  "minify": true,
  "autoTitleFromH1": true,
  "copyCode": true,
  "pageNavigation": true,
  "navigation": [
    { "title": "Introduction", "path": "/", "icon": "home" },
    {
      "title": "Getting Started",
      "icon": "rocket",
      "collapsible": false,
      "children": [
        { "title": "Installation", "path": "https://docs.docmd.io/getting-started/installation", "icon": "download", "external": true },
        { "title": "Configuration", "path": "https://docs.docmd.io/configuration/overview", "icon": "cog", "external": true }
      ]
    },
    { "title": "GitHub", "path": "https://github.com/docmd-io/docmd", "icon": "github", "external": true }
  ],
  "plugins": {
    "git": {
      "commitHistory": true,
      "maxCommits": 5
    },
    "seo": {
      "defaultDescription": "Documentation built with docmd."
    },
    "sitemap": {
      "defaultChangefreq": "weekly"
    }
  }
}
`;

const defaultIndexMdContent = `---
title: "Welcome"
description: "Welcome to your new documentation site."
---

# Welcome to Your Docs 🚀

Congratulations! You have successfully initialised a new **docmd** project.

## Quick Start

You are currently viewing \`docs/index.md\`.

\`\`\`bash
npm run dev   # Start the dev server
npm run build # Build for production
\`\`\`

## Features Demo

### 1. Smart Containers
::: callout tip "Did you know?"
You can nest containers, add custom titles, and use emojis! :tada:
:::

::: card "Flexible Structure"
Organise your content with cards.
::: button "View Documentation" https://docs.docmd.io
:::

### 2. Tabs & Code
::: tabs
== tab "JavaScript"
\`\`\`javascript
console.log('Hello World');
\`\`\`

== tab "Python"
\`\`\`python
print('Hello World')
\`\`\`
:::

### 3. Plugins (Enabled by Default)
- **Search**
- **Sitemap**
- **SEO Optimisation**
- **Git Integration**
- **Mermaid Diagrams**

## Next Steps
- **[Official Documentation](https://docs.docmd.io)**
- **[Customise Theme](https://docs.docmd.io/theming/available-themes)**
- **[Deploy Site](https://docs.docmd.io/deployment)**

Happy documenting! 🎉`;

const defaultPackageJson = {
  name: "my-docs",
  version: "0.0.1",
  private: true,
  type: "module",
  scripts: {
    "dev": "docmd dev",
    "build": "docmd build",
    "preview": "npx serve site"
  },
  dependencies: {
    "@docmd/core": `^${version}`
  }
};

export async function initProject() {
  const baseDir = process.cwd();
  const packageJsonFile = path.join(baseDir, 'package.json');
  const configFile = path.join(baseDir, 'docmd.config.json');
  const docsDir = path.join(baseDir, 'docs');
  const indexMdFile = path.join(docsDir, 'index.md');
  const assetsDir = path.join(baseDir, 'assets');
  const assetsCssDir = path.join(assetsDir, 'css');
  const assetsJsDir = path.join(assetsDir, 'js');
  const assetsImagesDir = path.join(assetsDir, 'images');

  const existingFiles = [];
  const dirExists = {
    docs: false,
    assets: false
  };

  TUI.section('Project Setup');

  // Check if package.json exists
  if (!await fs.pathExists(packageJsonFile)) {
    await fs.writeJson(packageJsonFile, defaultPackageJson, { spaces: 2 });
    TUI.step('Created package.json', 'DONE');
  } else {
    TUI.step('Using existing package.json', 'SKIP');
  }

  // Check each configuration file variant individually
  if (await fs.pathExists(configFile)) {
    existingFiles.push('docmd.config.json');
  }
  const jsConfigFile = path.join(baseDir, 'docmd.config.js');
  if (await fs.pathExists(jsConfigFile)) {
    existingFiles.push('docmd.config.js');
  }
  const tsConfigFile = path.join(baseDir, 'docmd.config.ts');
  if (await fs.pathExists(tsConfigFile)) {
    existingFiles.push('docmd.config.ts');
  }

  // Check for the legacy config.js
  const oldConfigFile = path.join(baseDir, 'config.js');
  if (await fs.pathExists(oldConfigFile)) {
    existingFiles.push('config.js');
  }

  // Check if docs directory exists
  if (await fs.pathExists(docsDir)) {
    dirExists.docs = true;
    if (await fs.pathExists(indexMdFile)) {
      existingFiles.push('docs/index.md');
    }
  }

  // Check if assets directory exists
  if (await fs.pathExists(assetsDir)) {
    dirExists.assets = true;
  }

  // Determine if we should override existing files
  let shouldOverride = false;
  if (existingFiles.length > 0) {
    TUI.warn('Existing files detected:');
    existingFiles.forEach(file => TUI.item('', file));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question(`\n ${TUI.bold('Do you want to override these files?')} (y/N): `, resolve);
    });

    rl.close();

    shouldOverride = (answer as string).toLowerCase() === 'y';

    if (!shouldOverride) {
      TUI.step('Maintaining existing files', 'SKIP');
    }
  }

  // Create docs directory if it doesn't exist
  if (!dirExists.docs) {
    await fs.ensureDir(docsDir);
    TUI.step('Created docs/ directory', 'DONE');
  } else {
    TUI.step('Using existing docs/ directory', 'SKIP');
  }

  // Create assets directory structure if it doesn't exist
  if (!dirExists.assets) {
    await fs.ensureDir(assetsDir);
    await fs.ensureDir(assetsCssDir);
    await fs.ensureDir(assetsJsDir);
    await fs.ensureDir(assetsImagesDir);
    TUI.step('Created assets/ infrastructure', 'DONE');
  } else {
    TUI.step('Using existing assets/ directory', 'SKIP');
    if (!await fs.pathExists(assetsCssDir)) await fs.ensureDir(assetsCssDir);
    if (!await fs.pathExists(assetsJsDir)) await fs.ensureDir(assetsJsDir);
    if (!await fs.pathExists(assetsImagesDir)) await fs.ensureDir(assetsImagesDir);
  }

  // Write config file if it doesn't exist or user confirmed override
  if (!await fs.pathExists(configFile) && !await fs.pathExists(jsConfigFile) && !await fs.pathExists(tsConfigFile) || shouldOverride) {
    await fs.writeFile(configFile, defaultConfigContent, 'utf8');
    TUI.step(`${shouldOverride ? 'Updated' : 'Created'} docmd.config.json`, 'DONE');
  } else {
    TUI.step('Using existing configuration', 'SKIP');
  }

  // Write index.md file if it doesn't exist or user confirmed override
  if (!await fs.pathExists(indexMdFile)) {
    await fs.writeFile(indexMdFile, defaultIndexMdContent, 'utf8');
    TUI.step('Created docs/index.md', 'DONE');
  } else if (shouldOverride) {
    await fs.writeFile(indexMdFile, defaultIndexMdContent, 'utf8');
    TUI.step('Updated docs/index.md', 'DONE');
  } else {
    TUI.step('Using existing docs/index.md', 'SKIP');
  }

  TUI.footer();
  TUI.success('Initialisation complete. Run `npm install` to setup dependencies.');
}