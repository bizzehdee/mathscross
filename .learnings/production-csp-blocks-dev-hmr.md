# The production CSP blocks Vite's HMR, silently

Established 2026-08-26, at M5, and it had already caused a misdiagnosis at M3.

## The fact

`src/index.html` carries a Content-Security-Policy with `connect-src 'none'`. That
is exactly right for the shipped app: the game makes no network requests, and the
directive turns that from an intention into something the browser enforces.

It is exactly wrong for `vite dev`. Vite's hot-update channel is a websocket to
localhost, so the policy blocks it:

```
Connecting to 'ws://localhost:5173/?token=...' violates the following Content
Security Policy directive: "connect-src 'none'". The action has been blocked.
```

## Why it is worth writing down

**Nothing appears to be wrong.** The page loads, the app runs, and the console error
scrolls past among Vite's own connection retries. What actually happens is that hot
updates never apply: the file changes on disk, the browser keeps the old module, and
the change looks like it silently failed.

At M3 this cost a real misdiagnosis. A CSS fix was on disk, the browser still had
the old rule, and the first re-check looked like the fix had not worked — so time
went into questioning the fix rather than the delivery. The tell is a custom
property reading empty:

```js
getComputedStyle(el).getPropertyValue('--board-floor') // '' means the file never arrived
```

An empty value means the stylesheet did not arrive, not that the rule is wrong.

## The fix

A Vite plugin with `apply: 'serve'` rewrites the directive for the dev server only:

```ts
function relaxCspForDevServer() {
  return {
    name: 'mathscross:relax-csp-for-dev-server',
    apply: 'serve' as const,
    transformIndexHtml: (html: string) =>
      html.replace("connect-src 'none'", "connect-src 'self' ws: wss:"),
  }
}
```

`apply: 'serve'` is the important half. Both build targets must keep the strict
policy, and a check worth running after any change here is that they do:

```bash
npm run build && grep -o "connect-src [^;]*" dist/index.html   # expect 'none'
```

**A `vite.config.ts` change needs the dev server restarted.** Editing the config does
not hot-reload, so the first check after adding this appeared to fail too.

## Where this applies again

Any tightening of the CSP, and any hot-reload behaviour that stops working for no
visible reason. More generally: a security header correct for production can be
wrong for the dev server, and the failure mode is silence rather than an error the
developer will notice.
