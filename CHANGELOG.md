# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-08-29

First stable release. From this version on, Chispa follows semantic versioning: breaking changes only ship in a new major, and anything scheduled for removal is first marked as deprecated in a minor. The public API is what [DOCUMENTATION.md](./DOCUMENTATION.md) documents; `getItem`, `getValidProps`, `setAttributes`, `setProps` and every member of `globalContext` other than `createRoot` and `maxScheduleIterations` are internal and may change in minor versions (see "Internal exports" in the documentation).

### Added

- `enableDevDebugging(overrides?)`: turns on the development warnings in a single call. Guard it with your bundler's development flag (`if (import.meta.env.DEV) enableDevDebugging();`) so that production builds drop it entirely.
- Warning for a `data-cb` that has no binding at any level and is therefore not rendered (`ChispaDebugConfig.enableMissingBindingWarnings`). Bind it to `{}` to render it as-is, or to `null` to omit it on purpose without a warning.
- Warning for a `computed`, `effect` or function-valued binding that reads no signal on its first evaluation and will therefore never re-run (`ChispaDebugConfig.enableInertReactivityWarnings`).
- `ChispaDebugConfig.enableMountLogging`: logs every component mount and unmount.
- `isWritableSignal(signal)` type guard.
- `sideEffects: false`, an `engines` field (Node ≥ 22.22.2, required by the HTML compiler's `jsdom` dependency) and `vite >= 7` declared as an optional peer dependency of the Vite plugin.
- `npm run verify` (format check, type check, tests, build and example app build), plus a GitHub Actions workflow running it on Node 22 and 24.
- Documentation rewritten in English: `README.md` and `DOCUMENTATION.md` now cover the asynchronous batched update model, dependency tracking pitfalls, the global scope of `provide`/`inject`, the debugging flags and the internal exports.

### Changed

- All `ChispaDebugConfig` flags are off by default; a production bundle never logs anything unless `enableDevDebugging()` (or a flag) is set.
- `npm test` runs the suite once (`vitest run`); `npm run test:watch` starts the watch mode.
- Toolchain: Vite 8, TypeScript 7, Vitest 4, tsdown.

### Removed

- `isWriteableSignal` (misspelled) — use `isWritableSignal`.
- `Component.silent` — use `ChispaDebugConfig.enableMountLogging`.
- `ComponentList.disposables` is no longer public.

### Fixed

- Adding items to a `componentList` while reordering could leave the DOM in the wrong order.

## [0.10.3] - 2026-07-23

Last pre-1.0 release. See the git history for earlier changes.
