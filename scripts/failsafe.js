/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025 docmd.io
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
const CLI_BIN = path.join(CWD, 'packages/core/bin/docmd.js');
const LIVE_DIST = path.join(CWD, 'dist');
const TEMP_SCRIPT = path.join(CWD, 'temp-live-test.js');

console.log('\n🛡️  Running Universal Failsafe...');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docmd-failsafe-'));
console.log(`   Temp Workspace: ${tempDir}\n`);

function assert(condition, message) {
    if (!condition) throw new Error(`❌ FAIL: ${message}`);
}

// Helper to safely run commands and capture errors
function runCmd(cmd, cwd) {
    try {
        execSync(cmd, { cwd, stdio: 'pipe' });
    } catch (e) {
        console.error(`\n💥 Command Failed: ${cmd}`);
        console.error(e.stderr.toString());
        console.error(e.stdout.toString());
        throw new Error("Process aborted due to command failure.");
    }
}

try {
    // 1. Install Dependencies
    console.log('📦 [1/8] Linking Workspace Dependencies...');
    runCmd('pnpm install --silent', CWD);

    // 2. Initialize Project
    console.log('🚀 [2/8] Initializing Project...');
    runCmd(`node "${CLI_BIN}" init`, tempDir);

    // 3. Inject Stress Tests (Deep Nesting & Deep Paths)
    console.log('🧪 [3/8] Injecting Stress Tests...');
    const docsDir = path.join(tempDir, 'docs');
    
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

    // 4. Create Paradigm Configs
    console.log('⚙️  [4/8] Creating Legacy & Modern Configs...');
    
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
      module.exports = {
        siteTitle: 'Modern Test', siteUrl: 'https://test.com',
        srcDir: 'docs', outputDir: 'site-modern',
        layout: {
          optionsMenu: { position: 'header', components: { search: true, themeSwitch: true, sponsor: 'https://sponsor.com' } },
          footer: { style: 'minimal', content: 'Modern Footer' }
        }
      };
    `;
    
    fs.writeFileSync(path.join(tempDir, 'legacy.config.js'), legacyConfig);
    fs.writeFileSync(path.join(tempDir, 'modern.config.js'), modernConfig);

    // 5. Build & Verify Both
    console.log('🔨 [5/8] Executing Dual Engine Builds...');
    runCmd(`node "${CLI_BIN}" build -c legacy.config.js`, tempDir);
    runCmd(`node "${CLI_BIN}" build -c modern.config.js`, tempDir);

    console.log('🔍 [6/8] Verifying Static Outputs...');
    
    const modernHtml = fs.readFileSync(path.join(tempDir, 'site-modern/index.html'), 'utf8');
    const stressHtml = fs.readFileSync(path.join(tempDir, 'site-modern/stress/index.html'), 'utf8');
    const deepHtml = fs.readFileSync(path.join(tempDir, 'site-modern/level1/level2/level3/deep/index.html'), 'utf8');

    assert(modernHtml.includes('docmd-options-menu'), "Options Menu missing in Modern Config");
    assert(modernHtml.includes('sponsor.com'), "Sponsor Link missing");
    assert(modernHtml.includes('Modern Footer'), "Footer missing");

    assert(!stressHtml.includes(':::'), "PARSER LEAK DETECTED: Found raw ':::' in HTML output!");
    assert(stressHtml.includes('class="docmd-container card"'), "Card container failed to render");
    assert(stressHtml.includes('class="docmd-container callout callout-warning"'), "Nested Callout failed to render");
    assert(stressHtml.includes('class="docmd-button"'), "Deep nested button failed to render");

    assert(deepHtml.includes('href="../../../../assets/css/docmd-main.css'), "CSS Relative Path calculation failed on deep folder!");

    // 7. Live Editor (COMPILE & RUNTIME TEST)
    console.log('🎥 [7/8] Testing "docmd live" build and RUNTIME Execution...');
    if(fs.existsSync(LIVE_DIST)) fs.rmSync(LIVE_DIST, {recursive: true});
    
    const liveTestScriptContent = `
        const { buildLive } = require('./packages/core/src/commands/live');
        buildLive({ serve: false }).catch(e => { console.error(e); process.exit(1); });
    `;
    fs.writeFileSync(TEMP_SCRIPT, liveTestScriptContent);
    runCmd(`node temp-live-test.js`, CWD);

    assert(fs.existsSync(path.join(LIVE_DIST, 'docmd-live.js')), "Live Editor bundle missing");

    // Live Test
    const liveBundle = fs.readFileSync(path.join(LIVE_DIST, 'docmd-live.js'), 'utf8');
    
    // Mock a minimal browser environment so the bundle can load
    const sandbox = { 
        window: { location: { host: 'localhost' } }, 
        document: { 
            documentElement: { getAttribute: () => 'light' },
            addEventListener: () => {},
            readyState: 'complete',
            querySelectorAll: () => [],
            querySelector: () => null,
            body: { classList: { add: () => {} }, dataset: {} },
            createElement: () => ({ setAttribute: () => {}, style: {} })
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
        const liveHtml = sandbox.docmd.compile('## Live Preview Failsafe', { 
            siteTitle: 'Runtime Check',
            layout: { spa: false }
        });
        
        assert(liveHtml.includes('Live Preview Failsafe'), "Live compiler failed to output markdown content.");
        assert(!liveHtml.includes('Template'), "Live compiler reported a missing template or partial! Check your ejs files.");
        assert(liveHtml.includes('docmd-options-menu'), "Live compiler failed to render the options menu partial.");
        
    } catch (err) {
        throw new Error(`Live Editor Runtime crashed! \nDetails: ${err.message}`);
    }

    // 8. Monorepo & Publish Check
    console.log('🏷️  [8/8] Verifying Monorepo Consistency & Dry Run Publish...');
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

    console.log('\n✅ ✨ ALL SYSTEMS GO. Ready to Publish. ✨');

} catch (e) {
    console.error('\n❌ FAILSAFE CRITICAL FAILURE ❌');
    console.error(e.message);
    process.exit(1);

} finally {
    if(fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    if(fs.existsSync(LIVE_DIST)) fs.rmSync(LIVE_DIST, { recursive: true, force: true });
    if(fs.existsSync(TEMP_SCRIPT)) fs.rmSync(TEMP_SCRIPT, { force: true });
}