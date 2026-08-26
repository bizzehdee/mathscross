import { mountApp } from './ui/app'
import { registerServiceWorker } from './ui/install/service-worker'
import { appVersion, bindBackButton, isNativeShell, whenPlatformReady } from './ui/platform'

const app = document.querySelector<HTMLDivElement>('#app')

if (app === null) {
  throw new Error('Mount point #app is missing from index.html')
}

// The board mounts first, and nothing below may prevent it. Launching with no
// network outranks update freshness.
void whenPlatformReady().then(() => {
  mountApp(app, { version: appVersion() })

  // Back leaves the current screen, and exits only from home. Plan section 8.6.
  bindBackButton(() => {
    const back = (app as unknown as Record<string, unknown>)['mathscrossBack']
    return typeof back === 'function' ? (back as () => boolean)() : false
  })

  if (isNativeShell()) {
    return
  }

  // Declared before use, so the callback cannot read it before assignment even if
  // the worker reported an update during registration.
  let applyUpdate: () => Promise<void> = async () => {}

  const worker = registerServiceWorker({
    onUpdateReady: () => {
      const show = (app as unknown as Record<string, unknown>)['mathscrossShowUpdate']
      if (typeof show === 'function') {
        ;(show as (apply: () => Promise<void>) => void)(() => applyUpdate())
      }
    },
  })
  applyUpdate = worker.applyUpdate
})
