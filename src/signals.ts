import { globalContext, Reactivity } from './context';

type WithSignals<T> = { [K in keyof T]: Signal<T[K]> };

abstract class Signal<T> {
	protected abstract value: T;

	protected contexts: Set<Reactivity> = new Set();

	constructor() {}

	get() {
		if (!globalContext.canReadSignal()) {
			throw new Error('Cannot read a signal value during component creation. Did you mean to use a computed signal instead?');
		}
		//context.current.register(this);
		const ctx = globalContext.getCurrentRenderContext();
		if (ctx) {
			this.contexts.add(ctx);
			ctx.addSignal(this);
		}
		return this.value;
	}

	public readonly computed = new Proxy(
		{},
		{
			get: (_, prop) => {
				return computed(() => this.get()[prop as keyof T]);
			},
		}
	) as WithSignals<T>;

	removeContext(ctx: Reactivity) {
		this.contexts.delete(ctx);
	}

	dispose() {
		console.log('disposing signal', this);
		this.contexts.forEach((ctx) => {
			ctx.removeSignal(this);
		});
		this.contexts.clear();
	}
}

class WritableSignal<T> extends Signal<T> {
	protected override value: T;

	public readonly initialValue: T;

	constructor(initialValue: T) {
		super();
		this.initialValue = initialValue;
		this.value = initialValue;
	}

	set(newValue: T) {
		this.value = newValue;
		this.contexts.forEach((ctx) => ctx.markDirty());
	}

	update(updater: (value: T) => T) {
		this.value = updater(this.value);
		this.contexts.forEach((ctx) => ctx.markDirty());
	}
}

class ComputedSignal<T> extends Signal<T> {
	protected override value: T;

	private computeFn: () => T;

	constructor(computeFn: () => T) {
		super();
		globalContext.pushExecutionStack('computed');
		this.value = computeFn();
		globalContext.popExecutionStack();
		this.computeFn = computeFn;
	}

	recompute() {
		const newValue = this.computeFn();
		if (newValue !== this.value) {
			this.value = newValue;
			this.contexts.forEach((ctx) => ctx.markDirty());
		}
	}
}

export function isSignal(value: any): value is Signal<any> {
	return value instanceof Signal;
}

export function isWriteableSignal<T>(value: Signal<T>): value is WritableSignal<T> {
	return value instanceof WritableSignal;
}

export function signal<T>(initialValue: T) {
	const sig = new WritableSignal(initialValue);

	// // Creamos una función que se usará como callable
	// const fn = (() => sig.get()) as any;

	// // Copiamos todas las propiedades y métodos de la instancia a la función
	// Object.setPrototypeOf(fn, sig.constructor.prototype);

	// // Copiamos las propiedades de instancia
	// Object.assign(fn, this);

	// // Retornamos la función como si fuera la instancia
	// return fn as WritableSignal<T> & (() => T);

	return sig;
}

export function computed<T>(fn: () => T) {
	let sig: ComputedSignal<T>;
	const ctx = new Reactivity(() => {
		sig.recompute();
	});
	globalContext.setCurrentReactivityContext(ctx);
	sig = new ComputedSignal(fn);
	globalContext.restorePreviousReactivityContext();

	return sig as Signal<T>;
}

export function effect(fn: () => void) {
	globalContext.addReactivity(fn);
}

export type { Signal, WritableSignal };
