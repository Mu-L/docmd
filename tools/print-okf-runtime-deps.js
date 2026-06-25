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
 *
 * Prints the external (non-@docmd) runtime dependencies of the @docmd/core
 * package and its transitive deps, sorted alphabetically. The output is the
 * exact list that docker/Dockerfile installs via `npm install -g` in the
 * production stage. Run this whenever a new external dep is added to any
 * @docmd/* package and update the Dockerfile accordingly.
 */

const fs = require("fs");
const path = require("path");

const root = process.cwd();

function findPackageDir(name, dir = path.join(root, "packages")) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    const pj = path.join(full, "package.json");
    if (fs.existsSync(pj)) {
      const pkg = JSON.parse(fs.readFileSync(pj, "utf8"));
      if (pkg.name === name) return full;
    }
    const r = findPackageDir(name, full);
    if (r) return r;
  }
  return null;
}

function collectDeps(name, seen = new Set()) {
  if (seen.has(name)) return seen;
  seen.add(name);
  const dir = findPackageDir(name);
  if (!dir) return seen;
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  for (const dep of Object.keys(pkg.dependencies || {})) {
    if (dep.startsWith("@docmd/")) collectDeps(dep, seen);
  }
  return seen;
}

const internal = collectDeps("@docmd/core");
const external = new Map();

for (const name of internal) {
  const dir = findPackageDir(name);
  if (!dir) continue;
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  for (const [dep, range] of Object.entries(pkg.dependencies || {})) {
    if (dep.startsWith("@docmd/")) continue;
    if (dep.startsWith("@mgks/")) continue;
    if (!external.has(dep)) external.set(dep, range);
  }
}

const lines = [...external].sort(([a], [b]) => a.localeCompare(b));
for (const [dep, range] of lines) {
  console.log(`${dep}@${range}`);
}