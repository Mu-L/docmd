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
 */

import fs from 'node:fs/promises';


export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function remove(dirPath: string) {
  await fs.rm(dirPath, { recursive: true, force: true });
}

export async function copy(src: string, dest: string, retryCount = 0): Promise<void> {
  try {
    await fs.cp(src, dest, { recursive: true });
  } catch (err: any) {
    if (err.code === 'ENOENT' && retryCount < 2) {
      // macOS Node.js recursive copy race condition over external IDE operations:
      // Sleep for 50ms and retry to securely shield the user from 'ghost unlinks'.
      await new Promise(r => setTimeout(r, 50));
      return copy(src, dest, retryCount + 1);
    }
    throw err;
  }
}

export async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export const pathExists = exists;

export async function writeJson(file: string, object: any, options: any = {}) {
  const content = JSON.stringify(object, null, options.spaces || 2);
  await fs.writeFile(file, content, 'utf8');
}

export default {
  ...fs,
  ensureDir,
  remove,
  copy,
  pathExists: exists,
  exists,
  writeJson
};