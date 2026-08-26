# A Cordova shell must serve the bundle from an origin, not from file://

Established in the Sudoku project, 2026-08-26, while adding its native build
target. Copied here because MathsCross uses the same shell arrangement and the
fact is a platform property, not a project one. Not yet verified against a
MathsCross build: the native shell arrives at M6, and this entry is the reason it
will be configured correctly the first time.

## The fact

A Cordova webview can load the application two ways, and the choice decides
whether `localStorage` survives.

Under `file://` there is no origin. The webview then treats script-writable
storage as belonging to no site in particular, and does not guarantee it across
app restarts or upgrades. `file://` is also not a secure context, which removes
`navigator.clipboard` and `navigator.serviceWorker` entirely.

The same local files can instead be served through a scheme handler under a
synthetic origin: `https://localhost` on Android via `WebViewAssetLoader`,
`app://localhost` on iOS. That gives a stable origin, durable storage, and a
secure context. Both are the modern default, and both should be set explicitly in
`native/config.xml` so that a future edit has to be deliberate:

```xml
<preference name="AndroidInsecureFileModeEnabled" value="false" />
<preference name="scheme" value="https" />
<preference name="hostname" value="localhost" />
```

## Why it matters here

MathsCross keeps stats, settings, completed daily date keys and two in-progress
boards in `localStorage`, with no server to recover any of it from. Losing the
origin loses the player's history and their streak.

The storage failure is **silent**, which is what makes it dangerous. Nothing
breaks at build time and nothing breaks on first run; the loss appears only after
an app upgrade.

## The related trap

Two absolute paths also break under `file://`, which is why the native build sets
Vite's `base` to `'./'`: `/assets/index.js` resolves against the filesystem root
rather than the app, and the page loads nothing at all. That failure is loud and
immediate. Keep the relative base anyway, as a backstop against the scheme
preferences being lost later — a loud failure is far better than the silent one.

## Where this applies again

Any change to the `scheme` or `hostname` preferences, any move to a different
webview plugin, and any future use of an API that requires a secure context.
