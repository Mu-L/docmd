/**
 * Global type declarations for the docmd browser runtime,
 * used in Playwright page.evaluate() contexts.
 */

declare const docmd: {
  call: (action: string, payload: Record<string, unknown>) => Promise<any>;
};