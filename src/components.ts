import { ChispaContent } from './builder';
import { globalContext, IDisposable } from './context';
import { computed, Signal, WritableSignal } from './signals';

export type Dict = Record<string, any>;
export type ComponentFactory<TProps extends Dict> = (props: TProps) => ChispaContent;

export class Component<TProps extends Dict = any> {
	public nodes: Node[] | null = null;

	private container: Node | null = null;

	private anchor: Node | null = null;

	private disposables: IDisposable[] = [];

	public silent = true;

	constructor(
		private readonly factoryFn: ComponentFactory<TProps>,
		public readonly key: any = null,
		public readonly props: TProps | null = null
	) {}

	mount(container: Node, anchor: Node | null = null) {
		if (!this.silent) console.log('Mounting Component', this);

		this.container = container;
		this.anchor = anchor;

		// If mounting within another component, register for automatic unmounting
		const parentComponent = globalContext.getCurrentComponent();
		if (parentComponent && parentComponent !== this) {
			parentComponent.addDisposable({
				dispose: () => this.unmount(),
			});
		}

		globalContext.pushExecutionStack('createComponent');
		globalContext.pushComponentStack(this);
		const node = this.factoryFn ? (this.factoryFn as any)(this.props) : null;
		globalContext.popComponentStack();
		globalContext.popExecutionStack();
		// if node is fragment, convert to array of nodes
		if (node) {
			if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
				this.nodes = Array.from(node.childNodes);
			} else {
				this.nodes = [node];
			}
		} else {
			this.nodes = null;
		}
		this.insertNodes();
	}

	reanchor(anchor: Node | null) {
		this.anchor = anchor;

		//console.log('reanchoring', this.nodes, ' before anchor', this.anchor);
		this.insertNodes();
	}

	private insertNodes() {
		if (!this.container || !this.nodes) return;
		// Insertar en la nueva posición
		for (const node of this.nodes) {
			if (this.anchor) {
				this.container.insertBefore(node, this.anchor);
			} else {
				this.container.appendChild(node);
			}
		}
	}

	addDisposable(disposable: IDisposable) {
		this.disposables.push(disposable);
	}

	unmount() {
		if (!this.silent) console.log('Unmounting Component', this);

		if (this.nodes) {
			this.nodes.forEach((node) => {
				if (node && node.parentNode) {
					node.parentNode.removeChild(node);
				}
			});
		}
		this.disposables.forEach((d) => {
			d.dispose();
		});
		this.disposables = [];
		this.nodes = null;
		this.container = null;
		this.anchor = null;
	}
}

// Definimos overloads para component
export function component(factory: ComponentFactory<any>): (props?: any) => Component;
export function component<TProps extends Dict>(factory: ComponentFactory<TProps>): (props: TProps) => Component<TProps>;

export function component<TProps extends Dict = any>(factory: ComponentFactory<TProps>) {
	return (props?: TProps) => {
		return new Component(factory, null, props);
	};
}

export function onUnmount(unmountFn: () => void) {
	const currentComponent = globalContext.getCurrentComponent();
	if (currentComponent) {
		currentComponent.addDisposable({
			dispose: unmountFn,
		});
	} else {
		throw new Error('onUnmount must be called within a component context');
	}
}

type ItemFactoryFn<T, TProps = any> = (item: Signal<T>, index: Signal<number>, list: Signal<T[]>, props: TProps, key: any) => ChispaContent;
type KeyFn<T> = (item: T, index: number) => any;

export class ComponentList<TItem = any, TProps extends Dict = any> {
	private readonly components: Map<string, Component<TProps>>;
	private container: Node | null = null; // Contenedor donde se montan los nodos
	private anchor: Node | null = null; // Nodes must be inserted before this node
	private ownAnchor: Node | null = null; // Anchor created by this list when mounted without one
	public disposables: any[] = [];

	constructor(
		private readonly itemFactoryFn: ItemFactoryFn<TItem, TProps>,
		private readonly keyFn: KeyFn<TItem>,
		private readonly itemsSignal: Signal<TItem[]>,
		private readonly props: TProps | null = null
	) {
		this.components = new Map();
	}

	/**
	 * Obtiene todos los componentes
	 */
	private getAllComponents(): Component[] {
		return Array.from(this.components.values());
	}

	/**
	 * Limpia todos los componentes
	 */
	private clear(): void {
		Array.from(this.components.values()).forEach((component) => {
			this.removeComponent(component);
		});
	}

	/**
	 * Elimina un componente completo
	 */
	private removeComponent(component: Component) {
		component.unmount();
		// Keys can be falsy ('', 0, false), so no truthiness check here
		this.components.delete(component.key);
	}

	/**
	 * Crea un nuevo componente
	 */
	private createNewComponent(key: any): Component {
		const factory = (props: TProps) => {
			const item = computed(() => this.itemsSignal.get().find((v, index) => this.keyFn(v, index) === key)!);
			const index = computed(() => this.itemsSignal.get().findIndex((v, index) => this.keyFn(v, index) === key));
			return this.itemFactoryFn ? this.itemFactoryFn(item, index, this.itemsSignal, props, key) : null;
		};

		const component = new Component(factory, key, this.props);
		this.components.set(key, component);

		return component;
	}

	/**
	 * Función principal que sincroniza los componentes DOM con un array de keys
	 */
	private synchronizeComponents(): void {
		const items = this.itemsSignal.get();
		const keys = items.map((item, index) => this.keyFn(item, index));
		const keySet = new Set(keys);

		// Eliminar los componentes cuya key ya no está en la lista
		const componentsToRemove = this.getAllComponents().filter((component) => !keySet.has(component.key));
		componentsToRemove.forEach((component) => this.removeComponent(component));

		if (!this.container) {
			console.warn('Container is null in synchronizeComponents');
			return;
		}
		const container = this.container;

		// Recorrer los items de atrás hacia adelante manteniendo el anchor de inserción.
		// Tras procesar los items i+1..n, esa región ya está en su orden final empezando
		// justo antes de `anchor`, así que el item i está bien colocado si y solo si su
		// último nodo precede a `anchor`. El propio DOM es la fuente de verdad: no hace
		// falta contabilidad paralela de keys, y los items ya ordenados no se mueven.
		let anchor = this.anchor;
		for (let index = items.length - 1; index >= 0; index--) {
			let component = this.components.get(keys[index]);
			if (!component) {
				component = this.createNewComponent(keys[index]);
				component.mount(container, anchor);
			} else if (component.nodes && component.nodes.length > 0) {
				const lastNode = component.nodes[component.nodes.length - 1];
				if (lastNode.nextSibling !== anchor) {
					component.reanchor(anchor);
				}
			}
			if (component.nodes && component.nodes.length > 0) {
				anchor = component.nodes[0];
			}
		}
	}

	mount(container: Node, anchor: Node | null = null) {
		//console.log('Mounting ComponentList');
		this.container = container;
		if (!anchor) {
			// Without an anchor, items created later would be appended at the end of the
			// container, after any sibling nodes added meanwhile. Create one to keep a
			// stable insertion point.
			anchor = document.createTextNode('');
			container.appendChild(anchor);
			this.ownAnchor = anchor;
		}
		this.anchor = anchor;

		// If mounting within another component, register for automatic unmounting
		const parentComponent = globalContext.getCurrentComponent();
		if (parentComponent && parentComponent !== this) {
			parentComponent.addDisposable({
				dispose: () => this.unmount(),
			});
		}

		globalContext.pushComponentStack(this);
		globalContext.addReactivity(() => {
			this.synchronizeComponents();
		});
		globalContext.popComponentStack();
	}

	addDisposable(disposable: IDisposable) {
		this.disposables.push(disposable);
	}

	unmount() {
		//console.log('Unmounting ComponentList');
		this.clear();
		if (this.ownAnchor && this.ownAnchor.parentNode) {
			this.ownAnchor.parentNode.removeChild(this.ownAnchor);
		}
		this.ownAnchor = null;
		this.container = null!;
		this.anchor = null!;
		this.disposables.forEach((d) => {
			d.dispose();
		});
	}
}

// Definimos overloads para componentList
export function componentList<TItem>(
	itemFactoryFn: ItemFactoryFn<TItem, any>,
	keyFn: KeyFn<TItem>
): (listSignal: Signal<TItem[]>, props?: any) => ComponentList<TItem>;
export function componentList<TItem, TProps extends Dict>(
	itemFactoryFn: ItemFactoryFn<TItem, TProps>,
	keyFn: KeyFn<TItem>
): (listSignal: Signal<TItem[]>, props: TProps) => ComponentList<TItem, TProps>;

export function componentList<TItem, TProps extends Dict = any>(itemFactoryFn: ItemFactoryFn<TItem, TProps>, keyFn: KeyFn<TItem>) {
	return (listSignal: Signal<TItem[]>, props?: TProps) => {
		const list = new ComponentList(itemFactoryFn, keyFn, listSignal, props);
		return list;
	};
}
