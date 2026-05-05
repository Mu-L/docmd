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
  console.error("Usage: node scripts/bump-version.js <new-version>");
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

function updatePluginDescriptor(pkgDir) {
  const pluginIndexPath = path.join(pkgDir, "src", "index.ts");
  if (fs.existsSync(pluginIndexPath)) {
    let content = fs.readFileSync(pluginIndexPath, "utf8");
    const versionRegex = /version:\s*(['"])(.*?)(['"])/g;
    if (content.includes('PluginDescriptor') && versionRegex.test(content)) {
      content = content.replace(versionRegex, `version: $1${newVersion}$3`);
      fs.writeFileSync(pluginIndexPath, content);
      console.log(`Updated PluginDescriptor: ${path.basename(pkgDir)} → ${newVersion}`);
    }
  }
}

// 1️⃣ Update root
updateVersion(path.join(root, "package.json"));

// 2️⃣ Recursively update all packages
function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    if (['node_modules', 'dist', '.build'].includes(entry)) continue;

    const full = path.join(dir, entry);

    if (fs.existsSync(path.join(full, "package.json"))) {
      updateVersion(path.join(full, "package.json"));
      updatePluginDescriptor(full);
    } else if (fs.statSync(full).isDirectory()) {
      walk(full);
    }
  }
}

walk(packagesDir);

console.log("Version bump complete.");