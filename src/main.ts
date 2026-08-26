import { appVersion, whenPlatformReady } from './ui/platform'

const app = document.querySelector<HTMLDivElement>('#app')

if (app === null) {
  throw new Error('Mount point #app is missing from index.html')
}

// M0 mounts a placeholder only. The board, the keypad and the generating state
// arrive at M3; the service worker and its update prompt arrive at M5. What this
// proves today is that both build targets produce a page that runs, that the two
// injected defines resolve, and that the theme tokens apply.
void whenPlatformReady().then(() => {
  mountPlaceholder(app, appVersion())
})

function mountPlaceholder(mount: HTMLDivElement, version: string): void {
  const header = document.createElement('header')
  header.className = 'header'

  const title = document.createElement('h1')
  title.textContent = 'MathsCross'
  header.append(title)

  const status = document.createElement('p')
  status.className = 'status'
  status.textContent = `Scaffolded. Version ${version}.`

  mount.append(header, status)
}
