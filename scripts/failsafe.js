/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
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

/**
 * --------------------------------------------------------------------
 * docmd : Universal Failsafe
 * Tests core engine, deep nesting, relative paths, config schemas,
 * simulates NPM publishing, and tests LIVE BUNDLE RUNTIME execution.
 * --------------------------------------------------------------------
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');

const CWD = process.cwd();
const CLI_BIN = path.join(CWD, 'packages/core/dist/bin/docmd.js');
const LIVE_PUBLIC = path.join(CWD, 'dist');
const TEMP_SCRIPT = path.join(CWD, 'temp-live-test.mjs');

console.log('🛡️  Running Universal Failsafe...');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docmd-failsafe-'));
console.log(`\x1b[2m   Temp Workspace: ${tempDir}\x1b[0m\n`);

function assert(condition, message) {
    if (!condition) throw new Error(`❌ FAIL: ${message}`);
}

// Helper to safely run commands and capture errors
function runCmd(cmd, cwd) {
    try {
        execSync(cmd, { cwd, stdio: 'pipe' });
    } catch (e) {
        console.error(`\x1b[31m\x1b[1m💥 Command Failed:\x1b[0m ${cmd}`);
        if (e.stderr) console.error(e.stderr.toString());
        if (e.stdout) console.error(e.stdout.toString());
        throw new Error("Process aborted due to command failure.");
    }
}

const args = process.argv.slice(2);
const skipSetup = args.includes('--skip-setup');

try {
    // 1. Install, Lint & Build Monorepo
    if (!skipSetup) {
        console.log('\n\x1b[2m📦 [1/14] Installing, Linting & Building Monorepo...\x1b[0m');
        runCmd('pnpm install --silent', CWD);
        runCmd('pnpm run lint', CWD);
        runCmd('pnpm run build', CWD);
    } else {
        console.log('\n\x1b[2m⏩ [1/14] Skipping setup (CI mode)...\x1b[0m');
    }

    // 2. Initialize Project
    console.log('\x1b[2m🚀 [2/14] Initializing Test Project...\x1b[0m');
    runCmd(`node "${CLI_BIN}" init`, tempDir);

    // 3. Inject Stress Tests, Versioning & Zero-Config Dirs
    console.log('\x1b[2m🧪 [3/14] Injecting Stress Tests & Versioning...\x1b[0m');
    const docsDir = path.join(tempDir, 'docs');
    const docsV1Dir = path.join(tempDir, 'docs-v1');
    const zeroConfigDir = path.join(tempDir, 'zero-docs');

    fs.mkdirSync(docsV1Dir, { recursive: true });
    fs.mkdirSync(path.join(zeroConfigDir, 'docs', 'nested'), { recursive: true });

    const stressMd = `---
title: "Stress Test"
---
::: card Outer Card
::: callout warning Inner Callout
::: button "Deep Button" /link
:::
:::
`;
    fs.writeFileSync(path.join(docsDir, 'stress.md'), stressMd);

    const deepDir = path.join(docsDir, 'level1', 'level2', 'level3');
    fs.mkdirSync(deepDir, { recursive: true });
    fs.writeFileSync(path.join(deepDir, 'deep.md'), '# Deep Content');

    // V1 Content (For Versioning Test)
    fs.writeFileSync(path.join(docsV1Dir, 'index.md'), '# V1 Home');
    fs.writeFileSync(path.join(docsV1Dir, 'stress.md'), '# V1 Stress');

    // Zero-Config Content (For Auto-Router Test)
    fs.writeFileSync(path.join(zeroConfigDir, 'docs', 'index.md'), '# Zero Config Home\nWelcome to auto-router.');
    fs.writeFileSync(path.join(zeroConfigDir, 'docs', 'nested', 'auto.md'), '# Auto Nested Page');

    // 4. Create Paradigm Configs
    console.log('\x1b[2m⚙️  [4/14] Creating Legacy & Modern Configs...\x1b[0m');

    const legacyConfig = `
      module.exports = {
        siteTitle: 'Legacy Test', siteUrl: 'https://test.com',
        srcDir: 'docs', outputDir: 'site-legacy',
        search: true, sponsor: 'https://sponsor.com',
        theme: { enableModeToggle: true, positionMode: 'top' },
        footer: 'Legacy Footer'
      };
    `;

    const modernConfig = `
      export default {
        title: 'Modern Test', url: 'https://test.com',
        src: 'docs', out: 'site-modern',
        versions: {
          current: 'v2',
          all:[
            { id: 'v2', dir: 'docs', label: 'v2.x' },
            { id: 'v1', dir: 'docs-v1', label: 'v1.x' }
          ]
        },
        redirects: { '/old-guide': '/new-guide' },
        notFound: { title: 'Custom 404', content: 'Page missing.' },
        layout: {
          optionsMenu: { position: 'header', components: { search: true, themeSwitch: true, sponsor: 'https://sponsor.com' } },
          footer: { style: 'minimal', content: 'Modern Footer', branding: false }
        }
      };
    `;

    fs.writeFileSync(path.join(tempDir, 'legacy.config.cjs'), legacyConfig);
    fs.writeFileSync(path.join(tempDir, 'modern.config.js'), modernConfig);

    // 5. Build & Verify
    console.log('\x1b[2m🔨 [5/14] Executing Engine Builds (Legacy, Modern, Zero-Config)...\x1b[0m');
    runCmd(`node "${CLI_BIN}" build -c legacy.config.cjs`, tempDir);
    runCmd(`node "${CLI_BIN}" build -c modern.config.js`, tempDir);
    runCmd(`node "${CLI_BIN}" build -z`, zeroConfigDir); // Zero config test

    console.log('\x1b[2m🔍 [6/14] Verifying Static Outputs...\x1b[0m');

    const modernHtml = fs.readFileSync(path.join(tempDir, 'site-modern/index.html'), 'utf8');
    const stressHtml = fs.readFileSync(path.join(tempDir, 'site-modern/stress/index.html'), 'utf8');
    const deepHtml = fs.readFileSync(path.join(tempDir, 'site-modern/level1/level2/level3/deep/index.html'), 'utf8');

    const v1Html = fs.readFileSync(path.join(tempDir, 'site-modern/v1/index.html'), 'utf8');
    const notFoundHtml = fs.readFileSync(path.join(tempDir, 'site-modern/404.html'), 'utf8');
    const redirectHtml = fs.readFileSync(path.join(tempDir, 'site-modern/old-guide/index.html'), 'utf8');
    const zcHtml = fs.readFileSync(path.join(zeroConfigDir, 'site/index.html'), 'utf8');
    const zcNestedHtml = fs.readFileSync(path.join(zeroConfigDir, 'site/nested/index.html'), 'utf8');

    assert(modernHtml.includes('docmd-options-menu'), "Options Menu missing in Modern Config");
    assert(modernHtml.includes('sponsor.com'), "Sponsor Link missing");
    assert(modernHtml.includes('Modern Footer'), "Footer missing");
    assert(!modernHtml.includes('Built with <svg'), "Branding toggle failed (branding is still visible)");

    assert(!stressHtml.includes(':::'), "PARSER LEAK DETECTED: Found raw ':::' in HTML output!");
    assert(stressHtml.includes('class="docmd-container card"'), "Card container failed to render");
    assert(stressHtml.includes('class="docmd-container callout callout-warning"'), "Nested Callout failed to render");
    assert(stressHtml.includes('class="docmd-button"'), "Deep nested button failed to render");

    assert(deepHtml.includes('href="../../../../assets/css/docmd-main.css'), "CSS Relative Path calculation failed on deep folder!");

    assert(modernHtml.includes('docmd-version-dropdown'), "Version dropdown missing in V2 (root)");
    assert(v1Html.includes('V1 Home'), "V1 Content missing in subfolder");
    assert(v1Html.includes('docmd-version-dropdown'), "Version dropdown missing in V1");
    assert(notFoundHtml.includes('Custom 404'), "404 Title missing");
    assert(notFoundHtml.includes('Page missing.'), "404 Content missing");
    assert(redirectHtml.includes('http-equiv="refresh"'), "Redirect meta tag missing");
    assert(redirectHtml.includes('/new-guide'), "Redirect URL missing");
    assert(zcHtml.includes('Zero Config Home'), "Zero Config failed to build index");
    assert(zcNestedHtml.includes('Auto Nested Page'), "Zero config failed to build nested auto-navigation page");

    // 7. Live Editor (COMPILE & RUNTIME TEST)
    console.log('\x1b[2m🎥 [7/14] Testing "docmd live" build & RUNTIME Execution...\x1b[0m');
    if (fs.existsSync(LIVE_PUBLIC)) fs.rmSync(LIVE_PUBLIC, { recursive: true });

    const liveTestScriptContent = `
        import { buildLive } from './packages/core/dist/commands/live.js';
        buildLive({ serve: false }).catch(e => { console.error(e); process.exit(1); });
    `;
    fs.writeFileSync(TEMP_SCRIPT, liveTestScriptContent);
    runCmd(`node temp-live-test.mjs`, CWD);

    assert(fs.existsSync(path.join(LIVE_PUBLIC, 'docmd-live.js')), "Live Editor bundle missing");

    // Live Test
    const liveBundle = fs.readFileSync(path.join(LIVE_PUBLIC, 'docmd-live.js'), 'utf8');

    // Mock a minimal browser environment so the bundle can load
    const sandbox = {
        window: { location: { host: 'localhost' } },
        document: {
            documentElement: { getAttribute: () => 'light' },
            addEventListener: () => { },
            readyState: 'complete',
            querySelectorAll: () => [],
            querySelector: () => null,
            body: { classList: { add: () => { } }, dataset: {} },
            createElement: () => ({ setAttribute: () => { }, style: {} })
        },
        console,
        setTimeout,
        clearTimeout,
        Buffer: Buffer,
    };

    // Circular references to mimic browser global scope
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    sandbox.window.document = sandbox.document;

    vm.createContext(sandbox);

    try {
        vm.runInContext(liveBundle, sandbox); // Execute the bundle
        assert(sandbox.docmd && typeof sandbox.docmd.compile === 'function', "docmd.compile is not exposed globally!");

        // Force the live editor to compile Markdown into HTML right here in Node
        // Because compile is now async, we must chain it or run it in an async IIFE, but we can't easily await inside sync vm.runInContext
        // Wait, sandbox.docmd.compile returns a Promise, so we can await it here.
        sandbox.docmd.compile('## Live Preview Failsafe', {
            siteTitle: 'Runtime Check',
            layout: { spa: false }
        }).then(liveHtml => {
            assert(liveHtml.includes('Live Preview Failsafe'), "Live compiler failed to output markdown content.");
            assert(!liveHtml.includes('Template'), "Live compiler reported a missing template or partial! Check your ejs files.");
            assert(liveHtml.includes('docmd-options-menu'), "Live compiler failed to render the options menu partial.");
        }).catch(err => {
            throw new Error(`Live Editor Runtime crashed! \\nDetails: ${err.message}`);
        });

    } catch (err) {
        throw new Error(`Live Editor Runtime crashed! \nDetails: ${err.message}`);
    }

    // 8. Plugin Installer End-to-End Verification
    console.log('\x1b[2m🔌 [8/14] Testing Plugin Installer Framework (add/remove)...\x1b[0m');

    // We create a dummy package.json in the zeroConfigDir so pnpm doesn't throw `ERR_PNPM_ADDING_TO_ROOT`.
    fs.writeFileSync(path.join(zeroConfigDir, 'package.json'), JSON.stringify({ name: "dummy-test-project", version: "1.0.0" }));

    runCmd(`node "${CLI_BIN}" add search`, zeroConfigDir);

    // Ensure the config file was created and injected
    const zeroConfigPath = path.join(zeroConfigDir, 'docmd.config.js');
    assert(fs.existsSync(zeroConfigPath), "docmd add search failed to scaffold a docmd.config.js in a raw directory.");

    let zcConfigContent = fs.readFileSync(zeroConfigPath, 'utf8');
    assert(zcConfigContent.includes("'search':"), "docmd add search failed to gracefully inject 'search' plugin config into the dummy file.");

    // Test the teardown (docmd remove search)
    runCmd(`node "${CLI_BIN}" remove search`, zeroConfigDir);
    zcConfigContent = fs.readFileSync(zeroConfigPath, 'utf8');
    assert(!zcConfigContent.includes("'search':"), "docmd remove search failed to wipe the 'search' configuration key.");

    // 9. Security Audit Check
    console.log('\x1b[2m🚨 [9/14] Checking for Vulnerabilities (Security Audit)...\x1b[0m');
    try {
        execSync('pnpm audit --audit-level=high', { cwd: CWD, stdio: 'pipe' });
        // console.log('\x1b[2m   ✅ Security Audit Passed.\x1b[0m');
    } catch (e) {
        throw new Error(`Security vulnerabilities found! Please run 'pnpm audit' and fix them before releasing.`);
    }

    // 10. Core Plugin Defaults — All 7 core plugins load without config
    console.log('\x1b[2m🔌 [10/14] Verifying Core Plugin Defaults (Zero-Config Activation)...\x1b[0m');

    // Build with NO plugins in config — all core plugins should activate
    const corePluginConfig = `
      export default {
        title: 'Plugin Test', url: 'https://test.com',
        src: 'docs', out: 'site-plugin-test'
      };
    `;
    fs.writeFileSync(path.join(tempDir, 'plugin-test.config.js'), corePluginConfig);
    runCmd(`node "${CLI_BIN}" build -c plugin-test.config.js`, tempDir);

    const ptIndex = fs.readFileSync(path.join(tempDir, 'site-plugin-test/index.html'), 'utf8');
    // Search plugin should inject its UI
    assert(ptIndex.includes('docmd-search') || ptIndex.includes('search'), 'Default search plugin failed to activate without config');
    // Sitemap should be generated
    assert(fs.existsSync(path.join(tempDir, 'site-plugin-test/sitemap.xml')), 'Default sitemap plugin failed to generate sitemap.xml');

    // Test explicit disable: plugins: { search: false }
    const disablePluginConfig = `
      export default {
        title: 'Disable Test', url: 'https://test.com',
        src: 'docs', out: 'site-disable-test',
        plugins: { search: false, sitemap: { enabled: false } }
      };
    `;
    fs.writeFileSync(path.join(tempDir, 'disable-test.config.js'), disablePluginConfig);
    runCmd(`node "${CLI_BIN}" build -c disable-test.config.js`, tempDir);
    assert(!fs.existsSync(path.join(tempDir, 'site-disable-test/sitemap.xml')), 'Sitemap plugin should be disabled when enabled: false');

    // 11. Zero-Config No Side Effects — must NOT create config files
    console.log('\x1b[2m🧹 [11/14] Verifying Zero-Config Has No Side Effects...\x1b[0m');

    const zcSideEffectDir = path.join(tempDir, 'zero-side-effect');
    fs.mkdirSync(path.join(zcSideEffectDir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(zcSideEffectDir, 'docs', 'index.md'), '# Side Effect Test');

    // Snapshot the directory before build
    const beforeFiles = new Set(fs.readdirSync(zcSideEffectDir));

    runCmd(`node "${CLI_BIN}" build -z`, zcSideEffectDir);

    const afterFiles = new Set(fs.readdirSync(zcSideEffectDir));
    // Only 'site' directory should be added
    for (const f of afterFiles) {
      if (!beforeFiles.has(f)) {
        assert(f === 'site', `Zero-Config created unexpected file/dir: ${f}`);
      }
    }
    assert(!fs.existsSync(path.join(zcSideEffectDir, 'docmd.config.js')), 'Zero-Config must NOT create a config file');
    assert(!fs.existsSync(path.join(zcSideEffectDir, 'navigation.json')), 'Zero-Config must NOT create a navigation.json');

    // Run twice — second run should be idempotent
    runCmd(`node "${CLI_BIN}" build -z`, zcSideEffectDir);
    assert(!fs.existsSync(path.join(zcSideEffectDir, 'docmd.config.js')), 'Zero-Config still clean after second run');

    // 12. docmdx Wrapper Verification
    console.log('\x1b[2m📦 [12/14] Verifying docmdx Wrapper Package...\x1b[0m');

    const docmdxPkgPath = path.join(CWD, 'packages/docmdx/package.json');
    assert(fs.existsSync(docmdxPkgPath), 'docmdx package.json exists');

    const docmdxPkg = JSON.parse(fs.readFileSync(docmdxPkgPath, 'utf8'));
    assert(docmdxPkg.bin && docmdxPkg.bin.docmdx, 'docmdx has bin entry');
    assert(docmdxPkg.dependencies && docmdxPkg.dependencies['@docmd/core'], 'docmdx depends on @docmd/core');

    const docmdxSrc = path.join(CWD, 'packages/docmdx/src/docmdx.ts');
    assert(fs.existsSync(docmdxSrc), 'docmdx source file exists');

    const docmdxContent = fs.readFileSync(docmdxSrc, 'utf8');
    assert(docmdxContent.includes('@docmd/core'), 'docmdx references @docmd/core');
    assert(docmdxContent.includes('zero-config') || docmdxContent.includes('zeroConfig') || docmdxContent.includes('-z'), 'docmdx supports zero-config mode');

    // 13. Navigation JSON Validation
    console.log('\x1b[2m🧭 [13/14] Validating Navigation JSON Structure...\x1b[0m');

    function validateNavEntry(entry, parentPath) {
      const loc = parentPath ? `${parentPath} > ${entry.title}` : entry.title;
      if (entry.path && !entry.external) {
        assert(typeof entry.path === 'string', `Nav path is string at: ${loc}`);
        assert(entry.path.startsWith('/') || entry.path.startsWith('http'), `Nav path should start with / at: ${loc}`);
      }
      if (entry.children) {
        assert(Array.isArray(entry.children), `Nav children is array at: ${loc}`);
        for (const child of entry.children) {
          validateNavEntry(child, loc);
        }
      }
    }

    // Validate docs navigation.json if it exists in the workspace root
    const docsNavPath = path.join(CWD, '..', 'docs', 'docs', 'navigation.json');
    if (fs.existsSync(docsNavPath)) {
      const docsNav = JSON.parse(fs.readFileSync(docsNavPath, 'utf8'));
      assert(Array.isArray(docsNav), 'Docs navigation.json is a valid array');
      for (const entry of docsNav) {
        validateNavEntry(entry, '');
      }
    }

    // 14. Monorepo & Publish Check
    console.log('\x1b[2m🏷️  [14/14] Verifying Monorepo Consistency & Dry Run Publish...\x1b[0m');
    const rootPkg = JSON.parse(fs.readFileSync(path.join(CWD, 'package.json'), 'utf8'));
    const rootVersion = rootPkg.version;

    function checkVersions(dir) {
        for (const entry of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, entry);
            if (fs.existsSync(path.join(fullPath, 'package.json'))) {
                const pkg = JSON.parse(fs.readFileSync(path.join(fullPath, 'package.json'), 'utf8'));
                assert(pkg.version === rootVersion, `Version mismatch in ${pkg.name}: expected ${rootVersion}, got ${pkg.version}`);
            } else if (fs.statSync(fullPath).isDirectory()) {
                checkVersions(fullPath);
            }
        }
    }
    checkVersions(path.join(CWD, 'packages'));

    runCmd('pnpm publish -r --dry-run --no-git-checks', CWD);



} catch (e) {
    console.error('\x1b[31m\x1b[1m\n❌ FAILSAFE CRITICAL FAILURE ❌\x1b[0m');
    console.error(e.message);
    process.exit(1);

} finally {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    if (fs.existsSync(LIVE_PUBLIC)) fs.rmSync(LIVE_PUBLIC, { recursive: true, force: true });
    if (fs.existsSync(TEMP_SCRIPT)) fs.rmSync(TEMP_SCRIPT, { force: true });
}