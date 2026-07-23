/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { inject, provide, resetServices, InjectionToken } from '../src/injection';
import { signal } from '../src/signals';
import { globalContext } from '../src/context';
import { component, onUnmount } from '../src/components';
import { appendChild } from '../src/builder';

beforeEach(() => {
	resetServices();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Basic injection
// ---------------------------------------------------------------------------

describe('inject()', () => {
	it('creates a service instance on first injection', () => {
		class CounterService {
			count = 0;
		}

		const svc = inject(CounterService);
		expect(svc).toBeInstanceOf(CounterService);
	});

	it('returns the same singleton on subsequent injections', () => {
		class CounterService {}

		const a = inject(CounterService);
		const b = inject(CounterService);
		expect(a).toBe(b);
	});

	it('keeps distinct singletons for different classes', () => {
		class ServiceA {}
		class ServiceB {}

		expect(inject(ServiceA)).not.toBe(inject(ServiceB));
	});
});

// ---------------------------------------------------------------------------
// Components mounted inside a singleton: the injection guard must only cut
// ties with what existed BEFORE the injection began, not with the singleton's
// own component tree
// ---------------------------------------------------------------------------

describe('inject() – components mounted inside a singleton', () => {
	it('nested components inside a singleton component tree are disposed with their parent', () => {
		const childUnmountSpy = vi.fn();

		const Child = component(() => {
			onUnmount(childUnmountSpy);
			return document.createElement('span');
		});

		class UiService {
			panel = component(() => {
				const div = document.createElement('div');
				Child().mount(div);
				return div;
			})();

			constructor() {
				this.panel.mount(document.body);
			}
		}

		const svc = inject(UiService);
		expect(childUnmountSpy).not.toHaveBeenCalled();

		svc.panel.unmount();
		expect(childUnmountSpy).toHaveBeenCalledTimes(1);
	});

	it('signal reads inside a singleton constructor are not tracked by the evaluating reactivity', async () => {
		const constructorSignal = signal(0);
		let evaluations = 0;

		class LazyService {
			value: number;
			constructor() {
				// Incidental one-time read during construction
				this.value = constructorSignal.get();
			}
		}

		const Host = component(() => {
			const div = document.createElement('div');
			appendChild(div, () => {
				evaluations++;
				return String(inject(LazyService).value);
			});
			return div;
		});

		const container = document.createElement('div');
		Host().mount(container);
		await vi.runOnlyPendingTimersAsync();
		expect(evaluations).toBe(1);
		expect(container.textContent).toBe('0');

		// The constructor's read must not have subscribed the child computed
		constructorSignal.set(1);
		await vi.runOnlyPendingTimersAsync();
		expect(evaluations).toBe(1);
	});

	it('a singleton top-level component is NOT tied to the component that triggered the injection', () => {
		class PanelService {
			panel = component(() => {
				const div = document.createElement('div');
				div.className = 'service-panel';
				return div;
			})();

			constructor() {
				this.panel.mount(document.body);
			}
		}

		const Host = component(() => {
			inject(PanelService);
			return document.createElement('div');
		});

		const host = Host();
		const mountPoint = document.createElement('div');
		document.body.appendChild(mountPoint);
		host.mount(mountPoint);
		expect(document.querySelector('.service-panel')).not.toBeNull();

		// Unmounting the injecting component must not unmount the service's panel
		host.unmount();
		expect(document.querySelector('.service-panel')).not.toBeNull();

		inject(PanelService).panel.unmount();
		mountPoint.remove();
	});
});

// ---------------------------------------------------------------------------
// Core fix: effects created in the service constructor must NOT be disposed
// when the component that first triggered the injection unmounts
// ---------------------------------------------------------------------------

describe('inject() – effect lifetime isolation', () => {
	it('service effect survives unmounting of the first injecting component', async () => {
		const counter = signal(0);
		const effectLog: number[] = [];

		class TrackedService {
			constructor() {
				globalContext.addReactivity(() => {
					effectLog.push(counter.get());
				});
			}
		}

		// Mount a component that injects TrackedService for the first time
		const MyComp = component(() => {
			inject(TrackedService);
			return document.createElement('div');
		});

		const container = document.createElement('div');
		document.body.appendChild(container);
		const comp = MyComp();
		comp.mount(container);

		// The effect ran once on creation
		expect(effectLog).toEqual([0]);

		// Unmount the component — the service effect must NOT be disposed
		comp.unmount();

		// Trigger the signal — the effect should still fire
		counter.set(1);
		await vi.runAllTimersAsync();

		expect(effectLog).toEqual([0, 1]);
	});

	it('service effect continues to work after the first injector is replaced by a second component', async () => {
		const counter = signal(0);
		const effectLog: number[] = [];

		class TrackedService {
			constructor() {
				globalContext.addReactivity(() => {
					effectLog.push(counter.get());
				});
			}
		}

		const container = document.createElement('div');
		document.body.appendChild(container);

		// First component injects and then is unmounted
		const CompA = component(() => {
			inject(TrackedService);
			return document.createElement('div');
		});
		const compA = CompA();
		compA.mount(container);
		compA.unmount();

		// Second component also injects (gets the singleton)
		const CompB = component(() => {
			inject(TrackedService);
			return document.createElement('div');
		});
		const compB = CompB();
		compB.mount(container);

		counter.set(42);
		await vi.runAllTimersAsync();

		// Effect should have fired: initial (0), then after set (42)
		expect(effectLog).toContain(42);
	});
});

// ---------------------------------------------------------------------------
// provide() – custom factory
// ---------------------------------------------------------------------------

describe('provide()', () => {
	it('uses the factory instead of the default constructor', () => {
		class ApiService {
			constructor(public readonly url: string = 'default') {}
		}

		provide(ApiService, () => new ApiService('https://api.example.com'));

		const svc = inject(ApiService);
		expect(svc.url).toBe('https://api.example.com');
	});

	it('factory is called only once (singleton)', () => {
		class ApiService {}
		const factory = vi.fn(() => new ApiService());

		provide(ApiService, factory);

		inject(ApiService);
		inject(ApiService);
		inject(ApiService);

		expect(factory).toHaveBeenCalledTimes(1);
	});

	it('throws if provide() is called after the service has already been injected', () => {
		class EagerService {}

		inject(EagerService); // primes the cache

		expect(() => provide(EagerService, () => new EagerService())).toThrowError(
			'Cannot call provide() for EagerService after it has already been injected.'
		);
	});

	it('allows provide() again after resetServices()', () => {
		class MyService {
			constructor(public readonly tag: string = 'default') {}
		}

		provide(MyService, () => new MyService('first'));
		inject(MyService);
		resetServices();

		provide(MyService, () => new MyService('second'));
		expect(inject(MyService).tag).toBe('second');
	});
});

// ---------------------------------------------------------------------------
// InjectionToken
// ---------------------------------------------------------------------------

describe('InjectionToken', () => {
	it('injects a value registered via provide()', () => {
		const API_URL = new InjectionToken<string>('API_URL');
		provide(API_URL, () => 'https://api.example.com');

		expect(inject(API_URL)).toBe('https://api.example.com');
	});

	it('returns the same singleton for repeated inject() calls', () => {
		const TOKEN = new InjectionToken<{ id: number }>('OBJ');
		const obj = { id: 1 };
		provide(TOKEN, () => obj);

		expect(inject(TOKEN)).toBe(inject(TOKEN));
	});

	it('throws a descriptive error when no provider is registered', () => {
		const MISSING = new InjectionToken<string>('MISSING_SERVICE');

		expect(() => inject(MISSING)).toThrowError('No provider registered for InjectionToken "MISSING_SERVICE"');
	});

	it('stores description on the token', () => {
		const TOKEN = new InjectionToken<string>('my-token');
		expect(TOKEN.description).toBe('my-token');
	});
});

// ---------------------------------------------------------------------------
// resetServices() – test isolation helper
// ---------------------------------------------------------------------------

describe('resetServices()', () => {
	it('causes a new instance to be created after reset', () => {
		class MyService {}

		const before = inject(MyService);
		resetServices();
		const after = inject(MyService);

		expect(before).not.toBe(after);
	});

	it('clears registered factories so an InjectionToken throws again', () => {
		const TOKEN = new InjectionToken<string>('RESET_TOKEN');
		provide(TOKEN, () => 'value');
		inject(TOKEN); // prime the cache

		resetServices();

		expect(() => inject(TOKEN)).toThrowError('RESET_TOKEN');
	});
});

// ---------------------------------------------------------------------------
// inject({ local: true }) – component-scoped instances
// ---------------------------------------------------------------------------

describe('inject({ local: true })', () => {
	it('returns a new instance every call, not the singleton', () => {
		class MyService {}

		const a = inject(MyService, { local: true });
		const b = inject(MyService, { local: true });
		expect(a).not.toBe(b);
	});

	it('local instance is not stored in the singleton cache', () => {
		class MyService {}

		inject(MyService, { local: true });
		// The singleton should be a different object
		const singleton = inject(MyService);
		const anotherLocal = inject(MyService, { local: true });
		expect(singleton).not.toBe(anotherLocal);
	});

	it('uses the registered factory when local: true', () => {
		class ApiService {
			constructor(public readonly url: string = 'default') {}
		}
		provide(ApiService, () => new ApiService('https://api.example.com'));

		const svc = inject(ApiService, { local: true });
		expect(svc.url).toBe('https://api.example.com');
	});

	it('throws for an unregistered InjectionToken when local: true', () => {
		const TOKEN = new InjectionToken<string>('LOCAL_TOKEN');
		expect(() => inject(TOKEN, { local: true })).toThrowError('LOCAL_TOKEN');
	});

	it('local service effects are disposed when the component unmounts', async () => {
		const counter = signal(0);
		const effectLog: number[] = [];

		class LocalService {
			constructor() {
				globalContext.addReactivity(() => {
					effectLog.push(counter.get());
				});
			}
		}

		const MyComp = component(() => {
			inject(LocalService, { local: true });
			return document.createElement('div');
		});

		const container = document.createElement('div');
		document.body.appendChild(container);
		const comp = MyComp();
		comp.mount(container);

		expect(effectLog).toEqual([0]);

		// Unmount — effect should be disposed
		comp.unmount();

		counter.set(99);
		await vi.runAllTimersAsync();

		// Effect must NOT have fired again after unmount
		expect(effectLog).toEqual([0]);
	});

	it('singleton effects are NOT disposed when a sibling local component unmounts', async () => {
		const counter = signal(0);
		const singletonLog: number[] = [];
		const localLog: number[] = [];

		class SingletonService {
			constructor() {
				globalContext.addReactivity(() => {
					singletonLog.push(counter.get());
				});
			}
		}

		class LocalService {
			constructor() {
				globalContext.addReactivity(() => {
					localLog.push(counter.get());
				});
			}
		}

		const container = document.createElement('div');
		document.body.appendChild(container);

		const CompA = component(() => {
			inject(SingletonService); // singleton
			inject(LocalService, { local: true }); // local
			return document.createElement('div');
		});

		const compA = CompA();
		compA.mount(container);

		// Both ran on init
		expect(singletonLog).toEqual([0]);
		expect(localLog).toEqual([0]);

		compA.unmount();

		counter.set(1);
		await vi.runAllTimersAsync();

		// Singleton effect still alive, local effect disposed
		expect(singletonLog).toContain(1);
		expect(localLog).toEqual([0]);
	});
});
