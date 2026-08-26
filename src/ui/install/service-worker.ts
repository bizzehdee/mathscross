/**
 * Service worker registration, with a prompt rather than an automatic reload.
 * Plan section 4.
 *
 * `registerType: 'prompt'` is set in the Vite config for one reason: a worker swap
 * must never discard an in-progress puzzle. `autoUpdate` activates and reloads
 * without asking, which on this app means a player's half-solved board vanishes
 * because a deploy happened. The new version waits until the player says so.
 *
 * Registration failing is not an error worth surfacing. The app is fully playable
 * without a service worker; all that is lost is offline capability on a second
 * visit, and there is nothing a player could do about it anyway.
 */
import { registerSW } from 'virtual:pwa-register'
import { isNativeShell } from '../platform'

export interface ServiceWorkerHandle {
  /** Activates the waiting worker and reloads. Resolves if it does not. */
  readonly applyUpdate: () => Promise<void>
}

export interface RegisterOptions {
  /** Called when a new version is waiting. */
  readonly onUpdateReady: () => void
}

export function registerServiceWorker(options: RegisterOptions): ServiceWorkerHandle {
  // A native shell already holds every asset on the device, so there is nothing
  // for a worker to cache and no update for it to find: the store ships new
  // versions instead. The PWA plugin emits no worker for that target either, so
  // this guard stops the registration code running against a stub.
  if (isNativeShell()) {
    return { applyUpdate: async () => {} }
  }

  try {
    const update = registerSW({
      immediate: true,
      onNeedRefresh: options.onUpdateReady,
    })
    return {
      applyUpdate: async () => {
        await update(true)
      },
    }
  } catch {
    // No service worker support, an insecure context, or a browser profile that
    // disallows it. None of these should reach the player.
    return { applyUpdate: async () => {} }
  }
}

/** The version stamped into the bundle at build time. */
export function appVersion(): string {
  return __APP_VERSION__
}
