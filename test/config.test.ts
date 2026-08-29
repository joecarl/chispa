import { describe, it, expect, afterEach } from 'vitest';
import { ChispaDebugConfig, enableDevDebugging } from '../src/config';

describe('ChispaDebugConfig', () => {
	// Snapshot taken before any test touches the flags (vitest isolates each test file)
	const defaults = { ...ChispaDebugConfig };

	afterEach(() => {
		Object.assign(ChispaDebugConfig, defaults);
	});

	it('has every diagnostic disabled by default', () => {
		expect(Object.keys(defaults).length).toBeGreaterThan(0);
		for (const [flag, value] of Object.entries(defaults)) {
			expect(value, `${flag} should be off by default`).toBe(false);
		}
	});

	describe('enableDevDebugging()', () => {
		it('enables the reliable warnings and leaves the noisy diagnostics off', () => {
			enableDevDebugging();

			expect(ChispaDebugConfig.enableMissingBindingWarnings).toBe(true);
			expect(ChispaDebugConfig.enableInertReactivityWarnings).toBe(true);
			expect(ChispaDebugConfig.enableReactivityWarnings).toBe(false);
			expect(ChispaDebugConfig.enableMountLogging).toBe(false);
		});

		it('applies overrides on top of what it enables', () => {
			enableDevDebugging({ enableMountLogging: true, enableInertReactivityWarnings: false });

			expect(ChispaDebugConfig.enableMountLogging).toBe(true);
			expect(ChispaDebugConfig.enableInertReactivityWarnings).toBe(false);
			expect(ChispaDebugConfig.enableMissingBindingWarnings).toBe(true);
			expect(ChispaDebugConfig.enableReactivityWarnings).toBe(false);
		});

		it('mutates the shared config object rather than replacing it', () => {
			const ref = ChispaDebugConfig;
			enableDevDebugging();
			expect(ref.enableMissingBindingWarnings).toBe(true);
		});
	});
});
