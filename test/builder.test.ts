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

		it('should add multiple classes from a static string', () => {
			const div = document.createElement('div');
			setProps(div, { addClass: 'class1 class2 class3' });
			expect(div.classList.contains('class1')).toBe(true);
			expect(div.classList.contains('class2')).toBe(true);
			expect(div.classList.contains('class3')).toBe(true);
		});

		it('should add multiple classes from a static array', () => {
			const div = document.createElement('div');
			setProps(div, { addClass: ['class-a', 'class-b'] });
			expect(div.classList.contains('class-a')).toBe(true);
			expect(div.classList.contains('class-b')).toBe(true);
		});

		it('should handle signal with multiple classes in string', async () => {
			const div = document.createElement('div');
			const classSignal = signal('c1 c2');
			setProps(div, { addClass: classSignal });
			expect(div.classList.contains('c1')).toBe(true);
			expect(div.classList.contains('c2')).toBe(true);

			classSignal.set('c2 c3');
			await vi.runOnlyPendingTimersAsync();
			expect(div.classList.contains('c1')).toBe(false);
			expect(div.classList.contains('c2')).toBe(true);
			expect(div.classList.contains('c3')).toBe(true);
		});

		it('should handle signal with array of classes', async () => {
			const div = document.createElement('div');
			const classSignal = signal(['arr1', 'arr2']);
			setProps(div, { addClass: classSignal as any });
			expect(div.classList.contains('arr1')).toBe(true);
			expect(div.classList.contains('arr2')).toBe(true);

			classSignal.set(['arr2', 'arr3']);
			await vi.runOnlyPendingTimersAsync();
			expect(div.classList.contains('arr1')).toBe(false);
			expect(div.classList.contains('arr2')).toBe(true);
			expect(div.classList.contains('arr3')).toBe(true);
		});

		it('should handle empty value in signal', async () => {
			const div = document.createElement('div');
			const classSignal = signal<string | string[]>('initial');
			setProps(div, { addClass: classSignal });
			expect(div.classList.contains('initial')).toBe(true);

			classSignal.set('');
			await vi.runOnlyPendingTimersAsync();
			expect(div.className).toBe('');

			classSignal.set(['a', 'b']);
			await vi.runOnlyPendingTimersAsync();
			expect(div.classList.contains('a')).toBe(true);
			expect(div.classList.contains('b')).toBe(true);

			classSignal.set([]);
			await vi.runOnlyPendingTimersAsync();
			expect(div.className).toBe('');
		});

		it('should play well with className prop', () => {
			const div = document.createElement('div');
			div.className = 'base';
			setProps(div, { addClass: 'extra' });

			expect(div.classList.contains('base')).toBe(true);
			expect(div.classList.contains('extra')).toBe(true);
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

describe('Builder Props: reactive props', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should handle props as a function', async () => {
		const div = document.createElement('div');
		const alternative = signal(1);

		setProps(div, () => (alternative.get() === 1 ? { id: 'initial' } : { id: 'updated' }));
		expect(div.id).toBe('initial');

		alternative.set(2);
		await vi.runOnlyPendingTimersAsync();
		expect(div.id).toBe('updated');
	});

	it('should handle props as a signal', async () => {
		const div = document.createElement('div');
		const propsSignal = signal({ id: 'initial', title: 'test' });
		setProps(div, propsSignal);
		expect(div.id).toBe('initial');
		expect(div.title).toBe('test');

		propsSignal.set({ id: 'updated', title: 'new' });
		await vi.runOnlyPendingTimersAsync();
		expect(div.id).toBe('updated');
		expect(div.title).toBe('new');
	});

	it('should handle reactive style in props signal', async () => {
		const div = document.createElement('div');
		const propsSignal = signal({ style: { color: 'red' } });
		setProps(div, propsSignal);
		expect(div.style.color).toBe('red');

		propsSignal.set({ style: { color: 'blue' } });
		await vi.runOnlyPendingTimersAsync();
		expect(div.style.color).toBe('blue');
	});

	it('should handle reactive dataset in props signal', async () => {
		const div = document.createElement('div');
		const propsSignal = signal({ dataset: { test: 'value' } });
		setProps(div, propsSignal);
		expect(div.dataset.test).toBe('value');

		propsSignal.set({ dataset: { test: 'newvalue' } });
		await vi.runOnlyPendingTimersAsync();
		expect(div.dataset.test).toBe('newvalue');
	});
});
