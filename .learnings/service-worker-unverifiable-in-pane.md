# Service worker registration cannot be verified in the in-app browser pane

Established in the Sudoku project, 2026-08-25. Copied here because MathsCross
ships the same PWA arrangement and will be verified the same way.

## The observation

Serving a production build on localhost and loading it in the agent's in-app
browser pane, service worker registration fails:

```
TypeError: Failed to register a ServiceWorker for scope ('http://localhost:5200/')
with script ('http://localhost:5200/sw.js'): An unknown error occurred when
fetching the script.
```

In the same page context, `fetch('/sw.js')` succeeds with status 200 and content
type `text/javascript`. `isSecureContext` is `true` and `'serviceWorker' in
navigator` is `true`.

## What it rules out

A registration failure caused by MIME type, scope, or a missing file reports a
specific error naming that cause. This error is generic, and the script is
provably fetchable from the page. The build artefacts are therefore not at fault.
The remaining explanation is that the pane's browser profile disallows service
worker script loads.

## What this means for verification

Do not treat a passing build as evidence that the service worker registers, and do
not treat the pane's failure as a defect in the application. Offline capability and
installability must be verified on a real browser:

- Android Chrome, for the install prompt and offline play.
- iOS Safari, for Add to Home Screen.

Until someone runs those checks, registration status is **unverified** and must be
described that way.
