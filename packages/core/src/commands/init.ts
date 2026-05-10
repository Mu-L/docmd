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

const defaultConfigContent = `// docmd.config.js
export default defineConfig({
  // --- Core Metadata ---
  title: 'My Documentation',
  url: '', // e.g. https://mysite.com (Critical for SEO/Sitemap)

  // --- Branding ---
  logo: {
    light: 'assets/images/docmd-logo-dark.png',
    dark: 'assets/images/docmd-logo-light.png',
    alt: 'Logo',
    href: '/',
  },
  favicon: 'assets/favicon.ico',

  // --- Source & Output ---
  src: 'docs',
  out: 'site',

  // --- Layout & UI Architecture ---
  layout: {
    spa: true, // Enable seamless page transitions
    header: {
      enabled: true,
    },
    sidebar: {
      collapsible: true,
      defaultCollapsed: false,
    },
    optionsMenu: {
      position: 'sidebar-top', // 'menubar', 'header', 'sidebar-top', 'sidebar-bottom'
      components: {
        search: true,      
        themeSwitch: true, 
        sponsor: null,     
      }
    },
    footer: {
      style: 'minimal', // 'minimal' or 'complete'
      content: '© ' + new Date().getFullYear() + ' My Project.',
      branding: true    // Config for "Built with docmd" badge
    }
  },

  // --- Theme Settings ---
  theme: {
    name: 'default',        // Options: 'default', 'sky', 'ruby', 'retro'
    appearance: 'system',   // 'light', 'dark', or 'system'
    codeHighlight: true,    
    customCss: [],          
  },

  // --- General Features ---
  minify: true,           
  autoTitleFromH1: true,  
  copyCode: true,         
  pageNavigation: true,   
  
  customJs: [],           

  // --- Versioning (Optional) ---
  /*
  versions: {
    position: 'sidebar-top', // 'sidebar-top', 'sidebar-bottom'
    current: 'v2',
    all: [
      { id: 'v2',       // Unique identifier for this version (used in URLs) and matching current version
       dir: 'docs',     // Source directory for latest version
       label: 'v2.0 (Latest)'
      },
      { id: 'v1',
       dir: 'docs-v1',  // Source directory for older version
       label: 'v1.0'
      }
    ]
  },
  */

  // --- Navigation (Sidebar) ---
  navigation: [
    { title: 'Introduction', path: '/', icon: 'home' },
    {
      title: 'Getting Started',
      icon: 'rocket',
      collapsible: false,
      children: [
        { title: 'Installation', path: 'https://docs.docmd.io/getting-started/installation', icon: 'download', external: true },
        { title: 'Configuration', path: 'https://docs.docmd.io/configuration/general/', icon: 'cog', external: true },
      ],
    },
    { title: 'Live Editor', path: 'https://live.docmd.io', icon: 'play', external: true },
    { title: 'GitHub', path: 'https://github.com/docmd-io/docmd', icon: 'github', external: true },
  ],

  // --- Plugins ---
  plugins: {
    seo: {
      defaultDescription: 'Documentation built with docmd.',
      openGraph: { defaultImage: '' },
      twitter: { cardType: 'summary_large_image' }
    },
    sitemap: { defaultChangefreq: 'weekly' },
    analytics: { 
      googleV4: { measurementId: 'G-X9WTDL262N' } // Change the example GA ID with your own
    }
  },
  
  // --- Edit Link ---
  editLink: {
    enabled: false,
    baseUrl: 'https://github.com/USERNAME/REPO/edit/main/docs',
    text: 'Edit this page'
  }
});
`;

const defaultIndexMdContent = `---
title: "Welcome"
description: "Welcome to your new documentation site."
---

# Welcome to Your Docs 🚀

Congratulations! You have successfully initialized a new **docmd** project.

## Quick Start

You are currently viewing \`docs/index.md\`.

\`\`\`bash
npm start   # Start the dev server
docmd build # Build for production
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
- **Analytics**
- **Mermaid Diagrams**
- **LLMs (AI Integration)**

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
  const configFile = path.join(baseDir, 'docmd.config.js');
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

  // Check each file individually
  if (await fs.pathExists(configFile)) {
    existingFiles.push('docmd.config.js');
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
  if (!await fs.pathExists(configFile) || shouldOverride) {
    await fs.writeFile(configFile, defaultConfigContent, 'utf8');
    TUI.step(`${shouldOverride ? 'Updated' : 'Created'} docmd.config.js`, 'DONE');
  } else {
    TUI.step('Using existing docmd.config.js', 'SKIP');
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
  TUI.success('Initialization complete. Run `npm install` to setup dependencies.');
}