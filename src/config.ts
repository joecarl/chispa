export const ChispaDebugConfig = {
	// Warns when a reactivity (computed, effect, binding) is created outside of any component or reactive scope
	enableReactivityWarnings: false,
	// Warns when a `data-cb` element has no binding at any level and is therefore not rendered
	enableMissingBindingWarnings: true,
	// Warns when a computed/effect/binding reads no signal on its first evaluation and will therefore never re-run
	enableInertReactivityWarnings: true,
	// Logs every component mount and unmount to the console
	enableMountLogging: false,
};
