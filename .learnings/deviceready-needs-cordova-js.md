# `deviceready` never fires unless the page loads `cordova.js`

Established 2026-09-08, from a build that ran on a phone and showed a blank screen
after launch. The same defect is the reason Google Play rejected the first
submission with "Your app does not open or load".

## The fact

Cordova does not inject its own runtime into the page. `cordova.js` is generated per
platform and copied into `assets/www` by `cordova prepare`, and the page has to ask
for it:

```html
<script src="cordova.js"></script>
```

Nothing warns when it does not. The file is not in `native/www` on disk — it appears
only in the packaged app — so a local build cannot notice that the tag is missing,
and Cordova has no opinion about the contents of the HTML it packages.

Without the tag there is no Cordova object and nothing to fire `deviceready`.
`src/main.ts` waited for the event before mounting:

```ts
void whenPlatformReady().then(() => { mountApp(app, ...) })
```

so the wait never ended, `mountApp` never ran, and the webview correctly rendered an
empty `<div id="app">`. The page loaded perfectly. It just had nothing in it.

## Why every check passed

The bundle is fine, and each check was true of what it examined:

- 240 unit tests pass — `__NATIVE_SHELL__` is false under Vitest, so every test took
  the web branch, where `whenPlatformReady` resolves immediately. The native branch
  had no test at all.
- the web build works, and is the same application.
- the packaged assets are all present and correct; the missing thing is a reference,
  not a file.
- the icon and manifest assertions in `release.yml` inspect files. None of them
  loaded a page.

Two independent shell defects — this and the stripped INTERNET permission in
[https-origin-needs-internet-permission.md](https-origin-needs-internet-permission.md)
— produced an identical symptom, which is worth remembering before concluding that
one explanation accounts for a blank screen.

## The fix

Three parts, because any one of them alone leaves the failure possible:

1. A Vite plugin injects the script tag into the native build's HTML only
   (`injectCordovaScript` in `vite.config.ts`). The web build has no such file.
2. `waitForDeviceReady` resolves after a timeout and warns, so a shell that never
   initialises costs the back button binding rather than the whole game. Waiting was
   only ever an optimisation.
3. `release.yml` asserts, against the packaged `assets/www`, that `cordova.js` is
   there and that `index.html` references it.

## Where this applies again

Anything the native shell provides and the web does not: `deviceready`, `backbutton`,
`navigator.app`. The web branch is the one the tests exercise, so a native-only path
is untested by default and its failure mode is silence.

More generally: never block the first paint on an event that something outside the
bundle has to fire.
