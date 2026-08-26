import { mountApp } from './ui/app'
import { appVersion, whenPlatformReady } from './ui/platform'

const app = document.querySelector<HTMLDivElement>('#app')

if (app === null) {
  throw new Error('Mount point #app is missing from index.html')
}

// The board mounts first and nothing may prevent it. The service worker and its
// update prompt arrive at M5; launching with no network outranks update freshness.
void whenPlatformReady().then(() => {
  mountApp(app, { version: appVersion() })
})
