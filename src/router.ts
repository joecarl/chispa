import { signal, computed, Signal } from './signals';
import { component, Component, Dict } from './components';
import { appendChild, setProps } from './builder';

export interface Route {
	path: string;
	component: (props?: any) => Component<any>;
}

const currentPath = signal(typeof window !== 'undefined' ? window.location.pathname : '/');

if (typeof window !== 'undefined') {
	window.addEventListener('popstate', () => {
		currentPath.set(window.location.pathname);
	});
}

export function navigate(to: string, replace = false) {
	if (typeof window === 'undefined') {
		currentPath.set(to);
		return;
	}
	if (replace) {
		window.history.replaceState({}, '', to);
	} else {
		window.history.pushState({}, '', to);
	}
	currentPath.set(to);
}

function match(routePath: string, currentPath: string): Dict | null {
	if (routePath === '*') return {};
	const routeParts = routePath.split('/').filter(Boolean);
	const currentParts = currentPath.split('/').filter(Boolean);
	if (routeParts.length !== currentParts.length) return null;
	const params: Dict = {};
	for (let i = 0; i < routeParts.length; i++) {
		if (routeParts[i].startsWith(':')) {
			params[routeParts[i].substring(1)] = currentParts[i];
		} else if (routeParts[i] !== currentParts[i]) {
			return null;
		}
	}
	return params;
}

export const Router = component<{ routes: Route[] }>((props) => {
	const container = document.createElement('div');
	container.style.display = 'contents';
	const activeRoute = computed(() => {
		const path = currentPath.get();
		for (const route of props.routes) {
			const params = match(route.path, path);
			if (params) {
				return route.component(params);
			}
		}
		return null;
	});
	appendChild(container, activeRoute);
	return container;
});

export interface LinkProps {
	to: string;
	class?: string | Signal<string> | (() => string);
	inner?: any;
	[key: string]: any;
}

export const Link = component<LinkProps>((props) => {
	const { to, inner, ...rest } = props;
	const a = document.createElement('a');
	a.href = to;

	a.addEventListener('click', (e) => {
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented || e.button !== 0) {
			return;
		}
		e.preventDefault();
		navigate(to);
	});

	if (inner) {
		appendChild(a, inner);
	}

	setProps(a, rest);

	return a;
});
