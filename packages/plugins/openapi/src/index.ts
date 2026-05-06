/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/plugin-openapi
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import type { PluginDescriptor } from '@docmd/api';

export const plugin: PluginDescriptor = {
  name: 'openapi',
  version: '0.7.9',
  capabilities: ['body', 'head']
};

/**
 * Handle OpenAPI markdown block rendering.
 * You can define a custom tag or use frontmatter to trigger OpenAPI rendering.
 */
export function onPageReady(pageObj: any): void {
  // Logic to inject Swagger UI or Redoc into the page based on OpenAPI spec
  const config = pageObj.config?.plugins?.openapi;
  if (!config) return;

  // Example: If a page has `openapi: path/to/spec.yaml` in its frontmatter
  if (pageObj.frontmatter?.openapi) {
    const specPath = pageObj.frontmatter.openapi;
    
    // Inject the spec UI wrapper into the HTML
    pageObj.html = `
      <div id="swagger-ui" data-spec-path="${specPath}"></div>
      ${pageObj.html}
    `;
  }
}

export function generateScripts(config: any): { headScriptsHtml: string; bodyScriptsHtml: string } {
  // Logic to inject Swagger UI / Redoc script tags
  return {
    headScriptsHtml: `
      <!-- Inject OpenAPI CSS (e.g. Swagger UI CSS) -->
    `,
    bodyScriptsHtml: `
      <!-- Inject OpenAPI JS and initialization script -->
    `
  };
}
