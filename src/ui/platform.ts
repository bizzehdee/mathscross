/**
 * Platform differences, in one place.
 *
 * Every branch on "is this a native shell" lives here. The rest of the
 * application must not read __NATIVE_SHELL__ or sniff the user agent.
 * Plan sections 4 and 9.2.
 */

/** Whether this bundle was built for a Cordova shell rather than the web. */
export function isNativeShell(): boolean {
  return __NATIVE_SHELL__
}

/** The version stamped into the bundle at build time. */
export function appVersion(): string {
  return __APP_VERSION__
}

/**
 * Resolves once the platform is ready to be driven.
 *
 * A Cordova shell must wait for `deviceready` before native APIs exist. The web
 * has no such event and is ready immediately, so waiting for one there would
 * hang forever.
 */
export function whenPlatformReady(): Promise<void> {
  if (!isNativeShell()) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    document.addEventListener('deviceready', () => resolve(), { once: true })
  })
}
