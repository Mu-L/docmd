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
 * Consolidated multi-stage integrity checks.
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

console.log(`\x1b[34m│\x1b[0m  \x1b[1mUNIVERSAL FAILSAFE\x1b[0m`);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docmd-failsafe-'));
console.log(`\x1b[34m│\x1b[0m  \x1b[2mWorkspace: ${tempDir}\x1b[0m`);
console.log(`\x1b[34m│\x1b[0m`);

function assert(condition, message) {
    if (!condition) throw new Error(`❌ FAIL: ${message}`);
}

function runCmd(cmd, cwd) {
    try {
        execSync(cmd, { cwd, stdio: 'pipe' });
    } catch (e) {
        process.stdout.write(` \x1b[31m[ ERROR ]\x1b[0m\n`);
        console.error(`\n\x1b[31m\x1b[1m┌─ Failsafe Command Failed\x1b[0m`);
        console.error(`\x1b[31m│\x1b[0m  \x1b[2mCommand:\x1b[0m ${cmd}`);
        if (e.stderr) {
            console.error(`\x1b[31m│\x1b[0m  \x1b[2mError:\x1b[0m`);
            console.error(e.stderr.toString().split('\n').map(l => `\x1b[31m│\x1b[0m  ${l}`).join('\n'));
        }
        console.error(`\x1b[31m└──────────────────────────────────────────────────────────\x1b[0m`);
        throw new Error("Process aborted due to command failure.");
    }
}

const args = process.argv.slice(2);
const skipSetup = args.includes('--skip-setup');

try {
    const rootPkg = JSON.parse(fs.readFileSync(path.join(CWD, 'package.json'), 'utf8'));
    const rootVersion = rootPkg.version;

    // --- PILLAR 1: MONOREPO FOUNDATIONS & INTEGRITY ---
    process.stdout.write(`\x1b[34m│\x1b[0m  \x1b[2m[1/7] Monorepo Integrity\x1b[0m`.padEnd(55));
    if (!skipSetup) {
        runCmd('pnpm install --silent', CWD);
        runCmd('pnpm run lint', CWD);
        runCmd('pnpm run build', CWD);
    }
    
    // Integrity Check (Version Sync)
    function checkIntegrity(dir) {
        for (const entry of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, entry);
            if (fs.existsSync(path.join(fullPath, 'package.json'))) {
                const pkg = JSON.parse(fs.readFileSync(path.join(fullPath, 'package.json'), 'utf8'));
                assert(pkg.version === rootVersion, `Version mismatch in ${pkg.name}: ${pkg.version} != ${rootVersion}`);
                const chk = (deps) => {
                    if (!deps) return;
                    for (const [n, v] of Object.entries(deps)) {
                        if (n.startsWith('@docmd/') && v !== 'workspace:*' && v !== rootVersion) {
                            throw new Error(`Outdated internal ref in ${pkg.name}: ${n}@${v}`);
                        }
                    }
                };
                chk(pkg.dependencies); chk(pkg.peerDependencies);
            } else if (fs.statSync(fullPath).isDirectory() && entry !== 'node_modules') {
                checkIntegrity(fullPath);
            }
        }
    }
    checkIntegrity(path.join(CWD, 'packages'));
    runCmd('pnpm publish -r --dry-run --no-git-checks', CWD);
    process.stdout.write(` \x1b[32m[ DONE ]\x1b[0m\n`);


    // --- PILLAR 2: PROJECT LIFECYCLE & CONTENT INJECTION ---
    process.stdout.write(`\x1b[34m│\x1b[0m  \x1b[2m[2/7] Project Lifecycle\x1b[0m`.padEnd(55));
    runCmd(`node "${CLI_BIN}" init`, tempDir);
    
    const docsDir = path.join(tempDir, 'docs');
    const docsV1Dir = path.join(tempDir, 'docs-v1');
    const zeroDocsDir = path.join(tempDir, 'zero-docs');
    fs.mkdirSync(docsV1Dir, { recursive: true });
    fs.mkdirSync(path.join(zeroDocsDir, 'docs'), { recursive: true });

    fs.writeFileSync(path.join(docsDir, 'stress.md'), `---\ntitle: "Stress"\n---\n::: card\n::: callout\n# Content\n:::\n:::\n`);
    fs.writeFileSync(path.join(docsV1Dir, 'index.md'), '# V1');
    fs.writeFileSync(path.join(zeroDocsDir, 'docs', 'index.md'), '# Zero');
    process.stdout.write(` \x1b[32m[ DONE ]\x1b[0m\n`);


    // --- PILLAR 3: ENGINE RELIABILITY (MULTI-PARADIGM BUILDS) ---
    process.stdout.write(`\x1b[34m│\x1b[0m  \x1b[2m[3/7] Engine Reliability\x1b[0m`.padEnd(55));
    const configs = [
        { name: 'legacy.config.cjs', content: `module.exports = { siteTitle: 'Legacy', srcDir: 'docs', outputDir: 'site-legacy' };` },
        { name: 'modern.config.js', content: `export default { title: 'Modern', url: 'https://test.com', src: 'docs', out: 'site-modern', versions: { current: 'v2', all:[{ id: 'v2', dir: 'docs', label: 'v2' }] } };` }
    ];
    for (const c of configs) {
        fs.writeFileSync(path.join(tempDir, c.name), c.content);
        runCmd(`node "${CLI_BIN}" build -c ${c.name}`, tempDir);
    }
    
    assert(fs.readFileSync(path.join(tempDir, 'site-modern/index.html'), 'utf8').includes('Modern'), "Modern build failed");
    assert(fs.readFileSync(path.join(tempDir, 'site-modern/stress/index.html'), 'utf8').includes('docmd-container card'), "Parser leakage detected");
    process.stdout.write(` \x1b[32m[ DONE ]\x1b[0m\n`);


    // --- PILLAR 4: PLUGIN ECOSYSTEM LIFECYCLE ---
    process.stdout.write(`\x1b[34m│\x1b[0m  \x1b[2m[4/7] Plugin Ecosystem\x1b[0m`.padEnd(55));
    const pTest = path.join(tempDir, 'plugin-test');
    fs.mkdirSync(pTest); 
    fs.writeFileSync(path.join(pTest, 'package.json'), JSON.stringify({ name: 'p-test', version: '1.0.0' }));
    
    // Test Installer
    runCmd(`node "${CLI_BIN}" add search`, pTest);
    assert(fs.readFileSync(path.join(pTest, 'docmd.config.js'), 'utf8').includes("'search':"), "Plugin install failed");
    
    // Test Defaults (Core plugins)
    const pDefaults = path.join(tempDir, 'plugin-defaults');
    fs.mkdirSync(path.join(pDefaults, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(pDefaults, 'docs', 'index.md'), '# Default Test');
    fs.writeFileSync(path.join(pDefaults, 'docmd.config.js'), "export default { title: 'Test', url: 'https://t.com' };");
    runCmd(`node "${CLI_BIN}" build`, pDefaults);
    assert(fs.existsSync(path.join(pDefaults, 'site/sitemap.xml')), "Core sitemap plugin failed");
    process.stdout.write(` \x1b[32m[ DONE ]\x1b[0m\n`);


    // --- PILLAR 5: RUNTIME & DEPLOYMENT READINESS ---
    process.stdout.write(`\x1b[34m│\x1b[0m  \x1b[2m[5/7] Runtime Readiness\x1b[0m`.padEnd(55));
    
    // Live Runtime
    if (fs.existsSync(LIVE_PUBLIC)) fs.rmSync(LIVE_PUBLIC, { recursive: true });
    fs.writeFileSync(TEMP_SCRIPT, `import { buildLive } from './packages/core/dist/commands/live.js'; buildLive({ serve: false });`);
    runCmd(`node temp-live-test.mjs`, CWD);
    const sandbox = { window: { location: { host: 'l' } }, document: { compatMode: 'CSS1Compat', documentElement: { getAttribute: () => 'l' }, addEventListener: () => { }, body: { classList: { add: () => { } }, dataset: {} }, querySelectorAll: () => [], createElement: () => ({ setAttribute: () => { }, style: {} }) }, console, setTimeout, clearTimeout, Buffer };
    sandbox.globalThis = sandbox; sandbox.self = sandbox; sandbox.window.document = sandbox.document;
    vm.createContext(sandbox); vm.runInContext(fs.readFileSync(path.join(LIVE_PUBLIC, 'docmd-live.js'), 'utf8'), sandbox);
    assert(typeof sandbox.docmd.compile === 'function', "Live runtime compile missing");

    // Deploy Smoke Test
    const dTest = path.join(tempDir, 'deploy-smoke');
    fs.mkdirSync(dTest);
    runCmd(`node "${CLI_BIN}" deploy --docker --nginx --caddy`, dTest);
    assert(fs.readFileSync(path.join(dTest, 'Dockerfile'), 'utf8').includes(rootVersion), "Deploy version pin failed");
    process.stdout.write(` \x1b[32m[ DONE ]\x1b[0m\n`);


    // --- PILLAR 6: INFRASTRUCTURE HEALTH (ZERO-CONFIG & NAVIGATION) ---
    process.stdout.write(`\x1b[34m│\x1b[0m  \x1b[2m[6/7] Infrastructure Health\x1b[0m`.padEnd(55));
    
    // ZeroConfig leak test
    runCmd(`node "${CLI_BIN}" build`, zeroDocsDir);
    const leaks = fs.readdirSync(zeroDocsDir).filter(f => f === 'navigation.json' || f === 'docmd.config.js');
    assert(leaks.length === 0, `Leaks detected in ZeroConfig: ${leaks.join(', ')}`);
    
    // Nav JSON integrity
    const nPath = path.join(CWD, '..', 'docs', 'docs', 'navigation.json');
    if (fs.existsSync(nPath)) JSON.parse(fs.readFileSync(nPath, 'utf8'));
    process.stdout.write(` \x1b[32m[ DONE ]\x1b[0m\n`);


    // --- PILLAR 7: SECURITY & FINAL RELEASE VERIFICATION ---
    process.stdout.write(`\x1b[34m│\x1b[0m  \x1b[2m[7/7] Security Verification\x1b[0m`.padEnd(55));
    
    // Security Audit
    try { 
        execSync('pnpm audit --audit-level=moderate', { cwd: CWD, stdio: 'pipe' }); 
    } catch (e) { 
        const out = e.stdout ? e.stdout.toString() : '';
        if (out.includes('vulnerabilities found') || out.includes('Severity:')) {
            process.stdout.write(' 💥\n');
            console.error(`\x1b[31m\x1b[1m💥 Security Audit Failed:\x1b[0m Vulnerabilities detected!`);
            console.error(out);
            throw new Error("Process aborted due to security vulnerabilities.");
        } else {
            process.stdout.write(` \x1b[33m[ WARN ]\x1b[0m\n`); 
            console.warn(`\x1b[34m│\x1b[0m  \x1b[33mWarning:\x1b[0m Registry endpoint might be unreachable or audit failed.`); 
        }
    }
    
    // The Final Gate: Bulletproof Dry-Run Publish
    runCmd('pnpm publish -r --dry-run --no-git-checks', CWD);
    
    process.stdout.write(` \x1b[32m[ DONE ]\x1b[0m\n`);

} catch (e) {
    if (!e.message.includes('Process aborted')) console.error(e.message);
    console.error('\x1b[31m\x1b[1m\n[ CRITICAL FAILURE ]\x1b[0m');
    process.exit(1);
} finally {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    if (fs.existsSync(LIVE_PUBLIC)) fs.rmSync(LIVE_PUBLIC, { recursive: true, force: true });
    if (fs.existsSync(TEMP_SCRIPT)) fs.rmSync(TEMP_SCRIPT, { force: true });
}