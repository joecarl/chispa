# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.3] - 2026-10-20

### Fixed

- HTML compiler: a `data-cb` on a custom element (or any tag TypeScript's `HTMLElementTagNameMap` does not know) produced a `.d.ts` that failed to type-check (`HTMLElementTagNameMap['my-widget']`). The generated types now fall back to `HTMLElement` (`SVGElement`, `MathMLElement`) for unknown tags, through a `TagElement` helper type emitted in each `.d.ts`.
- HTML compiler: the HTML content of an SVG `<foreignObject>` was created as SVG elements (`createElementNS(svg, 'P')`) and typed as `SVGElementTagNameMap['P']`. Every element is now created in the namespace the parser assigned to it, which also covers MathML (`<math>`) elements, created in the HTML namespace until now.
- HTML compiler: a `data-cb` that does not camelize to a valid identifier (`1st`, `my.box`, `a b`…) is rejected with a clear compile error. It used to surface as a syntax error from the code formatter, with a line and column of the generated code.

### Changed

- HTML compiler: a single JSDOM window is shared by every compilation, each template being parsed into its own fragment. Creating a window per template dominated the compile time (~35× slower parsing); the Vite plugin scans and compiles every template at startup and on each change.
- HTML compiler: elements without classes no longer get a `class=""` attribute, and elements without any attribute no longer get a `setAttributes` call in the generated code. Every rendered node used to carry an empty `class` attribute.

## [1.0.2] - 2026-10-13

### Added

- `chispaHtmlPlugin({ exclude })`: paths (directories or files, relative to the Vite root) whose `.html` files are not compiled into `.chispa/types` when the project is scanned. Until now only `node_modules`, `.git`, `dist` and `.chispa` were skipped, so every `.html` under the root (e.g. `public/`) got compiled.
- The generated `.d.ts` of a template now exports its prop types (`CbBoxProps`, `CbFragmentProps`, …), so `import type { CbBoxProps } from './x.html'` works.

### Fixed

- Emitting declarations (`tsc --declaration`) of a module that exports a template, or anything typed after `tpl.fragment`, failed with `TS4023: ... has or is using name 'CbFragmentProps' ... but cannot be named`, because the template prop types were not exported from the generated `.d.ts`.
- Vite plugin: the virtual module ids of compiled templates are now relative to the Vite root. They used to carry the absolute path of the file, which Rollup turns into the output file name when building a library with `preserveModules` (`_virtual/_/home/user/project/src/x.html.chispa.js`), leaking the machine path into `dist`.
- HTML compiler: a repeated `data-cb` in a template (or two that camelize to the same name, like `my-box` and `myBox`) is now a compile error. It used to silently keep the last element's builder, render it in every position and emit a duplicate property in the `.d.ts`. `data-cb="fragment"` is rejected too, as it collides with the whole-template builder.
- HTML compiler: templates are parsed as `<template>` content, so elements that only make sense inside a parent (`<tr>`, `<td>`, `<tbody>`, `<caption>`, `<col>`…) are kept at the root of a file. A root `<tr data-cb="row">` used to be dropped by the parser without any error.
- An exception thrown by a component factory no longer freezes the page: `Component.mount` now always restores the execution and component stacks, so signals keep being readable and the DOM mounted before the failure keeps updating. The exception itself still propagates.
- HTML compiler: a `<svg data-cb="...">` no longer leaks its SVG context into the rest of the template. The elements that followed it were created with `createElementNS` in the SVG namespace instead of as HTML elements.
- `addClass`, `classes`, `style` and `dataset` now work on SVG elements. They were only applied to `HTMLElement`; on an SVG element they fell through to plain property assignment, which ignored `classes` and `style` and threw a `TypeError` for `dataset`.

### Changed

- `Component.mount` and `ComponentList.mount` throw if called on an instance that is already mounted. Mounting twice used to run the factory again and leave the nodes of the first mount orphaned in the DOM. Call `unmount()` first to mount the same instance elsewhere.

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
