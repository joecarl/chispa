import { component, computed, signal, componentList, Signal } from 'chispa';
import tpl from './demo-table-component.html';

interface IDemoItem {
	id: number;
	nombre: string;
	edad: number;
	ciudad: string;
}

const MyList = componentList<IDemoItem, { citySuffix: Signal<string> }>(
	(item, index, list, props) => {
		return tpl.listRow({
			nodes: {
				id: { inner: item.computed.id },
				name: { inner: item.computed.nombre },
				age: { inner: item.computed.edad },
				city: { inner: () => item.get().ciudad + props.citySuffix.get() },
				editBtn: {
					onclick: () => {
						list.update((v) => {
							const idx = index.get();
							const newList = [...v];
							newList[idx] = { ...newList[idx], nombre: newList[idx].nombre + ' (editado)' };
							return newList;
						});
					},
				},
				moveupBtn: {
					onclick: () => {
						const idx = index.get();
						if (idx > 0) {
							list.update((v) => {
								const newList = [...v];
								[newList[idx - 1], newList[idx]] = [newList[idx], newList[idx - 1]];
								return newList;
							});
						}
					},
				},
				removeBtn: {
					onclick: () => {
						const idx = index.get();
						list.update((v) => v.filter((_, i) => i !== idx));
					},
				},
			},
		});
	},
	(item) => item.id
);

export const DemoTable = component((props) => {
	const showTable = signal(true);
	const citySuffix = signal(' 🌆');

	const list = signal<IDemoItem[]>([
		{ id: 1, nombre: 'Juan 🐟', edad: 25, ciudad: 'Madrid' },
		{ id: 2, nombre: 'Ana 🎶', edad: 30, ciudad: 'Barcelona' },
		{ id: 3, nombre: 'Luis 💻', edad: 28, ciudad: 'Valencia' },
	]);
	let idCounter = 4;

	const hiddenRowsIndicator = tpl.listRow({
		nodes: {
			id: { inner: '-' },
			name: { inner: '*** Filas desmontadas ***', style: { fontStyle: 'italic', color: 'rgb(143 106 48)' } },
			age: { inner: '-' },
			city: { inner: '-' },
		},
	});

	return tpl.fragment({
		listRow: () => (showTable.get() ? MyList(list, { citySuffix }) : hiddenRowsIndicator),
		addBtn: {
			onclick: () => {
				if (showTable.get() === false) {
					alert('Primero debes mostrar la tabla para añadir filas.');
					return;
				}
				list.update((v) => [...v, { id: idCounter++, nombre: 'Nuevo', edad: 0, ciudad: 'Ciudad' }]);
				citySuffix.set(' 🌃');
			},
		},
		toggleBtn: {
			onclick: () => {
				showTable.update((v) => !v);
			},
		},
	});
});
