/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/deployer
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

/** Normalised project context shared across all deployment providers. */
export interface DeployContext {
  title: string;
  outDir: string;
  siteUrl: string | null;
  hostname: string;
  isSpa: boolean;
  configFile: string | null;
  version: string;
}