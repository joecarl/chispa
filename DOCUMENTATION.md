# Chispa Documentation

**Chispa** is a fully declarative, reactive UI framework for building web applications. It is built around signals for state management and a smart compilation of HTML templates into efficient TypeScript code.

## Installation

```bash
npm install chispa
```

## Project Setup (Vite)

Chispa uses a Vite plugin to turn your HTML files into importable TypeScript modules.

1.  Make sure `vite` (7 or newer) is installed; the plugin relies on Vite's built-in Oxc transformer.
2.  Configure `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { chispaHtmlPlugin } from 'chispa/vite-plugin';

export default defineConfig({
	plugins: [chispaHtmlPlugin()],
});
```

This lets you import `.html` files directly from your `.ts` files.

## Core Concepts

### 1. Signals

State in Chispa is managed through signals.

- **`signal(initialValue)`**: Creates a writable signal.
- **`computed(fn)`**: Creates a read-only signal derived from other signals.
- **`effect(fn)`**: Runs `fn` and re-runs it whenever any of the signals it reads changes.
- **`.get()`**: Returns the current value (and registers the dependency when called inside a reactive context).
- **`.set(value)`** / **`.update(fn)`**: Updates the value of a writable signal.

```typescript
import { signal, computed, effect } from 'chispa';

const count = signal(0);
const doubleCount = computed(() => count.get() * 2);

effect(() => console.log('double:', doubleCount.get())); // double: 0

count.update((v) => v + 1);
console.log(count.get()); // 1 — writable signals update immediately
console.log(doubleCount.get()); // 0 — computed signals and effects refresh on the next tick
// ...a moment later the effect runs again: double: 2
```

Propagation to `computed` signals, effects and the DOM is asynchronous and batched; see [Update model](#update-model-asynchronous-batched-refresh).

#### Dependency tracking

The dependencies of a `computed` (and of an `effect`, and of the reactive functions you pass in bindings, which are `computed` internally) are not declared: they are **collected on every evaluation** from the signals read with `.get()`. Only those signals can trigger the next re-evaluation.

The important consequence is that **a `computed` whose evaluation reads no signal will never be re-evaluated**: there is nothing to subscribe to. The typical case is delegating to something that does not exist yet at mount time:

```typescript
// ❌ While `sibling.current` is null the computed reads no signal and is left
//    "dead": even after the sibling mounts and `invalid` changes, `hasError`
//    keeps returning false.
const sibling: { current: { invalid: Signal<boolean> } | null } = { current: null };
const hasError = computed(() => (sibling.current ? sibling.current.invalid.get() : false));

// ✅ Model the late reference as a signal. The first evaluation already reads
//    `siblingRef`, so assigning it re-evaluates the computed, which from then on
//    is also subscribed to `invalid`.
const siblingRef = signal<{ invalid: Signal<boolean> } | null>(null);
const hasError = computed(() => siblingRef.get()?.invalid.get() ?? false);
```

Rule of thumb: anything that can change and must be reflected in a `computed` has to be a signal read inside it — including on the first evaluation.

Because a reactivity that read no signal can never run again, Chispa warns as soon as it creates one (a `computed`, an `effect` or a function-valued binding) whose first evaluation registered no dependency:

```
[chispa] computed did not read any signal on its first evaluation, so it will never re-run: () => sibling.current ? sibling.current.invalid.get() : false. If it must react to state, read the signals it depends on unconditionally (also on the first run); if the value is constant, pass it directly instead of a function.
```

The warning also flags constant functions such as `inner: () => 'Hello'` or `classes: { active: () => true }`: they create a reactivity that will never fire, so pass the value itself (`inner: 'Hello'`). Only the first evaluation is checked; a reactivity that stops reading signals on a later run is left alone. The warning is controlled by `ChispaDebugConfig.enableInertReactivityWarnings`, off by default and turned on by `enableDevDebugging()` (see [Debugging](#debugging-chispadebugconfig)).

### 2. Components

Components are defined with the `component` function. A component is a function that receives `props` and returns a node structure (usually built from a template).

```typescript
import { component } from 'chispa';
import tpl from './my-component.html';

export const MyComponent = component(() => {
	return tpl.fragment({
		// ... props and bindings
	});
});
```

### 3. HTML templates and `data-cb`

Chispa separates structure (HTML) from logic (TS). In your HTML files you use the `data-cb` attribute (Callback Data) to mark the elements you need to control from your code.

**my-component.html**

```html
<div>
	<span data-cb="my-text">Initial text</span>
	<button data-cb="my-button">Click me</button>
</div>
```

The compiler generates a `tpl` object where every `data-cb` becomes a builder function (camelCase).

- `data-cb="my-text"` -> `tpl.myText(...)`
- `data-cb="my-button"` -> `tpl.myButton(...)`

### The `tpl.fragment` builder

Every compiled HTML file includes a special builder called `fragment`. It represents **the whole content** of the HTML file.

It is the standard, recommended way to create a component's entry point. Using `fragment` guarantees that the full content of the HTML file is rendered.

```typescript
export const MyComponent = component(() => {
	return tpl.fragment({
		myText: { inner: 'Hello' },
		myButton: { onclick: () => console.log('Click!') },
	});
});
```

Unless you need to render only a specific part of the template — because you are building a sub-component or for some other technical reason — you should always return `tpl.fragment(...)`.

## Usage Guide

### Property bindings

You can bind signals or static values to the properties of DOM elements.

- **`inner`**: Controls the content (text or children).
- **`style`**: Object with CSS styles.
- **`classes`**: Object for conditional classes `{ 'active': isActiveSignal }`.
- **Events**: `onclick`, `oninput`, etc.

```typescript
import { component, computed, signal } from 'chispa';
import tpl from './counter.html';

export const Counter = component(() => {
	const count = signal(0);

	return tpl.fragment({
		myText: {
			inner: count, // Direct signal binding
			style: {
				color: computed(() => (count.get() > 5 ? 'red' : 'black')),
			},
		},
		myButton: {
			onclick: () => count.update((v) => v + 1),
		},
	});
});
```

### Lists (`componentList`)

To render dynamic lists, use `componentList`.

```typescript
import { componentList } from 'chispa';

// List definition
const MyList = componentList<ItemType>(
	// Factory function: creates each item
	(itemSignal, indexSignal, listSignal) => {
		return tpl.listItem({
			nodes: {
				itemName: { inner: itemSignal.computed.name },
			},
		});
	},
	// Key function: unique identifier
	(item) => item.id
);

// Usage in a parent component
const items = signal([
	{ id: 1, name: 'A' },
	{ id: 2, name: 'B' },
]);
// ...
return tpl.container({
	inner: MyList(items),
});
```

### Nested node references (`nodes`)

If an element with `data-cb` contains other `data-cb` elements (descendants), you can reach them through the `nodes` property.

**HTML**

```html
<div data-cb="card">
	<h1 data-cb="title"></h1>
	<p data-cb="content"></p>
</div>
```

**TS**

```typescript
tpl.card({
	nodes: {
		title: { inner: 'Hello World' },
		content: { inner: 'Description...' },
	},
});
```

A nested `data-cb` can also be bound directly in the `fragment` object (or in any ancestor) without following the HTML nesting. Chispa looks up the binding of each `data-cb` starting at its parent's `nodes` and walking up through the ancestors to the `fragment`:

```typescript
// Equivalent to the previous example
tpl.fragment({
	card: {},
	title: { inner: 'Hello World' },
	content: { inner: 'Description...' },
});
```

### Unbound `data-cb`

If a `data-cb` has no binding at any level, **the element is not rendered**: its place is left empty. Since the symptom (a node that simply does not show up) is easy to mistake for other problems, Chispa logs a console warning when it finds a `data-cb` that appears in no bindings object:

```
[chispa] data-cb 'timeline' has no binding, so it will not be rendered. Bind it (e.g. `timeline: {}`) or set it to null explicitly to omit it on purpose.
```

- To render the element exactly as it is in the HTML, bind it to an empty object: `timeline: {}`.
- If the omission is intentional (you do not want that element in this instance), declare it explicitly: `timeline: null`. The warning is only emitted when the key is not declared at any level; an explicit `null`/`undefined` value is treated as a decision and does not warn.
- The warning is controlled by `ChispaDebugConfig.enableMissingBindingWarnings`, off by default and turned on by `enableDevDebugging()` (see [Debugging](#debugging-chispadebugconfig)):

```typescript
import { enableDevDebugging } from 'chispa';

if (import.meta.env.DEV) enableDevDebugging();
```

### Real node reference (`_ref`)

If you need direct access to the DOM element (for example, to use an external library or to focus an input), use the `_ref` property. The function runs as soon as the node is created.

```typescript
tpl.myInput({
	_ref: (el) => {
		console.log('Node created:', el);
		el.focus();
	},
});
```

### Controlled inputs

Chispa provides a `bindControlledInput` utility to handle inputs in a controlled way, allowing real-time transformations and validations.

```typescript
import { component, signal, bindControlledInput } from 'chispa';
import tpl from './my-form.html';

export const MyForm = component(() => {
	const name = signal('');

	return tpl.nameInput({
		_ref: (el) => {
			bindControlledInput(el, name, {
				// Transforms the value before storing it (e.g. force uppercase)
				transform: (val) => val.toUpperCase(),
				// Validates the value. If it returns false, the change is reverted.
				validate: (val) => val.length <= 10,
			});
		},
	});
});
```

## Update model: asynchronous batched refresh

Writing to a signal (`set`/`update`) **does not update the DOM synchronously**. What happens is:

1. The writable signal stores the new value immediately (`signal.get()` already returns it).
2. The `computed` signals, `effect`s and bindings that depend on it are marked as pending.
3. **A single refresh** is scheduled for the next turn of the task queue (`setTimeout(0)`). In that refresh every pending item is re-evaluated in cascade, including those that get marked during the refresh itself.

This way, several writes in the same tick (for example, inside an `onclick`) are applied to the DOM only once, and effects do not run with intermediate states. Note that until that refresh, `computed` signals also return their previous value.

Practical consequences:

- **In event handlers**, do not read the DOM or a `computed` right after writing a signal expecting to see the new state; derive that state with another `computed`/`effect`, or read it from the writable signal itself.
- **In unit tests** (vitest + jsdom) wait for the next tick before asserting on the DOM. With fake timers: `await vi.runOnlyPendingTimersAsync()`; with real timers: `await new Promise((r) => setTimeout(r, 0))`.
- **In E2E tests** (Playwright, Cypress…) use retrying assertions (`await expect(locator).toHaveText(...)`, `cy.get(...).should(...)`) instead of reading the DOM immediately after a `click()`.

```typescript
// vitest
count.update((v) => v + 1);
expect(span.textContent).toBe('0'); // not refreshed yet
await vi.runOnlyPendingTimersAsync();
expect(span.textContent).toBe('1');
```

As a guard against runaway cascades (reactivities that keep marking each other endlessly), a refresh is aborted with a console warning after `globalContext.maxScheduleIterations` iterations (100 by default).

## Dependency injection (`provide` / `inject`)

Chispa ships a very simple service container to share state and logic between components without passing them through props.

```typescript
import { inject, provide, InjectionToken, signal } from 'chispa';

class CartService {
	items = signal<Item[]>([]);
}

// In any component or service: created on first use, reused afterwards
const cart = inject(CartService);

// For values that are not classes, use an InjectionToken and register it with provide()
const API_URL = new InjectionToken<string>('API_URL');
provide(API_URL, () => 'https://api.example.com'); // before the first inject(API_URL)
const url = inject(API_URL);
```

- **`inject(token)`** returns the singleton associated with the token; if it does not exist yet, it is created (with `new Token()` or with the factory registered through `provide`). Reactivities created in the service constructor are **not** disposed when the component that performed the first `inject` unmounts.
- **`provide(token, factory)`** registers how to build a token. It must be called before the first `inject` of that token (usually in `main.ts`); if the singleton already exists, it throws.
- **`inject(token, { local: true })`** creates a fresh, non-cached instance bound to the component being mounted: its effects are disposed together with it.
- **`resetServices()`** clears the container. Meant for test isolation.

### Scope: the container is global

`provide`/`inject` **have no per-subtree scope**: there is a single container for the whole application and a token always resolves to the same singleton, regardless of which component calls `inject`. It works well for application services (API, session, notifications…), but not for "a different context per instance of a parent component".

To share state within a subtree (a form and its fields, a panel and its sections, a row and its cells…), pass the context explicitly as a prop. It is more explicit, it types without tricks and every parent instance gets its own:

```typescript
// form-context.ts
export interface FormCtx {
	errors: Signal<Record<string, string>>;
	setError: (field: string, message: string | null) => void;
}

export function createFormCtx(): FormCtx {
	const errors = signal<Record<string, string>>({});
	return {
		errors,
		setError: (field, message) =>
			errors.update((prev) => {
				const next = { ...prev };
				if (message) next[field] = message;
				else delete next[field];
				return next;
			}),
	};
}

// form.ts — the parent creates the context and hands it out
export const Form = component(() => {
	const ctx = createFormCtx();
	return tpl.fragment({
		nameField: Field({ ctx, name: 'name' }),
		emailField: Field({ ctx, name: 'email' }),
	});
});

// field.ts — children receive it through props
export const Field = component<{ ctx: FormCtx; name: string }>(({ ctx, name }) =>
	tpl.fragment({
		error: { inner: () => ctx.errors.get()[name] ?? '' },
	})
);
```

Create the context inside the parent component's function (as in the example): every reactivity created there is bound to its lifecycle and released when it unmounts. If you prefer to model it as a class, `inject(FormCtx, { local: true })` in the parent gives you a fresh instance with the same lifecycle, which you likewise hand out through props.

## Debugging (`ChispaDebugConfig`)

All development diagnostics are **off by default**, so a production bundle never logs anything unless asked to. The recommended way to turn them on is a single call at application start, guarded by your bundler's development flag so that production builds drop it entirely (Chispa itself does not detect the environment):

```typescript
import { enableDevDebugging } from 'chispa';

if (import.meta.env.DEV) enableDevDebugging();
```

`enableDevDebugging()` enables the warnings that are reliable in any application: `enableMissingBindingWarnings` and `enableInertReactivityWarnings`. The noisier diagnostics stay off unless you pass them explicitly, e.g. `enableDevDebugging({ enableMountLogging: true })`. In particular `enableReactivityWarnings` reports every reactivity created outside a component, which by design includes the effects that services obtained with `inject` set up in their constructors.

For finer control, `ChispaDebugConfig` is a mutable object that can be changed at any time:

| Property                        | Default | Effect                                                                                                                                                                                                                    |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enableMissingBindingWarnings`  | `false` | Warns when a `data-cb` has no binding at any level and is therefore not rendered. Enabled by `enableDevDebugging()`. See [Unbound `data-cb`](#unbound-data-cb).                                                           |
| `enableInertReactivityWarnings` | `false` | Warns when a `computed`, `effect` or function-valued binding reads no signal on its first evaluation and will therefore never re-run. Enabled by `enableDevDebugging()`. See [Dependency tracking](#dependency-tracking). |
| `enableReactivityWarnings`      | `false` | Warns when a reactivity (`computed`, `effect`, binding) is created outside of any component or reactive scope; useful to find subscriptions that will never be released.                                                  |
| `enableMountLogging`            | `false` | Logs every component mount and unmount to the console, together with the component instance (nodes, key, props), to follow the lifecycle of a tree.                                                                       |

## API Reference

### `component<TProps>(factoryFn)`

Creates a component. `factoryFn` receives `props` (typically signals) and must return a node or node structure.

### `signal(value)` / `computed(fn)`

Reactivity primitives. Type guards: `isSignal(value)` and `isWritableSignal(signal)`.

### `componentList<T>(itemFactory, keyFn)`

Creates an optimized list component. Returns a function that accepts a `WritableSignal<T[]>`.

### `appendChild(parent, child)`

Utility to mount the application or components manually.

```typescript
import { appendChild } from 'chispa';
import { App } from './app';

appendChild(document.body, App());
```

### `bindControlledInput(element, signal, options?)`

Binds an input or textarea to a signal in a controlled way. Supports `transform` and `validate` functions.

### `inject(token, options?)` / `provide(token, factory)` / `InjectionToken` / `resetServices()`

Global service container. See [Dependency injection](#dependency-injection-provide--inject).

### `ChispaDebugConfig` / `enableDevDebugging(overrides?)`

Engine development diagnostics, all off by default; `enableDevDebugging()` turns on the reliable ones in a single call. See [Debugging](#debugging-chispadebugconfig).

### `globalContext`

Engine context singleton. Only two members are part of the public API: `createRoot(component, mountPoint)`, which empties `mountPoint` and mounts the component there, and `maxScheduleIterations` (see [Update model](#update-model-asynchronous-batched-refresh)). Its other methods are internal plumbing and may change in minor versions.

### Internal exports

`getItem`, `getValidProps`, `setAttributes` and `setProps` are exported because the code generated by the HTML compiler imports them. They are **not** part of the stable public API: they ship in lockstep with the compiler and may change in minor versions. Build on `component`, `appendChild`, the template builders and the primitives above instead.
