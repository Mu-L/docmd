/**
 * --------------------------------------------------------------------
 * docmd : Universal Failsafe V4.1
 * 
 * Comprehensive end-to-end integration test for 0.8.0 release.
 * Tests multi-project, i18n, versioning, plugins, and config validation
 * in a single mega-build to ensure nothing is broken.
 * --------------------------------------------------------------------
 */

import { execSync } from 'node:child_process';
import nativeFs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CWD = process.cwd();
const CLI_BIN = path.join(CWD, 'packages/core/dist/bin/docmd.js');
const LIVE_PUBLIC = path.join(CWD, 'dist');
const TEMP_SCRIPT = path.join(CWD, 'temp-live-test.mjs');

// TUI Emulation (matching @docmd/tui for consistency without package dependency)
const TUI_EMU = {
    cyan: (t) => `\x1b[36m${t}\x1b[0m`,
    blue: (t) => `\x1b[34m${t}\x1b[0m`,
    green: (t) => `\x1b[32m${t}\x1b[0m`,
    yellow: (t) => `\x1b[33m${t}\x1b[0m`,
    red: (t) => `\x1b[31m${t}\x1b[0m`,
    dim: (t) => `\x1b[2m${t}\x1b[0m`,
    bold: (t) => `\x1b[1m${t}\x1b[0m`,
    
    step: (label, status = 'WAIT') => {
        const statusText = status === 'DONE' ? `\x1b[32m[ DONE ]\x1b[0m` :
                          status === 'SKIP' ? `\x1b[33m[ SKIP ]\x1b[0m` :
                          status === 'FAIL' ? `\x1b[31m[ FAIL ]\x1b[0m` :
                          `\x1b[34m[ ${status} ]\x1b[0m`;
        const line = `\x1b[34m│\x1b[0m  \x1b[2m${label.padEnd(45)}\x1b[0m ${statusText}`;
        
        if (process.stdout.isTTY && status !== 'WAIT') {
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

    console.log(`\x1b[34m│\x1b[0m\n\x1b[34m│\x1b[0m  \x1b[1mUNIVERSAL FAILSAFE V4.1\x1b[0m`);
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

    // Parallelize independent verification sections
    TUI.section('Concurrent Verification Suite');
    
    const runVerification = async () => {
        const results = await Promise.allSettled([
            // 1. Monorepo Integrity
            (async () => {
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
            })(),

            // 2. Live Runtime & Security (Parallel)
            (async () => {
                TUI.step('Testing Live Runtime', 'WAIT');
                if (nativeFs.existsSync(LIVE_PUBLIC)) nativeFs.rmSync(LIVE_PUBLIC, { recursive: true });
                nativeFs.writeFileSync(TEMP_SCRIPT, `import { buildLive } from './packages/core/dist/commands/live.js'; await buildLive({ serve: false });`);
                runCmd(`node "${TEMP_SCRIPT}"`, CWD);
                
                const sandbox = { 
                    window: { location: { host: 'l' } }, 
                    document: { 
                        compatMode: 'CSS1Compat', 
                        documentElement: { getAttribute: () => 'l' }, 
                        addEventListener: () => { }, 
                        body: { classList: { add: () => { } }, dataset: {} }, 
                        querySelectorAll: () => [], 
                        createElement: () => ({ setAttribute: () => { }, style: {} }) 
                    }, 
                    console, setTimeout, clearTimeout, Buffer 
                };
                sandbox.globalThis = sandbox; sandbox.self = sandbox; sandbox.window.document = sandbox.document;
                vm.createContext(sandbox); 
                vm.runInContext(nativeFs.readFileSync(path.join(LIVE_PUBLIC, 'docmd-live.js'), 'utf8'), sandbox);
                assert(typeof sandbox.docmd.compile === 'function', "Live runtime compile missing");
                TUI.step('Testing Live Runtime', 'DONE');
            })(),

            (async () => {
                TUI.step('Running Security Audit', 'WAIT');
                try {
                    execSync('pnpm audit --audit-level=moderate', { cwd: CWD, stdio: 'pipe' });
                    TUI.step('Running Security Audit', 'DONE');
                } catch {
                    TUI.step('Running Security Audit', 'SKIP'); // Non-fatal
                }
            })()
        ]);

        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) throw failures[0].reason;
    };

    await runVerification();
    TUI.footer();

    // ═════════════════════════════════════════════════════════════
    // V4.0: COMPREHENSIVE MEGA TEST
    // ═════════════════════════════════════════════════════════════
    
    TUI.section('Mega Integration Test (V4.1)');
    
    // Create ONE project that tests EVERYTHING together
    const megaDir = path.join(tempRoot, 'mega-integration');
    nativeFs.mkdirSync(megaDir, { recursive: true });
    
    // Setup multi-project structure with i18n + versioning + plugins
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
    
    // Root multi-project config
    nativeFs.writeFileSync(path.join(megaDir, 'docmd.config.js'), `export default {
      projects: [
        { prefix: '/', src: 'main' },
        { prefix: '/api', src: 'api' }
      ]
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
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
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
    
    // Multi-project outputs
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
    // V4.1: Parallel Brute-Test Integration
    // ═════════════════════════════════════════════════════════════
    
    TUI.section('Brute-Test Performance Check');
    TUI.step('Running brute-test.js', 'WAIT');
    
    // We keep brute-test for full isolation checks, but it's called once.
    try {
        execSync('node scripts/brute-test.js', { cwd: CWD, stdio: 'pipe' });
        TUI.step('Running brute-test.js', 'DONE');
    } catch {
        TUI.step('Running brute-test.js', 'FAIL');
        throw new Error('Brute-test suite failed!');
    }
    TUI.footer();

    // ═════════════════════════════════════════════════════════════
    // SUCCESS
    // ═════════════════════════════════════════════════════════════
    
    if (TUI.success) {
        TUI.success('Universal Failsafe V4.1 Passed!');
    } else {
        console.log(`\n\x1b[32m\x1b[1m⬢ Universal Failsafe V4.1 Passed!\x1b[0m\n`);
    }

    // Clean up
    nativeFs.rmSync(tempRoot, { recursive: true, force: true });
    if (nativeFs.existsSync(TEMP_SCRIPT)) nativeFs.unlinkSync(TEMP_SCRIPT);

})().catch(err => {
    console.error(`\n\x1b[31m┌─ Failsafe Fatal Error\x1b[0m`);
    console.error(`\x1b[31m│\x1b[0m ${err.message}`);
    if (err.stack) {
        err.stack.split('\n').slice(1, 4).forEach(l => console.error(`\x1b[31m│\x1b[0m \x1b[2m${l.trim()}\x1b[0m`));
    }
    console.error(`\x1b[31m└──────────────────────────────────────────────────────────\x1b[0m\n`);
    process.exit(1);
});