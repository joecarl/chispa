/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { component, onUnmount } from '../src';

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
});
