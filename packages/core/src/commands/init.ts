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
      "content": "© ${new Date().getFullYear()} My Project.",
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
npx @docmd/core dev   # Start the dev server
npx @docmd/core build # Build for production
\`\`\`

## Features Demo

### 1. Smart Containers
::: callout tip "Did you know?"
You can nest containers, add custom titles, and use emojis! :tada:
:::

::: card "Flexible Structure"
Organise your content with cards.

[View the docs →](https://docmd.io){.docmd-button}
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
- **LLMs Context**

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

const defaultSkillContent = `# docmd AI Agent Skill (SKILL.md)

You are an expert documentation AI agent equipped to build, manage, and author docs using \`docmd\`. Follow these guidelines, syntax references, configuration rules, and plugin configurations precisely.

---

## 1. Installation, Setup & CLI Commands

### Installing docmd
- **Add to a project**: \`npm install @docmd/core\` or \`pnpm add @docmd/core\`
- **Global / Runner execution**: \`npx @docmd/core <command>\`

### CLI Commands
- \`docmd init\`
  Initialise a new documentation workspace, generating \`package.json\`, \`docmd.config.json\`, \`docs/index.md\`, and this \`SKILL.md\` file.
- \`docmd build\`
  Compile documentation files into the production-ready static site under the output folder (default: \`site/\`).
- \`docmd dev\`
  Start the local hot-reloading development server (default: \`http://localhost:3000\`).
- \`docmd live\`
  Launch the local interactive visual Live Editor.
- \`docmd validate [--json]\`
  Lint and check all internal markdown files, relative links, and image links. \`--json\` produces machine-readable JSON errors.
- \`docmd mcp\`
  Start the Model Context Protocol (MCP) server over stdio for direct agent interactions.
- \`docmd add <plugin>\` / \`docmd remove <plugin>\`
  Install or remove official docmd plugins.

---

## 2. Zero-Config & File Layout Heuristics

\`docmd\` maps folders and files directly to the routing tree:
- **Source Folder**: Default is \`docs/\` in the project root. Other candidates include \`src/docs\`, \`documentation\`, or \`content\`.
- **Routing**: Folder structures generate sidebars automatically.
- **Index Pages**: \`index.md\` or \`README.md\` acts as the directory's index page.
- **Version Routing**: Folders matching \`v[0-9]+.*\` (e.g., \`docs/v0.8/\`, \`docs/v1.0/\`) are auto-routed as version namespaces.
- **Locale Routing**: Folders matching ISO 639-1 language codes (e.g., \`docs/v0.8/en/\`, \`docs/v0.8/zh/\`) are auto-routed as translation spaces.

---

## 3. Configuration System (\`docmd.config.json\`)

The \`docmd.config.json\` file specifies how documentation is structured and generated. The full schema structure and keys are detailed below:

\`\`\`json
{
  "title": "My Documentation",
  "description": "Project documentation description.",
  "url": "https://docs.myproject.com",
  "src": "docs",
  "out": "site",
  "base": "/",
  "logo": {
    "light": "/assets/images/logo-light.svg",
    "dark": "/assets/images/logo-dark.svg",
    "alt": "My App Logo"
  },
  "layout": {
    "spa": true,
    "header": { "enabled": true },
    "sidebar": {
      "enabled": true,
      "collapsible": true,
      "defaultCollapsed": false,
      "position": "left"
    },
    "footer": {
      "style": "minimal",
      "content": "Copyright © 2026",
      "branding": true
    }
  },
  "optionsMenu": {
    "position": "header",
    "components": {
      "search": true,
      "themeSwitch": true,
      "sponsor": "https://github.com/sponsors/my-profile"
    }
  },
  "theme": {
    "name": "default",
    "appearance": "system",
    "customCss": []
  },
  "customJs": [],
  "navigation": [
    { "text": "Getting Started", "url": "/getting-started" },
    {
      "text": "Guides",
      "items": [
        { "text": "Advanced Setup", "url": "/guides/advanced" }
      ]
    }
  ],
  "versions": {
    "current": "v1.0",
    "position": "sidebar-top",
    "all": [
      { "id": "v1.0", "dir": "docs/v1.0", "label": "Version 1.0" },
      { "id": "v0.8", "dir": "docs/v0.8", "label": "Version 0.8" }
    ]
  },
  "i18n": {
    "default": "en",
    "position": "options-menu",
    "locales": [
      { "id": "en", "label": "English" },
      { "id": "de", "label": "Deutsch" }
    ]
  },
  "redirects": {
    "/old-url": "/new-url"
  },
  "plugins": {
    "git": { "commitHistory": true }
  }
}
\`\`\`

### Configuration Field reference
- **\`title\`**: Title of the documentation website, injected into meta tags and headers.
- **\`description\`**: Default meta description for pages.
- **\`url\`**: Production domain URL of the built documentation.
- **\`src\`**: Input directory containing markdown source files (defaults to \`docs\`).
- **\`out\`**: Output directory where built HTML files are output (defaults to \`site\`).
- **\`base\`**: Base URL path prefix (useful for GitHub Pages routing).
- **\`logo\`**: Path to light/dark versions of the project logo.
- **\`layout\`**: Structural layout parameters (SPA navigation options, header configuration, sidebar positions).
- **\`optionsMenu\`**: Configuration of options components (Theme toggle, Sponsor link, Search toggle).
- **\`theme\`**: Specifies theme name, default appearance (\`light\` / \`dark\` / \`system\`), and custom stylesheet files.
- **\`navigation\`**: Static custom sidebar navigation tree definition (if not using auto-routing).
- **\`versions\`**: Configures multi-version documentation subdirectories.
- **\`i18n\`**: Configures localized language directories and fallback behaviors.
- **\`redirects\`**: Key-value mapping of SEO redirection URLs.

---

## 4. Plugin System & Configuration

Plugins are registered under the \`"plugins"\` key in \`docmd.config.json\`.

### 1. Git (\`git\`)
Shows page modification times and commit logs.
\`\`\`json
"git": {
  "repo": "https://github.com/username/repo", // Repository base URL
  "branch": "main",                         // Default git branch
  "editLink": true,                         // Enable/disable 'Edit this page' link
  "lastUpdated": true,                      // Enable last updated metadata
  "commitHistory": true,                    // Enable display of commit list
  "maxCommits": 5,                          // Max commits shown per page
  "dateFormat": "relative"                  // 'relative' or 'absolute' date display
}
\`\`\`

### 2. OpenAPI (\`openapi\`)
Renders swagger/OpenAPI json/yaml specification specs directly inside fenced blocks.
\`\`\`json
"openapi": {
  "info": true,                             // Render title & info block
  "collapsible": true,                      // Make endpoints collapsible
  "download": true                          // Provide download schema link
}
\`\`\`

### 3. Search (\`search\`)
Keyword matching or vector similarity search indexing.
\`\`\`json
"search": {
  "semantic": true,                         // Enable AI semantic vector search
  "model": "Xenova/all-MiniLM-L6-v2",       // Vector embedding model name
  "include": ["**/*.md"],                   // Glob patterns to index
  "exclude": ["**/.git/**"],                // Glob patterns to ignore
  "showConfidence": false,                  // Show match scores in search UI
  "showFilters": true                       // Show version filtering tags
}
\`\`\`

### 4. Mermaid (\`mermaid\`)
Mermaid diagram renderer.
\`\`\`json
"mermaid": {
  "theme": "default"                        // 'default', 'forest', 'dark', 'neutral'
}
\`\`\`

### 5. Analytics (\`analytics\`)
Integrates analytics trackers.
\`\`\`json
"analytics": {
  "provider": "google",                     // 'google', 'plausible', 'custom'
  "id": "G-XXXXXXXXXX"                      // Tracking measurement ID
}
\`\`\`

### 6. PWA (\`pwa\`)
Offline worker installation metadata.
\`\`\`json
"pwa": {
  "enabled": true,                          // Enable Service Worker generation
  "name": "Documentation App",              // Full app name
  "shortName": "Docs"                       // Short app label
}
\`\`\`

### 7. SEO (\`seo\`)
Page header metadata generator.
\`\`\`json
"seo": {
  "titleTemplate": "%s | Project Docs",     // Format pattern for page titles
  "description": "Fallback page desc",      // Meta description fallback
  "ogImage": "/assets/og.png"               // Social preview image URL
}
\`\`\`

### 8. Sitemap (\`sitemap\`)
Generates search engine sitemaps.
\`\`\`json
"sitemap": {
  "url": "https://docs.myproject.com"       // Site url prefix
}
\`\`\`

### 9. Math (\`math\`)
LaTeX equations formatting.
\`\`\`json
"math": {
  "katex": {}                               // Custom parameters passed to KaTeX
}
\`\`\`

### 10. Threads (\`threads\`)
Timeline comments and discussion threads.
\`\`\`json
"threads": {
  "comments": true,                         // Enable discussion comments
  "storage": "local"                        // 'local' or remote database backend
}
\`\`\`

---

## 5. Custom Plugins (Developer Guide)

A docmd plugin is exported as a Javascript object implementing the \`PluginDescriptor\` interface:

\`\`\`typescript
import type { PluginDescriptor } from '@docmd/api';

export const plugin: PluginDescriptor = {
  name: 'my-custom-plugin',
  version: '1.0.0',
  capabilities: ['build', 'assets']
};

export function onConfigResolved(config: any) {
  // Executed once the configuration schema is resolved and validated
}

export function onBeforeBuild(ctx: any) {
  // Modify pages or context array before compilation
}

export function getAssets(options: any) {
  // Injects custom stylesheet/script tags into the build
  return [
    { src: './assets/custom.js', dest: 'assets/js/custom.js', type: 'js', location: 'body' }
  ];
}
\`\`\`

---

## 6. Markdown Custom Containers (Formatting Syntax)

\`docmd\` parses custom container tags into modern rich components. Keep syntax strict:

### Callouts (Alerts)
Used to highlight warnings, tips, and key context.
\`\`\`markdown
::: callout [type] "[Title]" [icon:lucide-name]
Content goes here. Supports markdown body.
:::
\`\`\`
- **Types**: \`info\`, \`tip\`, \`warning\`, \`danger\`, \`success\`.
- **Aliases**: \`:::tip\`, \`:::warning\`, \`:::danger\`, \`:::info\`, \`:::note\`, \`:::caution\`.
- **Custom Title & Icon Example**:
  \`\`\`markdown
  ::: callout warning "Breaking Change" icon:alert-triangle
  WebSocket support is deprecated.
  :::
  \`\`\`

### Steps (Vertical Timeline)
Converts ordered lists into timeline walkthroughs. Bold the first line of each list item to act as the step title.
\`\`\`markdown
::: steps
1. **Initialise Project**
   Run the init command.
2. **Author Content**
   Write markdown files.
:::
\`\`\`

### Cards
Isolate features or highlights into framed boxes.
\`\`\`markdown
::: card "Title Text" [icon:lucide-name]
Card description body goes here.
:::
\`\`\`

### Grids & Grid (Multi-Column Layouts)
Wraps cards inside grids for responsive side-by-side columns.
\`\`\`markdown
::: grids
  ::: grid
    ::: card "Column 1"
    Content for column 1.
    :::
  :::
  ::: grid
    ::: card "Column 2"
    Content for column 2.
    :::
  :::
:::
\`\`\`

### Tabs
Switchable tab panels.
\`\`\`markdown
::: tabs
== tab "pnpm" icon:package
\`\`\`bash
pnpm install
\`\`\`
== tab "npm"
\`\`\`bash
npm install
\`\`\`
:::
\`\`\`

### Changelogs
Release history timeline.
\`\`\`markdown
::: changelog
== v1.5.0 (2026-06-05)
- Added search upgrades.
== v1.0.0 (2025-12-01)
- Initial release.
:::
\`\`\`

### Collapsible (Accordions)
Toggle details block.
\`\`\`markdown
::: collapsible "Toggle Details Title"
Content revealed when expanded.
:::
\`\`\`

### Buttons
Primary visual call-to-actions.
\`\`\`markdown
::: button "Get Started" /getting-started
:::
\`\`\`

### Tags (Badges)
Pill tags to display status or labels.
\`\`\`markdown
::: tag type="success" "Stable"
::: tag type="warning" "Beta"
\`\`\`

---

## 7. Agent Validation Loop

Before finalizing your work, always run the validation suite to detect errors:
1. Validate internal link syntax.
2. Ensure relative paths (e.g. \`[link](./another-file.md)\`) target actual documents.
3. Correct broken links or missing files automatically.

---

## 8. Install docmd-skills

This file is the project-local **docmd** skill (read by \`docmd mcp\`'s \`get_skill\` tool). For the full agent skill set — including **docmd-dev** (framework contributor) and **docmd-writer** (multi-language documentation writer) — install the [\`docmd-skills\`](https://www.npmjs.com/package/docmd-skills) npm package into your agent's skills directory.

**Single-line install (run once per machine):**

\`\`\`bash
npx docmd-skills ~/.claude/skills
\`\`\`

The \`[dir]\` argument is the directory your agent reads skills from. Common choices:

- \`~/.claude/skills\` (Claude Code)
- \`~/.cursor/skills\` (Cursor)
- \`./.skills\` (project-local)

After running the command above, the additional \`docmd-skills\`, \`docmd-dev\`, and \`docmd-writer\` modules are available to your agent alongside this file. \`npx docmd-skills --help\` lists all subcommands (e.g. \`npx docmd-skills dev [dir]\` to install only \`docmd-dev\`).
`;

export async function initProject(opts: { force?: boolean; yes?: boolean } = {}) {
  const baseDir = process.cwd();
  const packageJsonFile = path.join(baseDir, 'package.json');
  const configFile = path.join(baseDir, 'docmd.config.json');
  const docsDir = path.join(baseDir, 'docs');
  const indexMdFile = path.join(docsDir, 'index.md');
  const skillFile = path.join(baseDir, 'SKILL.md');
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
  let shouldOverride = !!opts.force;
  if (existingFiles.length > 0 && !shouldOverride) {
    TUI.warn('Existing files detected:');
    existingFiles.forEach(file => TUI.item('', file));

    // In a non-interactive environment (CI, piped input, Docker without -it,
    // npx with no TTY), skip the prompt. Default to "no" for safety unless
    // --yes is passed.
    const isInteractive = !!process.stdin.isTTY;
    if (!isInteractive) {
      if (opts.yes) {
        shouldOverride = true;
        TUI.dim('  (non-interactive mode + --yes: overriding existing files)');
      } else {
        shouldOverride = false;
        TUI.dim('  (non-interactive mode: keeping existing files. Pass --force to override.)');
      }
    } else {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question(`\n ${TUI.bold('Do you want to override these files?')} (y/N): `, resolve);
      });

      rl.close();

      shouldOverride = (answer as string).toLowerCase() === 'y';
    }

    if (!shouldOverride) {
      TUI.step('Maintaining existing files', 'SKIP');
    }
  } else if (existingFiles.length > 0 && shouldOverride) {
    TUI.warn(`Overriding ${existingFiles.length} existing file(s) (--force)`);
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

  // Write SKILL.md if it doesn't exist or user confirmed override
  if (!await fs.pathExists(skillFile) || shouldOverride) {
    // T-S5 fix (revised): no network call. docmd-skills is now a standalone
    // npm package (npx docmd-skills [dir]); users run it separately to install
    // the full docmd-dev / docmd-writer / docmd-skills skill set into their
    // agent directory. The local SKILL.md ships with @docmd/core for MCP
    // consumption and remains editable.
    await fs.writeFile(skillFile, defaultSkillContent, 'utf8');
    TUI.step(`${shouldOverride ? 'Updated' : 'Created'} SKILL.md`, 'DONE');
    TUI.dim('  (For the full agent skill set, run `npx docmd-skills` separately.)');
  } else {
    TUI.step('Using existing SKILL.md', 'SKIP');
  }

  TUI.footer();
  TUI.success('Initialisation complete. Run `npm install` to setup dependencies.');
}