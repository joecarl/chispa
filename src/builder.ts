import { Component, ComponentList } from './components';
import { ChispaDebugConfig } from './config';
import { globalContext } from './context';
import { computed, isSignal, type Signal } from './signals';

export type ChispaReactive<T> = T | Signal<T> | (() => T);
export type ChispaNode = string | number | Node | null;
export type ChispaContent = ChispaNode | Component | (ChispaNode | Component)[] | ComponentList;
export type ChispaContentReactive = ChispaReactive<ChispaContent>;
export type ChispaClasses = Record<string, ChispaReactive<boolean>>;
export type ChispaCSSPropertiesStrings = {
	[K in keyof CSSStyleDeclaration]?: ChispaReactive<string>;
};

type EventPropKeys<T> = Extract<keyof T, `on${string}`>;
type AllowSignals<T> = { [K in keyof T]: ChispaReactive<T[K]> };

type ChispaNodeBuilderBaseProps<T> = AllowSignals<Omit<T, 'style' | 'dataset' | EventPropKeys<T>>> & Pick<T, EventPropKeys<T>>;
interface INodeBuilderSpecialProps {
	addClass?: ChispaReactive<string | string[]>;
	classes?: ChispaClasses;
	style?: ChispaCSSPropertiesStrings;
	dataset?: Record<string, ChispaReactive<string>>;
}
interface INodeBuilderAdditionalProps<T, TNodes> {
	nodes?: TNodes;
	inner?: ChispaContentReactive;
	_ref?: (node: T) => void | { current: T | null };
}
export type ChispaNodeBuilderProps<T, TNodes> = Partial<ChispaNodeBuilderBaseProps<T>> & INodeBuilderAdditionalProps<T, TNodes> & INodeBuilderSpecialProps;
export type ChispaNodeBuilderPropsReactive<T, TNodes> = ChispaReactive<ChispaNodeBuilderProps<T, TNodes>>;

const forbiddenProps = ['nodes', 'inner', '_ref'];

/**
 * @internal Used by compiler-generated template code. Not part of the stable public
 * API: ships in lockstep with the HTML compiler and may change in minor versions.
 */
export function getValidProps<T>(props: ChispaNodeBuilderProps<T, any>) {
	const finalProps: any = {};

	for (const propName in props) {
		if (!forbiddenProps.includes(propName)) {
			finalProps[propName] = props[propName as keyof typeof props];
		}
	}

	return finalProps as ChispaNodeBuilderProps<T, any>;
}

// Bindings of the `data-cb` items being built, innermost first. A nested item can be
// bound in its parent's `nodes` or at any ancestor level (the fragment included).
const itemsStack: any[] = [];
function findItemInStack(itemName: string): any {
	for (const itemsDefs of itemsStack) {
		if (itemsDefs && itemsDefs[itemName]) {
			return itemsDefs[itemName];
		}
	}
	return null;
}

// A binding declared with an explicit empty value (e.g. `title: null`) means "render
// nothing" on purpose. Only a name missing from every level is a likely mistake.
function isItemDeclaredInStack(itemName: string): boolean {
	return itemsStack.some((itemsDefs) => itemsDefs !== null && typeof itemsDefs === 'object' && itemName in itemsDefs);
}

/**
 * @internal Used by compiler-generated template code. Not part of the stable public
 * API: ships in lockstep with the HTML compiler and may change in minor versions.
 */
export function getItem<T>(template: T, items: any, itemName: keyof T) {
	itemsStack.unshift(items);
	try {
		const item: any = findItemInStack(itemName as string);

		if (!item) {
			if (ChispaDebugConfig.enableMissingBindingWarnings && !isItemDeclaredInStack(itemName as string)) {
				console.warn(
					`[chispa] data-cb '${String(itemName)}' has no binding, so it will not be rendered. ` +
						`Bind it (e.g. \`${String(itemName)}: {}\`) or set it to null explicitly to omit it on purpose.`
				);
			}
			return null;
		}

		if (item.constructor && item.constructor.name === 'Object' && !(item instanceof Element)) {
			const Comp = template[itemName] as (props: any) => Element;
			const itemProps = item;

			return Comp(itemProps);
		}

		return item;
	} finally {
		// Always restore the stack, even if a builder throws, so later lookups never see stale bindings
		itemsStack.shift();
	}
}

/**
 * @internal Used by compiler-generated template code. Not part of the stable public
 * API: ships in lockstep with the HTML compiler and may change in minor versions.
 */
export function setAttributes(node: Element, attributes: Record<string, string>) {
	for (const attr in attributes) {
		const attrValue = attributes[attr];
		if (attrValue === undefined || attrValue === null) {
			node.removeAttribute(attr);
			continue;
		}
		node.setAttribute(attr, attrValue);
	}
}

function isEventProp(prop: string) {
	return prop.startsWith('on');
}

function getPropValue(props: any, prop: string) {
	const propValue = props[prop];
	if (typeof propValue === 'function' && !isEventProp(prop)) {
		return computed(propValue);
	}
	return propValue;
}

/**
 * @internal Used by compiler-generated template code. Not part of the stable public
 * API: ships in lockstep with the HTML compiler and may change in minor versions.
 */
export function setProps<T extends Element>(node: T, props: ChispaNodeBuilderPropsReactive<T, any>) {
	let _props = props;
	if (typeof _props === 'function') {
		_props = computed(_props);
	}
	if (isSignal(_props)) {
		globalContext.addReactivity(() => {
			setProps(node, _props.get());
		});
		return;
	}

	props = getValidProps(_props);

	if (node instanceof HTMLElement) {
		setSpecialProps(node, props);
	}

	for (const prop in props) {
		const propValue = getPropValue(props, prop);
		//console.log('setting prop', prop, propValue )
		if (isSignal(propValue)) {
			globalContext.addReactivity(() => {
				(node as any)[prop] = propValue.get();
			});
		} else if (propValue === undefined) {
			continue;
		} else {
			(node as any)[prop] = propValue;
		}
	}
}

function parseAddClassProp(value: string | string[]): string[] {
	const arr = typeof value === 'string' ? value.split(' ') : value;
	return arr.filter((c) => c.trim() !== '');
}

function setSpecialProps<T extends HTMLElement>(node: T, props: INodeBuilderSpecialProps) {
	if (props.style !== undefined) {
		const style = props.style;
		for (const styleKey in style) {
			let styleValue = style[styleKey]!;
			if (typeof styleValue === 'function') {
				styleValue = computed(styleValue);
			}
			if (isSignal(styleValue)) {
				globalContext.addReactivity(() => {
					node.style[styleKey] = styleValue.get();
				});
			} else {
				node.style[styleKey] = styleValue;
			}
		}
		delete props.style;
	}

	if (props.addClass !== undefined) {
		let addClass = props.addClass;
		let prevClass: string[] | null = null;

		if (typeof addClass === 'function') {
			addClass = computed(addClass);
		}

		if (isSignal(addClass)) {
			globalContext.addReactivity(() => {
				const classes = parseAddClassProp(addClass.get());
				const classesToRemove = prevClass ? prevClass.filter((c) => !classes.includes(c)) : [];
				node.classList.remove(...classesToRemove);
				node.classList.add(...classes);
				prevClass = classes;
			});
		} else {
			const toAdd = parseAddClassProp(addClass);
			node.classList.add(...toAdd);
		}
		delete props.addClass;
	}

	if (props.classes !== undefined) {
		const classes = props.classes;
		for (const className in classes) {
			let apply = classes[className];
			if (typeof apply === 'function') {
				apply = computed(apply);
			}
			if (isSignal(apply)) {
				globalContext.addReactivity(() => {
					if (apply.get()) {
						node.classList.add(className);
					} else {
						node.classList.remove(className);
					}
				});
			} else {
				if (classes[className]) {
					node.classList.add(className);
				} else {
					node.classList.remove(className);
				}
			}
		}
		delete props.classes;
	}

	if (props.dataset !== undefined) {
		const dataset = props.dataset;
		for (const datasetKey in dataset) {
			let ds = dataset[datasetKey];
			if (typeof ds === 'function') {
				ds = computed(ds);
			}
			if (isSignal(ds)) {
				globalContext.addReactivity(() => {
					node.dataset[datasetKey] = ds.get();
				});
			} else {
				node.dataset[datasetKey] = ds;
			}
		}
		delete props.dataset;
	}
}

export function appendChild(node: Element | DocumentFragment, child: ChispaContentReactive) {
	if (child === null) return;
	if (typeof child === 'function') {
		processSignalChild(node, computed(child));
		return;
	}
	if (isSignal(child)) {
		processSignalChild(node, child);
		return;
	}
	if (child instanceof Component || child instanceof ComponentList) {
		child.mount(node, null);
		return;
	}
	if (Array.isArray(child)) {
		child.forEach((ch) => {
			appendChild(node, ch);
		});
		return;
	}
	node.appendChild(child instanceof Node ? child : document.createTextNode(child.toString()));
}

function isStaticArrayWithComponents(arr: ChispaContent): arr is (Component | ChispaNode)[] {
	if (!Array.isArray(arr)) return false;
	for (const item of arr) {
		if (item instanceof Component) {
			return true;
		}
	}
	return false;
}

function processSignalChild(node: Element | DocumentFragment, child: Signal<ChispaContent>) {
	const anchor = document.createTextNode('');
	node.appendChild(anchor);
	let prevValue: Component | ComponentList | null = null;

	globalContext.addReactivity(() => {
		//console.log('Signal child changed', child);
		const ch = child.get();
		if (prevValue) {
			prevValue.unmount();
		}
		if (ch === null) {
			prevValue = null;
			return;
		}

		let component: Component | ComponentList;
		if (isStaticArrayWithComponents(ch)) {
			component = new Component(() => {
				const frag = document.createDocumentFragment();
				for (const c of ch) {
					appendChild(frag, c);
				}
				return frag;
			});
			component.mount(node, anchor);
		} else if (ch instanceof Component || ch instanceof ComponentList) {
			ch.mount(node, anchor);
			component = ch;
		} else {
			const wrCmp = new Component(() => toNode(ch));
			//wrCmp.silent = true;
			wrCmp.mount(node, anchor);
			component = wrCmp;
		}
		prevValue = component;
	});
}

function toNode(n: ChispaNode | ChispaNode[]): Node | null {
	if (Array.isArray(n)) {
		const frag = document.createDocumentFragment();
		const nodes = n.map((c) => toNode(c)).filter((n) => n !== null);
		frag.append(...nodes);
		return frag;
	} else if (n instanceof Node) {
		return n;
	} else if (typeof n === 'string' || typeof n === 'number') {
		return document.createTextNode(n.toString());
	} else {
		return null;
		//throw new Error('Invalid node type');
	}
}
