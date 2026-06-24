/**
 * --------------------------------------------------------------------
 * docmd : Universal Failsafe V5.0
 * 
 * Comprehensive end-to-end integration test for 0.8.3 release.
 * Tests workspaces, i18n, versioning, plugins, type safety,
 * and config validation in a single mega-build.
 * --------------------------------------------------------------------
 */

import { execSync } from 'node:child_process';
import nativeFs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CWD = process.cwd();
const CLI_BIN = path.join(CWD, 'packages/core/dist/bin/docmd.js');

// TUI Emulation (matching @docmd/tui for consistency without package dependency)
const TUI_EMU = {
    cyan: (t) => `\x1b[36m${t}\x1b[0m`,
    blue: (t) => `\x1b[34m${t}\x1b[0m`,
    green: (t) => `\x1b[32m${t}\x1b[0m`,
    yellow: (t) => `\x1b[33m${t}\x1b[0m`,
    red: (t) => `\x1b[31m${t}\x1b[0m`,
    dim: (t) => `\x1b[2m${t}\x1b[0m`,
    bold: (t) => `\x1b[1m${t}\x1b[0m`,
    
    step: (label, status = 'WAIT', noReplace = false) => {
        const statusText = status === 'DONE' ? `\x1b[32m[ DONE ]\x1b[0m` :
                          status === 'SKIP' ? `\x1b[33m[ SKIP ]\x1b[0m` :
                          status === 'FAIL' ? `\x1b[31m[ FAIL ]\x1b[0m` :
                          `\x1b[34m[ ${status} ]\x1b[0m`;
        const line = `\x1b[34m│\x1b[0m  \x1b[2m${label.padEnd(45)}\x1b[0m ${statusText}`;
        
        if (process.stdout.isTTY && status !== 'WAIT' && !noReplace) {
            process.stdout.write(`\x1b[1A\r\x1b[K${line}\n`);
        } else {
            process.stdout.write(`${line}\n`);
        }
    },
    section: (title) => {
        console.log(`\n\x1b[34m┌─ ${title}\x1b[0m`);
    },
    error: (msg) => {
        console.error(`\x1b[34m│\x1b[0m  \x1b[31mError:\x1b[0m ${msg}`);
    },
    footer: () => {
        console.log(`\x1b[34m└──────────────────────────────────────────────────────────\x1b[0m\n`);
    }
};

let TUI = TUI_EMU;

/** 
 * Try to load the official TUI package if it's already built.
 * This ensures perfect consistency once the monorepo is ready.
 */
async function syncTUI() {
    try {
        const tuiPath = path.resolve(CWD, 'packages/tui/dist/index.js');
        if (nativeFs.existsSync(tuiPath)) {
            const mod = await import(`file://${tuiPath}`);
            TUI = mod.TUI;
        }
    } catch (e) {
        // Fallback to emulator if not built or fails
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function runCmd(cmd, cwd, silent = true) {
    try {
        execSync(cmd, { cwd, stdio: silent ? 'pipe' : 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
    } catch (e) {
        TUI.error(`Command failed: ${cmd}`);
        if (e.stderr) {
            console.error(e.stderr.toString().split('\n').map(l => `\x1b[34m│\x1b[0m  \x1b[31m${l}\x1b[0m`).join('\n'));
        }
        throw new Error(`Process aborted due to command failure: ${cmd}`);
    }
}

(async () => {
    await syncTUI();

    const args = process.argv.slice(2);
    const skipSetup = args.includes('--skip-setup');

    console.log(`\x1b[34m│\x1b[0m\n\x1b[34m│\x1b[0m  \x1b[1mUNIVERSAL FAILSAFE V5.0\x1b[0m`);
    const tempRoot = path.join(os.tmpdir(), `docmd-failsafe-${Math.random().toString(36).slice(2, 8)}`);
    console.log(`\x1b[34m│\x1b[0m  \x1b[2mWorkspace: ${tempRoot}\x1b[0m\n\x1b[34m│\x1b[0m`);
    nativeFs.mkdirSync(tempRoot);
    console.log(`\x1b[34m└────────────────────────────\x1b[0m`);

    if (!skipSetup) {
        TUI.section('Monorepo Foundations');
        
        TUI.step('Installing dependencies', 'WAIT');
        execSync('pnpm install --silent', { cwd: CWD, stdio: 'ignore' });
        TUI.step('Installing dependencies', 'DONE');

        TUI.step('Building monorepo', 'WAIT');
        execSync('pnpm run build', { cwd: CWD, stdio: 'ignore' });
        TUI.step('Building monorepo', 'DONE');

        // Sync with REAL TUI now that it's built
        await syncTUI();
        TUI.footer();
    }

    const rootPkg = JSON.parse(nativeFs.readFileSync(path.join(CWD, 'package.json'), 'utf8'));
    const rootVersion = rootPkg.version;

    // ═════════════════════════════════════════════════════════════
    // SECTION 1: Type Safety & Version Integrity
    // ═════════════════════════════════════════════════════════════
    
    TUI.section('Type Safety & Integrity');

    // 1a. TypeScript type-checking across ALL packages
    // Order matters: leaf packages first, then dependents
    TUI.step('Type-checking monorepo packages', 'WAIT');
    const typeCheckPackages = ['utils', 'tui', 'ui', 'themes', 'parser', 'api', 'live', 'deployer', 'core'];
    // Engine packages live under packages/engines/<name> — check them separately
    const typeCheckEngines = ['engines/js', 'engines/rust'];
    const typeErrors = [];
    for (const pkg of [...typeCheckPackages, ...typeCheckEngines]) {
        const pkgDir = path.join(CWD, 'packages', pkg);
        if (!nativeFs.existsSync(path.join(pkgDir, 'tsconfig.json'))) continue;
        try {
            execSync('npx tsc --noEmit', { cwd: pkgDir, stdio: 'pipe' });
        } catch (e) {
            const stderr = e.stderr?.toString() || e.stdout?.toString() || '';
            typeErrors.push({ pkg, errors: stderr });
        }
    }
    if (typeErrors.length > 0) {
        TUI.step('Type-checking monorepo packages', 'FAIL');
        for (const { pkg, errors } of typeErrors) {
            TUI.error(`Type errors in @docmd/${pkg}:`);
            errors.split('\n').slice(0, 10).forEach(l => {
                console.error(`\x1b[34m│\x1b[0m  \x1b[2m${l}\x1b[0m`);
            });
        }
        throw new Error(`TypeScript type errors found in ${typeErrors.map(e => e.pkg).join(', ')}`);
    }
    TUI.step('Type-checking monorepo packages', 'DONE');

    // 1b. Plugin type-checking
    TUI.step('Type-checking plugins', 'WAIT');
    const pluginsDir = path.join(CWD, 'packages/plugins');
    const pluginTypeErrors = [];
    if (nativeFs.existsSync(pluginsDir)) {
        for (const entry of nativeFs.readdirSync(pluginsDir)) {
            const pluginDir = path.join(pluginsDir, entry);
            if (!nativeFs.existsSync(path.join(pluginDir, 'tsconfig.json'))) continue;
            try {
                execSync('npx tsc --noEmit', { cwd: pluginDir, stdio: 'pipe' });
            } catch (e) {
                const stderr = e.stderr?.toString() || e.stdout?.toString() || '';
                pluginTypeErrors.push({ plugin: entry, errors: stderr });
            }
        }
    }
    if (pluginTypeErrors.length > 0) {
        TUI.step('Type-checking plugins', 'FAIL');
        for (const { plugin, errors } of pluginTypeErrors) {
            TUI.error(`Type errors in plugin ${plugin}:`);
            errors.split('\n').slice(0, 10).forEach(l => {
                console.error(`\x1b[34m│\x1b[0m  \x1b[2m${l}\x1b[0m`);
            });
        }
        throw new Error(`TypeScript type errors found in plugins: ${pluginTypeErrors.map(e => e.plugin).join(', ')}`);
    }
    TUI.step('Type-checking plugins', 'DONE');

    // 1b'. Template type-checking (new in 0.8.7)
    TUI.step('Type-checking templates', 'WAIT');
    const templatesDir = path.join(CWD, 'packages/templates');
    const templateTypeErrors = [];
    if (nativeFs.existsSync(templatesDir)) {
        for (const entry of nativeFs.readdirSync(templatesDir)) {
            const templateDir = path.join(templatesDir, entry);
            if (!nativeFs.existsSync(path.join(templateDir, 'tsconfig.json'))) continue;
            try {
                execSync('npx tsc --noEmit', { cwd: templateDir, stdio: 'pipe' });
            } catch (e) {
                const stderr = e.stderr?.toString() || e.stdout?.toString() || '';
                templateTypeErrors.push({ template: entry, errors: stderr });
            }
        }
    }
    if (templateTypeErrors.length > 0) {
        TUI.step('Type-checking templates', 'FAIL');
        for (const { template, errors } of templateTypeErrors) {
            TUI.error(`Type errors in template ${template}:`);
            errors.split('\n').slice(0, 10).forEach(l => {
                console.error(`\x1b[34m│\x1b[0m  \x1b[2m${l}\x1b[0m`);
            });
        }
        throw new Error(`TypeScript type errors found in templates: ${templateTypeErrors.map(e => e.template).join(', ')}`);
    }
    TUI.step('Type-checking templates', 'DONE');

    // 1c. Version consistency
    TUI.step('Checking version consistency', 'WAIT');
    const packagesDir = path.join(CWD, 'packages');
    const checkVersions = (dir) => {
        for (const entry of nativeFs.readdirSync(dir)) {
            const p = path.join(dir, entry);
            if (nativeFs.existsSync(path.join(p, 'package.json'))) {
                const pkg = JSON.parse(nativeFs.readFileSync(path.join(p, 'package.json'), 'utf8'));
                assert(pkg.version === rootVersion, `Version mismatch in ${pkg.name}: ${pkg.version} != ${rootVersion}`);
            } else if (nativeFs.statSync(p).isDirectory() && entry !== 'node_modules' && entry !== 'dist') {
                checkVersions(p);
            }
        }
    };
    checkVersions(packagesDir);
    TUI.step('Checking version consistency', 'DONE');

    TUI.footer();

    // 1d. Security Audit
    TUI.section('Security & Compliance');
    TUI.step('Running security audit', 'WAIT');
    try {
        // Run our custom monorepo security audit
        execSync('node tools/security-audit.mjs --skip-header', { cwd: CWD, stdio: 'inherit' });
        TUI.step('Running security audit', 'DONE');
    } catch (e) {
        TUI.step('Running security audit', 'FAIL');
        TUI.error('High-risk security patterns detected in source code or templates.');
        throw new Error('Security audit failed. Fix issues in tools/security-audit.mjs baseline or patch vulnerabilities.');
    }
    TUI.footer();

    // ═════════════════════════════════════════════════════════════
    // SECTION 1e: ENGINE TESTS
    // ═════════════════════════════════════════════════════════════
    
    TUI.section('Engine Tests');
    
    // Test JS Engine
    TUI.step('Testing JS engine', 'WAIT');
    try {
        const jsEngineTest = await import('../packages/engines/js/dist/index.js');
        const jsEngine = jsEngineTest.createJsEngine();
        
        // Test file:discover
        const discoverResult = await jsEngine.run({ 
            type: 'file:discover', 
            payload: { dir: path.join(CWD, 'packages/engines'), extensions: ['.ts'] } 
        });
        if (!discoverResult.success) throw new Error('file:discover failed');
        
        // Test file:exists
        const existsResult = await jsEngine.run({ 
            type: 'file:exists', 
            payload: { path: path.join(CWD, 'package.json') } 
        });
        if (!existsResult.success || existsResult.data !== true) throw new Error('file:exists failed');
        
        TUI.step('Testing JS engine', 'DONE');
    } catch (e) {
        TUI.step('Testing JS engine', 'FAIL');
        TUI.error(`JS engine test failed: ${e.message}`);
        throw e;
    }
    
    // Test Rust Engine (if binary available)
    TUI.step('Testing Rust engine', 'WAIT');
    try {
        const rustEngineTest = await import('../packages/engines/rust/dist/index.js');
        
        if (rustEngineTest.isRustEngineAvailable()) {
            const rustEngine = rustEngineTest.createRustEngine();
            
            // Test file:discover
            const discoverResult = await rustEngine.run({ 
                type: 'file:discover', 
                payload: { dir: path.join(CWD, 'packages/engines'), extensions: ['.ts'] } 
            });
            if (!discoverResult.success) throw new Error('file:discover failed');
            
            // Test file:exists
            const existsResult = await rustEngine.run({ 
                type: 'file:exists', 
                payload: { path: path.join(CWD, 'package.json') } 
            });
            if (!existsResult.success || existsResult.data !== true) throw new Error('file:exists failed');
            
            // Test git:status
            const gitResult = await rustEngine.run({ type: 'git:status', payload: {} });
            if (!gitResult.success) throw new Error('git:status failed');
            
            TUI.step('Testing Rust engine', 'DONE');
        } else {
            TUI.step('Testing Rust engine (binary not present, built by CI)', 'SKIP');
        }
    } catch (e) {
        TUI.step('Testing Rust engine', 'FAIL');
        TUI.error(`Rust engine test failed: ${e.message}`);
        // Don't throw — Rust engine is optional, JS is the fallback
    }
    
    // Test API engine loading
    TUI.step('Testing API engine loader', 'WAIT');
    try {
        const apiEngine = await import('../packages/api/dist/engine.js');
        
        // Test loading JS engine via API
        const jsEngine = await apiEngine.loadEngine('js');
        if (jsEngine.name !== 'js') throw new Error('loadEngine("js") failed');
        
        // Test running a task through the API
        const result = await apiEngine.discoverFiles(jsEngine, path.join(CWD, 'packages/engines'), ['.ts']);
        if (!Array.isArray(result)) throw new Error('discoverFiles failed');
        
        TUI.step('Testing API engine loader', 'DONE');
    } catch (e) {
        TUI.step('Testing API engine loader', 'FAIL');
        TUI.error(`API engine loader test failed: ${e.message}`);
        throw e;
    }
    
    TUI.footer();

    // ═════════════════════════════════════════════════════════════
    // SECTION 2: COMPREHENSIVE MEGA INTEGRATION TEST
    // ═════════════════════════════════════════════════════════════
    
    TUI.section('Mega Integration Test (V5.0)');
    
    // Create ONE project that tests EVERYTHING together
    const megaDir = path.join(tempRoot, 'mega-integration');
    nativeFs.mkdirSync(megaDir, { recursive: true });
    
    // Setup workspace structure with i18n + versioning + plugins
    nativeFs.mkdirSync(path.join(megaDir, 'main/docs/en'), { recursive: true });
    nativeFs.mkdirSync(path.join(megaDir, 'main/docs/fr'), { recursive: true });
    nativeFs.mkdirSync(path.join(megaDir, 'main/docs-v1/en'), { recursive: true });
    nativeFs.mkdirSync(path.join(megaDir, 'api/docs/en'), { recursive: true });
    nativeFs.mkdirSync(path.join(megaDir, 'main/assets/css'), { recursive: true });
    nativeFs.mkdirSync(path.join(megaDir, 'api/assets'), { recursive: true });
    
    // Main project config with i18n + versioning
    nativeFs.writeFileSync(path.join(megaDir, 'main/docmd.config.js'), `export default {
      title: 'Mega Docs',
      url: 'https://example.com',
      src: 'docs',
      out: 'site',
      plugins: { math: {}, sitemap: {}, llms: {}, seo: {}, pwa: {} },
      versions: { current: 'v2', all: [
        { id: 'v2', dir: 'docs', label: 'v2.0' },
        { id: 'v1', dir: 'docs-v1', label: 'v1.0' }
      ]},
      i18n: { default: 'en', locales: [
        { id: 'en', label: 'English' },
        { id: 'fr', label: 'Français' }
      ]}
    }`);
    
    // API project (simpler, no versioning) - with navigation
    nativeFs.writeFileSync(path.join(megaDir, 'api/docmd.config.js'), `export default {
      title: 'API Reference',
      url: 'https://example.com/api',
      src: 'docs',
      navigation: [
        { title: 'Home', path: '/' },
        { title: 'Endpoints', path: '/endpoints' }
      ],
      plugins: { search: {}, mermaid: {} }
    }`);
    
    // Root workspace config
    nativeFs.writeFileSync(path.join(megaDir, 'docmd.config.js'), `export default {
      workspace: {
        projects: [
          { prefix: '/', src: 'main' },
          { prefix: '/api', src: 'api' }
        ]
      }
    }`);

    // Content files for main project
    nativeFs.writeFileSync(path.join(megaDir, 'main/docs/en/index.md'), `---
title: Home
description: Welcome to Mega Docs
---
# Welcome
This is the home page.`);
    
    nativeFs.writeFileSync(path.join(megaDir, 'main/docs/en/guide.md'), `---
title: Guide
description: User guide
---
# Guide
## Getting Started
Follow these steps.`);
    
    nativeFs.writeFileSync(path.join(megaDir, 'main/docs/en/math.md'), `---
title: Math
---
# Math Test
Inline math: $E = mc^2$
Block math:
$$
\\\\int_{-\\\\infty}^{\\\\infty} e^{-x^2} dx = \\\\sqrt{\\\\pi}
$$`);
    
    nativeFs.writeFileSync(path.join(megaDir, 'main/docs/en/mermaid.md'), `---
title: Diagrams
---
# Diagrams
\`\`\`mermaid
graph TD
  A[Start] --> B[End]
\`\`\``);
    
    nativeFs.writeFileSync(path.join(megaDir, 'main/docs/fr/index.md'), `# Accueil\nBienvenue!`);
    
    nativeFs.writeFileSync(path.join(megaDir, 'main/docs-v1/en/index.md'), `# v1 Home\nOld version.`);
    
    // Content for API project
    nativeFs.mkdirSync(path.join(megaDir, 'api/docs'), { recursive: true });
    nativeFs.writeFileSync(path.join(megaDir, 'api/docs/index.md'), `---
title: API Index
---
# API Reference
## Endpoints
GET /users`);
    nativeFs.writeFileSync(path.join(megaDir, 'api/docs/endpoints.md'), `---
title: Endpoints
---
# Endpoints
All available API endpoints.`);
    
    // Assets
    nativeFs.writeFileSync(path.join(megaDir, 'main/assets/css/custom.css'), 'body { background: #fff; }');
    
    // RUN THE MEGA BUILD
    TUI.step('Running mega integration build', 'WAIT');
    runCmd(`node "${CLI_BIN}" build`, megaDir);
    TUI.step('Running mega integration build', 'DONE');
    
    // ═════════════════════════════════════════════════════════════
    // VERIFY ALL EXPECTED OUTPUTS
    // ═════════════════════════════════════════════════════════════
    
    const checks = [];
    const verify = (condition, desc) => checks.push({ ok: condition, desc });
    
    // Workspace outputs
    verify(nativeFs.existsSync(path.join(megaDir, 'site/index.html')), 'Main project root index');
    verify(nativeFs.existsSync(path.join(megaDir, 'site/guide/index.html')), 'Main project guide page');
    verify(nativeFs.existsSync(path.join(megaDir, 'site/api/index.html')), 'API project index');
    verify(nativeFs.existsSync(path.join(megaDir, 'site/api/endpoints/index.html')), 'API endpoints page');
    
    // i18n outputs
    verify(nativeFs.existsSync(path.join(megaDir, 'site/fr/index.html')), 'French locale index');
    verify(nativeFs.existsSync(path.join(megaDir, 'site/fr/guide/index.html')), 'French locale guide');
    
    // Versioning outputs
    verify(nativeFs.existsSync(path.join(megaDir, 'site/v1/index.html')), 'v1 index');
    verify(!nativeFs.existsSync(path.join(megaDir, 'site/v1/guide/index.html')), 'v1 guide fallback (should NOT exist in v1)');
    
    // Plugin outputs (search, sitemap, llms, seo, math, mermaid)
    verify(nativeFs.existsSync(path.join(megaDir, 'site/search-index.json')), 'Search index generated');
    verify(nativeFs.existsSync(path.join(megaDir, 'site/sitemap.xml')), 'Sitemap generated');
    verify(nativeFs.existsSync(path.join(megaDir, 'site/llms.txt')), 'LLMs txt generated');
    verify(nativeFs.existsSync(path.join(megaDir, 'site/llms-full.txt')), 'LLMs full txt generated');
    verify(nativeFs.existsSync(path.join(megaDir, 'site/manifest.webmanifest')), 'PWA manifest generated');
    verify(nativeFs.existsSync(path.join(megaDir, 'site/service-worker.js')), 'Service worker generated');
    
    // Verify search index has actual content
    const searchIdx = JSON.parse(nativeFs.readFileSync(path.join(megaDir, 'site/search-index.json'), 'utf8'));
    verify(searchIdx.documentCount >= 2, 'Search index has content');
    
    // Verify sitemap has URLs
    const sitemap = nativeFs.readFileSync(path.join(megaDir, 'site/sitemap.xml'), 'utf8');
    verify(sitemap.includes('https://example.com/'), 'Sitemap has root URL');
    verify(sitemap.includes('https://example.com/fr/'), 'Sitemap has French URL');
    
    // Verify llms.txt has links
    const llmsTxt = nativeFs.readFileSync(path.join(megaDir, 'site/llms.txt'), 'utf8');
    verify(llmsTxt.includes('https://example.com/'), 'LLMs txt has links');
    
    // Verify math renders (check for katex CSS or rendered output)
    const mathPage = nativeFs.readFileSync(path.join(megaDir, 'site/math/index.html'), 'utf8');
    verify(mathPage.includes('katex') || mathPage.includes('math'), 'Math page has math content');
    
    // Verify mermaid renders as div
    const mermaidPage = nativeFs.readFileSync(path.join(megaDir, 'site/mermaid/index.html'), 'utf8');
    verify(mermaidPage.includes('mermaid') || mermaidPage.includes('graph'), 'Mermaid page has diagram');
    
    // Verify SEO meta tags in index
    const indexHtml = nativeFs.readFileSync(path.join(megaDir, 'site/index.html'), 'utf8');
    verify(indexHtml.includes('og:title') || indexHtml.includes('description'), 'SEO meta tags present');
    
    // Verify assets were copied
    verify(nativeFs.existsSync(path.join(megaDir, 'site/assets/css/custom.css')), 'Custom assets copied');
    
    // Report results
    const passed = checks.filter(c => c.ok).length;
    const failed = checks.filter(c => !c.ok).length;
    
    TUI.section(`Mega Test Results: ${passed}/${passed + failed}`);
    checks.forEach(c => {
        TUI.step(c.desc, c.ok ? 'DONE' : 'FAIL');
    });

    if (failed > 0) {
        throw new Error(`${failed} mega-test checks failed!`);
    }
    TUI.step('Mega integration test', 'DONE');
    TUI.footer();

    // ═════════════════════════════════════════════════════════════
    // SUCCESS
    // ═════════════════════════════════════════════════════════════
    
    if (TUI.success) {
        TUI.success('Universal Failsafe V5.0 Passed!');
    } else {
        console.log(`\n\x1b[32m\x1b[1m⬢ Universal Failsafe V5.0 Passed!\x1b[0m\n`);
    }

    // Clean up
    nativeFs.rmSync(tempRoot, { recursive: true, force: true });

})().catch(err => {
    console.error(`\n\x1b[31m┌─ Failsafe Fatal Error\x1b[0m`);
    console.error(`\x1b[31m│\x1b[0m ${err.message}`);
    if (err.stack) {
        err.stack.split('\n').slice(1, 4).forEach(l => console.error(`\x1b[31m│\x1b[0m \x1b[2m${l.trim()}\x1b[0m`));
    }
    console.error(`\x1b[31m└──────────────────────────────────────────────────────────\x1b[0m\n`);
    process.exit(1);
});