import { Component, ComponentList } from './components';
import { globalContext } from './context';
import { computed, isSignal, type Signal } from './signals';

export type ChispaClasses = Record<string, boolean>;
export type ChispaNode = string | number | Node | null;
export type ChispaContent = ChispaNode | ChispaNode[] | Component | ComponentList; // | Signal<ChispaNode | ChispaNode[] | Component | ComponentList>;
export type ChispaCSSPropertiesStrings = {
	[K in keyof CSSStyleDeclaration]?: string | Signal<string> | (() => string);
};

type AllowSignals<T> = { [K in keyof T]: T[K] | Signal<T[K]> };

type ChispaNodeBuilderBaseProps<T> = AllowSignals<Omit<Partial<T>, 'style' | 'dataset'>>;
interface INodeBuilderAdditionalProps<T, TNodes> {
	addClass?: string;
	classes?: ChispaClasses;
	nodes?: TNodes;
	inner?: ChispaContent | Signal<ChispaContent> | (() => ChispaContent);
	style?: ChispaCSSPropertiesStrings;
	dataset?: Record<string, string>;
	_ref?: (node: T) => void | { current: T | null };
}
export type ChispaNodeBuilderProps<T, TNodes> = ChispaNodeBuilderBaseProps<T> & INodeBuilderAdditionalProps<T, TNodes>;

function makeclass(classes: ChispaClasses) {
	let finalClasses = [];

	for (const className in classes) {
		if (classes[className]) {
			finalClasses.push(className);
		}
	}

	return finalClasses.join(' ').trim();
}

export function buildClass(literalValue: string, additionalValue?: string, classes?: ChispaClasses) {
	const parts = [];
	if (literalValue) parts.push(literalValue);
	if (additionalValue) parts.push(additionalValue);
	parts.push(makeclass(classes ?? {}));
	return parts.join(' ').trim();
}

const forbiddenProps = ['addClass', 'classes', 'nodes', 'inner', '_ref'];

export function getValidProps(props: any) {
	const finalProps: any = {};

	for (const propName in props) {
		if (forbiddenProps.indexOf(propName) === -1) {
			finalProps[propName] = props[propName];
		}
	}

	if (props._ref !== undefined) {
		//finalProps.ref = props._ref;
	}

	return finalProps;
}

export function getItem<T>(Components: T, items: any, itemName: keyof T) {
	if (!items || !items[itemName]) {
		return null;
	}

	const item = items[itemName];

	if (item.constructor && item.constructor.name === 'Object' && !(item instanceof Element)) {
		const Comp = Components[itemName] as (props: any) => Element;
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

export function setProps<T extends Element>(node: T, props: any) {
	if (node instanceof HTMLElement) {
		if (props.style !== undefined) {
			const style = props.style;
			for (const styleKey in style) {
				if (typeof style[styleKey] === 'function') {
					globalContext.addReactivity(() => {
						node.style[styleKey as any] = style[styleKey]();
					});
				} else if (isSignal(style[styleKey])) {
					globalContext.addReactivity(() => {
						node.style[styleKey as any] = style[styleKey].get();
					});
				} else {
					node.style[styleKey as any] = style[styleKey];
				}
			}
			delete props.style;
		}
		if (props.dataset !== undefined) {
			const dataset = props.dataset;
			for (const datasetKey in dataset) {
				if (isSignal(dataset[datasetKey])) {
					globalContext.addReactivity(() => {
						node.dataset[datasetKey] = dataset[datasetKey].get();
					});
				} else {
					node.dataset[datasetKey] = dataset[datasetKey];
				}
			}
			delete props.dataset;
		}
	}

	for (const prop in props) {
		const propValue = props[prop];
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

export function appendChild(node: Element | DocumentFragment, child: ChispaContent | Signal<ChispaContent>) {
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

function processSignalChild(node: Element | DocumentFragment, child: Signal<ChispaNode | Component<any> | ComponentList<any> | ChispaNode[]>) {
	const anchor = document.createTextNode('');
	node.appendChild(anchor);
	let prevValue: Component | ComponentList = null;

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
		if (ch instanceof Component || ch instanceof ComponentList) {
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

function toNode(n: ChispaNode | ChispaNode[]): Node {
	if (Array.isArray(n)) {
		const frag = document.createDocumentFragment();
		frag.append(...n.map((c) => toNode(c)));
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
