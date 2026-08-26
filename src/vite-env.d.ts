/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Build-time version stamp, injected by vite.config.ts. Plan section 4.
 */
declare const __APP_VERSION__: string

/**
 * Whether this bundle targets a native shell, injected by vite.config.ts.
 * Read through ui/platform, never directly.
 */
declare const __NATIVE_SHELL__: boolean
