import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { globalContext } from '../src/context';

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

	it('should warn and stop after exceeding max iterations', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		// make iterations small for test speed/reliability
		const original = globalContext.maxScheduleIterations;
		globalContext.maxScheduleIterations = 5;

		let count = 0;
		// This reactivity will re-mark itself dirty every time it runs, forcing
		// the scheduleRefresh loop to iterate repeatedly.
		globalContext.addReactivity(() => {
			count++;
			const ctx = globalContext.getCurrentRenderContext();
			if (ctx) {
				ctx.markDirty();
			}
		});

		await vi.runOnlyPendingTimersAsync();

		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
		globalContext.maxScheduleIterations = original;
	});
});
