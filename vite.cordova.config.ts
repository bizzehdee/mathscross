import { createConfig } from './vite.config.ts'

// A second config file rather than an environment variable on the build script,
// for the reason recorded in the sibling's windows-npm-script-env-vars.md: npm
// runs scripts through cmd.exe on Windows, where the POSIX `VAR=1 vite build`
// form is a parse error. Matches how vitest.slow.config.ts selects the slow
// suite.
export default createConfig('native')
