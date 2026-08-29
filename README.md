# Chispa [![npm version](https://img.shields.io/npm/v/chispa.svg?style=flat)](https://www.npmjs.com/package/chispa)

A reactive UI engine, extremely minimalist and surprisingly powerful.

Chispa was born out of frustration after years of using the most popular frameworks (such as React or Angular) without finding one that fully convinced me in every respect. It has been built by distilling the best of each, adding ideas of its own and systematically removing everything that is superfluous.

The result is an engine focused on **absolute simplicity and clean code**. It is not just an engine for small modules; after migrating complex projects to Chispa, experience has shown that the resulting code is far more readable, maintainable and free of the unpredictable "magic" of other frameworks.

**Core principle**: the component function runs only once; everything else is pure data flow (**signals → DOM**).

## Why Chispa?

- **Low mental overhead**: Forget opaque lifecycles, endless re-renders or hooks with complex rules.
- **Full control**: Direct access to the real DOM and to the HTML templates, with none of the heavy abstractions of a Virtual DOM.
- **Clean code**: Separating HTML structure from TS logic and using precise signals makes the code declarative and extremely easy to follow.
- **Native performance**: Only the exact node that changes is updated. Maximum efficiency by design.
- **Real HTML**: Plain HTML templates imported as-is, no JSX and no magic transformations.
- **Single-pass TS/JS**: Component functions run once (setup), eliminating ephemeral-state problems on every render.
- **Precise signal → DOM bindings**: Atomic updates without tree-diffing heuristics.
- **Embeddable engine**: No imposed architecture; perfect both for full applications and for embedding in existing systems.
- **Lightweight**: Zero dependencies in the browser runtime (~28 KB unminified). `jsdom` and `prettier` are used only by the HTML compiler at build time and never reach your bundle.
- **Vite integration**: Ships a Vite plugin for a smooth development experience.

## Create a new project

You can quickly scaffold a new chispa project by running:

```bash
npx create-chispa my-app
```

## Manual setup

### Installation

Install `chispa` in your project:

```bash
npm install chispa
```

### Configuration (Vite)

To use HTML templates you need to add the Chispa plugin to your `vite.config.ts` (requires Vite 7 or newer, as the plugin relies on Vite's built-in Oxc transformer):

```typescript
import { defineConfig } from 'vite';
import { chispaHtmlPlugin } from 'chispa/vite-plugin';

export default defineConfig({
	plugins: [chispaHtmlPlugin()],
});
```

For typings to work correctly you also need to add this to `tsconfig.json`:

```json
{
	"compilerOptions": {
		"rootDirs": [".chispa/types"]
	}
}
```

## Basic usage

### 1. Create a component

Chispa lets you define your component's structure in an HTML file and its logic in TypeScript.

**my-component.html**
Use the `data-cb` attribute to mark the elements that will be controlled from your code.

```html
<div class="my-app">
	<h1>Counter: <span data-cb="countDisplay">0</span></h1>
	<button data-cb="incrementBtn">Increment</button>
</div>
```

**my-component.ts**

```typescript
import { component, signal } from 'chispa';
import tpl from './my-component.html'; // Imports the processed HTML

export const MyComponent = component(() => {
	// Reactive state
	const count = signal(0);

	// Return the fragment, binding the HTML elements
	return tpl.fragment({
		// Bind the content directly to the signal
		countDisplay: { inner: count },

		incrementBtn: {
			// Bind the button's click event
			onclick: () => count.update((v) => v + 1),
			// Bind a property to a reactive function
			disabled: () => count.get() >= 10,
		},
	});
});
```

Unlike other UI frameworks, the component function runs only once, when the component mounts. State updates do not cause the component function to run again. Instead, the system atomically updates only the nodes or attributes bound to the signal that changed. For this reason, reading a signal's value directly in the body of the component's factory function is not allowed; reads must happen inside callbacks or effects.

### 2. Mount the application

**main.ts**

```typescript
import { mountRoot, enableDebugging } from 'chispa';
import { MyComponent } from './my-component';

// Development warnings (unbound data-cb, reactivities that will never re-run).
// Chispa logs nothing by default; the guard lets production builds drop the call.
if (import.meta.env.DEV) enableDebugging();

mountRoot(MyComponent(), document.body);
```

## Documentation

The full reference (lists, `nodes`, controlled inputs, dependency injection, the asynchronous update model and debugging warnings) lives in [DOCUMENTATION.md](./DOCUMENTATION.md).

## License

MIT
