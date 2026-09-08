# cordova-android insets the webview and still reports the insets to CSS

Established in the Sudoku project, 2026-09-07, after a user reported a gap between
the top of the phone screen and the header on every screen of the packaged Android
app. Copied here 2026-09-08, when the same gap was reported above the title on the
MathsCross menu screen: the two shells have the same `viewport-fit=cover` and the same
`env(safe-area-inset-*)` padding on `#app`, so the defect transferred with the
arrangement. Fixed the same way, with `AndroidEdgeToEdge` in `native/config.xml`.

## The fact

`AndroidEdgeToEdge` defaults to **false** in cordova-android 15.1.0. With it off,
`CordovaActivity.createViews` does two things that do not agree:

- It calls `WindowCompat.setDecorFitsSystemWindows(getWindow(), false)`
  unconditionally, so the window is edge to edge whatever the preference says.
- Its `OnApplyWindowInsetsListener` then gives the webview a **margin** of
  `bars.top` (and left, right, bottom), and returns `insets` — not
  `WindowInsetsCompat.CONSUMED`.

Because the insets are never consumed, the FrameLayout passes them on to the
webview, which is what Chrome resolves `env(safe-area-inset-*)` from. So a page
with `viewport-fit=cover` that pads by `env(safe-area-inset-top)` avoids the
status bar twice: once in the native margin, once in its own CSS. The result is
roughly double the intended top padding, on every screen, and the same doubling
on the left or right in landscape where a cutout sits.

Setting `AndroidEdgeToEdge` to `true` zeroes those margins, and every inset is
then applied once, in CSS, exactly as iOS and the browser build already do it.

## What the preference also changes

The root view and status bar backgrounds become `Color.TRANSPARENT`, so the
page's own background shows through behind the system bars. `SystemBarPlugin`
then picks the status bar icon colour from `getUiModeColor()` — the **device's**
light or dark mode — not from the application's theme setting. An app whose theme
contradicts the device mode can therefore draw a dark status bar icon on its own
dark background. Driving the system bars from the app's theme needs runtime
calls, and there is no `<preference>` for it.

## How to tell which way round you are looking at it

A doubled inset and a correct one look similar in a screenshot. The tell is that
turning the preference on can only ever *remove* space: if `env()` were resolving
to zero the app would already be drawing its header hard against the status bar,
and the complaint would be the opposite one.

## Related

`SetFullscreen` and `Fullscreen` take a third path through the same listener,
zeroing different edges. Do not reason about one without checking the others in
`CordovaActivity.createViews`.
