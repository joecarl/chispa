/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { component, onUnmount, componentList, signal, appendChild } from '../src';

describe('Component Creation, Mounting, and Unmounting', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('should create a component instance', () => {
		const MyComponent = component(() => {
			const div = document.createElement('div');
			div.textContent = 'Hello';
			return div;
		});

		const comp = MyComponent();
		expect(comp).toHaveProperty('mount');
		expect(comp).toHaveProperty('unmount');
		expect(comp.props).toBeNull();
	});

	it('should mount a component to a container', () => {
		const MyComponent = component(() => {
			const div = document.createElement('div');
			div.textContent = 'Mounted';
			return div;
		});

		const comp = MyComponent();
		const container = document.createElement('div');
		document.body.appendChild(container);

		comp.mount(container);

		expect(container.innerHTML).toContain('Mounted');
		expect((comp as any).nodes).toHaveLength(1);
		expect((comp as any).nodes![0].textContent).toBe('Mounted');
	});

	it('should unmount a component and remove from DOM', () => {
		const MyComponent = component(() => {
			const div = document.createElement('div');
			div.textContent = 'To Unmount';
			return div;
		});

		const comp = MyComponent();
		const container = document.createElement('div');
		document.body.appendChild(container);

		comp.mount(container);
		expect(container.innerHTML).toContain('To Unmount');

		comp.unmount();
		expect(container.innerHTML).toBe('');
		expect((comp as any).nodes).toBeNull();
		expect((comp as any).container).toBeNull();
	});

	it('should call onUnmount callback when unmounting', () => {
		const unmountSpy = vi.fn();

		const MyComponent = component(() => {
			onUnmount(unmountSpy);
			const div = document.createElement('div');
			div.textContent = 'Unmount Test';
			return div;
		});

		const comp = MyComponent();
		const container = document.createElement('div');
		document.body.appendChild(container);

		comp.mount(container);
		expect(unmountSpy).not.toHaveBeenCalled();

		comp.unmount();
		expect(unmountSpy).toHaveBeenCalledTimes(1);
	});

	it('should handle component with props', () => {
		const MyComponent = component<{ message: string }>((props) => {
			const div = document.createElement('div');
			div.textContent = props.message;
			return div;
		});

		const comp = MyComponent({ message: 'Props Test' });
		const container = document.createElement('div');
		document.body.appendChild(container);

		comp.mount(container);
		expect(container.innerHTML).toContain('Props Test');
	});

	it('should mount component with anchor', () => {
		const MyComponent = component(() => {
			const div = document.createElement('div');
			div.textContent = 'Anchored';
			return div;
		});

		const comp = MyComponent();
		const container = document.createElement('div');
		const anchor = document.createElement('span');
		container.appendChild(anchor);
		document.body.appendChild(container);

		comp.mount(container, anchor);
		expect(container.children[0].textContent).toBe('Anchored');
		expect(container.children[1]).toBe(anchor);
	});

	it('should unmount nested components when parent is unmounted', () => {
		const childUnmountSpy = vi.fn();
		const parentUnmountSpy = vi.fn();

		const ChildComponent = component(() => {
			onUnmount(childUnmountSpy);
			const div = document.createElement('div');
			div.textContent = 'Child';
			return div;
		});

		const ParentComponent = component(() => {
			onUnmount(parentUnmountSpy);
			const div = document.createElement('div');
			div.textContent = 'Parent';
			const child = ChildComponent();
			child.mount(div);
			return div;
		});

		const comp = ParentComponent();
		const container = document.createElement('div');
		document.body.appendChild(container);

		comp.mount(container);
		expect(container.innerHTML).toContain('Parent');
		expect(container.innerHTML).toContain('Child');
		expect(childUnmountSpy).not.toHaveBeenCalled();
		expect(parentUnmountSpy).not.toHaveBeenCalled();

		comp.unmount();
		expect(childUnmountSpy).toHaveBeenCalledTimes(1);
		expect(parentUnmountSpy).toHaveBeenCalledTimes(1);
		expect(container.innerHTML).toBe('');
	});

	it('should remove ComponentList items with falsy keys (empty string, 0)', async () => {
		vi.useFakeTimers();
		try {
			const ItemList = componentList<{ id: string | number }>(
				(item) => {
					const div = document.createElement('div');
					appendChild(div, () => 'Item:' + item.get().id);
					return div;
				},
				(item) => item.id
			);

			const container = document.createElement('div');
			document.body.appendChild(container);
			const listSignal = signal<{ id: string | number }[]>([{ id: '' }, { id: 0 }, { id: 'x' }]);
			ItemList(listSignal).mount(container);
			expect(container.children.length).toBe(3);

			listSignal.set([{ id: 'x' }]);
			await vi.runOnlyPendingTimersAsync();
			expect(container.children.length).toBe(1);
			expect(container.textContent).toBe('Item:x');
		} finally {
			vi.useRealTimers();
		}
	});

	it('should keep list items before sibling nodes appended after the list', async () => {
		vi.useFakeTimers();
		try {
			const ItemList = componentList<{ id: string }>(
				(item) => {
					const div = document.createElement('div');
					appendChild(div, () => item.get().id);
					return div;
				},
				(item) => item.id
			);

			const container = document.createElement('div');
			document.body.appendChild(container);
			const listSignal = signal([{ id: 'a' }]);
			appendChild(container, ItemList(listSignal));

			// Sibling appended after the list (like a footer card)
			const footer = document.createElement('footer');
			container.appendChild(footer);

			const order = () => Array.from(container.children).map((c) => (c.tagName === 'FOOTER' ? '<footer>' : c.textContent));
			expect(order()).toEqual(['a', '<footer>']);

			// Growing the list must insert the new items before the sibling
			listSignal.set([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
			await vi.runOnlyPendingTimersAsync();
			expect(order()).toEqual(['a', 'b', 'c', '<footer>']);

			// Even when every original item has been replaced
			listSignal.set([{ id: 'x' }, { id: 'y' }]);
			await vi.runOnlyPendingTimersAsync();
			expect(order()).toEqual(['x', 'y', '<footer>']);
		} finally {
			vi.useRealTimers();
		}
	});

	it('should reorder items correctly when inserting a new item and moving existing ones', async () => {
		vi.useFakeTimers();
		try {
			const ItemList = componentList<{ id: string }>(
				(item) => {
					const div = document.createElement('div');
					appendChild(div, () => item.get().id);
					return div;
				},
				(item) => item.id
			);

			const container = document.createElement('div');
			document.body.appendChild(container);
			const listSignal = signal([{ id: 'a' }, { id: 'b' }]);
			ItemList(listSignal).mount(container);

			listSignal.set([{ id: 'x' }, { id: 'b' }, { id: 'a' }]);
			await vi.runOnlyPendingTimersAsync();
			expect(Array.from(container.children).map((c) => c.textContent)).toEqual(['x', 'b', 'a']);
		} finally {
			vi.useRealTimers();
		}
	});

	it('should handle every permutation transition and mixed insert/remove/reorder steps', async () => {
		vi.useFakeTimers();
		try {
			const ItemList = componentList<{ id: string }>(
				(item) => {
					const div = document.createElement('div');
					appendChild(div, () => item.get().id);
					return div;
				},
				(item) => item.id
			);

			const container = document.createElement('div');
			document.body.appendChild(container);
			const listSignal = signal<{ id: string }[]>([]);
			ItemList(listSignal).mount(container);

			const apply = async (keys: string[]) => {
				listSignal.set(keys.map((id) => ({ id })));
				await vi.runOnlyPendingTimersAsync();
				expect(Array.from(container.children).map((c) => c.textContent)).toEqual(keys);
			};

			// All transitions between permutations of [a, b, c]
			const perms = [
				['a', 'b', 'c'],
				['a', 'c', 'b'],
				['b', 'a', 'c'],
				['b', 'c', 'a'],
				['c', 'a', 'b'],
				['c', 'b', 'a'],
			];
			for (const from of perms) {
				for (const to of perms) {
					await apply(from);
					await apply(to);
				}
			}

			// Mixed inserts, removals and reorders
			const steps = [
				['a', 'b', 'c'],
				['x', 'b', 'a'],
				['a', 'x', 'y', 'b'],
				['y'],
				['z', 'y'],
				['y', 'z'],
				[],
				['a', 'b', 'c'],
			];
			for (const step of steps) {
				await apply(step);
			}
		} finally {
			vi.useRealTimers();
		}
	});

	it('should unmount nested ComponentList when parent is unmounted', () => {
		const listItemUnmountSpy = vi.fn();
		const parentUnmountSpy = vi.fn();

		const ItemComponent = componentList<{ id: number }>(
			(item, index, list) => {
				onUnmount(listItemUnmountSpy);
				const div = document.createElement('div');
				appendChild(div, () => 'Item ' + item.get().id);
				return div;
			},
			(item) => item.id
		);

		const ParentComponent = component(() => {
			onUnmount(parentUnmountSpy);
			const div = document.createElement('div');
			div.textContent = 'Parent';
			const listSignal = signal([{ id: 1 }, { id: 2 }]);
			const list = ItemComponent(listSignal);
			list.mount(div);
			return div;
		});

		const comp = ParentComponent();
		const container = document.createElement('div');
		document.body.appendChild(container);

		comp.mount(container);
		expect(container.innerHTML).toContain('Parent');
		expect(container.innerHTML).toContain('Item 1');
		expect(container.innerHTML).toContain('Item 2');
		expect(listItemUnmountSpy).not.toHaveBeenCalled();
		expect(parentUnmountSpy).not.toHaveBeenCalled();

		comp.unmount();
		expect(listItemUnmountSpy).toHaveBeenCalledTimes(2); // Two items
		expect(parentUnmountSpy).toHaveBeenCalledTimes(1);
		expect(container.innerHTML).toBe('');
	});
});
