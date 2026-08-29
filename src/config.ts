// Engine settings. Mutable, like `ChispaDebugConfig`; change them before mounting.
export const ChispaConfig = {
	// Maximum number of passes a scheduled refresh may run before it is aborted with a
	// warning. Guards against unbounded reactivity cascades; raise it only when a
	// legitimate cascade needs more passes (tests lower it to exercise the guard).
	maxScheduleIterations: 100,
};

// Development diagnostics. Everything is off by default so that a production bundle
// never logs anything unless asked to; see `enableDebugging` below.
export const ChispaDebugConfig = {
	// Warns when a reactivity (computed, effect, binding) is created outside of any component or reactive scope
	enableReactivityWarnings: false,
	// Warns when a `data-cb` element has no binding at any level and is therefore not rendered
	enableMissingBindingWarnings: false,
	// Warns when a computed/effect/binding reads no signal on its first evaluation and will therefore never re-run
	enableInertReactivityWarnings: false,
	// Logs every component mount and unmount to the console
	enableMountLogging: false,
};

/**
 * Turns on the development warnings that are reliable in any application (missing
 * `data-cb` bindings and inert reactivities). The noisier diagnostics
 * (`enableReactivityWarnings`, `enableMountLogging`) stay off unless passed in
 * `overrides`.
 *
 * Chispa does not detect the environment: guard the call yourself so that production
 * builds drop it entirely, e.g. in `main.ts`:
 *
 *     if (import.meta.env.DEV) enableDebugging();
 */
export function enableDebugging(overrides: Partial<typeof ChispaDebugConfig> = {}) {
	Object.assign(ChispaDebugConfig, {
		enableMissingBindingWarnings: true,
		enableInertReactivityWarnings: true,
		...overrides,
	});
}
