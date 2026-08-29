# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-08-29

First stable release. From this version on, Chispa follows semantic versioning: breaking changes only ship in a new major, and anything scheduled for removal is first marked as deprecated in a minor. The public API is what [DOCUMENTATION.md](./DOCUMENTATION.md) documents; `getItem`, `getValidProps`, `setAttributes`, `setProps` are internal and may change in minor versions (see "Internal exports" in the documentation).

### Added

- `mountRoot(component, mountPoint)`: top-level entry point to mount an application. It empties `mountPoint` (so it can hold a static placeholder until the app takes over), mounts the component and returns it, so the application can be torn down with `unmount()`. `README.md`, `DOCUMENTATION.md` and the example app now use it in `main.ts`; `appendChild` remains the way to insert a component into an existing element without touching its content.
- `ChispaConfig`: engine settings object, mutable like `ChispaDebugConfig`. Its only field, `maxScheduleIterations` (100 by default), replaces `globalContext.maxScheduleIterations`.

- `enableDebugging(overrides?)`: turns on the development warnings in a single call. Guard it with your bundler's development flag (`if (import.meta.env.DEV) enableDebugging();`) so that production builds drop it entirely.
- Warning for a `data-cb` that has no binding at any level and is therefore not rendered (`ChispaDebugConfig.enableMissingBindingWarnings`). Bind it to `{}` to render it as-is, or to `null` to omit it on purpose without a warning.
- Warning for a `computed`, `effect` or function-valued binding that reads no signal on its first evaluation and will therefore never re-run (`ChispaDebugConfig.enableInertReactivityWarnings`).
- `ChispaDebugConfig.enableMountLogging`: logs every component mount and unmount.
- `isWritableSignal(signal)` type guard.
- `sideEffects: false`, an `engines` field (Node ≥ 22.22.2, required by the HTML compiler's `jsdom` dependency) and `vite >= 7` declared as an optional peer dependency of the Vite plugin.
- `npm run verify` (format check, type check, tests, build and example app build), plus a GitHub Actions workflow running it on Node 22 and 24.
- Documentation rewritten in English: `README.md` and `DOCUMENTATION.md` now cover the asynchronous batched update model, dependency tracking pitfalls, the global scope of `provide`/`inject`, the debugging flags and the internal exports.

### Changed

- All `ChispaDebugConfig` flags are off by default; a production bundle never logs anything unless `enableDebugging()` (or a flag) is set.
- `npm test` runs the suite once (`vitest run`); `npm run test:watch` starts the watch mode.
- Toolchain: Vite 8, TypeScript 7, Vitest 4, tsdown.

### Removed

- `globalContext` is no longer exported. It was the engine's internal context and only two of its members were documented: `createRoot(factory, mountPoint)` is replaced by `mountRoot(component, mountPoint)` and `maxScheduleIterations` by `ChispaConfig.maxScheduleIterations`.
- `isWriteableSignal` (misspelled) — use `isWritableSignal`.
- `Component.silent` — use `ChispaDebugConfig.enableMountLogging`.
- `ComponentList.disposables` is no longer public.

### Fixed

- Adding items to a `componentList` while reordering could leave the DOM in the wrong order.
- Mounting a root no longer discards the updates already scheduled by other roots or by module-level effects (the former `globalContext.createRoot` cleared the pending reactivities, so a signal written just before mounting could leave its subscribers stale).

## [0.10.3] - 2026-07-23

Last pre-1.0 release. See the git history for earlier changes.
