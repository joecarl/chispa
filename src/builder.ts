import { Component, ComponentList } from './components';
import { globalContext } from './context';
import { computed, isSignal, type Signal } from './signals';

export type ChispaReactive<T> = T | Signal<T> | (() => T);
export type ChispaNode = string | number | Node | null;
export type ChispaContent = ChispaNode | ChispaNode[] | Component | Component[] | ComponentList;
export type ChispaContentReactive = ChispaReactive<ChispaContent>;
export type ChispaClasses = Record<string, ChispaReactive<boolean>>;
export type ChispaCSSPropertiesStrings = {
	[K in keyof CSSStyleDeclaration]?: ChispaReactive<string>;
};

type AllowSignals<T> = { [K in keyof T]: T[K] | Signal<T[K]> };

type ChispaNodeBuilderBaseProps<T> = AllowSignals<Omit<Partial<T>, 'style' | 'dataset'>>;
interface INodeBuilderSpecialProps {
	addClass?: ChispaReactive<string>;
	classes?: ChispaClasses;
	style?: ChispaCSSPropertiesStrings;
	dataset?: Record<string, ChispaReactive<string>>;
}
interface INodeBuilderAdditionalProps<T, TNodes> {
	nodes?: TNodes;
	inner?: ChispaContentReactive;
	_ref?: (node: T) => void | { current: T | null };
}
export type ChispaNodeBuilderProps<T, TNodes> = ChispaNodeBuilderBaseProps<T> & INodeBuilderAdditionalProps<T, TNodes> & INodeBuilderSpecialProps;
export type ChispaNodeBuilderPropsReactive<T, TNodes> = ChispaReactive<ChispaNodeBuilderProps<T, TNodes>>;

const forbiddenProps = ['nodes', 'inner', '_ref'];

export function getValidProps<T>(props: ChispaNodeBuilderProps<T, any>) {
	const finalProps: any = {};

	for (const propName in props) {
		if (forbiddenProps.indexOf(propName) === -1) {
			finalProps[propName] = props[propName as keyof typeof props];
		}
	}

	if (props._ref !== undefined) {
		//finalProps.ref = props._ref;
	}

	return finalProps as ChispaNodeBuilderProps<T, any>;
}

export function getItem<T>(template: T, items: any, itemName: keyof T) {
	if (!items || !items[itemName]) {
		return null;
	}

	const item = items[itemName];

	if (item.constructor && item.constructor.name === 'Object' && !(item instanceof Element)) {
		const Comp = template[itemName] as (props: any) => Element;
		const itemProps = item;

		return Comp(itemProps);
	} else {
		return item;
	}
}

export function setAttributes(node: Element, attributes: Record<string, string>) {
	for (const attr in attributes) {
		const attrValue = attributes[attr].trim();
		if (!attrValue) continue;
		//console.log('setting attr', attr, attrValue )
		node.setAttribute(attr, attrValue);
	}
}

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
		const propValue = (props as any)[prop];
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
		let prevClass: string | null = null;

		if (typeof addClass === 'function') {
			addClass = computed(addClass);
		}

		if (isSignal(addClass)) {
			globalContext.addReactivity(() => {
				const cls = addClass.get();
				if (cls !== prevClass) {
					if (prevClass) {
						node.classList.remove(prevClass);
					}
					node.classList.add(cls);
				}
				prevClass = cls;
			});
		} else {
			node.classList.add(addClass);
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

function isStaticArrayOfComponents(arr: ChispaContent): arr is Component[] {
	if (!Array.isArray(arr)) return false;
	for (const item of arr) {
		if (!(item instanceof Component)) {
			return false;
		}
	}
	return true;
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
		if (isStaticArrayOfComponents(ch)) {
			throw new Error('Static array of components not supported in signal children. Use ComponentList instead.');
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
