# A webview served from an https origin needs the INTERNET permission

Established 2026-09-08, after Google Play rejected the first MathsCross submission
with "Your app does not open or load". The reviewer's screenshot showed the launcher
icon on the splash background and nothing else: the shell started, the webview never
painted a page.

## The fact

Two configuration choices that each look correct cannot both be made.

`native/config.xml` served the bundle from a real origin, which is what makes
`localStorage` durable — see [native-shell-origin.md](native-shell-origin.md):

```xml
<preference name="AndroidInsecureFileModeEnabled" value="false" />
<preference name="scheme" value="https" />
<preference name="hostname" value="localhost" />
```

An `after_prepare` hook then stripped `android.permission.INTERNET` from the
generated manifest, so that "makes no network requests" could be read off the Play
listing's permission list.

But the origin is `https://localhost`, and a WebView will not perform an http(s) load
for an app that does not hold the INTERNET permission. It is refused in the network
stack, before `WebViewAssetLoader` is consulted, so the interceptor that would have
answered from `assets/www/` never runs. `loadUrl` fails, the webview stays empty, and
the app opens to a blank screen.

The permission is not a use of the network. It is what allows the webview to load
pages that are already inside the APK.

## Why it took a store rejection to find

Every local check passed and none of them exercised the load:

- the build succeeds; nothing here is a compile-time relationship;
- the hook's own assertions passed, because it did exactly what it was written to do;
- `release.yml` asserted the permission was absent, which was the wrong property;
- the icon and manifest checks all inspect files, and every file was correct.

The two settings sit in the same 30 lines of `config.xml`, each with a comment
explaining why it is right. Neither comment could see the other.

## Escape routes that do not exist

`scheme` accepts only `http` and `https` on Android — `ConfigXmlParser` rejects
anything else and falls back to `https` — so there is no custom scheme that keeps an
origin without the permission. The only way to drop the permission is `file://`, and
that costs durable storage and the secure context, which is the failure the origin
preferences exist to prevent.

## The fix

Keep the permission; let the app be unable to use it. `config.xml` grants no
`<access>` and no `<allow-navigation>`, and `src/index.html` sets `connect-src
'none'`, which the browser enforces at runtime whatever the manifest says. The store
text now claims "makes no network requests" rather than "no internet permission",
because the second was about to be false.

`release.yml` asserts that `INTERNET` is declared and that it is the only permission
declared. Absence was never the property worth checking; a permission the app does
not need is.

## Where this applies again

Any offline claim resting on a permission list rather than on what the code can
reach. And more generally: a property asserted in CI is only as good as its
relationship to the thing that has to work. Nothing in this repository loaded a page.
