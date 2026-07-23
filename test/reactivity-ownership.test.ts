/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { component, signal, appendChild, setProps, inject, resetServices } from '../src';
import { globalContext } from '../src/context';

describe('Reactivity ownership', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should not leak reactivities when a reactive child rebuilds template nodes', async () => {
		// A signal fed with fresh object identities, like any polling/WS data source
		const data = signal({ color: 'red' });

		// What the html-compiler emits for a template node: an eager node builder
		const tplDot = (props: any) => {
			const el = document.createElement('div');
			setProps(el, props);
			return el;
		};

		const Root = component(() => {
			const container = document.createElement('div');
			appendChild(container, () => {
				const color = data.get().color;
				return color === 'none' ? null : tplDot({ className: 'dot', style: { backgroundColor: () => data.get().color } });
			});
			return container;
		});

		const root = document.createElement('div');
		document.body.appendChild(root);
		globalContext.createRoot(() => Root(), root);
		await vi.runOnlyPendingTimersAsync();

		const subscribers = () => (data as any).contexts.size;
		const baseline = subscribers();

		for (let tick = 0; tick < 50; tick++) {
			data.set({ color: 'red' }); // same value, new identity — like re-parsed JSON
			await vi.runOnlyPendingTimersAsync();
		}
		expect(subscribers()).toBe(baseline);

		// The mounted node must still be reactive after all those rebuilds
		data.set({ color: 'blue' });
		await vi.runOnlyPendingTimersAsync();
		const dot = root.querySelector('.dot') as HTMLElement;
		expect(dot.style.backgroundColor).toBe('blue');
	});

	it('should not accumulate bindings when setProps re-runs on a reactive props object', async () => {
		const title = signal('a');
		const color = signal('red');
		const el = document.createElement('div');

		const Root = component(() => {
			// Function-valued props object: setProps re-runs it on every change and
			// creates fresh bindings for the function-valued props inside
			setProps(el, () => ({ title: title.get(), className: () => color.get() }));
			return el;
		});

		const root = document.createElement('div');
		document.body.appendChild(root);
		globalContext.createRoot(() => Root(), root);
		await vi.runOnlyPendingTimersAsync();

		const subscribers = () => (color as any).contexts.size;
		const baseline = subscribers();

		for (let tick = 0; tick < 50; tick++) {
			title.set('a' + tick);
			await vi.runOnlyPendingTimersAsync();
		}
		expect(subscribers()).toBe(baseline);

		// The latest binding must still be live
		color.set('blue');
		await vi.runOnlyPendingTimersAsync();
		expect(el.className).toBe('blue');
	});

	it('should not leak reactivities created by nested scopes inside a singleton service', async () => {
		resetServices();
		const data = signal({ color: 'red' });

		class PanelService {
			el = document.createElement('div');
			constructor() {
				// Same rebuild-on-change pattern, but living inside a singleton:
				// the bindings created on each re-evaluation must be owned by the
				// service's own child reactivity, not left orphan
				appendChild(this.el, () => {
					data.get();
					const node = document.createElement('span');
					setProps(node, { className: () => data.get().color });
					return node;
				});
			}
		}

		const svc = inject(PanelService);
		await vi.runOnlyPendingTimersAsync();

		const subscribers = () => (data as any).contexts.size;
		const baseline = subscribers();

		for (let tick = 0; tick < 50; tick++) {
			data.set({ color: 'red' });
			await vi.runOnlyPendingTimersAsync();
		}
		expect(subscribers()).toBe(baseline);

		// The latest binding must still be live
		data.set({ color: 'blue' });
		await vi.runOnlyPendingTimersAsync();
		expect((svc.el.firstElementChild as HTMLElement).className).toBe('blue');
	});
});
