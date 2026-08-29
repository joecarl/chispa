import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { globalContext } from '../src/context';
import { signal } from '../src/signals';
import { ChispaConfig } from '../src/config';

describe('AppContext.scheduleRefresh', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		sinonRestoreIfNeeded();
	});

	function sinonRestoreIfNeeded() {
		// noop helper in case we add spies; kept for symmetry
	}

	it('defaults to 100 iterations', () => {
		expect(ChispaConfig.maxScheduleIterations).toBe(100);
	});

	it('should warn and stop after exceeding max iterations', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		// make iterations small for test speed/reliability
		const original = ChispaConfig.maxScheduleIterations;
		ChispaConfig.maxScheduleIterations = 5;

		// Two reactivities that keep marking each other dirty: every refresh iteration
		// leaves the other one pending, so the loop can only stop at the iteration limit.
		// (A reactivity that marks *itself* dirty during its own run is cleared again by
		// process(), so it would never exercise the guard.)
		const a = signal(0);
		const b = signal(0);
		globalContext.addReactivity(() => {
			b.set(a.get() + 1);
		});
		globalContext.addReactivity(() => {
			a.set(b.get() + 1);
		});

		await vi.runOnlyPendingTimersAsync();

		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('possible uncontrolled reactivity cascade'));
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('processed 5 iterations'));
		warnSpy.mockRestore();
		ChispaConfig.maxScheduleIterations = original;
	});
});
