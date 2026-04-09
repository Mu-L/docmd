/**
 * Global type declarations for the docmd browser runtime,
 * used in Playwright page.evaluate() contexts.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const docmd: {
  call: (action: string, payload: Record<string, unknown>) => Promise<any>;
};