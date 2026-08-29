import { Component, ComponentList } from './components';
import { ChispaDebugConfig } from './config';
import { Signal } from './signals';

type ExecutionKind = 'createComponent' | 'computed' | 'addReactivity';

export interface IDisposable {
	dispose: () => void;
}

export interface IDisposableOwner {
	addDisposable(disposable: IDisposable): void;
}

/**
 * An isolated set of execution stacks. A fresh frame is pushed while a singleton
 * service is being constructed, so nothing created inside it can bind to (or be
 * tracked by) whatever component, reactivity or computed happened to trigger the
 * injection. Everything the singleton mounts or creates lives on its own frame,
 * where ownership and tracking work exactly as in the root frame.
 */
class ContextFrame {
	reactivityContextStack: Reactivity[] = [];

	executionStack: ExecutionKind[] = [];

	componentStack: (Component | ComponentList)[] = [];

	// Components and executing/evaluating reactivities, in nesting order. The innermost
	// entry owns the reactivities created within, so it can dispose them later.
	ownerStack: IDisposableOwner[] = [];
}

class AppContext {
	private refreshTimeout: any = 0;

	private dirtyReactivities = new Set<Reactivity>();

	private frames: ContextFrame[] = [new ContextFrame()];

	private get frame(): ContextFrame {
		return this.frames[this.frames.length - 1];
	}

	pushContextFrame() {
		this.frames.push(new ContextFrame());
	}

	popContextFrame() {
		if (this.frames.length === 1) {
			throw new Error('Cannot pop the root context frame');
		}
		this.frames.pop();
	}

	pushComponentStack(cmp: Component | ComponentList) {
		this.frame.componentStack.push(cmp);
		this.frame.ownerStack.push(cmp);
	}

	popComponentStack() {
		this.frame.componentStack.pop();
		this.frame.ownerStack.pop();
	}

	getCurrentComponent() {
		const stack = this.frame.componentStack;
		if (stack.length === 0) {
			//console.warn('No current component');
			return null;
		}
		return stack[stack.length - 1];
	}

	getCurrentOwner(): IDisposableOwner | null {
		const stack = this.frame.ownerStack;
		if (stack.length === 0) return null;
		return stack[stack.length - 1];
	}

	setCurrentReactivityContext(context: Reactivity) {
		this.frame.reactivityContextStack.push(context);
		this.frame.ownerStack.push(context);
	}

	restorePreviousReactivityContext() {
		this.frame.reactivityContextStack.pop();
		this.frame.ownerStack.pop();
	}

	getCurrentRenderContext() {
		const stack = this.frame.reactivityContextStack;
		if (stack.length === 0) {
			//console.warn('No current render context');
			return null;
		}
		return stack[stack.length - 1];
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
		warnIfInertReactivity(ctx, 'effect', executor);
		return ctx;
	}

	createRoot(component: () => Component, mountPoint: HTMLElement) {
		this.dirtyReactivities.clear();
		mountPoint.innerHTML = '';
		const cmp = component();
		cmp.mount(mountPoint, null);
	}

	canReadSignal() {
		const stack = this.frame.executionStack;
		if (stack.length === 0) return true;
		return stack[stack.length - 1] !== 'createComponent';
	}

	pushExecutionStack(type: ExecutionKind) {
		this.frame.executionStack.push(type);
	}

	popExecutionStack() {
		this.frame.executionStack.pop();
	}

	addDirtyContext(ctx: Reactivity) {
		this.dirtyReactivities.add(ctx);
	}

	removeDirtyContext(ctx: Reactivity) {
		this.dirtyReactivities.delete(ctx);
	}
}

export class Reactivity implements IDisposable, IDisposableOwner {
	private dirty: boolean = false;

	private signals = new Set<Signal<any>>();

	// Disposables (e.g. nested reactivities) created during this reactivity's execution.
	// They belong to that execution: re-running the action recreates the ones still
	// needed, so the previous ones must be disposed to avoid leaking subscriptions.
	private ownedDisposables: IDisposable[] = [];

	constructor(private readonly action: () => void) {
		const owner = globalContext.getCurrentOwner();
		if (owner) {
			owner.addDisposable(this);
		} else {
			if (ChispaDebugConfig.enableReactivityWarnings) {
				console.warn('Creating a Reactivity outside of a component');
			}
		}
	}

	addDisposable(disposable: IDisposable) {
		this.ownedDisposables.push(disposable);
	}

	private disposeOwned() {
		const owned = this.ownedDisposables;
		this.ownedDisposables = [];
		owned.forEach((d) => d.dispose());
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

	hasDependencies() {
		return this.signals.size > 0;
	}

	process() {
		if (!this.dirty) return;
		this.exec();
		//console.log('re-render cycle completed');
		this.dirty = false;
		globalContext.removeDirtyContext(this);
	}

	exec() {
		this.disposeOwned();
		this.signals.forEach((s) => s.removeContext(this));
		this.signals.clear();
		globalContext.setCurrentReactivityContext(this);
		this.action();
		globalContext.restorePreviousReactivityContext();
	}

	dispose() {
		this.disposeOwned();
		this.signals.forEach((s) => s.removeContext(this));
		this.signals.clear();
		this.dirty = false;
		globalContext.removeDirtyContext(this);
	}
}

// Only signals can mark a reactivity dirty, so one that read no signal can never run
// again. Warn right after its first execution, which is where the mistake was made.
export function warnIfInertReactivity(ctx: Reactivity, kind: 'computed' | 'effect', fn: Function) {
	if (!ChispaDebugConfig.enableInertReactivityWarnings || ctx.hasDependencies()) return;
	const source = fn.toString().replace(/\s+/g, ' ').trim();
	const snippet = source.length > 80 ? source.slice(0, 77) + '...' : source;
	console.warn(
		`[chispa] ${kind} did not read any signal on its first evaluation, so it will never re-run: ${snippet}. ` +
			`If it must react to state, read the signals it depends on unconditionally (also on the first run); ` +
			`if the value is constant, pass it directly instead of a function.`
	);
}

/**
 * Engine context singleton. Only `createRoot(component, mountPoint)` and
 * `maxScheduleIterations` are part of the stable public API; every other member is
 * internal plumbing shared with the compiler and may change in minor versions.
 */
export const globalContext = new AppContext();
