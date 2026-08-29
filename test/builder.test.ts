/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appendChild, getItem, setProps } from '../src/builder';
import { ChispaDebugConfig } from '../src/config';
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
			// A constant function yields an inert reactivity, which chispa warns about (see 'Inert reactivity warnings')
			vi.spyOn(console, 'warn').mockImplementation(() => {});
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
			vi.spyOn(console, 'warn').mockImplementation(() => {});
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

describe('getItem: missing binding warnings', () => {
	// Mirrors what the html-compiler emits for:
	// <div data-cb="card"><h1 data-cb="title"></h1></div>
	const template: any = {
		fragment: (props: any) => {
			const fragment = document.createDocumentFragment();
			appendChild(fragment, getItem(template, props, 'card'));
			return fragment;
		},
		card: (props: any) => {
			const node = document.createElement('div');
			setProps(node, props);
			appendChild(node, getItem(template, props.nodes, 'title'));
			return node;
		},
		title: (props: any) => {
			const node = document.createElement('h1');
			setProps(node, props);
			if (props.inner !== undefined && props.inner !== null) {
				appendChild(node, props.inner);
			}
			return node;
		},
	};

	const originalFlag = ChispaDebugConfig.enableMissingBindingWarnings;

	beforeEach(() => {
		ChispaDebugConfig.enableMissingBindingWarnings = true;
	});

	afterEach(() => {
		ChispaDebugConfig.enableMissingBindingWarnings = originalFlag;
		vi.restoreAllMocks();
	});

	it('warns and renders nothing when a nested data-cb has no binding at any level', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const fragment = template.fragment({ card: {} });

		expect(fragment.querySelector('div')).not.toBeNull();
		expect(fragment.querySelector('h1')).toBeNull();
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0][0]).toContain("data-cb 'title' has no binding");
	});

	it('warns when a top-level data-cb is missing from the fragment props (even with no props at all)', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		expect(template.fragment({}).childNodes.length).toBe(0);
		expect(template.fragment(undefined).childNodes.length).toBe(0);

		expect(warnSpy).toHaveBeenCalledTimes(2);
		expect(warnSpy.mock.calls[0][0]).toContain("data-cb 'card' has no binding");
	});

	it('does not warn when the binding is declared explicitly as null or undefined (intentional omission)', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		expect(template.fragment({ card: { nodes: { title: null } } }).querySelector('h1')).toBeNull();
		expect(template.fragment({ card: {}, title: undefined }).querySelector('h1')).toBeNull();
		expect(template.fragment({ card: null }).childNodes.length).toBe(0);

		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('does not warn when the nested data-cb is bound at an ancestor level', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const fragment = template.fragment({ card: {}, title: { inner: 'Hi' } });

		expect(fragment.querySelector('h1')?.textContent).toBe('Hi');
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('does not warn when enableMissingBindingWarnings is disabled', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		ChispaDebugConfig.enableMissingBindingWarnings = false;

		expect(template.fragment({ card: {} }).querySelector('h1')).toBeNull();
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('restores the lookup stack when a builder throws, so later lookups do not see stale bindings', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const failing: any = {
			fragment: (props: any) => {
				const fragment = document.createDocumentFragment();
				appendChild(fragment, getItem(failing, props, 'boom'));
				return fragment;
			},
			boom: () => {
				throw new Error('boom');
			},
		};

		expect(() => failing.fragment({ boom: {}, title: { inner: 'stale' } })).toThrow('boom');

		// Without cleanup, 'title' would be resolved from the failed build's leftover props
		const fragment = template.fragment({ card: {} });
		expect(fragment.querySelector('h1')).toBeNull();
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0][0]).toContain("data-cb 'title' has no binding");
	});
});

describe('Inert reactivity warnings in bindings', () => {
	const originalFlag = ChispaDebugConfig.enableInertReactivityWarnings;

	beforeEach(() => {
		ChispaDebugConfig.enableInertReactivityWarnings = true;
	});

	afterEach(() => {
		ChispaDebugConfig.enableInertReactivityWarnings = originalFlag;
		vi.restoreAllMocks();
	});

	it('warns when a function-valued prop reads no signal (the value should be passed directly)', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const div = document.createElement('div');

		setProps(div, { title: () => 'static' });

		expect(div.title).toBe('static');
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0][0]).toContain('computed did not read any signal');
		expect(warnSpy.mock.calls[0][0]).toContain('static');
	});

	it('does not warn when the function-valued prop reads a signal', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const title = signal('a');
		const div = document.createElement('div');

		setProps(div, { title: () => title.get() });

		expect(div.title).toBe('a');
		expect(warnSpy).not.toHaveBeenCalled();
	});
});
