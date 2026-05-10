import { createHash } from 'node:crypto';

/**
 * Generates an MD5 hash of the given string.
 * This is used for fast caching checks.
 */
export function md5(content: string): string {
  return createHash('md5').update(content).digest('hex');
}