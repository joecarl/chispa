/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal, computed, effect, isSignal, isWriteableSignal, type Signal } from '../src/signals';
import { globalContext } from '../src/context';
import { ChispaDebugConfig } from '../src/config';

describe('Signals', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('signal()', () => {
		it('should create a signal with an initial value', () => {
			const s = signal(10);
			expect(s.get()).toBe(10);
		});

		it('should update the value with set()', () => {
			const s = signal(10);
			s.set(20);
			expect(s.get()).toBe(20);
		});

		it('should update the value with update()', () => {
			const s = signal(10);
			s.update((v) => v + 5);
			expect(s.get()).toBe(15);
		});

		it('should correctly identify signals', () => {
			const s = signal(10);
			expect(isSignal(s)).toBe(true);
			expect(isWriteableSignal(s)).toBe(true);
			expect(isSignal({})).toBe(false);
		});
	});

	describe('computed()', () => {
		it('should compute a value based on other signals', async () => {
			const a = signal(1);
			const b = signal(2);
			const c = computed(() => a.get() + b.get());

			expect(c.get()).toBe(3);

			a.set(10);
			await vi.runAllTimersAsync();
			expect(c.get()).toBe(12);
		});

		it('should update when dependencies change', async () => {
			const a = signal(1);
			const b = signal(2);
			const c = computed(() => a.get() + b.get());

			let effectCalled = 0;
			effect(() => {
				c.get();
				effectCalled++;
			});

			expect(effectCalled).toBe(1);

			a.set(10);
			await vi.runAllTimersAsync();
			expect(effectCalled).toBe(2);
			expect(c.get()).toBe(12);
		});

		it('should handle nested computed signals', async () => {
			const a = signal(1);
			const b = computed(() => a.get() * 2);
			const c = computed(() => b.get() + 1);

			expect(c.get()).toBe(3);

			a.set(5);
			await vi.runAllTimersAsync();
			expect(c.get()).toBe(11);
		});
	});

	describe('effect()', () => {
		it('should run an effect when dependencies change', async () => {
			const s = signal(1);
			let value = 0;
			effect(() => {
				value = s.get();
			});

			expect(value).toBe(1);

			s.set(10);
			await vi.runAllTimersAsync();
			expect(value).toBe(10);
		});

		it('should support multiple signals in one effect', async () => {
			const a = signal(1);
			const b = signal(2);
			let sum = 0;
			effect(() => {
				sum = a.get() + b.get();
			});

			expect(sum).toBe(3);

			a.set(10);
			await vi.runAllTimersAsync();
			expect(sum).toBe(12);

			b.set(20);
			await vi.runAllTimersAsync();
			expect(sum).toBe(30);
		});
	});

	describe('signal.computed proxy', () => {
		it('should create a computed signal for a property', async () => {
			const user = signal({ name: 'Alice', age: 30 });
			const name = user.computed.name;

			expect(isSignal(name)).toBe(true);
			expect(name.get()).toBe('Alice');

			user.set({ name: 'Bob', age: 25 });
			await vi.runAllTimersAsync();
			expect(name.get()).toBe('Bob');
		});

		it('should update when the specific property changes', async () => {
			const user = signal({ name: 'Alice', age: 30 });
			const name = user.computed.name;

			let nameValue = '';
			effect(() => {
				nameValue = name.get();
			});

			expect(nameValue).toBe('Alice');

			user.update((u) => ({ ...u, name: 'Bob' }));
			await vi.runAllTimersAsync();
			expect(nameValue).toBe('Bob');
		});
	});

	describe('Signal disposal', () => {
		it('should stop updating effects after disposal', async () => {
			const s = signal(1);
			let value = 0;

			// This is a bit tricky to test directly as effect returns void
			// But we can check if the signal still has contexts

			let effectCalled = 0;
			effect(() => {
				s.get();
				effectCalled++;
			});

			expect(effectCalled).toBe(1);

			s.set(2);
			await vi.runAllTimersAsync();
			expect(effectCalled).toBe(2);

			s.dispose();

			s.set(3);
			await vi.runAllTimersAsync();
			expect(effectCalled).toBe(2); // Should not have increased
		});
	});

	describe('Edge cases and Errors', () => {
		it('should throw an error if read during component creation', () => {
			const s = signal(1);

			globalContext.pushExecutionStack('createComponent');
			expect(() => s.get()).toThrow('Cannot read a signal value during component creation');
			globalContext.popExecutionStack();

			// Should work again after popping
			expect(s.get()).toBe(1);
		});

		it('should not trigger dependencies if computed value remains the same', async () => {
			const a = signal(1);
			const isPositive = computed(() => a.get() > 0);

			let effectCalled = 0;
			effect(() => {
				isPositive.get();
				effectCalled++;
			});

			expect(effectCalled).toBe(1);

			a.set(10); // Still positive
			await vi.runAllTimersAsync();
			expect(effectCalled).toBe(1); // Should not have re-run effect

			a.set(-5); // Now negative
			await vi.runAllTimersAsync();
			expect(effectCalled).toBe(2);
		});
	});
});

describe('Dependency tracking and refresh timing (documented behaviour)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('writable signals update synchronously, but computed/effects only on the next scheduled refresh', async () => {
		const a = signal(1);
		const double = computed(() => a.get() * 2);
		let seen = 0;
		effect(() => {
			seen = double.get();
		});

		a.set(5);
		expect(a.get()).toBe(5);
		// Dependents (and therefore the DOM) still hold the previous value until the batched refresh runs
		expect(double.get()).toBe(2);
		expect(seen).toBe(2);

		await vi.runOnlyPendingTimersAsync();
		expect(double.get()).toBe(10);
		expect(seen).toBe(10);
	});

	it('several writes in the same tick are applied in a single refresh', async () => {
		const a = signal(1);
		const b = signal(1);
		let runs = 0;
		effect(() => {
			a.get() + b.get();
			runs++;
		});
		expect(runs).toBe(1);

		a.set(2);
		b.set(3);
		a.set(4);
		await vi.runOnlyPendingTimersAsync();
		expect(runs).toBe(2);
	});

	it('does not re-evaluate a computed whose first run read no signal (there is nothing to subscribe to)', async () => {
		const invalid = signal(false);
		const sibling: { current: { invalid: Signal<boolean> } | null } = { current: null };
		// The sibling is "not mounted yet": the branch that reads a signal is never taken
		const hasError = computed(() => (sibling.current ? sibling.current.invalid.get() : false));

		sibling.current = { invalid };
		invalid.set(true);
		await vi.runOnlyPendingTimersAsync();

		expect(hasError.get()).toBe(false);
	});

	it('modelling the late reference as a signal keeps the computed subscribed', async () => {
		const invalid = signal(false);
		const siblingRef = signal<{ invalid: Signal<boolean> } | null>(null);
		const hasError = computed(() => siblingRef.get()?.invalid.get() ?? false);

		siblingRef.set({ invalid });
		await vi.runOnlyPendingTimersAsync();
		expect(hasError.get()).toBe(false);

		invalid.set(true);
		await vi.runOnlyPendingTimersAsync();
		expect(hasError.get()).toBe(true);
	});
});

describe('Inert reactivity warnings', () => {
	const originalFlag = ChispaDebugConfig.enableInertReactivityWarnings;

	beforeEach(() => {
		vi.useFakeTimers();
		ChispaDebugConfig.enableInertReactivityWarnings = true;
	});

	afterEach(() => {
		ChispaDebugConfig.enableInertReactivityWarnings = originalFlag;
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('warns when a computed reads no signal on its first evaluation', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		computed(() => 42);

		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0][0]).toContain('computed did not read any signal on its first evaluation');
		expect(warnSpy.mock.calls[0][0]).toContain('42');
	});

	it('warns for the "late sibling" case: a conditional branch that skips every signal read', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const sibling: { current: { invalid: Signal<boolean> } | null } = { current: null };

		computed(() => (sibling.current ? sibling.current.invalid.get() : false));

		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0][0]).toContain('will never re-run');
	});

	it('warns when an effect reads no signal', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		effect(() => {});

		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0][0]).toContain('effect did not read any signal on its first evaluation');
	});

	it('does not warn when at least one signal is read', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const a = signal(1);

		computed(() => a.get() * 2);
		effect(() => {
			a.get();
		});

		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('does not warn when enableInertReactivityWarnings is disabled', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		ChispaDebugConfig.enableInertReactivityWarnings = false;

		computed(() => 42);
		effect(() => {});

		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('only checks the first evaluation: a re-run that stops reading signals is not reported', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const data = signal<number | null>(null);
		let loaded = false;

		effect(() => {
			if (!loaded && data.get() !== null) {
				loaded = true;
			}
		});

		data.set(1); // re-run: reads `data` and flips `loaded`
		await vi.runOnlyPendingTimersAsync();
		data.set(2); // re-run: `loaded` short-circuits, nothing is read -> intentionally inert from now on
		await vi.runOnlyPendingTimersAsync();

		expect(loaded).toBe(true);
		expect(warnSpy).not.toHaveBeenCalled();
	});
});
