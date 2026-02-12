const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CWD = process.cwd();
const CLI_BIN = path.join(CWD, 'packages/core/bin/docmd.js');
const LIVE_DIST = path.join(CWD, 'dist');
const TEMP_SCRIPT = path.join(CWD, 'temp-live-test.js');

console.log('🛡️  Running Monorepo Failsafe Integration Test...');
console.log(`   Target CLI: ${CLI_BIN}`);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docmd-failsafe-'));
console.log(`   Temp Workspace: ${tempDir}\n`);

try {
    // 1. Install Dependencies
    console.log('📦 [1/5] Installing Workspace Dependencies...');
    // We suppress output unless there's an error to keep the log clean
    execSync('pnpm install --silent', { stdio: 'inherit' });

    // 2. Initialize Project
    console.log('\n🚀 [2/5] Testing "docmd init"...');
    execSync(`node "${CLI_BIN}" init`, { cwd: tempDir, stdio: 'inherit' });

    // Simulate User Configuration (Fix missing siteUrl for sitemap)
    console.log('   ⚙️  Configuring project (Adding siteUrl)...');
    const configPath = path.join(tempDir, 'docmd.config.js');
    let configContent = fs.readFileSync(configPath, 'utf8');
    configContent = configContent.replace("siteUrl: '',", "siteUrl: 'https://failsafe.test',");
    fs.writeFileSync(configPath, configContent);

    // 3. Build Project
    console.log('\n🔨 [3/5] Testing "docmd build"...');
    execSync(`node "${CLI_BIN}" build`, { cwd: tempDir, stdio: 'inherit' });

    // 4. Verify Output Structure
    console.log('\n🔍 [4/5] Verifying Build Output...');
    const siteDir = path.join(tempDir, 'site');

    // Check HTML
    if (!fs.existsSync(path.join(siteDir, 'index.html'))) throw new Error('Build failed: index.html missing');
    
    // Check Assets (UI) - Look for docmd-main.css (New prefix)
    if (!fs.existsSync(path.join(siteDir, 'assets/css/docmd-main.css'))) {
        throw new Error('Build failed: UI assets missing (docmd-main.css)');
    }
    
    // Check Themes (Themes Package) - Look for docmd-theme-sky.css
    if (!fs.existsSync(path.join(siteDir, 'assets/css/docmd-theme-sky.css'))) {
        throw new Error('Build failed: Theme assets missing (docmd-theme-sky.css)');
    }
    
    // Check Plugins (Sitemap)
    if (!fs.existsSync(path.join(siteDir, 'sitemap.xml'))) throw new Error('Build failed: Sitemap plugin failed');
    
    // Check Plugins (Search)
    if (!fs.existsSync(path.join(siteDir, 'search-index.json'))) throw new Error('Build failed: Search plugin failed');
    
    // Check Search Asset Injection
    if (!fs.existsSync(path.join(siteDir, 'assets/js/docmd-search.js'))) throw new Error('Build failed: Plugin assets (docmd-search.js) missing');

    console.log('✅ verification passed.');

    // 5. Live Editor Build
    console.log('\n🎥 [5/5] Testing "docmd live" build...');
    
    // Ensure clean state before start
    if(fs.existsSync(LIVE_DIST)) fs.rmSync(LIVE_DIST, {recursive: true});
    
    // Run the build logic directly via a wrapper script
    // We pass { serve: false } to prevent the server from hanging the test
    const liveTestScriptContent = `
        const { buildLive } = require('./packages/core/src/commands/live');
        buildLive({ serve: false }).catch(e => { console.error(e); process.exit(1); });
    `;
    fs.writeFileSync(TEMP_SCRIPT, liveTestScriptContent);
    
    execSync(`node temp-live-test.js`, { cwd: CWD, stdio: 'inherit' });

    if (!fs.existsSync(path.join(LIVE_DIST, 'docmd-live.js'))) throw new Error('Live Editor build failed: docmd-live.js missing');
    if (!fs.existsSync(path.join(LIVE_DIST, 'index.html'))) throw new Error('Live Editor build failed: index.html missing');

    console.log('\n✨ ALL SYSTEMS GO. Monorepo is stable.');

} catch (e) {
    console.error('\n❌ FAILSAFE CRITICAL FAILURE');
    console.error(e.message);
    process.exit(1);
} finally {
    // --- 🧹 CLEANUP SECTION ---
    try {
        // 1. Remove Temp Workspace (/tmp/docmd-failsafe-...)
        if(fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        
        // 2. Remove Live Editor Dist (./dist)
        if(fs.existsSync(LIVE_DIST)) {
            fs.rmSync(LIVE_DIST, { recursive: true, force: true });
        }

        // 3. Remove Temp Script (./temp-live-test.js)
        if(fs.existsSync(TEMP_SCRIPT)) {
            fs.rmSync(TEMP_SCRIPT, { force: true });
        }
        
        console.log('🧹 Environment scrubbed.'); // Optional log
    } catch(e) {
        console.warn('⚠️ Cleanup warning:', e.message);
    }
}