import path from 'node:path';

/**
 * Normalises a file path to use forward slashes.
 */
export function normalisePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}