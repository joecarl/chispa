/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setProps } from '../src/builder';
import { signal } from '../src/signals';

describe('Builder Props: addClass and classes', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('addClass prop', () => {
		it('should add a static class string', () => {
			const div = document.createElement('div');
			setProps(div, { addClass: 'test-class' });
			expect(div.classList.contains('test-class')).toBe(true);
		});

		it('should add a class from a signal', async () => {
			const div = document.createElement('div');
			const classSignal = signal('dynamic-class');
			setProps(div, { addClass: classSignal });
			expect(div.classList.contains('dynamic-class')).toBe(true);

			classSignal.set('new-class');
			await vi.runOnlyPendingTimersAsync();
			expect(div.classList.contains('new-class')).toBe(true);
			expect(div.classList.contains('dynamic-class')).toBe(false);
		});

		it('should handle function returning class', () => {
			const div = document.createElement('div');
			setProps(div, { addClass: () => 'func-class' });
			expect(div.classList.contains('func-class')).toBe(true);
		});
	});

	describe('classes prop', () => {
		it('should add classes based on boolean values', () => {
			const div = document.createElement('div');
			setProps(div, {
				classes: {
					active: true,
					hidden: false,
					selected: true,
				},
			});
			expect(div.classList.contains('active')).toBe(true);
			expect(div.classList.contains('hidden')).toBe(false);
			expect(div.classList.contains('selected')).toBe(true);
		});

		it('should handle classes with signals', async () => {
			const div = document.createElement('div');
			const activeSignal = signal(true);
			const hiddenSignal = signal(false);
			setProps(div, {
				classes: {
					active: activeSignal,
					hidden: hiddenSignal,
				},
			});
			expect(div.classList.contains('active')).toBe(true);
			expect(div.classList.contains('hidden')).toBe(false);

			activeSignal.set(false);
			hiddenSignal.set(true);
			await vi.runOnlyPendingTimersAsync();
			expect(div.classList.contains('active')).toBe(false);
			expect(div.classList.contains('hidden')).toBe(true);
		});

		it('should handle classes with functions', () => {
			const div = document.createElement('div');
			setProps(div, {
				classes: {
					enabled: () => true,
					disabled: () => false,
				},
			});
			expect(div.classList.contains('enabled')).toBe(true);
			expect(div.classList.contains('disabled')).toBe(false);
		});
	});
});
