import { Component, ComponentList } from './components';
import { ChispaDebugConfig } from './config';
import { Signal } from './signals';

type ExecutionKind = 'createComponent' | 'computed' | 'addReactivity';

export interface IDisposable {
	dispose: () => void;
}

class AppContext {
	private reactivityContextStack: Reactivity[] = [];

	private refreshTimeout: any = 0;

	//private contexts = new Set<RenderContext>();

	private dirtyReactivities = new Set<Reactivity>();

	private executionStack: ExecutionKind[] = [];

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

	// Maximum number of iterations to process during a scheduled refresh. Prevents
	// unbounded loops in case of uncontrolled reactivity cascades. Use the
	// `globalContext.maxScheduleIterations` field to override in tests or
	// special cases.
	public maxScheduleIterations = 100;

	scheduleRefresh() {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}
		this.refreshTimeout = setTimeout(() => {
			let iteration = 0;
			// Process dirty contexts until none remain, or until the iteration limit
			// is reached (this avoids infinite loops when reactivities keep
			// re-adding themselves or each other).
			while (this.dirtyReactivities.size > 0 && iteration < this.maxScheduleIterations) {
				iteration++;
				const dirtyContexts = Array.from(this.dirtyReactivities);
				dirtyContexts.forEach((ctx) => ctx.process());
			}

			if (this.dirtyReactivities.size > 0) {
				// Warn once if we stopped early due to the iteration limit. We also
				// clear the set to avoid repeated warnings and to avoid leaving the
				// system in a permanently spinning state.
				console.warn(`[AppContext.scheduleRefresh] possible uncontrolled reactivity cascade: processed ${iteration} iterations — aborting.`);
				this.dirtyReactivities.clear();
			}
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

	pushExecutionStack(type: ExecutionKind) {
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
			currentComponent.addDisposable(this);
		} else {
			if (ChispaDebugConfig.enableReactivityWarnings) {
				console.warn('Creating a Reactivity outside of a component');
			}
		}
	}

	markDirty() {
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
