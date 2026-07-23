import { globalContext } from './context';

type Constructor<T> = new (...args: any[]) => T;

/**
 * A typed token that can be used to inject values or interfaces that are not
 * tied to a concrete class constructor.
 *
 * @example
 * const API_URL = new InjectionToken<string>('API_URL');
 * provide(API_URL, () => 'https://api.example.com');
 * const url = inject(API_URL); // string
 */
export class InjectionToken<T> {
	constructor(public readonly description: string) {}
}

type Token<T> = Constructor<T> | InjectionToken<T>;

class ServiceContainer {
	private services = new Map<Token<any>, any>();
	private factories = new Map<Token<any>, () => any>();

	public provide<T>(token: Token<T>, factory: () => T): void {
		if (this.services.has(token)) {
			const name = token instanceof InjectionToken ? `"${token.description}"` : (token as Constructor<T>).name;
			throw new Error(`Cannot call provide() for ${name} after it has already been injected.`);
		}
		this.factories.set(token, factory);
	}

	public get<T>(token: Token<T>): T {
		if (this.services.has(token)) {
			return this.services.get(token) as T;
		}

		let service: T;

		// Construct the singleton in a fresh context frame: nothing created inside
		// may bind to the component/reactivity that happened to trigger the injection
		globalContext.pushContextFrame();
		try {
			service = this.createInstance(token);
		} finally {
			globalContext.popContextFrame();
		}

		this.services.set(token, service);
		return service;
	}

	/**
	 * Creates a fresh, non-cached instance of the token's service.
	 * Runs inside the current component context so that any effects created
	 * in the constructor are bound to (and disposed with) that component.
	 */
	public getLocal<T>(token: Token<T>): T {
		// TODO: this is a bit hacky, we should find a cleaner way to create local instances without affecting the global singleton cache or execution stack
		return this.createInstance(token);
	}

	private createInstance<T>(token: Token<T>): T {
		const factory = this.factories.get(token);
		if (factory) {
			return factory();
		} else if (token instanceof InjectionToken) {
			throw new Error(`No provider registered for InjectionToken "${token.description}"`);
		} else {
			return new (token as Constructor<T>)();
		}
	}

	public reset(): void {
		this.services.clear();
		this.factories.clear();
	}
}

const services = new ServiceContainer();

/**
 * Registers a factory function for the given token. The factory is called
 * at most once (the result is cached as a singleton). Must be called before
 * the first `inject(token)` call for that token.
 */
export function provide<T>(token: Token<T>, factory: () => T): void {
	services.provide(token, factory);
}

export interface InjectOptions {
	/**
	 * When `true`, a new instance is created every time and is NOT added to the
	 * singleton cache. Any reactive effects created in the service constructor
	 * will be registered to the currently mounting component and disposed when
	 * it unmounts.
	 */
	local?: boolean;
}

/**
 * Injects (or lazily creates) the singleton service associated with `token`.
 * Any reactive effects declared inside the service constructor will NOT be
 * disposed when the component that first triggers the injection is unmounted.
 *
 * Pass `{ local: true }` to get a fresh, component-scoped instance instead:
 * effects will be disposed together with the component.
 */
export function inject<T>(token: Token<T>, options?: InjectOptions): T {
	if (options?.local) {
		return services.getLocal(token);
	}
	return services.get(token);
}

/**
 * Resets the entire service container. Useful for test isolation.
 */
export function resetServices(): void {
	services.reset();
}
