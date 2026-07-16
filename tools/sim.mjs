#!/usr/bin/env node
/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 *
 * sim : single-command live preview of unreleased docmd in a real consumer.
 *
 * Replaces ad-hoc manual steps (resolve-ws-deps + npm pack for every
 * package + copy to consumer/local-tars + reinstall + build) with one
 * invocation. Use to verify a release candidate before tagging.
 *
 * USAGE (from the docmd/ monorepo root):
 *   pnpm sim                      # build everything, then consumer dev
 *   pnpm sim --dev                # keep dev server running after the build
 *   pnpm sim --build              # consumer build only (no dev server)
 *   pnpm sim --push               # also commit + push consumer (triggers CI)
 *
 * SAFE TO RUN FROM THE MONOREPO:
 *   Packages are packed from a staging copy under $STAGING_DIR, never
 *   from the live monorepo working tree. Killing the script mid-run
 *   leaves /tmp dirty at most.
 * --------------------------------------------------------------------
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// CONFIGURATION — change these to point at any consumer project.
// ---------------------------------------------------------------------------

const MONOREPO_ROOT  = path.resolve(__dirname, '..');               // this repo
const CONSUMER_ROOT  = '/Users/mac/Workspace/GitHub/docmd-io/_brutetest/gh-sub-parent';
const CONSUMER_TARS  = path.join(CONSUMER_ROOT, 'local-tars');      // where tars land
const CONSUMER_CFG   = path.join(CONSUMER_ROOT, 'docmd.config.json');// consumer config
const CONSUMER_PKGS  = path.join(CONSUMER_ROOT, 'package.json');     // consumer manifest
const STAGING_DIR    = '/tmp/docmd-sim-staging';                     // copy of pkgs before pack
const TARBALL_DIR    = path.join(STAGING_DIR, 'tarballs');
const WORK_DIR       = '/tmp/docmd-sim-consumer';                    // throwaway consumer dir
const BRANCH         = 'main';                                       // git push target
const REMOTE         = 'origin';                                     // git remote name

// Packages to PACK into the consumer. Anything matching this prefix gets
// a fresh tarball. Keep narrow: only @docmd/* monorepo packages.
const PACKAGE_PREFIX = '@docmd/';

// Verbose: stream every command's output. Toggle with --verbose.
const ARGS = process.argv.slice(2);
const VERBOSE = ARGS.includes('--verbose') || ARGS.includes('--v');
const AFTER_DEV = ARGS.includes('--dev');            // keep dev server running
const BUILD_ONLY = ARGS.includes('--build');          // consumer build only
const DO_PUSH = ARGS.includes('--push');              // also git push consumer

// ---------------------------------------------------------------------------
// ANSI helpers (zero deps)
// ---------------------------------------------------------------------------

const DIM    = (s) => `\x1b[2m${s}\x1b[0m`;
const GREEN  = (s) => `\x1b[32m${s}\x1b[0m`;
const RED    = (s) => `\x1b[31m${s}\x1b[0m`;
const CYAN   = (s) => `\x1b[36m${s}\x1b[0m`;
const BOLD   = (s) => `\x1b[1m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;

const RESET  = '\x1b[0m';

function step(label, fn) {
  process.stdout.write(`  ${DIM('WAIT')} ${label}...`);
  try {
    const result = fn();
    process.stdout.write(`\r  ${GREEN('DONE')} ${label}      ${RESET}\n`);
    return result;
  } catch (err) {
    process.stdout.write(`\r  ${RED('FAIL')} ${label}      ${RESET}\n`);
    if (VERBOSE) console.error(err.stderr?.toString() || err.message);
    throw err;
  }
}

function run(cmd, opts = {}) {
  const merged = { encoding: 'utf8', stdio: VERBOSE ? 'inherit' : 'pipe', timeout: 180000, ...opts };
  return execSync(cmd, merged);
}

function rmrf(p) {
  if (fs.existsSync(p)) run(`rm -rf "${p}"`);
}

// ---------------------------------------------------------------------------
// STEP 1: Build the monorepo so fresh dist/ files exist in every package.
// ---------------------------------------------------------------------------

function buildMonorepo() {
  step('Building monorepo (pnpm -r run build)', () => {
    run('pnpm -r run build', { cwd: MONOREPO_ROOT });
  });
}

// ---------------------------------------------------------------------------
// STEP 2: Collect every @docmd/* package metadata from the monorepo.
// ---------------------------------------------------------------------------

function collectPackages() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir)) {
      if (entry.startsWith('_') || entry.startsWith('.')) continue;
      const full = path.join(dir, entry);
      const pkgJson = path.join(full, 'package.json');
      if (fs.existsSync(pkgJson)) {
        const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
        if (pkg.name && pkg.name.startsWith(PACKAGE_PREFIX)) {
          out.push({
            pkgDir: full,
            name: pkg.name,
            version: pkg.version,
            files: Array.isArray(pkg.files) ? pkg.files : ['dist'],
          });
        }
      } else if (fs.statSync(full).isDirectory()) {
        walk(full);
      }
    }
  };
  walk(path.join(MONOREPO_ROOT, 'packages'));
  return out;
}

// ---------------------------------------------------------------------------
// STEP 3: Copy each package to staging, rewrite workspace:* in the copy
// (NOT the monorepo), pack into tars, then copy the tars to the consumer.
// The monorepo working tree is NEVER mutated.
// ---------------------------------------------------------------------------

function packAndShip() {
  const packages = collectPackages();
  const versionMap = Object.fromEntries(packages.map((p) => [p.name, p.version]));

  rmrf(STAGING_DIR);
  fs.mkdirSync(TARBALL_DIR, { recursive: true });

  step(`Copying ${packages.length} packages to staging`, () => {
    for (const pkg of packages) {
      const flat = pkg.name.replace('@', '').replace('/', '-');
      const dest = path.join(STAGING_DIR, 'packages', flat);
      fs.mkdirSync(dest, { recursive: true });
      fs.copyFileSync(path.join(pkg.pkgDir, 'package.json'), path.join(dest, 'package.json'));
      for (const entry of pkg.files) {
        const src = path.join(pkg.pkgDir, entry);
        if (!fs.existsSync(src)) continue;
        const target = path.join(dest, entry);
        if (fs.statSync(src).isDirectory()) {
          run(`cp -R "${src}" "${target}"`);
        } else {
          fs.copyFileSync(src, target);
        }
      }
    }
  });

  step('Rewriting workspace:* in staging copies', () => {
    for (const pkg of packages) {
      const flat = pkg.name.replace('@', '').replace('/', '-');
      const pkgJson = path.join(STAGING_DIR, 'packages', flat, 'package.json');
      const data = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
      let changed = false;
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        if (!data[field]) continue;
        for (const dep in data[field]) {
          if (data[field][dep].startsWith('workspace:')) {
            const v = versionMap[dep];
            if (v) { data[field][dep] = `^${v}`; changed = true; }
          }
        }
      }
      if (changed) fs.writeFileSync(pkgJson, JSON.stringify(data, null, 2) + '\n', 'utf8');
    }
  });

  step(`Packing ${packages.length} tarballs`, () => {
    for (const pkg of packages) {
      const flat = pkg.name.replace('@', '').replace('/', '-');
      const pkgDir = path.join(STAGING_DIR, 'packages', flat);
      run(`npm pack --pack-destination "${TARBALL_DIR}"`, { cwd: pkgDir });
    }
  });

  step('Shipping tars into consumer/local-tars', () => {
    rmrf(CONSUMER_TARS);
    fs.mkdirSync(CONSUMER_TARS, { recursive: true });
    run(`cp ${TARBALL_DIR}/*.tgz "${CONSUMER_TARS}/"`);
  });

  step('Cleaning staging', () => rmrf(STAGING_DIR));
}

// ---------------------------------------------------------------------------
// STEP 4: Install the new tars in the consumer (in WORK_DIR copy) and run
// the consumer's build/dev command.
// ---------------------------------------------------------------------------

function buildConsumer() {
  // Copy consumer to a throwaway dir so we don't touch its working tree.
  rmrf(WORK_DIR);
  fs.mkdirSync(WORK_DIR, { recursive: true });
  step('Copying consumer to throwaway work dir', () => {
    run(`cp -R "${CONSUMER_ROOT}/." "${WORK_DIR}/"`);
    // Ensure installed deps are wiped so npm picks up the new tars.
    run(`rm -rf "${WORK_DIR}/node_modules" "${WORK_DIR}/package-lock.json" "${WORK_DIR}/site"`);
  });

  step('npm install (consumer)', () => {
    run('npm install', { cwd: WORK_DIR });
  });

  step('docmd build (consumer)', () => {
    run('npx docmd build', { cwd: WORK_DIR });
  });

  step('Syncing site/ back into consumer', () => {
    // Make the build output available to the real consumer dir for inspection.
    if (fs.existsSync(path.join(WORK_DIR, 'site'))) {
      rmrf(path.join(CONSUMER_ROOT, 'site'));
      run(`cp -R "${WORK_DIR}/site" "${CONSUMER_ROOT}/"`);
    }
  });
}

function startDevServer() {
  // Run docmd dev in the real consumer dir so the user can interact,
  // edit, and watch rebuilds happen in place.
  step('Starting dev server in consumer', () => {
    return new Promise((resolve, reject) => {
      const child = spawn('npx', ['docmd', 'dev'], { cwd: CONSUMER_ROOT, stdio: 'inherit' });
      process.on('SIGINT', () => { child.kill('SIGINT'); resolve(); });
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`dev exited ${code}`))));
    });
  });
}

// ---------------------------------------------------------------------------
// Optional: commit and push consumer (triggers GH Pages deploy).
// ---------------------------------------------------------------------------

function pushConsumer(message) {
  step('Committing consumer for CI deploy', () => {
    run('git add -A', { cwd: CONSUMER_ROOT });
    try {
      run(`git commit -m "${message}"`, { cwd: CONSUMER_ROOT });
      run(`git push ${REMOTE} ${BRANCH}`, { cwd: CONSUMER_ROOT });
    } catch {
      console.log(`  ${YELLOW('note')}: nothing to commit or push failed`);
    }
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async function main() {
  console.log();
  console.log(`  ${BOLD('docmd sim')} ${DIM('— single-command preview of unreleased changes')}`);
  console.log(`  ${DIM('monorepo: ' + MONOREPO_ROOT)}`);
  console.log(`  ${DIM('consumer: ' + CONSUMER_ROOT)}`);
  console.log();

  buildMonorepo();
  packAndShip();
  buildConsumer();

  console.log();
  if (BUILD_ONLY) {
    console.log(`  ${GREEN('build complete')} ${DIM('site/ synced into consumer for inspection')}`);
    process.exit(0);
  }

  if (DO_PUSH) {
    pushConsumer(`test: docmd sim preview (auto-generated)`);
    console.log();
    console.log(`  ${GREEN('pushed')} ${DIM(`watch CI: https://github.com/mgks/gh-sub-parent/actions`)}`);
    process.exit(0);
  }

  if (AFTER_DEV) {
    console.log(`  ${CYAN('starting dev server')}`);
    await startDevServer();
  } else {
    console.log(`  ${GREEN('done')} ${DIM('re-run with --dev to start the dev server, --push to deploy via CI')}`);
    process.exit(0);
  }
})().catch((err) => {
  console.error(`\n  ${RED('failure')}: ${err.message}\n`);
  process.exit(1);
});
