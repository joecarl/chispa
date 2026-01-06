/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router, navigate, component } from '../src';

describe('Router', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
		navigate('/');
		vi.runAllTimers();
	});

	it('should render the initial route', () => {
		const Home = component(() => {
			const div = document.createElement('div');
			div.textContent = 'Home';
			return div;
		});

		const routes = [{ path: '/', component: Home }];

		const router = Router({ routes });
		router.mount(document.body, null);

		expect(document.body.innerHTML).toContain('Home');
	});

	it('should navigate to another route', () => {
		const Home = component(() => {
			const div = document.createElement('div');
			div.textContent = 'Home';
			return div;
		});
		const About = component(() => {
			const div = document.createElement('div');
			div.textContent = 'About';
			return div;
		});

		const routes = [
			{ path: '/', component: Home },
			{ path: '/about', component: About },
		];

		const router = Router({ routes });
		router.mount(document.body, null);

		expect(document.body.innerHTML).toContain('Home');

		navigate('/about');
		vi.runAllTimers();

		expect(document.body.innerHTML).toContain('About');
		expect(document.body.innerHTML).not.toContain('Home');
	});

	it('should handle parameters', () => {
		const User = component((props) => {
			const div = document.createElement('div');
			div.textContent = `User ${props.id}`;
			return div;
		});

		const routes = [{ path: '/user/:id', component: User }];

		const router = Router({ routes });
		router.mount(document.body, null);

		navigate('/user/123');
		vi.runAllTimers();

		expect(document.body.innerHTML).toContain('User 123');
	});

	it('should handle wildcard route', () => {
		const NotFound = component(() => {
			const div = document.createElement('div');
			div.textContent = '404';
			return div;
		});

		const routes = [
			{ path: '/', component: component(() => document.createElement('div')) },
			{ path: '*', component: NotFound },
		];

		const router = Router({ routes });
		router.mount(document.body, null);

		navigate('/something-that-does-not-exist');
		vi.runAllTimers();

		expect(document.body.innerHTML).toContain('404');
	});
});
