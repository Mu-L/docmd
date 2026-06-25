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

const fs = require("fs");
const path = require("path");

const newVersion = process.argv[2];

if (!newVersion) {
  console.error("Usage: node tools/bump-version.js <new-version>");
  process.exit(1);
}

const root = process.cwd();
const packagesDir = path.join(root, "packages");

function updateVersion(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log(`Updated: ${pkg.name} → ${newVersion}`);
}

function updateSourceVersion(pkgDir) {
  const indexPath = path.join(pkgDir, "src", "index.ts");
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, "utf8");
    const versionRegex = /version:\s*(['"])(.*?)(['"])/g;
    // Update any file in src/index.ts that has a version property
    if (versionRegex.test(content)) {
      content = content.replace(versionRegex, `version: $1${newVersion}$3`);
      fs.writeFileSync(indexPath, content);
      console.log(`Updated Source Version: ${path.basename(pkgDir)} → ${newVersion}`);
    }
  }
}

function updateCargoVersion(pkgDir) {
  const cargoPath = path.join(pkgDir, "native", "Cargo.toml");
  if (fs.existsSync(cargoPath)) {
    let content = fs.readFileSync(cargoPath, "utf8");
    const versionRegex = /version\s*=\s*(['"])(.*?)(['"])/;
    if (versionRegex.test(content)) {
      content = content.replace(versionRegex, `version     = "${newVersion}"`);
      fs.writeFileSync(cargoPath, content);
      console.log(`Updated Cargo Version: ${path.basename(pkgDir)} → ${newVersion}`);
    }
  }
}

function updateDockerVersion() {
  // Update Docker workflow if it exists
  const dockerWorkflowPath = path.join(root, ".github", "workflows", "docker-publish.yml");
  if (fs.existsSync(dockerWorkflowPath)) {
    let content = fs.readFileSync(dockerWorkflowPath, "utf8");
    // Update any hardcoded version references in comments or examples
    // This is mainly for documentation purposes in the workflow
    const versionCommentRegex = /# Version:\s*v?[\d.]+/g;
    if (versionCommentRegex.test(content)) {
      content = content.replace(versionCommentRegex, `# Version: v${newVersion}`);
      fs.writeFileSync(dockerWorkflowPath, content);
      console.log(`Updated Docker Workflow Version → ${newVersion}`);
    }
  }
}

// 1️⃣ Update root
updateVersion(path.join(root, "package.json"));

// 2️⃣ Update Docker version references
updateDockerVersion();

// 2️⃣ Recursively update all packages
function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    if (['node_modules', 'dist', '.build'].includes(entry)) continue;

    const full = path.join(dir, entry);

    if (fs.existsSync(path.join(full, "package.json"))) {
      updateVersion(path.join(full, "package.json"));
      updateSourceVersion(full);
      updateCargoVersion(full);
    } else if (fs.statSync(full).isDirectory()) {
      walk(full);
    }
  }
}

walk(packagesDir);

console.log("Version bump complete.");