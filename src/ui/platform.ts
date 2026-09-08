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
 * How long to wait for `deviceready` before giving up on it.
 *
 * Cordova fires the event within a few hundred milliseconds of the webview
 * loading, so a second is generous. It is not tuned: nothing depends on the exact
 * value, only on there being one.
 */
const DEVICEREADY_TIMEOUT_MS = 1000

/**
 * Resolves when Cordova fires `deviceready`, or when waiting stops being worth it.
 *
 * Exported for its test. The timeout is the point: waiting for the shell is an
 * optimisation — the back button binding needs Cordova, the game does not — and an
 * unbounded wait turns a missing shell into an app that never draws anything.
 *
 * The first Android build shipped a page that never referenced `cordova.js`, so
 * nothing was ever going to fire the event and it opened to a blank screen. See
 * `.learnings/deviceready-needs-cordova-js.md`.
 */
export function waitForDeviceReady(timeoutMs = DEVICEREADY_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(() => {
      console.warn('deviceready did not fire; mounting without the Cordova shell.')
      resolve()
    }, timeoutMs)

    document.addEventListener(
      'deviceready',
      () => {
        globalThis.clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
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

  return waitForDeviceReady()
}

/**
 * Routes the Android hardware back button through a handler.
 *
 * Cordova fires `backbutton` on the document once `deviceready` has run, and
 * overriding it means the app decides what back does. Returning false from the
 * handler means "nothing left to leave", at which point the app should exit —
 * which is the one case where the default behaviour is right.
 *
 * Plan section 8.6: back leaves the current screen, and exits only from home.
 */
export function bindBackButton(handle: () => boolean): () => void {
  if (!isNativeShell()) {
    return () => {}
  }

  const onBack = (): void => {
    if (handle()) {
      return
    }
    const exit = (
      globalThis as unknown as { navigator?: { app?: { exitApp?: () => void } } }
    ).navigator?.app?.exitApp
    exit?.()
  }

  document.addEventListener('backbutton', onBack)
  return () => document.removeEventListener('backbutton', onBack)
}
