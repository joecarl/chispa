/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bindControlledInput, bindControlledSelect, SelectOption } from '../src/controlled-input';
import { signal } from '../src/signals';

describe('Controlled Inputs', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('bindControlledInput', () => {
		it('should bind input value to signal', async () => {
			const input = document.createElement('input');
			document.body.appendChild(input);
			const valueSignal = signal('initial');

			const cleanup = bindControlledInput(input, valueSignal);
			expect(input.value).toBe('initial');

			input.value = 'new value';
			input.dispatchEvent(new Event('input'));
			await vi.runOnlyPendingTimersAsync();
			expect(valueSignal.get()).toBe('new value');

			valueSignal.set('updated');
			await vi.runOnlyPendingTimersAsync();
			expect(input.value).toBe('updated');

			cleanup();
		});

		it('should apply transform', async () => {
			const input = document.createElement('input');
			document.body.appendChild(input);
			const valueSignal = signal('');

			const cleanup = bindControlledInput(input, valueSignal, {
				transform: (val) => val.toUpperCase(),
			});

			input.value = 'hello';
			input.dispatchEvent(new Event('input'));
			await vi.runOnlyPendingTimersAsync();
			expect(valueSignal.get()).toBe('HELLO');
			expect(input.value).toBe('HELLO');

			cleanup();
		});

		it('should apply validation', async () => {
			const input = document.createElement('input');
			document.body.appendChild(input);
			const valueSignal = signal('valid');

			const cleanup = bindControlledInput(input, valueSignal, {
				validate: (val) => val.length > 2,
			});

			input.value = 'hi'; // invalid
			input.dispatchEvent(new Event('input'));
			await vi.runOnlyPendingTimersAsync();
			expect(valueSignal.get()).toBe('valid'); // reverted
			expect(input.value).toBe('valid');

			cleanup();
		});
	});

	describe('bindControlledSelect', () => {
		it('should bind select value to signal', async () => {
			const select = document.createElement('select');
			const option1 = document.createElement('option');
			option1.value = 'val1';
			option1.textContent = 'Label 1';
			const option2 = document.createElement('option');
			option2.value = 'val2';
			option2.textContent = 'Label 2';
			select.appendChild(option1);
			select.appendChild(option2);
			document.body.appendChild(select);
			const valueSignal = signal('val1');

			const cleanup = bindControlledSelect(select, valueSignal);
			expect(select.value).toBe('val1');

			select.value = 'val2';
			select.dispatchEvent(new Event('change'));
			await vi.runOnlyPendingTimersAsync();
			expect(valueSignal.get()).toBe('val2');

			valueSignal.set('val1');
			await vi.runOnlyPendingTimersAsync();
			expect(select.value).toBe('val1');

			cleanup();
		});

		it('should update options from signal', async () => {
			const select = document.createElement('select');
			document.body.appendChild(select);
			const valueSignal = signal('a');
			const optionsSignal = signal<SelectOption[]>([
				{ value: 'a', label: 'A' },
				{ value: 'b', label: 'B' },
			]);

			const cleanup = bindControlledSelect(select, valueSignal, optionsSignal);
			await vi.runOnlyPendingTimersAsync();
			expect(select.children.length).toBe(2);
			expect((select.children[0] as HTMLOptionElement).value).toBe('a');
			expect((select.children[1] as HTMLOptionElement).value).toBe('b');
			expect(select.value).toBe('a');

			optionsSignal.set([
				{ value: 'c', label: 'C' },
				{ value: 'd', label: 'D' },
				{ value: 'e', label: 'E' },
			]);
			await vi.runOnlyPendingTimersAsync();
			expect(select.children.length).toBe(3);
			expect((select.children[0] as HTMLOptionElement).value).toBe('c');
			expect(select.value).toBe(''); // value resets if not in new options

			cleanup();
		});
	});
});
