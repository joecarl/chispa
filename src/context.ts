import { Component, ComponentList } from './components';
import { Signal } from './signals';

type TExecutionProcess = 'createComponent' | 'computed' | 'addReactivity';

export interface IDisposable {
	dispose: () => void;
}

class AppContext {
	private reactivityContextStack: Reactivity[] = [];

	private refreshTimeout: any = 0;

	//private contexts = new Set<RenderContext>();

	private dirtyReactivities = new Set<Reactivity>();

	private executionStack: TExecutionProcess[] = [];

	private componentStack: (Component | ComponentList)[] = [];

	pushComponentStack(cmp: Component | ComponentList) {
		this.componentStack.push(cmp);
	}

	popComponentStack() {
		this.componentStack.pop();
	}

	getCurrentComponent() {
		if (this.componentStack.length === 0) {
			//console.warn('No current component');
			return null;
		}
		return this.componentStack[this.componentStack.length - 1];
	}

	setCurrentReactivityContext(context: Reactivity) {
		this.reactivityContextStack.push(context);
		//this.contexts.add(context);
	}

	restorePreviousReactivityContext() {
		this.reactivityContextStack.pop();
	}

	getCurrentRenderContext() {
		if (this.reactivityContextStack.length === 0) {
			//console.warn('No current render context');
			return null;
		}
		return this.reactivityContextStack[this.reactivityContextStack.length - 1];
	}

	scheduleRefresh() {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}
		this.refreshTimeout = setTimeout(() => {
			const dirtyContexts = Array.from(this.dirtyReactivities);
			dirtyContexts.forEach((ctx) => ctx.process());
		}, 0);
	}

	addReactivity(executor: () => void) {
		const ctx = new Reactivity(executor);
		globalContext.pushExecutionStack('addReactivity');
		ctx.exec();
		globalContext.popExecutionStack();
		return ctx;
	}

	createRoot(component: () => Component, mountPoint: HTMLElement) {
		this.dirtyReactivities.clear();
		mountPoint.innerHTML = '';
		const cmp = component();
		cmp.mount(mountPoint, null);
	}

	canReadSignal() {
		const length = this.executionStack.length;
		if (length === 0) return true;
		const current = this.executionStack[length - 1];
		return current !== 'createComponent';
	}

	pushExecutionStack(type: TExecutionProcess) {
		this.executionStack.push(type);
	}

	popExecutionStack() {
		this.executionStack.pop();
	}

	addDirtyContext(ctx: Reactivity) {
		this.dirtyReactivities.add(ctx);
	}

	removeDirtyContext(ctx: Reactivity) {
		this.dirtyReactivities.delete(ctx);
	}
}

export class Reactivity implements IDisposable {
	private dirty: boolean = false;

	private signals = new Set<Signal<any>>();

	constructor(private readonly action: () => void) {
		const currentComponent = globalContext.getCurrentComponent();
		if (currentComponent) {
			currentComponent.disposables.push(this);
		} else {
			console.warn('Creating a Reactivity outside of a component');
		}
	}

	markDirty() {
		// Mark the context as dirty (needing re-render)
		//console.log('marking context as dirty');
		this.dirty = true;
		globalContext.addDirtyContext(this);
		globalContext.scheduleRefresh();
	}

	addSignal(signal: Signal<any>) {
		this.signals.add(signal);
	}

	removeSignal(signal: Signal<any>) {
		this.signals.delete(signal);
	}

	process() {
		if (!this.dirty) return;
		this.exec();
		//console.log('re-render cycle completed');
		this.dirty = false;
		globalContext.removeDirtyContext(this);
	}

	exec() {
		this.signals.forEach((s) => s.removeContext(this));
		this.signals.clear();
		globalContext.setCurrentReactivityContext(this);
		this.action();
		globalContext.restorePreviousReactivityContext();
	}

	dispose() {
		this.signals.forEach((s) => s.removeContext(this));
		this.signals.clear();
		this.dirty = false;
		globalContext.removeDirtyContext(this);
	}
}

export const globalContext = new AppContext();
