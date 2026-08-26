# Killing an npm script on Windows leaves the vite child running

Established in the Sudoku project, 2026-08-25. Copied here because MathsCross is
developed on the same platform with the same toolchain.

## The observation

`npm run preview -- --port 5200 &` followed by `kill $!` leaves two node processes
alive: the npm wrapper, and the vite child. `kill` terminates the wrapper only.
The vite child keeps running and keeps a handle on the output directory. The port
stops answering, so the server looks stopped.

The next build then fails:

```
Error: Unable to write the service worker file.
'EPERM: operation not permitted, open '...\dist\sw.js''
```

`pkill -f "vite preview"` does not kill it either. A build that succeeded minutes
earlier with identical inputs is what identifies a lock rather than a code defect.

## Why it happens

npm spawns the script in a child process. On Windows there is no process group to
signal, so terminating the parent orphans the child instead of ending it. **A
closed port is not evidence that a dev server has exited.**

## What to do

- Stop a dev or preview server by PID, found from its command line, not by killing
  the npm wrapper:
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` shows each command
  line, then `Stop-Process -Id <ids> -Force`.
- Check the command lines before killing anything. The agent harness is also a
  node process, and killing it ends the session.
- If a build fails with `EPERM` on a file under `dist/` or `native/www/`, suspect a
  stale server before suspecting the build.
