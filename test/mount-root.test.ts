/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { component, signal, effect, mountRoot } from '../src';

const Hello = component(() => {
	const el = document.createElement('p');
	el.textContent = 'hello';
	return el;
});

function mountPoint(placeholder = '') {
	const el = document.createElement('div');
	el.innerHTML = placeholder;
	document.body.appendChild(el);
	return el;
}

describe('mountRoot', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('empties the mount point and mounts the component inside it', () => {
		const root = mountPoint('<span>Loading…</span>');

		mountRoot(Hello(), root);

		expect(root.querySelector('span')).toBeNull();
		expect(root.innerHTML).toBe('<p>hello</p>');
	});

	it('returns the mounted component so the application can be torn down', () => {
		const root = mountPoint();

		const app = mountRoot(Hello(), root);
		expect(root.children.length).toBe(1);

		app.unmount();
		expect(root.innerHTML).toBe('');
	});

	it('does not discard updates scheduled before mounting', async () => {
		const count = signal(0);
		const seen: number[] = [];
		effect(() => {
			seen.push(count.get());
		});
		count.set(1); // pending until the next refresh

		mountRoot(Hello(), mountPoint());
		await vi.runOnlyPendingTimersAsync();

		expect(seen).toEqual([0, 1]);
	});

	it('does not let a second root cancel the pending updates of the first', async () => {
		const label = signal('a');
		const Label = component(() => {
			const el = document.createElement('span');
			effect(() => {
				el.textContent = label.get();
			});
			return el;
		});
		const first = mountPoint();
		const second = mountPoint();

		mountRoot(Label(), first);
		label.set('b');
		mountRoot(Hello(), second);
		await vi.runOnlyPendingTimersAsync();

		expect(first.textContent).toBe('b');
		expect(second.textContent).toBe('hello');
	});
});
