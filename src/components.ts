import { globalContext, IDisposable } from './context';
import { computed, Signal, WritableSignal } from './signals';

export type Dict = Record<string, any>;
export type ComponentFactory<TProps extends Dict> = (props: TProps) => Node | null;

export class Component<TProps extends Dict = any> {
	public onUnmount: (() => void) | null = null;

	public nodes: Node[] | null = null;

	private container: Node | null = null;

	private anchor: Node | null = null;

	public disposables: IDisposable[] = [];

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

	unmount() {
		if (!this.silent) console.log('Unmounting Component', this);
		if (this.onUnmount) {
			this.onUnmount();
			this.onUnmount = null;
		}
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

type ItemFactoryFn<T, TProps = any> = (item: Signal<T>, index: Signal<number>, list: WritableSignal<T[]>, props?: TProps) => Node;
type KeyFn<T> = (item: T, index: number) => any;

export class ComponentList<TItem = any, TProps extends Dict = any> {
	private readonly components: Map<string, Component<TProps>>;
	private container: Node | null = null; // Contenedor donde se montan los nodos
	private anchor: Node | null = null; // Nodes must be inserted before this node
	private currentKeys: any[] = [];
	public disposables: any[] = [];

	constructor(
		private readonly itemFactoryFn: ItemFactoryFn<TItem, TProps>,
		private readonly keyFn: KeyFn<TItem>,
		private readonly itemsSignal: WritableSignal<TItem[]>,
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
		if (component.key) {
			this.components.delete(component.key);
		}
	}

	/**
	 * Crea un nuevo componente
	 */
	private createNewComponent(key: any): Component {
		const factory = (props?: TProps) => {
			const item = computed(() => this.itemsSignal.get().find((v, index) => this.keyFn(v, index) === key)!);
			const index = computed(() => this.itemsSignal.get().findIndex((v, index) => this.keyFn(v, index) === key));
			return this.itemFactoryFn ? this.itemFactoryFn(item, index, this.itemsSignal, props) : null;
		};

		const component = new Component(factory, key, this.props);
		this.components.set(key, component);

		return component;
	}

	private getTargetAnchor(items: TItem[], index: number): Node | null {
		const nextItem = index + 1 < items.length ? items[index + 1] : null;
		const nextComp = nextItem ? this.components.get(this.keyFn(nextItem, index + 1)) : null;
		if (nextComp && nextComp.nodes) {
			return nextComp.nodes[0];
		} else {
			// Es el último componente, debería insertarse antes del anchor original
			return this.anchor;
		}
	}

	/**
	 * Función principal que sincroniza los componentes DOM con un array de keys
	 */
	private synchronizeComponents(): void {
		const existingComponents = this.getAllComponents();

		// Identificar qué componentes eliminar (los que no están en keys)
		const items = this.itemsSignal.get();
		const keys = items.map((item, index) => this.keyFn(item, index));
		const componentsToRemove = existingComponents.filter((component) => component.key && !keys.includes(component.key));
		componentsToRemove.forEach((component) => this.removeComponent(component));

		this.currentKeys = this.currentKeys.filter((key) => keys.includes(key));
		//console.log('Current keys:', this.currentKeys, 'Target keys:', keys);

		if (!this.container) {
			console.warn('Container is null in synchronizeComponents');
			return;
		}
		// Procesar cada key en el orden deseado
		const container = this.container;

		items.forEach((item, index) => {
			const targetKey = this.keyFn(item, index);
			const currentKey = this.currentKeys[index];
			if (targetKey === currentKey) {
				// La key no ha cambiado de posición, no hacer nada
				return;
			}
			const existingComponent = this.components.get(targetKey);

			if (existingComponent) {
				const prevComp = this.components.get(currentKey);
				if (!prevComp || !prevComp.nodes) {
					console.warn('Previous component or its nodes not found for key', currentKey);
					return;
				}
				existingComponent.reanchor(prevComp.nodes[0]);
				// Reordenar el array de keys actuales
				this.currentKeys = this.currentKeys.filter((k) => k !== targetKey);
				this.currentKeys.splice(index, 0, targetKey);
			} else {
				// El componente no existe, crearlo
				const targetAnchor = this.getTargetAnchor(items, index);
				const newComponent = this.createNewComponent(targetKey);
				newComponent.mount(container, targetAnchor);
				this.currentKeys.splice(index, 0, targetKey);
			}
		});
	}

	mount(container: Node, anchor: Node | null = null) {
		//console.log('Mounting ComponentList');
		this.container = container;
		this.anchor = anchor;

		globalContext.pushComponentStack(this);
		globalContext.addReactivity(() => {
			this.synchronizeComponents();
		});
		globalContext.popComponentStack();
	}

	unmount() {
		//console.log('Unmounting ComponentList');
		this.clear();
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
): (listSignal: WritableSignal<TItem[]>, props?: any) => ComponentList<TItem>;
export function componentList<TItem, TProps extends Dict>(
	itemFactoryFn: ItemFactoryFn<TItem, TProps>,
	keyFn: KeyFn<TItem>
): (listSignal: WritableSignal<TItem[]>, props: TProps) => ComponentList<TItem, TProps>;

export function componentList<TItem, TProps extends Dict = any>(itemFactoryFn: ItemFactoryFn<TItem, TProps>, keyFn: KeyFn<TItem>) {
	return (listSignal: WritableSignal<TItem[]>, props?: TProps) => {
		const list = new ComponentList(itemFactoryFn, keyFn, listSignal, props);
		return list;
	};
}
